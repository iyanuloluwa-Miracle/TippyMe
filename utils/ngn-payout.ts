import Decimal from 'decimal.js';

/** Shown before a creator confirms an NGN withdrawal. Bachs charges this on top. */
export const NGN_PAYOUT_FEE = '50.00';

/**
 * `gross` is what leaves the creator's available balance.
 * The bank receives that amount minus the payout fee.
 */
export function ngnWithdrawalAmounts(gross: string): {
  fee: string;
  toBank: string;
  debit: string;
} {
  const debit = new Decimal(gross);
  const fee = new Decimal(NGN_PAYOUT_FEE);
  const toBank = debit.minus(fee);
  return {
    fee: fee.toFixed(2),
    toBank: toBank.toFixed(2),
    debit: debit.toFixed(2),
  };
}
