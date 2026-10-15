import { expect, it } from 'vitest';
import { canTransitionTip, mapVerificationToStatuses } from '../server/services/payments/payment-status.transitions';
import { buildSettlementStatus } from '../server/services/creators/settlement.types';

it('allows a verified reversal of a paid tip but rejects stale failure events', () => {
  expect(canTransitionTip('PAID', 'REFUNDED')).toBe(true);
  expect(canTransitionTip('PAID', 'DISPUTED')).toBe(true);
  expect(canTransitionTip('PAID', 'FAILED')).toBe(false);
  expect(mapVerificationToStatuses('refunded')).toEqual({ tipStatus: 'REFUNDED', paymentStatus: 'REFUNDED' });
});

it('does not mark payouts ready without a saved bank method', () => {
  const status = buildSettlementStatus({ hasMethod: false });
  expect(status.readiness).toBe('NOT_CONFIGURED');
  expect(status.bankPayoutReady).toBe(false);
  expect(status.tippyInitiatedPayoutAvailable).toBe(false);
});
