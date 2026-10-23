import Decimal from 'decimal.js';
import { ApiError } from '../../lib/errors';
import { openSecret, sealSecret } from '../../lib/secret-box';
import {
  AuditLogModel,
  CreatorPayoutMethodModel,
  CreatorProfileModel,
  PaymentTransactionModel,
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
  PaymentTransaction,
  PayoutRequest,
  Tip,
} from '../../db/types';
import {
  BachsHttpClient,
  type BachsBalance,
  type BachsCreatePayoutBody,
  type BachsPayoutDestinationResponse,
  type BachsPayoutResponse,
} from '../payments/bachs/bachs-http.client';
import { BachsProviderError } from '../payments/bachs/bachs.errors';
import {
  ensureCreatorBachsAccount,
  buildPayoutRequirementFields,
  readPayoutRequirement,
} from './bachs-account.service';
import { isDirectChargeSettled } from './payout-readiness';
import {
  computeCreatorNet,
  platformFeePercent,
} from './platform-fee';
import { NGN_PAYOUT_FEE, ngnWithdrawalAmounts } from '../../../utils/ngn-payout';
import {
  buildSettlementStatus,
  type CreatorSettlementStatusDto,
} from './settlement.types';

const MIN_PAYOUT_NGN = new Decimal('100.00');

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
  /** Changes whenever the saved bank destination changes. */
  destinationVersion: string;
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
  availableBalance: string | null;
  balanceSource: 'BACHS_LIVE' | 'LOCAL_LEDGER' | 'UNAVAILABLE';
  balanceMessage: string | null;
  currency: string;
  platformFeePercent: number;
  minPayoutAmount: string;
  /** NGN fee shown before a withdrawal is sent. Charged on top by Bachs. */
  payoutFee: string;
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
    const [ledgerBalance, recent] = await Promise.all([
      this.computeAvailableBalance(profile),
      PayoutRequestModel.find({ creatorId: profile.id })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean<LeanDoc[]>(),
    ]);

    const balance = await this.resolveWithdrawableBalance(profile, ledgerBalance);

    return {
      settlement: buildSettlementStatus({
        methodStatus: method?.status ?? null,
        hasMethod: Boolean(method),
        lastError: method?.lastError ?? null,
      }),
      method: method ? this.toMaskedMethod(method) : null,
      availableBalance: balance.amount,
      balanceSource: balance.source,
      balanceMessage: balance.message,
      currency: profile.currency,
      platformFeePercent: platformFeePercent(),
      minPayoutAmount: MIN_PAYOUT_NGN.toFixed(2),
      payoutFee: NGN_PAYOUT_FEE,
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
    input?: { amount?: string; destinationVersion?: string },
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
    if (!payoutDestinationVersionMatches(method, input?.destinationVersion)) {
      throw new ApiError(
        409,
        'PAYOUT_DESTINATION_CHANGED',
        'Your payout bank changed or the confirmation expired. Review the bank details and confirm again.',
      );
    }
    if (profile.currency.toUpperCase() !== 'NGN') {
      throw new ApiError(
        400,
        'PAYOUT_CURRENCY_UNSUPPORTED',
        'Bank payouts currently support NGN collection currency only.',
      );
    }

    const ledgerBalance = await this.computeAvailableBalance(profile);
    let accountId: string;
    let availableBalance = ledgerBalance;
    try {
      accountId = await ensureCreatorBachsAccount(profile, this.http);
      if (this.http.isConfigured) {
        await this.assertStoredDestinationMatches(accountId, method);
        const balances = await this.http.getBalances(accountId);
        const verified = providerBackedWithdrawableBalance(
          ledgerBalance,
          balances,
          'NGN',
        );
        if (verified === null) {
          throw new ApiError(
            503,
            'PAYOUT_BALANCE_UNAVAILABLE',
            'Your live Bachs balance is temporarily unavailable. Try again shortly.',
          );
        }
        availableBalance = verified;
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        502,
        'PAYOUT_FAILED',
        'Bachs could not open a payout account for this withdrawal. Try again shortly.',
      );
    }
    const available = new Decimal(availableBalance);
    const requested = parseRequestedAmount(input?.amount) ?? available;

    if (!available.isFinite() || available.lte(0)) {
      throw new ApiError(
        400,
        'INSUFFICIENT_BALANCE',
        'Nothing is available to withdraw right now.',
      );
    }
    if (!requested.isFinite() || requested.lte(0)) {
      throw new ApiError(400, 'INVALID_PAYOUT_AMOUNT', 'Enter a valid payout amount.');
    }
    const split = ngnWithdrawalAmounts(requested.toFixed(2));
    const gross = new Decimal(split.debit);
    const toBank = new Decimal(split.toBank);
    if (toBank.lt(MIN_PAYOUT_NGN)) {
      throw new ApiError(
        400,
        'PAYOUT_BELOW_MINIMUM',
        `Your bank receives the withdrawal minus a ₦${NGN_PAYOUT_FEE} payout fee. That amount must be at least ₦${MIN_PAYOUT_NGN.toFixed(2)}.`,
      );
    }
    if (gross.gt(available)) {
      throw new ApiError(
        400,
        'INSUFFICIENT_BALANCE',
        'That amount is more than your live available balance.',
      );
    }

    const amount = gross.toFixed(2);
    const bankAmount = toBank.toFixed(2);
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
        metadata: {
          amount,
          currency: 'NGN',
          bachsDestinationId: method.bachsDestinationId,
          bankCode: method.bankCode,
          accountNumberLast4: method.accountNumberLast4,
        },
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
      const payout = unwrapPayout(
        await this.http.createPayout(
          buildBachsPayoutBody({
            destinationId: method.bachsDestinationId,
            bankAmount,
            payoutRequestId: requestRow.id,
            creatorId: profile.id,
          }),
          `payout_${requestRow.id}`.slice(0, 255),
          accountId,
        ),
      );

      const status = this.mapPayoutStatus(payout.status);
      const debited = normalizePayoutAmount(payout.total_debited);
      const reserved =
        debited && new Decimal(debited).gt(amount) ? debited : amount;
      await PayoutRequestModel.updateOne(
        { _id: requestRow.id },
        {
          $set: {
            amount: reserved,
            bachsPayoutId: payout.id || null,
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
          ? err.kind === 'VALIDATION'
            ? 'Bachs could not send this amount. Their withdrawal fee is charged on top, or this balance was already paid out.'
            : 'Bachs rejected this payout. Try again shortly.'
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
    amount?: string;
    currency?: string;
    destinationId?: string;
    payoutRequestId?: string;
  }): Promise<boolean> {
    await useDb();
    let row = toPlain<PayoutRequest>(
      await PayoutRequestModel.findOne({
        bachsPayoutId: input.bachsPayoutId,
      }).lean<LeanDoc | null>(),
    );
    if (!row) {
      row = await this.linkUnmatchedPayout(input);
    }
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
    const tips = toPlainList<Pick<Tip, 'id' | 'amount' | 'paymentTransactionId'>>(
      await TipModel.find({
        creatorId: profile.id,
        status: TipStatus.PAID,
        currency: profile.currency,
      })
        .select('amount paymentTransactionId')
        .lean<LeanDoc[]>(),
    );

    const paymentIds = tips
      .map((tip) => tip.paymentTransactionId)
      .filter((id): id is string => Boolean(id));
    const payments = paymentIds.length
      ? toPlainList<Pick<PaymentTransaction, 'id' | 'metadata'>>(
          await PaymentTransactionModel.find({ _id: { $in: paymentIds } })
            .select('metadata')
            .lean<LeanDoc[]>(),
        )
      : [];
    const directChargeIds = new Set(
      payments
        .filter((payment) => isDirectChargeSettled(payment.metadata))
        .map((payment) => payment.id),
    );

    let net = new Decimal(0);
    const feePct = platformFeePercent();
    for (const tip of tips) {
      if (!tip.paymentTransactionId || !directChargeIds.has(tip.paymentTransactionId)) {
        continue;
      }
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

  private async resolveWithdrawableBalance(
    profile: CreatorProfile,
    ledgerBalance: string,
  ): Promise<{
    amount: string | null;
    source: CreatorPayoutOverviewDto['balanceSource'];
    message: string | null;
  }> {
    if (!this.http.isConfigured) {
      return { amount: ledgerBalance, source: 'LOCAL_LEDGER', message: null };
    }

    const accountId = profile.bachsAccountId?.trim();
    if (!accountId || accountId.startsWith('acct_stub_')) {
      return {
        amount: null,
        source: 'UNAVAILABLE',
        message: 'Your live Bachs balance is not available yet.',
      };
    }

    try {
      const balances = await this.http.getBalances(accountId);
      const amount = providerBackedWithdrawableBalance(
        ledgerBalance,
        balances,
        profile.currency,
      );
      if (amount === null) {
        return {
          amount: null,
          source: 'UNAVAILABLE',
          message: 'Bachs returned an invalid balance. Payouts are paused for safety.',
        };
      }
      return { amount, source: 'BACHS_LIVE', message: null };
    } catch (err) {
      console.warn(
        `Bachs balance lookup failed account=${accountId}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return {
        amount: null,
        source: 'UNAVAILABLE',
        message: 'Your live Bachs balance is temporarily unavailable. Try again shortly.',
      };
    }
  }

  /**
   * The onboarding field creates the destination. Listing finds that row.
   * Creating one directly is only valid once payouts is active.
   */
  private async findCreatorDestination(
    accountId: string,
    method: CreatorPayoutMethod,
    accountNumber: string,
    profile: CreatorProfile,
  ): Promise<BachsPayoutDestinationResponse> {
    const listed = await this.matchingDestination(accountId, method, accountNumber);
    if (listed) return listed;

    try {
      return await this.http.createPayoutDestination(
        {
          type: 'bank_account',
          currency: 'NGN',
          bank_code: method.bankCode,
          account_number: accountNumber,
          name: method.accountName || profile.displayName,
          label: `TippyMe @${profile.username}`,
        },
        `dest_${accountId}_${method.id}_${method.bankCode}_${method.accountNumberLast4}`.slice(
          0,
          255,
        ),
        accountId,
      );
    } catch (err) {
      if (!(err instanceof BachsProviderError) || err.kind !== 'FORBIDDEN') {
        throw err;
      }
      const after = await this.matchingDestination(accountId, method, accountNumber);
      if (after) return after;
      throw err;
    }
  }

  private async matchingDestination(
    accountId: string,
    method: CreatorPayoutMethod,
    accountNumber: string,
  ): Promise<BachsPayoutDestinationResponse | null> {
    try {
      const listed = await this.http.listPayoutDestinations(accountId, 'NGN');
      return (
        listed.find((destination) =>
          payoutDestinationMatchesSavedBank(destination, method, accountNumber),
        ) ?? null
      );
    } catch (err) {
      if (!(err instanceof BachsProviderError) || err.kind !== 'FORBIDDEN') {
        throw err;
      }
      return null;
    }
  }

  private async assertStoredDestinationMatches(
    accountId: string,
    method: CreatorPayoutMethod,
  ): Promise<void> {
    const accountNumber = openSecret(method.accountNumberEncrypted);
    const destinations = await this.http.listPayoutDestinations(accountId, 'NGN');
    const stored = destinations.find(
      (destination) => destination.id === method.bachsDestinationId,
    );
    if (!stored || !payoutDestinationMatchesSavedBank(stored, method, accountNumber)) {
      throw new ApiError(
        409,
        'PAYOUT_DESTINATION_MISMATCH',
        'The bank saved on your dashboard no longer matches the Bachs payout destination. Save the bank again before withdrawing.',
      );
    }
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
      const accountId = await ensureCreatorBachsAccount(profile, this.http);
      const accountNumber = openSecret(method.accountNumberEncrypted);
      const holderName = method.accountName || profile.displayName;
      // Submitting the bank on the account is what creates the destination.
      // A direct create before that is accepted returns 403, which must not
      // wipe a destination Bachs already approved.
      const updatedAccount = await this.http.updateConnectedAccount(
        accountId,
        {
          fields: buildPayoutRequirementFields({
            holderName,
            accountNumber,
            accountName: holderName,
            bankCode: method.bankCode,
          }),
        },
      );
      const requirement = readPayoutRequirement(updatedAccount);
      if (requirement.state === 'rejected') {
        throw new ApiError(
          400,
          'PAYOUT_DESTINATION_FAILED',
          requirement.reason ||
            'That bank account could not be verified. Check the bank and the 10-digit account number.',
        );
      }
      let destination: BachsPayoutDestinationResponse | null = null;
      try {
        destination = await this.findCreatorDestination(
          accountId,
          method,
          accountNumber,
          profile,
        );
      } catch (err) {
        if (
          requirement.state !== 'accepted' ||
          !(err instanceof BachsProviderError) ||
          err.kind !== 'FORBIDDEN'
        ) {
          throw err;
        }
      }
      if (!destination) {
        const pending = {
          ...method,
          status: PayoutMethodStatus.PENDING_DESTINATION,
          lastError: null,
        };
        await CreatorPayoutMethodModel.updateOne(
          { _id: method.id },
          {
            $set: {
              status: pending.status,
              lastError: null,
              updatedAt: new Date(),
            },
          },
        );
        return pending;
      }

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
        err instanceof ApiError
          ? err.message
          : err instanceof BachsProviderError
            ? this.destinationFailureMessage(err)
            : 'Could not register bank account with Bachs.';
      const clientStatus =
        err instanceof ApiError
          ? err.statusCode
          : err instanceof BachsProviderError &&
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
    if (err.kind === 'FORBIDDEN') {
      return 'Bachs has not activated payouts for this account yet. Save the bank again in a moment.';
    }
    return `Bachs could not register this bank account (${err.kind}).`;
  }

  /**
   * Bachs automatic withdrawals use a withdrawal id we never stored.
   * Match the local request by metadata, or by the saved destination, and
   * record a completed payout so the balance cannot be withdrawn twice.
   */
  private async linkUnmatchedPayout(input: {
    bachsPayoutId: string;
    status: string;
    amount?: string;
    currency?: string;
    destinationId?: string;
    payoutRequestId?: string;
  }): Promise<PayoutRequest | null> {
    const resolved = await this.resolvePayoutLink(input);
    if (resolved.requestId) {
      return this.claimPayoutRequest(resolved.requestId, input.bachsPayoutId);
    }
    if (!resolved.method) return null;
    if (this.mapPayoutStatus(input.status) !== PayoutRequestStatus.PAID) {
      return null;
    }

    const amount =
      normalizePayoutAmount(input.amount) ??
      normalizePayoutAmount(resolved.amount);
    if (!amount) return null;

    const currency = (input.currency || resolved.currency || 'NGN').toUpperCase();
    try {
      await PayoutRequestModel.create({
        creatorId: resolved.method.creatorId,
        payoutMethodId: resolved.method.id,
        amount,
        currency,
        platformFeePercent: platformFeePercent(),
        status: PayoutRequestStatus.REQUESTED,
        bachsPayoutId: input.bachsPayoutId,
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }

    return toPlain<PayoutRequest>(
      await PayoutRequestModel.findOne({
        bachsPayoutId: input.bachsPayoutId,
      }).lean<LeanDoc | null>(),
    );
  }

  private async resolvePayoutLink(input: {
    bachsPayoutId: string;
    destinationId?: string;
    payoutRequestId?: string;
    amount?: string;
    currency?: string;
  }): Promise<{
    requestId?: string;
    method: CreatorPayoutMethod | null;
    amount?: string;
    currency?: string;
  }> {
    let requestId = mongoId(input.payoutRequestId);
    let destinationId = input.destinationId;
    let amount = input.amount;
    let currency = input.currency;

    if ((!requestId || !destinationId) && this.http.isConfigured) {
      try {
        const accountId = await this.accountIdForPayoutLookup(
          requestId,
          destinationId,
        );
        const remote = unwrapPayout(
          await this.http.getPayout(input.bachsPayoutId, accountId),
        );
        requestId =
          requestId || mongoId(remote.metadata?.tippyme_payout_request_id);
        destinationId = destinationId || remote.destination;
        amount = amount || remote.amount;
        currency = currency || remote.currency;
      } catch (err) {
        console.warn(
          `Bachs payout lookup failed id=${input.bachsPayoutId}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    if (requestId) {
      return { requestId, method: null, amount, currency };
    }

    const method = await this.findPayoutMethodForWithdrawal(destinationId);
    if (!method) return { method: null, amount, currency };

    const open = toPlain<PayoutRequest>(
      await PayoutRequestModel.findOne({
        creatorId: method.creatorId,
        payoutMethodId: method.id,
        status: {
          $in: [PayoutRequestStatus.REQUESTED, PayoutRequestStatus.PROCESSING],
        },
        $or: [{ bachsPayoutId: null }, { bachsPayoutId: input.bachsPayoutId }],
      })
        .sort({ createdAt: -1 })
        .lean<LeanDoc | null>(),
    );

    return {
      requestId: open?.id,
      method,
      amount,
      currency,
    };
  }

  private async accountIdForPayoutLookup(
    requestId?: string,
    destinationId?: string,
  ): Promise<string | undefined> {
    let creatorId: string | undefined;
    if (requestId) {
      const request = toPlain<PayoutRequest>(
        await PayoutRequestModel.findOne({ _id: requestId })
          .select('creatorId')
          .lean<LeanDoc | null>(),
      );
      creatorId = request?.creatorId;
    }
    if (!creatorId && destinationId) {
      const method = await this.findPayoutMethodForWithdrawal(destinationId);
      creatorId = method?.creatorId;
    }
    if (!creatorId) return undefined;
    const profile = toPlain<CreatorProfile>(
      await CreatorProfileModel.findOne({ _id: creatorId })
        .select('bachsAccountId')
        .lean<LeanDoc | null>(),
    );
    const accountId = profile?.bachsAccountId?.trim();
    return accountId || undefined;
  }

  private async findPayoutMethodForWithdrawal(
    destinationId: string | undefined,
  ): Promise<CreatorPayoutMethod | null> {
    if (destinationId) {
      const match = toPlain<CreatorPayoutMethod>(
        await CreatorPayoutMethodModel.findOne({
          bachsDestinationId: destinationId,
        }).lean<LeanDoc | null>(),
      );
      if (match) return match;
    }

    const methods = toPlainList<CreatorPayoutMethod>(
      await CreatorPayoutMethodModel.find({
        bachsDestinationId: { $type: 'string', $ne: '' },
      })
        .limit(2)
        .lean<LeanDoc[]>(),
    );
    return methods.length === 1 ? methods[0]! : null;
  }

  private async claimPayoutRequest(
    requestId: string,
    bachsPayoutId: string,
  ): Promise<PayoutRequest | null> {
    const claimed = toPlain<PayoutRequest>(
      await PayoutRequestModel.findOneAndUpdate(
        {
          _id: requestId,
          $or: [{ bachsPayoutId: null }, { bachsPayoutId }],
        },
        { $set: { bachsPayoutId, updatedAt: new Date() } },
        { new: true },
      ).lean<LeanDoc | null>(),
    );
    if (claimed) return claimed;

    return toPlain<PayoutRequest>(
      await PayoutRequestModel.findOne({
        _id: requestId,
        bachsPayoutId,
      }).lean<LeanDoc | null>(),
    );
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
      destinationVersion: method.updatedAt.toISOString(),
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

/** Match only the exact dashboard account, or a masked account with the same bank. */
export function payoutDestinationMatchesSavedBank(
  destination: BachsPayoutDestinationResponse,
  method: Pick<CreatorPayoutMethod, 'bankCode' | 'accountNumberLast4'>,
  accountNumber: string,
): boolean {
  const rawNumber = (destination.account_number || '').trim();
  const digits = rawNumber.replace(/\D/g, '');
  const bankCode = (destination.bank_code || '').trim();
  if (!destination.id || !digits) return false;
  if (bankCode !== method.bankCode) return false;
  if (digits === accountNumber) return true;

  const isMasked = /[^\d\s]/.test(rawNumber) && digits === method.accountNumberLast4;
  return isMasked && bankCode === method.bankCode;
}

export function payoutDestinationVersionMatches(
  method: Pick<CreatorPayoutMethod, 'updatedAt'>,
  expectedVersion: string | undefined,
): boolean {
  return Boolean(
    expectedVersion && expectedVersion === method.updatedAt.toISOString(),
  );
}

export function buildBachsPayoutBody(input: {
  destinationId: string;
  bankAmount: string;
  payoutRequestId: string;
  creatorId: string;
}): BachsCreatePayoutBody {
  return {
    destination: input.destinationId,
    amount: input.bankAmount,
    reference: `payout_${input.payoutRequestId}`.slice(0, 128),
    metadata: {
      tippyme_payout_request_id: input.payoutRequestId,
      tippyme_creator_id: input.creatorId,
    },
  };
}

/** Never show or withdraw more than both systems agree is available. */
export function providerBackedWithdrawableBalance(
  ledgerBalance: string,
  providerBalances: BachsBalance[],
  currency: string,
): string | null {
  try {
    const ledger = new Decimal(ledgerBalance);
    if (!ledger.isFinite() || ledger.lt(0)) return null;
    const row = providerBalances.find(
      (balance) => balance.currency?.toUpperCase() === currency.toUpperCase(),
    );
    if (!row) return '0.00';
    const provider = new Decimal(row.available_balance ?? '');
    if (!provider.isFinite() || provider.lt(0)) return null;
    return Decimal.min(ledger, provider).toFixed(2);
  } catch {
    return null;
  }
}

function mongoId(value: string | undefined): string | undefined {
  return value && /^[a-f\d]{24}$/i.test(value) ? value : undefined;
}

function parseRequestedAmount(value: string | undefined): Decimal | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new Decimal(raw);
  } catch {
    return null;
  }
}

function normalizePayoutAmount(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const amount = new Decimal(value);
    if (!amount.isFinite() || amount.lte(0)) return null;
    return amount.toFixed(2);
  } catch {
    return null;
  }
}

function unwrapPayout(raw: BachsPayoutResponse): BachsPayoutResponse {
  if (!raw.id && raw.data?.id) return raw.data;
  return raw;
}
