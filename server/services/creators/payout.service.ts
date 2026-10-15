import Decimal from 'decimal.js';
import { ApiError } from '../../lib/errors';
import { openSecret, sealSecret } from '../../lib/secret-box';
import {
  AuditLogModel,
  CreatorPayoutMethodModel,
  CreatorProfileModel,
  PayoutRequestModel,
  TipModel,
  isUniqueViolation,
  toPlain,
  toPlainList,
  useDb,
} from '../../db';
import type { LeanDoc } from '../../db/lean';
import {
  AuditAction,
  PayoutMethodStatus,
  PayoutRequestStatus,
  TipStatus,
} from '../../db/enums';
import type {
  CreatorPayoutMethod,
  CreatorProfile,
  PayoutRequest,
} from '../../db/types';
import { BachsHttpClient } from '../payments/bachs/bachs-http.client';
import { BachsProviderError } from '../payments/bachs/bachs.errors';
import {
  computeCreatorNet,
  platformFeePercent,
} from './platform-fee';
import {
  buildSettlementStatus,
  type CreatorSettlementStatusDto,
} from './settlement.types';

const MIN_PAYOUT_NGN = new Decimal('1000.00');

/** Fallback NGN banks when Bachs list-banks is unavailable. */
const NGN_BANKS_FALLBACK: { code: string; name: string }[] = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank' },
  { code: '058', name: 'Guaranty Trust Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'Suntrust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank For Africa' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  // Codes from Bachs GET /v1/reference/banks?country=NG (not Paystack placeholders).
  { code: '305', name: 'Opay (Paycom)' },
  { code: '100033', name: 'PALMPAY' },
  { code: '50211', name: 'Kuda Micro-finance Bank' },
];

export interface PayoutBankOption {
  code: string;
  name: string;
}

export interface MaskedPayoutMethodDto {
  bankCode: string;
  bankName: string | null;
  accountNumberLast4: string;
  accountName: string | null;
  payoutCurrency: string;
  status: CreatorPayoutMethod['status'];
  ready: boolean;
}

export interface PayoutRequestDto {
  id: string;
  amount: string;
  currency: string;
  status: PayoutRequest['status'];
  createdAt: string;
  failureReason: string | null;
}

export interface CreatorPayoutOverviewDto {
  settlement: CreatorSettlementStatusDto;
  method: MaskedPayoutMethodDto | null;
  availableBalance: string;
  currency: string;
  platformFeePercent: number;
  minPayoutAmount: string;
  recentRequests: PayoutRequestDto[];
}

export class PayoutService {
  constructor(private readonly http = new BachsHttpClient()) {}

  async listBanks(): Promise<PayoutBankOption[]> {
    if (this.http.isConfigured) {
      try {
        const banks = await this.http.listBanks({
          country: 'NG',
        });
        const mapped = banks
          .map((b) => ({
            code: String(b.code || b.bank_code || '').trim(),
            name: String(b.name || b.bank_name || '').trim(),
          }))
          .filter((b) => b.code && b.name);
        if (mapped.length) {
          mapped.sort((a, b) => a.name.localeCompare(b.name));
          return mapped;
        }
      } catch (err) {
        console.warn(
          `Bachs list banks failed: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }
    return [...NGN_BANKS_FALLBACK].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getOverview(userId: string): Promise<CreatorPayoutOverviewDto> {
    await useDb();
    const profile = await this.requireProfile(userId);
    const method = toPlain<CreatorPayoutMethod>(
      await CreatorPayoutMethodModel.findOne({ creatorId: profile.id }).lean<
        LeanDoc | null
      >(),
    );
    const [availableBalance, recent] = await Promise.all([
      this.computeAvailableBalance(profile),
      PayoutRequestModel.find({ creatorId: profile.id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean<LeanDoc[]>(),
    ]);

    return {
      settlement: buildSettlementStatus({
        methodStatus: method?.status ?? null,
        hasMethod: Boolean(method),
      }),
      method: method ? this.toMaskedMethod(method) : null,
      availableBalance,
      currency: profile.currency,
      platformFeePercent: platformFeePercent(),
      minPayoutAmount: MIN_PAYOUT_NGN.toFixed(2),
      recentRequests: toPlainList<PayoutRequest>(recent).map((row) => ({
        id: row.id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        failureReason: row.failureReason,
      })),
    };
  }

  async saveMethod(
    userId: string,
    input: { bankCode: string; accountNumber: string; bankName?: string },
  ): Promise<CreatorPayoutOverviewDto> {
    await useDb();
    const profile = await this.requireProfile(userId);
    if (profile.currency.toUpperCase() !== 'NGN') {
      throw new ApiError(
        400,
        'PAYOUT_CURRENCY_UNSUPPORTED',
        'Set your preferred currency to NGN in profile settings before saving a Nigerian bank account.',
      );
    }
    const bankCode = input.bankCode.trim();
    const accountNumber = input.accountNumber.replace(/\s+/g, '');
    if (!/^\d{3,20}$/.test(bankCode)) {
      throw new ApiError(400, 'INVALID_BANK_CODE', 'Choose a valid bank.');
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new ApiError(
        400,
        'INVALID_ACCOUNT_NUMBER',
        'Enter a valid 10-digit NGN account number.',
      );
    }

    let accountName: string | null = null;
    if (this.http.isConfigured) {
      try {
        const resolved = await this.http.resolveBankAccount({
          bank_code: bankCode,
          account_number: accountNumber,
          country: 'NG',
        });
        if (resolved.resolved === false) {
          throw new ApiError(
            400,
            'ACCOUNT_UNRESOLVED',
            resolved.message?.trim() ||
              'That account number could not be verified for the selected bank. Check the bank and number, then try again.',
          );
        }
        accountName = resolved.account_name?.trim() || null;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        // Resolve failed at the network/API layer; destination create may still succeed.
        console.warn(
          `Bachs resolve bank account failed: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    const bankName =
      input.bankName?.trim() ||
      NGN_BANKS_FALLBACK.find((b) => b.code === bankCode)?.name ||
      null;
    const encrypted = sealSecret(accountNumber);
    const last4 = accountNumber.slice(-4);

    let method = toPlain<CreatorPayoutMethod>(
      await CreatorPayoutMethodModel.findOne({ creatorId: profile.id }).lean<
        LeanDoc | null
      >(),
    );

    const baseSet: {
      bankCode: string;
      bankName: string | null;
      accountNumberEncrypted: string;
      accountNumberLast4: string;
      accountName: string | null;
      payoutCurrency: string;
      status: CreatorPayoutMethod['status'];
      lastError: string | null;
      updatedAt: Date;
    } = {
      bankCode,
      bankName,
      accountNumberEncrypted: encrypted,
      accountNumberLast4: last4,
      accountName,
      payoutCurrency: 'NGN',
      status: PayoutMethodStatus.PENDING_DESTINATION,
      lastError: null,
      updatedAt: new Date(),
    };

    if (!method) {
      try {
        const created = await CreatorPayoutMethodModel.create({
          creatorId: profile.id,
          ...baseSet,
          bachsDestinationId: null,
          createdAt: new Date(),
        });
        // Re-read lean so `toPlain` gets `_id` (toObject transform strips it).
        method = toPlain<CreatorPayoutMethod>(
          await CreatorPayoutMethodModel.findById(created._id).lean<LeanDoc | null>(),
        );
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        method = toPlain<CreatorPayoutMethod>(
          await CreatorPayoutMethodModel.findOne({ creatorId: profile.id }).lean<
            LeanDoc | null
          >(),
        );
      }
    }

    if (!method) {
      throw new ApiError(500, 'PAYOUT_METHOD_FAILED', 'Could not save bank details.');
    }

    await CreatorPayoutMethodModel.updateOne(
      { _id: method.id },
      { $set: baseSet },
    );
    method = {
      ...method,
      ...baseSet,
    };

    method = await this.registerDestination(profile, method);

    await AuditLogModel.create([
      {
        actorUserId: userId,
        action: AuditAction.PROFILE_UPDATED,
        entityType: 'CreatorPayoutMethod',
        entityId: method.id,
        metadata: {
          event: 'payout_method_saved',
          bankCode,
          last4,
          status: method.status,
        },
      },
    ]);

    return this.getOverview(userId);
  }

  async requestPayout(
    userId: string,
    input?: { amount?: string },
  ): Promise<CreatorPayoutOverviewDto> {
    await useDb();
    const profile = await this.requireProfile(userId);
    const method = toPlain<CreatorPayoutMethod>(
      await CreatorPayoutMethodModel.findOne({ creatorId: profile.id }).lean<
        LeanDoc | null
      >(),
    );
    if (!method || method.status !== PayoutMethodStatus.READY || !method.bachsDestinationId) {
      throw new ApiError(
        400,
        'PAYOUT_METHOD_REQUIRED',
        'Save a verified bank account before requesting a payout.',
      );
    }
    if (profile.currency.toUpperCase() !== 'NGN') {
      throw new ApiError(
        400,
        'PAYOUT_CURRENCY_UNSUPPORTED',
        'Bank payouts currently support NGN collection currency only.',
      );
    }

    const available = new Decimal(await this.computeAvailableBalance(profile));
    const requested = input?.amount?.trim()
      ? new Decimal(input.amount.trim())
      : available;

    if (!requested.isFinite() || requested.lte(0)) {
      throw new ApiError(400, 'INVALID_PAYOUT_AMOUNT', 'Enter a valid payout amount.');
    }
    if (requested.lt(MIN_PAYOUT_NGN)) {
      throw new ApiError(
        400,
        'PAYOUT_BELOW_MINIMUM',
        `Minimum payout is ₦${MIN_PAYOUT_NGN.toFixed(2)}.`,
      );
    }
    if (requested.gt(available)) {
      throw new ApiError(
        400,
        'INSUFFICIENT_BALANCE',
        'That amount is more than your available balance.',
      );
    }

    const amount = requested.toFixed(2);
    const feePct = platformFeePercent();
    const created = await PayoutRequestModel.create({
      creatorId: profile.id,
      payoutMethodId: method.id,
      amount,
      currency: 'NGN',
      platformFeePercent: feePct,
      status: PayoutRequestStatus.REQUESTED,
      bachsPayoutId: null,
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const requestRow = toPlain<PayoutRequest>(
      await PayoutRequestModel.findById(created._id).lean<LeanDoc | null>(),
    );
    if (!requestRow) {
      throw new ApiError(500, 'PAYOUT_FAILED', 'Could not create payout request.');
    }

    await AuditLogModel.create([
      {
        actorUserId: userId,
        action: AuditAction.PAYOUT_REQUESTED,
        entityType: 'PayoutRequest',
        entityId: requestRow.id,
        metadata: { amount, currency: 'NGN' },
      },
    ]);

    if (!this.http.isConfigured) {
      await PayoutRequestModel.updateOne(
        { _id: requestRow.id },
        {
          $set: {
            status: PayoutRequestStatus.FAILED,
            failureReason: 'Bachs API key is not configured.',
            updatedAt: new Date(),
          },
        },
      );
      throw new ApiError(
        503,
        'PAYOUTS_UNAVAILABLE',
        'Payouts are temporarily unavailable. Try again later.',
      );
    }

    try {
      const payout = await this.http.createPayout(
        {
          destination: method.bachsDestinationId,
          amount,
          currency: 'NGN',
          description: `TippyMe payout @${profile.username}`,
          metadata: {
            tippyme_payout_request_id: requestRow.id,
            tippyme_creator_id: profile.id,
          },
        },
        `payout_${requestRow.id}`.slice(0, 255),
      );

      const status = this.mapPayoutStatus(payout.status);
      await PayoutRequestModel.updateOne(
        { _id: requestRow.id },
        {
          $set: {
            bachsPayoutId: payout.id,
            status,
            failureReason:
              status === PayoutRequestStatus.FAILED
                ? payout.failure_reason || 'Payout failed'
                : null,
            updatedAt: new Date(),
          },
        },
      );

      if (status === PayoutRequestStatus.FAILED) {
        throw new ApiError(
          502,
          'PAYOUT_FAILED',
          'Bachs could not complete this payout. Check your bank details and try again.',
        );
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      const message =
        err instanceof BachsProviderError
          ? 'Bachs rejected this payout. Try again shortly.'
          : 'Unable to start payout right now.';
      await PayoutRequestModel.updateOne(
        { _id: requestRow.id },
        {
          $set: {
            status: PayoutRequestStatus.FAILED,
            failureReason: message,
            updatedAt: new Date(),
          },
        },
      );
      console.error(
        `Payout create failed request=${requestRow.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new ApiError(502, 'PAYOUT_FAILED', message);
    }

    return this.getOverview(userId);
  }

  /** Apply Bachs payout webhook status updates. */
  async applyProviderPayoutUpdate(input: {
    bachsPayoutId: string;
    status: string;
    failureReason?: string | null;
  }): Promise<boolean> {
    await useDb();
    const row = toPlain<PayoutRequest>(
      await PayoutRequestModel.findOne({
        bachsPayoutId: input.bachsPayoutId,
      }).lean<LeanDoc | null>(),
    );
    if (!row) return false;

    const next = this.mapPayoutStatus(input.status);
    if (row.status === PayoutRequestStatus.PAID || row.status === next) {
      return true;
    }

    await PayoutRequestModel.updateOne(
      { _id: row.id },
      {
        $set: {
          status: next,
          failureReason:
            next === PayoutRequestStatus.FAILED
              ? input.failureReason || row.failureReason || 'Payout failed'
              : null,
          updatedAt: new Date(),
        },
      },
    );

    await AuditLogModel.create([
      {
        actorUserId: null,
        action:
          next === PayoutRequestStatus.PAID
            ? AuditAction.PAYOUT_COMPLETED
            : next === PayoutRequestStatus.FAILED
              ? AuditAction.PAYOUT_FAILED
              : AuditAction.PAYOUT_REQUESTED,
        entityType: 'PayoutRequest',
        entityId: row.id,
        metadata: {
          bachsPayoutId: input.bachsPayoutId,
          status: next,
        },
      },
    ]);

    return true;
  }

  async computeAvailableBalance(profile: CreatorProfile): Promise<string> {
    const tips = await TipModel.find({
      creatorId: profile.id,
      status: TipStatus.PAID,
      currency: profile.currency,
    })
      .select('amount')
      .lean<LeanDoc[]>();

    let net = new Decimal(0);
    const feePct = platformFeePercent();
    for (const tip of tips) {
      net = net.plus(computeCreatorNet(String(tip.amount), feePct));
    }

    const reserved = await PayoutRequestModel.find({
      creatorId: profile.id,
      currency: profile.currency,
      status: {
        $in: [
          PayoutRequestStatus.REQUESTED,
          PayoutRequestStatus.PROCESSING,
          PayoutRequestStatus.PAID,
        ],
      },
    })
      .select('amount')
      .lean<LeanDoc[]>();

    for (const row of reserved) {
      net = net.minus(String(row.amount));
    }

    if (net.lt(0)) net = new Decimal(0);
    return net.toFixed(2);
  }

  private async registerDestination(
    profile: CreatorProfile,
    method: CreatorPayoutMethod,
  ): Promise<CreatorPayoutMethod> {
    if (!this.http.isConfigured) {
      // Local/dev without Bachs: mark ready so UI can be exercised; live payouts still need a key.
      const updated = {
        ...method,
        status: PayoutMethodStatus.READY,
        bachsDestinationId: method.bachsDestinationId || `pd_stub_${method.id}`,
        lastError: null,
      };
      await CreatorPayoutMethodModel.updateOne(
        { _id: method.id },
        {
          $set: {
            status: updated.status,
            bachsDestinationId: updated.bachsDestinationId,
            lastError: null,
            updatedAt: new Date(),
          },
        },
      );
      return updated;
    }

    try {
      const accountNumber = openSecret(method.accountNumberEncrypted);
      // Match Bachs NGN docs: type, currency, bank_code, account_number (+ optional name/label).
      const destination = await this.http.createPayoutDestination(
        {
          type: 'bank_account',
          currency: 'NGN',
          bank_code: method.bankCode,
          account_number: accountNumber,
          name: method.accountName || profile.displayName,
          label: `TippyMe @${profile.username}`,
        },
        // Include bank + account so retries after fixing details are not stuck on a cached failure.
        `dest_${method.id}_${method.bankCode}_${method.accountNumberLast4}`.slice(
          0,
          255,
        ),
      );

      // Docs: trust is_usable; sandbox often auto-approves, live may stay pending_review.
      const status = (destination.status || '').toLowerCase();
      const statusBlocks =
        status === 'rejected' ||
        status === 'failed' ||
        status === 'disabled';
      const ready =
        Boolean(destination.id) &&
        !statusBlocks &&
        destination.is_usable !== false;

      const next = {
        ...method,
        bachsDestinationId: destination.id,
        accountName: destination.account_name || method.accountName,
        status: ready
          ? PayoutMethodStatus.READY
          : PayoutMethodStatus.PENDING_DESTINATION,
        lastError: ready ? null : 'Destination pending Bachs approval',
      };

      await CreatorPayoutMethodModel.updateOne(
        { _id: method.id },
        {
          $set: {
            bachsDestinationId: next.bachsDestinationId,
            accountName: next.accountName,
            status: next.status,
            lastError: next.lastError,
            updatedAt: new Date(),
          },
        },
      );
      return next;
    } catch (err) {
      const detail =
        err instanceof BachsProviderError
          ? this.destinationFailureMessage(err)
          : 'Could not register bank account with Bachs.';
      const clientStatus =
        err instanceof BachsProviderError &&
        (err.kind === 'VALIDATION' ||
          err.kind === 'NOT_FOUND' ||
          (err.providerErrorCode || '').toUpperCase() ===
            'BANK_ROUTING_DETAILS_INVALID' ||
          (err.providerErrorCode || '').toUpperCase() === 'VALIDATION_ERROR')
          ? 400
          : 502;
      await CreatorPayoutMethodModel.updateOne(
        { _id: method.id },
        {
          $set: {
            status: PayoutMethodStatus.FAILED,
            lastError: detail,
            updatedAt: new Date(),
          },
        },
      );
      console.error(
        `Payout destination failed method=${method.id}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new ApiError(clientStatus, 'PAYOUT_DESTINATION_FAILED', detail);
    }
  }

  private destinationFailureMessage(err: BachsProviderError): string {
    const code = (err.providerErrorCode || '').toUpperCase();
    if (
      code === 'BANK_ROUTING_DETAILS_INVALID' ||
      code === 'VALIDATION_ERROR' ||
      err.kind === 'VALIDATION' ||
      err.kind === 'NOT_FOUND'
    ) {
      return 'That bank account could not be verified. Pick the bank from the list (e.g. Opay (Paycom)) and confirm the 10-digit account number.';
    }
    if (code === 'PAYOUT_CURRENCY_NOT_ENABLED') {
      return 'NGN bank payouts are not enabled on this Bachs account yet.';
    }
    return `Bachs could not register this bank account (${err.kind}).`;
  }

  private mapPayoutStatus(raw?: string | null): PayoutRequest['status'] {
    const s = (raw || '').toLowerCase();
    if (['paid', 'succeeded', 'success', 'completed'].includes(s)) {
      return PayoutRequestStatus.PAID;
    }
    if (['failed', 'cancelled', 'canceled', 'rejected'].includes(s)) {
      return PayoutRequestStatus.FAILED;
    }
    if (['processing', 'pending', 'accepted', 'initiated'].includes(s)) {
      return PayoutRequestStatus.PROCESSING;
    }
    return PayoutRequestStatus.PROCESSING;
  }

  private toMaskedMethod(method: CreatorPayoutMethod): MaskedPayoutMethodDto {
    return {
      bankCode: method.bankCode,
      bankName: method.bankName,
      accountNumberLast4: method.accountNumberLast4,
      accountName: method.accountName,
      payoutCurrency: method.payoutCurrency,
      status: method.status,
      ready: method.status === PayoutMethodStatus.READY,
    };
  }

  private async requireProfile(userId: string): Promise<CreatorProfile> {
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({ userId }).lean<LeanDoc | null>(),
    );
    if (!profile) {
      throw new ApiError(404, 'PROFILE_NOT_FOUND', 'Creator profile not found.');
    }
    return profile;
  }
}
