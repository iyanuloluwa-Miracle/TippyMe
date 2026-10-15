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
    settlement: buildSettlementStatus({ hasMethod: false }),
  };
}

describe('personalized dashboard answers', () => {
  it('directs a creator without bank details to payout setup', () => {
    const reply = answerDashboardQuestion('When is my payout?', account());
    expect(reply.answer).toContain('haven’t saved a bank account');
    expect(reply.answer).toContain('Available balance');
    expect(reply.actions[0]?.to).toBe('/dashboard#payouts');
  });
  it('distinguishes pending bank approval from ready', () => {
    const d = account();
    d.settlement = buildSettlementStatus({
      hasMethod: true,
      methodStatus: 'PENDING_DESTINATION',
    });
    const reply = answerDashboardQuestion('Why can’t I withdraw?', d);
    expect(reply.answer).toContain('has not approved');
  });
  it('reports ready bank payouts', () => {
    const d = account();
    d.settlement = buildSettlementStatus({
      hasMethod: true,
      methodStatus: 'READY',
    });
    const reply = answerDashboardQuestion('Can I get paid?', d);
    expect(reply.answer).toContain('ready for payouts');
    expect(reply.answer).toContain('Request a payout');
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
