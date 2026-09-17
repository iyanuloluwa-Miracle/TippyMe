import { expect, it } from 'vitest';
import { accountCanReceiveDestinationCharges, isDestinationSettled } from '../server/services/creators/payout-readiness';
import { buildSettlementStatus } from '../server/services/creators/settlement.types';
import { platformFeePercent } from '../server/services/creators/connect.service';
import {
  confirmationTokenMatches,
  createConfirmationToken,
} from '../server/services/tips/confirmation-token';
import { toStatusOnlyTipDto } from '../server/services/tips/tips.types';

it('treats an account id without enabled payouts as onboarding, not settled', () => {
  const status = buildSettlementStatus({
    bachsAccountId: 'acct_live',
    fridayPayoutEnabled: true,
    payoutsReady: false,
  });
  expect(status.readiness).toBe('ONBOARDING');
  expect(status.destinationChargesEnabled).toBe(false);
  expect(status.automatedFridayPayout).toBe('NOT_ENABLED');
});

it('accepts enabled transfer or payout capabilities only', () => {
  expect(accountCanReceiveDestinationCharges({
    capabilities: { transfers: { status: 'requested' } },
  })).toBe(false);
  expect(accountCanReceiveDestinationCharges({
    enabled_capabilities: ['payouts'],
  })).toBe(true);
  expect(accountCanReceiveDestinationCharges({
    capabilities: { transfers: { status: 'active' } },
  })).toBe(true);
});

it('recognizes destination-charge metadata', () => {
  expect(isDestinationSettled({ settledVia: 'destination_charge' })).toBe(true);
  expect(isDestinationSettled({ settled_via: 'destination_charge' })).toBe(true);
  expect(isDestinationSettled({ settledVia: 'platform_hold' })).toBe(false);
});

it('hides the tip note without a matching confirmation token', () => {
  const created = createConfirmationToken();
  expect(confirmationTokenMatches(created.token, created.hash)).toBe(true);
  expect(confirmationTokenMatches('nope', created.hash)).toBe(false);

  const dto = toStatusOnlyTipDto({
    id: 'tip_1',
    creatorId: 'c1',
    amount: '10.00',
    currency: 'NGN',
    message: 'secret note',
    aiThankYouMessage: 'thanks',
    isAnonymous: false,
    supporterName: 'Ada',
    supporterEmail: 'ada@example.com',
    status: 'PAID',
    paymentTransactionId: null,
    createdAt: new Date('2026-09-17T00:00:00Z'),
    updatedAt: new Date('2026-09-17T00:00:00Z'),
    creator: { username: 'ada', displayName: 'Ada', avatarUrl: null },
  });
  expect(dto.noteVisible).toBe(false);
  expect(dto.message).toBeNull();
  expect(dto.supporterName).toBeNull();
  expect(dto.amount).toBe('10.00');
});

it('exposes a finite platform fee percent', () => {
  expect(platformFeePercent()).toBeGreaterThanOrEqual(0);
});
