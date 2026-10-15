/**
 * Settlement / payout readiness for the creator dashboard.
 *
 * Tips settle into TippyMe’s Bachs platform balance. Creators save a bank
 * account and request payouts to that destination. TippyMe is not a bank.
 */

export type SettlementReadiness =
  | 'NOT_CONFIGURED'
  | 'PENDING'
  | 'READY'
  | 'FAILED';

export interface CreatorSettlementStatusDto {
  readiness: SettlementReadiness;
  /** True when a bank payout method is saved and ready. */
  bankPayoutReady: boolean;
  /** Creators can request TippyMe-initiated Bachs payouts when ready. */
  tippyInitiatedPayoutAvailable: boolean;
  /** Human-readable status for the dashboard. */
  message: string;
}

export function buildSettlementStatus(input: {
  hasMethod?: boolean;
  methodStatus?: string | null;
}): CreatorSettlementStatusDto {
  const status = input.methodStatus ?? null;
  if (!input.hasMethod || !status) {
    return {
      readiness: 'NOT_CONFIGURED',
      bankPayoutReady: false,
      tippyInitiatedPayoutAvailable: false,
      message:
        'Add your bank account to receive payouts. Tips collect on TippyMe via Bachs; you request payouts to your bank when you are ready.',
    };
  }

  if (status === 'READY') {
    return {
      readiness: 'READY',
      bankPayoutReady: true,
      tippyInitiatedPayoutAvailable: true,
      message:
        'Your bank account is ready. Request a payout anytime from your available balance (after the platform fee).',
    };
  }

  if (status === 'FAILED') {
    return {
      readiness: 'FAILED',
      bankPayoutReady: false,
      tippyInitiatedPayoutAvailable: false,
      message:
        'We could not register that bank account with Bachs. Check the details and save again.',
    };
  }

  return {
    readiness: 'PENDING',
    bankPayoutReady: false,
    tippyInitiatedPayoutAvailable: false,
    message:
      'Bank details saved. Waiting for Bachs to approve the payout destination.',
  };
}
