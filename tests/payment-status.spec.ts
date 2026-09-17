import { expect, it } from 'vitest';
import { canTransitionTip, mapVerificationToStatuses } from '../server/services/payments/payment-status.transitions';
import { buildSettlementStatus } from '../server/services/creators/settlement.types';

it('allows a verified reversal of a paid tip but rejects stale failure events', () => {
  expect(canTransitionTip('PAID', 'REFUNDED')).toBe(true);
  expect(canTransitionTip('PAID', 'DISPUTED')).toBe(true);
  expect(canTransitionTip('PAID', 'FAILED')).toBe(false);
  expect(mapVerificationToStatuses('refunded')).toEqual({ tipStatus: 'REFUNDED', paymentStatus: 'REFUNDED' });
});

it('does not present a demo Connect ID as a real payout account', () => {
  const status = buildSettlementStatus({ bachsAccountId: 'acct_stub_demo', fridayPayoutEnabled: true });
  expect(status.readiness).toBe('NOT_CONFIGURED');
  expect(status.automatedFridayPayout).toBe('FUTURE_CAPABILITY');
});
