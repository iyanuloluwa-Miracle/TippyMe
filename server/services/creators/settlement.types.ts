/**
 * Settlement / payout readiness for the creator dashboard.
 *
 * TippyMe is not a bank. Tips settle into Bachs Connect balances when a
 * creator has linked `bachsAccountId` and checkout uses destination charges.
 * TippyMe never exposes a withdrawable TippyMe wallet.
 */

export type SettlementReadiness = 'NOT_CONFIGURED' | 'ONBOARDING' | 'CONNECTED';

/** Friday auto-payout via Bachs balance_settings on the Connect account. */
export type AutomatedFridayPayoutStatus =
  | 'NOT_ENABLED'
  | 'CONFIGURED'
  | 'FUTURE_CAPABILITY';

export interface CreatorSettlementStatusDto {
  readiness: SettlementReadiness;
  /** Bachs Connect `acct_…` when linked; null until Connect onboarding. */
  bachsConnectAccountId: string | null;
  /**
   * Always false — Tip totals are TippyMe records, not a Bachs wallet.
   */
  tippyHoldsWithdrawableBalance: false;
  /**
   * Creators withdraw via Bachs, not TippyMe.
   */
  tippyInitiatedPayoutAvailable: false;
  automatedFridayPayout: AutomatedFridayPayoutStatus;
  /** Destination charges only after Bachs enables transfers or payouts. */
  destinationChargesEnabled: boolean;
  /** Human-readable status for the dashboard. */
  message: string;
}

export function buildSettlementStatus(input: {
  bachsAccountId: string | null | undefined;
  fridayPayoutEnabled?: boolean;
  /** True only after Bachs reports transfers or payouts as enabled. */
  payoutsReady?: boolean;
}): CreatorSettlementStatusDto {
  const linked = Boolean(input.bachsAccountId?.trim()) && !input.bachsAccountId?.startsWith('acct_stub_');
  const ready = linked && Boolean(input.payoutsReady);
  const friday = ready && Boolean(input.fridayPayoutEnabled);

  if (!linked) {
    return {
      readiness: 'NOT_CONFIGURED',
      bachsConnectAccountId: null,
      tippyHoldsWithdrawableBalance: false,
      tippyInitiatedPayoutAvailable: false,
      automatedFridayPayout: 'FUTURE_CAPABILITY',
      destinationChargesEnabled: false,
      message:
        'Connect Bachs to settle tips into your creator balance. TippyMe is not a bank and does not hold a withdrawable wallet. Automatic Friday payouts unlock after Connect.',
    };
  }

  if (!ready) {
    return {
      readiness: 'ONBOARDING',
      bachsConnectAccountId: input.bachsAccountId!.trim(),
      tippyHoldsWithdrawableBalance: false,
      tippyInitiatedPayoutAvailable: false,
      automatedFridayPayout: 'NOT_ENABLED',
      destinationChargesEnabled: false,
      message:
        'Bachs account started, but payouts are not enabled yet. Finish onboarding before new tips settle to your balance. Until then, verified tips stay with TippyMe and are not your withdrawable money.',
    };
  }

  return {
    readiness: 'CONNECTED',
    bachsConnectAccountId: input.bachsAccountId!.trim(),
    tippyHoldsWithdrawableBalance: false,
    tippyInitiatedPayoutAvailable: false,
    automatedFridayPayout: friday ? 'CONFIGURED' : 'NOT_ENABLED',
    destinationChargesEnabled: true,
    message: friday
      ? 'Bachs payouts are enabled. New tips settle to your Bachs balance via destination charges. Automatic Friday payouts are configured on Bachs. TippyMe does not hold a withdrawable wallet.'
      : 'Bachs payouts are enabled. New tips settle to your Bachs balance via destination charges. TippyMe does not hold a withdrawable wallet. Enable Friday payouts from the settlement panel.',
  };
}
