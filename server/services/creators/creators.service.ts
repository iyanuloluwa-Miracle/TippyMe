import Decimal from 'decimal.js';
import {
  AuditLogModel,
  CreatorProfileModel,
  PaymentTransactionModel,
  SocialLinkModel,
  TipModel,
  TipPageViewModel,
  UserModel,
  isUniqueViolation,
  toPlain,
  toPlainList,
  uniqueViolationFields,
  useDb,
  withTransaction,
} from '../../db';
import { insertedId, type LeanDoc } from '../../db/lean';
import type {
  CreatorProfile,
  PaymentStatus,
  PaymentTransaction,
  SocialLink,
  Tip,
  User,
} from '../../db/types';
import { AuditAction, SocialPlatform, TipStatus } from '../../db/enums';
import { ApiError } from '../../lib/errors';
import { getServerEnv } from '../../lib/env';
import { decimalToAmountString } from '../tips/tips.types';
import type {
  CreateCreatorInput,
  CreatorProfileDto,
  ReplaceSocialLinksInput,
  SocialLinkInput,
  UpdateCreatorProfileInput,
  UpdateCreatorSettingsInput,
  UsernameAvailabilityDto,
} from './creators.types';
import { toCreatorProfileDto } from './creators.types';
import {
  toCreatorTipDto,
  toPublicSupporterNoteDto,
  toSupportGoalDto,
  utcMonthBounds,
  utcWeekBounds,
  type CreatorDashboardDto,
  type CreatorTipsPageDto,
  type ListTipsQuery,
  type PublicCreatorPageDto,
  type PublicSupporterNoteDto,
} from './dashboard.types';
import { buildSettlementStatus } from './settlement.types';
import { ConnectService, platformFeePercent } from './connect.service';
import { isDestinationSettled } from './payout-readiness';
import { convertAmount, tryConvertCurrencyTotals, type CurrencyTotal } from './currency-conversion';
import { isAllowedAvatarUrl, normalizeSavedAvatarUrl } from '../../../utils/avatar';
import {
  ALLOWED_CURRENCIES,
  BIO_MAX,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
  MAX_SOCIAL_LINKS,
  MAX_SUGGESTED_TIPS,
  SUPPORT_MESSAGE_MAX,
  normalizeUsername,
  validateUsernameFormat,
  usernameValidationMessage,
  type AllowedCurrency,
} from './username';

const RECENT_TIPS_LIMIT = 8;
const RECENT_MESSAGES_LIMIT = 8;
const PUBLIC_NOTES_LIMIT = 8;

type ProfileWithLinks = CreatorProfile & { socialLinks: SocialLink[] };
type TipWithPaymentStatus = Tip & {
  paymentTransaction: Pick<PaymentTransaction, 'status'> | null;
};

export class CreatorsService {
  async checkUsernameAvailability(
    raw: string,
    opts?: { excludeUserId?: string },
  ): Promise<UsernameAvailabilityDto> {
    await useDb();
    const format = validateUsernameFormat(raw);
    if (!format.ok) {
      return {
        username: normalizeUsername(raw),
        available: false,
        reason: format.reason,
      };
    }

    const existing = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({
        username: format.username,
      }).lean<LeanDoc | null>(),
    );

    if (existing && existing.userId !== opts?.excludeUserId) {
      return {
        username: format.username,
        available: false,
        reason: 'TAKEN',
      };
    }

    return { username: format.username, available: true };
  }

  async getMe(userId: string): Promise<CreatorProfileDto | null> {
    await useDb();
    const profile = await this.findProfileWithLinks({ userId });
    return profile ? toCreatorProfileDto(profile) : null;
  }

  async getPublicByUsername(raw: string): Promise<PublicCreatorPageDto> {
    await useDb();
    const username = normalizeUsername(raw);
    const profile = await this.findProfileWithLinks({ username });

    if (!profile || !profile.isActive) {
      throw new ApiError(404, 'CREATOR_NOT_FOUND', 'Creator not found.');
    }

    // Notes only — weekly tip totals stay private on the creator dashboard.
    const [noteDocs, lifetime] = await Promise.all([
      TipModel.find({
        creatorId: profile.id,
        status: TipStatus.PAID,
        message: { $ne: null },
      })
        .sort({ createdAt: -1 })
        .limit(PUBLIC_NOTES_LIMIT)
        .lean<LeanDoc[]>(),
      this.aggregateTipTotals({
        creatorId: profile.id,
        status: TipStatus.PAID,
      }),
    ]);

    const recentSupporterNotes = toPlainList<Tip>(noteDocs)
      .map((tip) => toPublicSupporterNoteDto(tip))
      .filter(
        (note: PublicSupporterNoteDto | null): note is PublicSupporterNoteDto =>
          note !== null,
      );

    const week = utcWeekBounds();

    const raised = await tryConvertCurrencyTotals(lifetime.byCurrency, profile.currency);
    const sameCurrency = lifetime.byCurrency.find((row) => row.currency === profile.currency);
    const goalRaised = raised ?? sameCurrency?.sum ?? new Decimal(0);

    return {
      profile: toCreatorProfileDto(profile),
      tipsThisWeek: {
        sum: '0.00',
        count: 0,
        currency: profile.currency,
        weekKey: week.weekKey,
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
      },
      supportGoal: (() => {
        const goal = toSupportGoalDto(profile, goalRaised);
        if (goal && raised == null && lifetime.byCurrency.some((row) => row.currency !== profile.currency)) {
          return { ...goal, raisedIncomplete: true };
        }
        return goal;
      })(),
      recentSupporterNotes,
      platformFeePercent: platformFeePercent(),
    };
  }

  async create(
    userId: string,
    dto: CreateCreatorInput,
  ): Promise<CreatorProfileDto> {
    await useDb();
    const existing = await CreatorProfileModel.findOne({ userId })
      .select('_id')
      .lean<LeanDoc | null>();
    if (existing) {
      throw new ApiError(
        409,
        'PROFILE_EXISTS',
        'You already have a creator profile.',
      );
    }

    const avatarUrl = this.requireAvatarUrl(dto.avatarUrl);

    const username = this.requireValidUsername(dto.username);
    const availability = await this.checkUsernameAvailability(username);
    if (!availability.available) {
      throw this.usernameConflict(availability.reason ?? 'TAKEN');
    }

    const linkRows = this.normalizeSocialLinks(dto.socialLinks ?? []);
    const suggestedTipAmounts = this.normalizeTipAmounts(
      dto.suggestedTipAmounts ?? ['1000.00', '2500.00', '5000.00'],
    );

    try {
      const profileId = await withTransaction(async (session) => {
        const [created] = await CreatorProfileModel.create(
          [
            {
              userId,
              username,
              displayName: dto.displayName.trim(),
              bio: dto.bio?.trim() || null,
              avatarUrl,
              supportMessage: dto.supportMessage?.trim() || null,
              currency: (dto.currency ?? 'NGN').toUpperCase(),
              suggestedTipAmounts,
            },
          ],
          { session },
        );
        const id = insertedId(created);

        if (linkRows.length > 0) {
          await SocialLinkModel.insertMany(
            linkRows.map((link) => ({ ...link, creatorId: id })),
            { session },
          );
        }

        return id;
      });

      const profile = await this.findProfileWithLinks({ _id: profileId });
      if (!profile) {
        throw new Error('Creator profile insert did not return a row.');
      }

      await AuditLogModel.create([
        {
          actorUserId: userId,
          action: AuditAction.PROFILE_UPDATED,
          entityType: 'CreatorProfile',
          entityId: profile.id,
          metadata: { event: 'created', username },
        },
      ]);

      return toCreatorProfileDto(profile);
    } catch (err) {
      throw this.mapCreateUniqueViolation(err);
    }
  }

  async updateProfile(
    userId: string,
    dto: UpdateCreatorProfileInput,
  ): Promise<CreatorProfileDto> {
    await useDb();
    const profile = await this.requireOwnedProfile(userId);

    const data: {
      displayName?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      username?: string;
    } = {};

    if (dto.displayName !== undefined) {
      data.displayName = this.requireValidDisplayName(dto.displayName);
    }
    if (dto.bio !== undefined) {
      data.bio = dto.bio === null ? null : this.requireValidBio(dto.bio);
    }
    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = this.requireAvatarUrl(dto.avatarUrl);
    }
    if (dto.username !== undefined) {
      const username = this.requireValidUsername(dto.username);
      const availability = await this.checkUsernameAvailability(username, {
        excludeUserId: userId,
      });
      if (!availability.available) {
        throw this.usernameConflict(availability.reason ?? 'TAKEN');
      }
      data.username = username;
    }

    try {
      await CreatorProfileModel.updateOne(
        { _id: profile.id },
        { $set: { ...data, updatedAt: new Date() } },
      );

      const updated = await this.findProfileWithLinks({ _id: profile.id });
      if (!updated) {
        throw new Error('Creator profile update did not return a row.');
      }

      await AuditLogModel.create([
        {
          actorUserId: userId,
          action: AuditAction.PROFILE_UPDATED,
          entityType: 'CreatorProfile',
          entityId: updated.id,
          metadata: { event: 'profile_update' },
        },
      ]);

      return toCreatorProfileDto(updated);
    } catch (err) {
      throw this.mapCreateUniqueViolation(err);
    }
  }

  async updateSettings(
    userId: string,
    dto: UpdateCreatorSettingsInput,
  ): Promise<CreatorProfileDto> {
    await useDb();
    const profile = await this.requireOwnedProfile(userId);

    const data: {
      supportMessage?: string | null;
      currency?: AllowedCurrency;
      payoutCountry?: string;
      suggestedTipAmounts?: string[];
      goalTitle?: string | null;
      goalTargetAmount?: string | null;
      goalActive?: boolean;
      amountBasis?: CreatorProfile['amountBasis'];
    } = {};
    if (dto.supportMessage !== undefined) {
      data.supportMessage =
        dto.supportMessage === null
          ? null
          : this.requireValidSupportMessage(dto.supportMessage);
    }
    if (dto.currency !== undefined) {
      data.currency = this.requireValidCurrency(dto.currency);
    }
    if (dto.payoutCountry !== undefined) {
      const country = dto.payoutCountry.trim().toUpperCase();
      if (!['NG', 'GH', 'KE', 'ZA'].includes(country)) {
        throw new ApiError(400, 'INVALID_PAYOUT_COUNTRY', 'Choose a supported payout country.');
      }
      const linkedCountry = profile.payoutCountry ?? null;
      if (profile.bachsAccountId && !profile.bachsAccountId.startsWith('acct_stub_') && country !== linkedCountry) {
        throw new ApiError(409, 'PAYOUT_COUNTRY_LOCKED', 'Contact support to change the country of a linked payout account.');
      }
      data.payoutCountry = country;
    }
    if (dto.suggestedTipAmounts !== undefined) {
      data.suggestedTipAmounts = this.normalizeTipAmounts(
        dto.suggestedTipAmounts,
      );
    }
    if (dto.goalTitle !== undefined) {
      data.goalTitle =
        dto.goalTitle === null
          ? null
          : this.requireValidGoalTitle(dto.goalTitle);
    }
    if (dto.goalTargetAmount !== undefined) {
      data.goalTargetAmount =
        dto.goalTargetAmount === null
          ? null
          : this.requireValidGoalAmount(dto.goalTargetAmount).toFixed(2);
    }
    if (dto.goalActive !== undefined) {
      data.goalActive = Boolean(dto.goalActive);
    }

    // Convert from the original amounts so NGN -> USD -> NGN does not compound rounding.
    const basis = profile.amountBasis ?? {
      currency: profile.currency,
      suggestedTipAmounts: profile.suggestedTipAmounts,
      goalTargetAmount: profile.goalTargetAmount,
    };
    if (data.currency && data.currency !== profile.currency) {
      const previousAmounts = profile.suggestedTipAmounts ?? [];
      const submittedAmounts = data.suggestedTipAmounts ?? previousAmounts;
      const amountsUnchanged = submittedAmounts.length === previousAmounts.length &&
        submittedAmounts.every((amount, index) => amount === previousAmounts[index]);
      const previousGoal = profile.goalTargetAmount;
      const goalUnchanged = data.goalTargetAmount === undefined || data.goalTargetAmount === previousGoal;
      if (amountsUnchanged) {
        data.suggestedTipAmounts = await Promise.all((basis.suggestedTipAmounts ?? []).map((amount) =>
          convertAmount(amount, basis.currency, data.currency!),
        ));
      }
      if (basis.goalTargetAmount && goalUnchanged) {
        data.goalTargetAmount = await convertAmount(basis.goalTargetAmount, basis.currency, data.currency);
      }
      data.amountBasis = amountsUnchanged && goalUnchanged
        ? basis
        : {
            currency: data.currency,
            suggestedTipAmounts: data.suggestedTipAmounts ?? basis.suggestedTipAmounts,
            goalTargetAmount: data.goalTargetAmount ?? basis.goalTargetAmount,
          };
    } else if (data.suggestedTipAmounts || data.goalTargetAmount !== undefined) {
      data.amountBasis = {
        currency: profile.currency,
        suggestedTipAmounts: data.suggestedTipAmounts ?? basis.suggestedTipAmounts,
        goalTargetAmount: data.goalTargetAmount !== undefined
          ? data.goalTargetAmount
          : basis.goalTargetAmount,
      };
    }

    await CreatorProfileModel.updateOne(
      { _id: profile.id },
      { $set: { ...data, updatedAt: new Date() } },
    );

    const updated = await this.findProfileWithLinks({ _id: profile.id });
    if (!updated) {
      throw new Error('Creator profile update did not return a row.');
    }

    await AuditLogModel.create([
      {
        actorUserId: userId,
        action: AuditAction.PROFILE_UPDATED,
        entityType: 'CreatorProfile',
        entityId: updated.id,
        metadata: { event: 'settings_update' },
      },
    ]);

    return toCreatorProfileDto(updated);
  }

  async replaceSocialLinks(
    userId: string,
    dto: ReplaceSocialLinksInput,
  ): Promise<CreatorProfileDto> {
    await useDb();
    const profile = await this.requireOwnedProfile(userId);
    const linkRows = this.normalizeSocialLinks(dto.links);

    await withTransaction(async (session) => {
      await SocialLinkModel.deleteMany({ creatorId: profile.id }, { session });
      if (linkRows.length > 0) {
        await SocialLinkModel.insertMany(
          linkRows.map((link) => ({ ...link, creatorId: profile.id })),
          { session },
        );
      }
    });

    const updated = await this.findProfileWithLinks({ _id: profile.id });
    if (!updated) {
      throw new Error('Creator profile not found after social link replace.');
    }

    await AuditLogModel.create([
      {
        actorUserId: userId,
        action: AuditAction.PROFILE_UPDATED,
        entityType: 'CreatorProfile',
        entityId: updated.id,
        metadata: { event: 'social_links_replaced', count: linkRows.length },
      },
    ]);

    return toCreatorProfileDto(updated);
  }

  /**
   * Creator dashboard aggregates + recent activity.
   * Scoped exclusively to the session user's owned profile (IDOR-safe).
   * Successful totals count TipStatus.PAID only.
   */
  async getDashboard(userId: string): Promise<CreatorDashboardDto> {
    await useDb();
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({ userId }).lean<LeanDoc | null>(),
    );
    if (!profile) {
      throw new ApiError(
        404,
        'PROFILE_NOT_FOUND',
        'Create a creator profile first.',
      );
    }

    const creatorId = profile.id;
    const { start, end, periodKey, periodLabel } = utcMonthBounds();
    const week = utcWeekBounds();
    const appUrl = (getServerEnv().APP_URL ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );

    const paidFilter = { creatorId, status: TipStatus.PAID };

    const [
      lifetime,
      period,
      recentTipDocs,
      recentMessageDocs,
      lifetimeViewCount,
      weekViewCount,
    ] = await Promise.all([
      this.aggregateTipTotals(paidFilter),
      this.aggregateTipTotals({
        ...paidFilter,
        createdAt: { $gte: start, $lt: end },
      }),
      TipModel.find({ creatorId })
        .sort({ createdAt: -1 })
        .limit(RECENT_TIPS_LIMIT)
        .lean<LeanDoc[]>(),
      TipModel.find({
        creatorId,
        status: TipStatus.PAID,
        message: { $ne: null },
      })
        .sort({ createdAt: -1 })
        .limit(RECENT_MESSAGES_LIMIT)
        .lean<LeanDoc[]>(),
      TipPageViewModel.countDocuments({ creatorId }),
      TipPageViewModel.countDocuments({
        creatorId,
        createdAt: { $gte: week.start, $lt: week.end },
      }),
    ]);

    const [recentTips, recentMessages, split, payoutsReady, lifetimeSum, periodSum] = await Promise.all([
      this.attachPaymentStatus(toPlainList<Tip>(recentTipDocs)),
      this.attachPaymentStatus(toPlainList<Tip>(recentMessageDocs)),
      this.splitPaidSettlement(creatorId),
      new ConnectService().refreshPayoutReadiness(profile),
      tryConvertCurrencyTotals(lifetime.byCurrency, profile.currency),
      tryConvertCurrencyTotals(period.byCurrency, profile.currency),
    ]);

    const needsConversion = lifetime.byCurrency.some((row) => row.currency !== profile.currency);
    const successfulTipCount = lifetime.count;
    const conversionRate =
      lifetimeViewCount > 0
        ? Math.min(1, successfulTipCount / lifetimeViewCount)
        : null;
    const goalRaised = lifetimeSum ?? new Decimal(0);

    return {
      currency: profile.currency,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      publicPath: `/${profile.username}`,
      publicUrl: `${appUrl}/${profile.username}`,
      totals: {
        successfulSupport: lifetimeSum == null ? null : decimalToAmountString(lifetimeSum),
        converted: needsConversion && lifetimeSum != null,
        successfulTipCount,
        periodSupport: periodSum == null ? null : decimalToAmountString(periodSum),
        periodTipCount: period.count,
        periodKey,
        periodLabel,
        byCurrency: toCurrencyAmounts(lifetime.byCurrency),
        settledByCurrency: split.settled,
        heldByCurrency: split.held,
      },
      linkViews: {
        lifetime: lifetimeViewCount,
        thisWeek: weekViewCount,
      },
      conversion: {
        viewsToTipsRate: conversionRate,
        /** Percentage 0–100 for UI, null when no views. */
        viewsToTipsPercent:
          conversionRate == null
            ? null
            : Math.round(conversionRate * 1000) / 10,
      },
      supportGoal: (() => {
        const goal = toSupportGoalDto(profile, goalRaised);
        if (goal && lifetimeSum == null) return { ...goal, raisedIncomplete: true };
        return goal;
      })(),
      recentTips: recentTips.map(toCreatorTipDto),
      recentMessages: recentMessages
        .filter((t) => Boolean(t.message?.trim()))
        .map(toCreatorTipDto),
      settlement: buildSettlementStatus({
        bachsAccountId: profile.bachsAccountId,
        fridayPayoutEnabled: profile.fridayPayoutEnabled,
        payoutsReady,
      }),
      platformFeePercent: platformFeePercent(),
    };
  }

  /**
   * Record an anonymous public tip-page view for dashboard link-view counts.
   * Does not store IP, user-agent, or other visitor identifiers.
   */
  async recordTipPageView(raw: string): Promise<{ recorded: true }> {
    await useDb();
    const username = normalizeUsername(raw);
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({ username }).lean<LeanDoc | null>(),
    );

    if (!profile || !profile.isActive) {
      throw new ApiError(404, 'CREATOR_NOT_FOUND', 'Creator not found.');
    }

    await TipPageViewModel.create([{ creatorId: profile.id }]);

    return { recorded: true };
  }

  /**
   * Paginated tip list for the authenticated creator.
   * Always filters by owned creatorId — never trusts client creator/tip ids.
   */
  async listMyTips(
    userId: string,
    query: ListTipsQuery,
  ): Promise<CreatorTipsPageDto> {
    await useDb();
    const profile = await this.requireOwnedProfile(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filter = this.buildTipListFilter(profile.id, query);

    const [total, tipDocs] = await Promise.all([
      TipModel.countDocuments(filter),
      TipModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<LeanDoc[]>(),
    ]);

    const tipRows = await this.attachPaymentStatus(toPlainList<Tip>(tipDocs));

    return {
      tips: tipRows.map(toCreatorTipDto),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private buildTipListFilter(
    creatorId: string,
    query: ListTipsQuery,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = { creatorId };

    if (query.status) {
      filter.status = query.status;
    }

    const createdAt: Record<string, Date> = {};
    if (query.from) {
      createdAt.$gte = new Date(query.from);
    }
    if (query.to) {
      const to = new Date(query.to);
      // If date-only (YYYY-MM-DD), include the full end day in UTC.
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
        to.setUTCHours(23, 59, 59, 999);
      }
      createdAt.$lte = to;
    }
    if (Object.keys(createdAt).length > 0) {
      filter.createdAt = createdAt;
    }

    // Amounts are stored as decimal strings, so compare them numerically
    // rather than lexicographically.
    const amountBounds: Record<string, unknown>[] = [];
    if (query.minAmount) {
      amountBounds.push({
        $expr: {
          $gte: [{ $toDecimal: '$amount' }, { $toDecimal: query.minAmount }],
        },
      });
    }
    if (query.maxAmount) {
      amountBounds.push({
        $expr: {
          $lte: [{ $toDecimal: '$amount' }, { $toDecimal: query.maxAmount }],
        },
      });
    }
    if (amountBounds.length > 0) {
      filter.$and = amountBounds;
    }

    return filter;
  }

  /**
   * Ensures the authenticated user owns this creator id.
   * Never trust a client-supplied userId for ownership.
   */
  async assertOwnsCreator(userId: string, creatorId: string): Promise<void> {
    await useDb();
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({
        _id: creatorId,
      }).lean<LeanDoc | null>(),
    );
    if (!profile) {
      throw new ApiError(404, 'CREATOR_NOT_FOUND', 'Creator not found.');
    }
    if (profile.userId !== userId) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'You do not have access to this creator profile.',
      );
    }
  }

  /** Split verified PAID tips into destination-settled vs platform-held. */
  private async splitPaidSettlement(creatorId: string): Promise<{
    settled: { currency: string; amount: string; count: number }[];
    held: { currency: string; amount: string; count: number }[];
  }> {
    const tips = await TipModel.find({ creatorId, status: TipStatus.PAID })
      .select('amount currency paymentTransactionId')
      .lean<LeanDoc[]>();
    const paymentIds = tips
      .map((tip) => tip.paymentTransactionId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const payments = paymentIds.length
      ? await PaymentTransactionModel.find({ _id: { $in: paymentIds } })
          .select('metadata')
          .lean<LeanDoc[]>()
      : [];
    const settledIds = new Set(
      payments
        .filter((payment) =>
          isDestinationSettled(payment.metadata as Record<string, unknown> | null),
        )
        .map((payment) => String(payment._id)),
    );

    const buckets = {
      settled: new Map<string, { sum: Decimal; count: number }>(),
      held: new Map<string, { sum: Decimal; count: number }>(),
    };
    for (const tip of tips) {
      const currency = String(tip.currency);
      const amount = new Decimal(String(tip.amount));
      const key =
        typeof tip.paymentTransactionId === 'string' &&
        settledIds.has(tip.paymentTransactionId)
          ? 'settled'
          : 'held';
      const current = buckets[key].get(currency) ?? { sum: new Decimal(0), count: 0 };
      current.sum = current.sum.plus(amount);
      current.count += 1;
      buckets[key].set(currency, current);
    }

    const toList = (map: Map<string, { sum: Decimal; count: number }>) =>
      [...map.entries()].map(([currency, value]) => ({
        currency,
        amount: value.sum.toFixed(2),
        count: value.count,
      }));

    return { settled: toList(buckets.settled), held: toList(buckets.held) };
  }

  /** PAID-tip sum and count for a tip filter, mirroring the old SQL aggregates. */
  private async aggregateTipTotals(
    match: Record<string, unknown>,
  ): Promise<{ byCurrency: CurrencyTotal[]; count: number }> {
    const rows = await TipModel.aggregate<{ _id: string; total: unknown; n: number }>([
      { $match: match },
      {
        $group: {
          _id: '$currency',
          total: { $sum: { $toDecimal: '$amount' } },
          n: { $sum: 1 },
        },
      },
    ]);

    const byCurrency = rows.map((row) => ({
      currency: row._id,
      sum: new Decimal(String(row.total)),
      count: row.n,
    }));
    return {
      byCurrency,
      count: byCurrency.reduce((count, row) => count + row.count, 0),
    };
  }

  private async attachPaymentStatus(
    tipList: Tip[],
  ): Promise<TipWithPaymentStatus[]> {
    const paymentIds = tipList
      .map((tip) => tip.paymentTransactionId)
      .filter((id): id is string => Boolean(id));

    const statusById = new Map<string, PaymentStatus>();
    if (paymentIds.length > 0) {
      const payments = await PaymentTransactionModel.find({
        _id: { $in: paymentIds },
      })
        .select('status')
        .lean<LeanDoc[]>();
      for (const payment of payments) {
        statusById.set(String(payment._id), payment.status as PaymentStatus);
      }
    }

    return tipList.map((tip) => {
      const status = tip.paymentTransactionId
        ? statusById.get(tip.paymentTransactionId)
        : undefined;
      return {
        ...tip,
        paymentTransaction: status ? { status } : null,
      };
    });
  }

  private async findProfileWithLinks(
    filter: Record<string, unknown>,
  ): Promise<ProfileWithLinks | null> {
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne(filter).lean<LeanDoc | null>(),
    );
    if (!profile) return null;

    const socialLinks = toPlainList<SocialLink>(
      await SocialLinkModel.find({ creatorId: profile.id })
        .sort({ sortOrder: 1 })
        .lean<LeanDoc[]>(),
    );

    return { ...profile, socialLinks };
  }

  private async requireOwnedProfile(userId: string): Promise<CreatorProfile> {
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({ userId }).lean<LeanDoc | null>(),
    );
    if (!profile) {
      throw new ApiError(
        404,
        'PROFILE_NOT_FOUND',
        'Create a creator profile first.',
      );
    }
    return profile;
  }

  private requireAvatarUrl(raw: string | null | undefined): string {
    const avatarUrl = normalizeSavedAvatarUrl(raw?.trim() ?? '');
    if (!avatarUrl || !isAllowedAvatarUrl(avatarUrl)) {
      throw new ApiError(
        400,
        'AVATAR_REQUIRED',
        'Choose an avatar or upload a photo before continuing.',
      );
    }
    return avatarUrl;
  }

  private requireValidDisplayName(raw: string): string {
    const displayName = raw.trim();
    if (
      displayName.length < DISPLAY_NAME_MIN ||
      displayName.length > DISPLAY_NAME_MAX
    ) {
      throw new ApiError(
        400,
        'INVALID_DISPLAY_NAME',
        `Display name must be between ${DISPLAY_NAME_MIN} and ${DISPLAY_NAME_MAX} characters.`,
      );
    }
    return displayName;
  }

  private requireValidBio(raw: string): string | null {
    const bio = raw.trim();
    if (!bio) return null;
    if (bio.length > BIO_MAX) {
      throw new ApiError(
        400,
        'INVALID_BIO',
        `Bio must be at most ${BIO_MAX} characters.`,
      );
    }
    return bio;
  }

  private requireValidSupportMessage(raw: string): string | null {
    const message = raw.trim();
    if (!message) return null;
    if (message.length > SUPPORT_MESSAGE_MAX) {
      throw new ApiError(
        400,
        'INVALID_SUPPORT_MESSAGE',
        `Support message must be at most ${SUPPORT_MESSAGE_MAX} characters.`,
      );
    }
    return message;
  }

  private requireValidGoalTitle(raw: string): string | null {
    const title = raw.trim();
    if (!title) return null;
    if (title.length > 80) {
      throw new ApiError(
        400,
        'INVALID_GOAL_TITLE',
        'Goal title must be at most 80 characters.',
      );
    }
    return title;
  }

  private requireValidGoalAmount(raw: string): Decimal {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 100) {
      throw new ApiError(
        400,
        'INVALID_GOAL_AMOUNT',
        'Goal target must be at least 100.00.',
      );
    }
    if (n > 100_000_000) {
      throw new ApiError(
        400,
        'INVALID_GOAL_AMOUNT',
        'Goal target is too large.',
      );
    }
    return new Decimal(n.toFixed(2));
  }

  private requireValidCurrency(raw: string): AllowedCurrency {
    const currency = raw.trim().toUpperCase();
    if (!(ALLOWED_CURRENCIES as readonly string[]).includes(currency)) {
      throw new ApiError(
        400,
        'INVALID_CURRENCY',
        `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}.`,
      );
    }
    return currency as AllowedCurrency;
  }

  private requireValidUsername(raw: string): string {
    const format = validateUsernameFormat(raw);
    if (!format.ok) {
      throw new ApiError(
        400,
        format.reason,
        usernameValidationMessage(format.reason),
      );
    }
    return format.username;
  }

  private usernameConflict(reason: string): ApiError {
    if (reason === 'RESERVED') {
      return new ApiError(
        400,
        'RESERVED',
        usernameValidationMessage('RESERVED'),
      );
    }
    if (
      reason === 'INVALID_FORMAT' ||
      reason === 'TOO_SHORT' ||
      reason === 'TOO_LONG'
    ) {
      return new ApiError(400, reason, usernameValidationMessage(reason));
    }
    return new ApiError(409, 'USERNAME_TAKEN', 'That username is already taken.');
  }

  /** Map Mongo E11000 to the right API error — never blame username for other keys. */
  private mapCreateUniqueViolation(err: unknown): never {
    if (!isUniqueViolation(err)) {
      throw err;
    }
    const fields = uniqueViolationFields(err);
    if (fields.includes('userId')) {
      throw new ApiError(
        409,
        'PROFILE_EXISTS',
        'You already have a creator profile.',
      );
    }
    if (fields.includes('username') || fields.length === 0) {
      throw new ApiError(
        409,
        'USERNAME_TAKEN',
        'That username was just taken. Please choose another.',
      );
    }
    throw new ApiError(
      409,
      'CONFLICT',
      'That update conflicts with existing data. Please try again.',
    );
  }

  private normalizeTipAmounts(amounts: string[]): string[] {
    if (amounts.length > MAX_SUGGESTED_TIPS) {
      throw new ApiError(
        400,
        'TOO_MANY_TIP_AMOUNTS',
        `You can suggest at most ${MAX_SUGGESTED_TIPS} tip amounts.`,
      );
    }
    const normalized = amounts.map((a) => {
      const n = Number(a);
      if (!Number.isFinite(n) || n <= 0) {
        throw new ApiError(
          400,
          'INVALID_TIP_AMOUNT',
          'Suggested tip amounts must be positive numbers.',
        );
      }
      return n.toFixed(2);
    });
    return [...new Set(normalized)];
  }

  private normalizeSocialLinks(links: SocialLinkInput[]) {
    if (links.length > MAX_SOCIAL_LINKS) {
      throw new ApiError(
        400,
        'TOO_MANY_SOCIAL_LINKS',
        `You can add at most ${MAX_SOCIAL_LINKS} social links.`,
      );
    }
    const seen = new Set<string>();
    return links.map((link, index) => {
      const url = link.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        throw new ApiError(
          400,
          'INVALID_SOCIAL_URL',
          'Social links must be http(s) URLs.',
        );
      }
      if (
        !Object.values(SocialPlatform).includes(
          link.platform as (typeof SocialPlatform)[keyof typeof SocialPlatform],
        )
      ) {
        throw new ApiError(
          400,
          'INVALID_SOCIAL_PLATFORM',
          'Unsupported social platform.',
        );
      }
      const key = `${link.platform}:${url.toLowerCase()}`;
      if (seen.has(key)) {
        throw new ApiError(
          400,
          'DUPLICATE_SOCIAL_LINK',
          'Duplicate social links are not allowed.',
        );
      }
      seen.add(key);
      return {
        platform: link.platform,
        url,
        label: link.label?.trim() || null,
        sortOrder: link.sortOrder ?? index,
      };
    });
  }

  async setPageActive(userId: string, active: boolean): Promise<CreatorProfileDto> {
    await useDb();
    const profile = await this.requireOwnedProfile(userId);
    const user = toPlain<User>(
      await UserModel.findOne({ _id: userId }).select('closedAt').lean<LeanDoc | null>(),
    );
    if (user?.closedAt) {
      throw new ApiError(403, 'ACCOUNT_CLOSED', 'This account is closed.');
    }
    await CreatorProfileModel.updateOne(
      { _id: profile.id },
      { $set: { isActive: active, updatedAt: new Date() } },
    );
    const updated = await this.findProfileWithLinks({ _id: profile.id });
    if (!updated) throw new Error('Creator profile update did not return a row.');
    return toCreatorProfileDto(updated);
  }

  async exportTipsCsv(userId: string): Promise<string> {
    await useDb();
    const profile = await this.requireOwnedProfile(userId);
    const tips = toPlainList<Tip>(
      await TipModel.find({ creatorId: profile.id }).sort({ createdAt: -1 }).lean<LeanDoc[]>(),
    );
    const header = ['createdAt', 'status', 'amount', 'currency', 'anonymous', 'supporterName', 'message'];
    const lines = tips.map((tip) => [
      tip.createdAt.toISOString(),
      tip.status,
      tip.amount,
      tip.currency,
      tip.isAnonymous ? 'yes' : 'no',
      tip.isAnonymous ? '' : (tip.supporterName ?? ''),
      tip.message ?? '',
    ].map(csvCell).join(','));
    return [header.join(','), ...lines].join('\n');
  }

  async closeAccount(userId: string): Promise<void> {
    await useDb();
    const profile = await this.requireOwnedProfile(userId);
    const now = new Date();
    await withTransaction(async (session) => {
      await CreatorProfileModel.updateOne(
        { _id: profile.id },
        { $set: { isActive: false, updatedAt: now } },
        { session },
      );
      await UserModel.updateOne(
        { _id: userId },
        { $set: { closedAt: now, sessionRevokedAt: now, updatedAt: now } },
        { session },
      );
      await AuditLogModel.create(
        [{
          actorUserId: userId,
          action: AuditAction.PROFILE_UPDATED,
          entityType: 'User',
          entityId: userId,
          metadata: { event: 'account_closed' },
        }],
        { session },
      );
    });
  }
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCurrencyAmounts(rows: CurrencyTotal[]) {
  return rows.map((row) => ({
    currency: row.currency,
    amount: row.sum.toFixed(2),
    count: row.count,
  }));
}
