import { describe, expect, it } from 'vitest';
import {
  toPublicSupporterNoteDto,
  utcWeekBounds,
} from '../server/services/creators/dashboard.types';
import { buildSettlementStatus } from '../server/services/creators/settlement.types';

describe('utcWeekBounds', () => {
  it('returns a Monday–next-Monday UTC window containing the given instant', () => {
    // Wednesday 2026-09-09 UTC
    const now = new Date(Date.UTC(2026, 8, 9, 15, 30, 0));
    const { start, end, weekKey, weekStart, weekEnd } = utcWeekBounds(now);

    expect(start.toISOString()).toBe('2026-09-07T00:00:00.000Z'); // Monday
    expect(end.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(weekStart).toBe(start.toISOString());
    expect(weekEnd).toBe(end.toISOString());
    expect(weekKey).toMatch(/^2026-W\d{2}$/);
    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(now.getTime()).toBeLessThan(end.getTime());
  });

  it('treats Sunday as the end of the week that started the prior Monday', () => {
    const sunday = new Date(Date.UTC(2026, 8, 13, 12, 0, 0));
    const { start, end } = utcWeekBounds(sunday);
    expect(start.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });
});

describe('toPublicSupporterNoteDto', () => {
  const baseTip = {
    id: 'tip_1',
    creatorId: 'creator_1',
    amount: '5000.00',
    currency: 'NGN',
    message: '  Thanks!  ',
    aiThankYouMessage: null,
    isAnonymous: false,
    supporterName: 'Tobi',
    supporterEmail: 'secret@example.com',
    status: 'PAID' as const,
    paymentTransactionId: null,
    createdAt: new Date('2026-09-09T10:00:00.000Z'),
    updatedAt: new Date('2026-09-09T10:00:00.000Z'),
  };

  it('maps a paid tip with a message and never includes email', () => {
    const note = toPublicSupporterNoteDto(baseTip as never);
    expect(note).toEqual({
      amount: '5000.00',
      currency: 'NGN',
      message: 'Thanks!',
      displayName: 'Tobi',
      isAnonymous: false,
      createdAt: '2026-09-09T10:00:00.000Z',
    });
    expect(JSON.stringify(note)).not.toContain('secret@example.com');
  });

  it('nulls displayName for anonymous tips', () => {
    const note = toPublicSupporterNoteDto({
      ...baseTip,
      isAnonymous: true,
      supporterName: 'Hidden',
    } as never);
    expect(note?.displayName).toBeNull();
    expect(note?.isAnonymous).toBe(true);
  });

  it('returns null when message is empty', () => {
    expect(
      toPublicSupporterNoteDto({ ...baseTip, message: '   ' } as never),
    ).toBeNull();
    expect(
      toPublicSupporterNoteDto({ ...baseTip, message: null } as never),
    ).toBeNull();
  });
});

describe('buildSettlementStatus', () => {
  it('starts not configured without a bank method', () => {
    const status = buildSettlementStatus({ hasMethod: false });
    expect(status.readiness).toBe('NOT_CONFIGURED');
    expect(status.bankPayoutReady).toBe(false);
    expect(status.tippyInitiatedPayoutAvailable).toBe(false);
    expect(status.message.toLowerCase()).toContain('bank');
  });

  it('marks pending when destination is not ready', () => {
    const status = buildSettlementStatus({
      hasMethod: true,
      methodStatus: 'PENDING_DESTINATION',
    });
    expect(status.readiness).toBe('PENDING');
    expect(status.bankPayoutReady).toBe(false);
  });

  it('marks ready when bank destination is READY', () => {
    const status = buildSettlementStatus({
      hasMethod: true,
      methodStatus: 'READY',
    });
    expect(status.readiness).toBe('READY');
    expect(status.bankPayoutReady).toBe(true);
    expect(status.tippyInitiatedPayoutAvailable).toBe(true);
  });
});
