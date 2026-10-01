import { describe, expect, it } from 'vitest';
import { answerDashboardQuestion } from '../server/services/ai/dashboard-assistant';
import { buildSettlementStatus } from '../server/services/creators/settlement.types';
import type { CreatorDashboardDto } from '../server/services/creators/dashboard.types';

function account(): CreatorDashboardDto {
  return {
    displayName: 'Ada', username: 'ada', currency: 'NGN', avatarUrl: null,
    publicPath: '/ada', publicUrl: 'https://tippyme.example/ada',
    totals: {
      successfulSupport: null, converted: false, successfulTipCount: 3,
      periodSupport: null, periodTipCount: 2, periodKey: '2026-10', periodLabel: 'October 2026',
      byCurrency: [{ currency: 'NGN', amount: '5000.00', count: 2 }, { currency: 'USD', amount: '5.00', count: 1 }],
      settledByCurrency: [{ currency: 'NGN', amount: '3000.00', count: 1 }],
      heldByCurrency: [{ currency: 'NGN', amount: '2000.00', count: 1 }],
    },
    linkViews: { lifetime: 20, thisWeek: 5 },
    conversion: { viewsToTipsRate: null, viewsToTipsPercent: null },
    supportGoal: null, recentTips: [], recentMessages: [], platformFeePercent: 3,
    settlement: buildSettlementStatus({ bachsAccountId: null }),
  };
}

describe('personalized dashboard answers', () => {
  it('directs an unconnected creator to payout setup without promising a payout', () => {
    const reply = answerDashboardQuestion('When is my payout?', account());
    expect(reply.answer).toContain('haven’t connected Bachs');
    expect(reply.answer).toContain('not your current bank or withdrawable balance');
    expect(reply.answer).toContain('can’t confirm an individual bank transfer');
    expect(reply.actions[0]?.to).toBe('/dashboard#payouts');
  });
  it('distinguishes incomplete onboarding from an enabled payout account', () => {
    const d = account();
    d.settlement = buildSettlementStatus({ bachsAccountId: 'acct_private' });
    const reply = answerDashboardQuestion('Why can’t I withdraw?', d);
    expect(reply.answer).toContain('payout setup is not complete');
    expect(JSON.stringify(reply)).not.toContain('acct_private');
  });
  it('reports Friday configuration without inventing a bank arrival date', () => {
    const d = account();
    d.settlement = buildSettlementStatus({ bachsAccountId: 'acct_private', payoutsReady: true, fridayPayoutEnabled: true });
    const reply = answerDashboardQuestion('Will I get paid Friday?', d);
    expect(reply.answer).toContain('Automatic Friday payouts are configured');
    expect(reply.answer).toContain('can’t confirm');
    expect(reply.answer).not.toContain('will arrive');
  });
  it('keeps unconvertible currencies separate and exposes no supporter details', () => {
    const d = account();
    d.recentTips = [{ id: 'tip_1', amount: '20', currency: 'NGN', message: 'private note', supporterName: 'Private Person', isAnonymous: false, status: 'PAID', paymentStatus: null, createdAt: '' }];
    const reply = answerDashboardQuestion('How much support have I received?', d);
    expect(reply.answer).toContain('NGN 5000.00, USD 5.00');
    expect(reply.answer).toContain('combined currency total is unavailable');
    expect(JSON.stringify(reply)).not.toContain('Private Person');
    expect(JSON.stringify(reply)).not.toContain('private note');
  });
  it('keeps relevant follow-ups on topic and allows topic changes', () => {
    expect(answerDashboardQuestion('What next?', account(), 'payout').topic).toBe('payout');
    expect(answerDashboardQuestion('How many page views?', account(), 'payout').topic).toBe('traffic');
    expect(answerDashboardQuestion('Write a recipe', account(), 'payout').topic).toBe('help');
  });
  it('handles empty goals and missing conversion data honestly', () => {
    expect(answerDashboardQuestion('How is my support goal?', account()).answer).toContain('don’t have an active support goal');
    expect(answerDashboardQuestion('Show my analytics', account()).answer).toContain('isn’t enough data');
  });
  it('reports partial goal totals and routes support-link questions to profile', () => {
    const d = account();
    d.supportGoal = { active: true, title: 'New camera', currency: 'NGN', raisedAmount: '5000.00', targetAmount: '10000.00', percent: 50, raisedIncomplete: true };
    expect(answerDashboardQuestion('How is my goal?', d).answer).toContain('excludes support in currencies');
    expect(answerDashboardQuestion('Where can I share my support link?', d).topic).toBe('profile');
  });
});
