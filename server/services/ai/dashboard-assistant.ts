import type { AssistantReply, AssistantTopic } from '../../../types/assistant';
import type { CreatorDashboardDto, CurrencyAmountDto } from '../creators/dashboard.types';

export const assistantTopics: AssistantTopic[] = ['payout', 'earnings', 'goal', 'traffic', 'fees', 'profile', 'help'];

/** Account answers are built from trusted records, never generated financial claims. */
export function answerDashboardQuestion(
  question: string,
  dashboard: CreatorDashboardDto,
  previousTopic?: AssistantTopic,
): AssistantReply {
  const q = question.toLowerCase().replace(/[’']/g, '');
  let topic: AssistantTopic = 'help';
  if (/\b(fee|fees|charge|charges|commission|deduction|deducted)\b/.test(q)) topic = 'fees';
  else if (/\b(payout|payouts|pay out|paid out|withdraw\w*|bank|bachs|settle\w*|friday|balance|held|pending|connect|onboarding|money|paid|payment|payments)\b/.test(q)) topic = 'payout';
  else if (/\b(goal|target|progress)\b/.test(q)) topic = 'goal';
  else if (/\b(view\w*|visit\w*|traffic|conversion|analytics)\b/.test(q)) topic = 'traffic';
  else if (/\b(profile|bio|link|share|username|name)\b/.test(q)) topic = 'profile';
  else if (/\b(earn\w*|tip|tips|support|supporters|received|raised|made|total|totals|income)\b/.test(q)) topic = 'earnings';
  if (/\b(goal|target)\b/.test(q)) topic = 'goal';
  // Short follow-ups keep context, but unrelated questions get a clear scope response.
  if (topic === 'help' && previousTopic && /^(why|when|how|what next|what about|and |is it|can i|yes|tell me more|explain|what does that mean)/.test(q.trim())) topic = previousTopic;

  const money = (rows: CurrencyAmountDto[]) => rows.length
    ? rows.map((row) => `${row.currency} ${row.amount}`).join(', ')
    : 'none recorded';
  const response: AssistantReply = {
    answer: '', displayName: dashboard.displayName, topic,
    checkedAt: new Date().toISOString(), actions: [],
  };

  if (topic === 'payout') {
    const s = dashboard.settlement;
    const readiness = s.readiness === 'CONNECTED'
      ? 'Your Bachs payout setup is enabled.'
      : s.readiness === 'ONBOARDING'
        ? 'Your Bachs account has been started, but payout setup is not complete. Finish onboarding in the payout section.'
        : 'You haven’t connected Bachs payouts yet. Start with Connect Bachs payouts in the payout section.';
    const friday = s.automatedFridayPayout === 'CONFIGURED'
      ? 'Automatic Friday payouts are configured on your account.'
      : s.readiness === 'CONNECTED'
        ? 'Automatic Friday payouts are not enabled. You can enable them in the payout section.'
        : 'Friday payouts become available once Bachs enables your payout setup.';
    response.answer = `${readiness}\n\n${friday}\n\nSupport recorded as settled: ${money(dashboard.totals.settledByCurrency)}. Support recorded as held: ${money(dashboard.totals.heldByCurrency)}. These are support records, not your current bank or withdrawable balance.\n\nWithdrawals are handled by Bachs. I can’t confirm an individual bank transfer, its arrival time, or your available Bachs balance. Check Bachs for those details.`;
    response.actions = [{ label: 'Open payout & settlement', to: '/dashboard#payouts' }];
  } else if (topic === 'earnings') {
    const t = dashboard.totals;
    response.answer = `You’ve received ${t.successfulTipCount} successful ${t.successfulTipCount === 1 ? 'tip' : 'tips'}. Your recorded support by currency: ${money(t.byCurrency)}.\n\nFor ${t.periodLabel}, you have ${t.periodTipCount} successful tips${t.periodSupport === null ? '. A combined currency total is unavailable.' : ` totaling ${dashboard.currency} ${t.periodSupport}${t.converted ? ' (approximately, using reference exchange rates)' : ''}.`}\n\nThese totals describe support received, not a withdrawable balance.`;
    response.actions = [{ label: 'View my tips', to: '/dashboard/tips' }];
  } else if (topic === 'goal') {
    const g = dashboard.supportGoal;
    response.answer = g
      ? `Your goal “${g.title}” has reached ${g.currency} ${g.raisedAmount} of ${g.currency} ${g.targetAmount} (${g.percent}%).${g.raisedIncomplete ? ' This excludes support in currencies that could not be converted.' : ''}`
      : 'You don’t have an active support goal yet. Add a title and target in your profile’s support settings.';
    response.actions = [{ label: 'Manage my goal', to: '/dashboard/profile#support' }];
  } else if (topic === 'traffic') {
    response.answer = `Your page has ${dashboard.linkViews.lifetime} lifetime views and ${dashboard.linkViews.thisWeek} views this week. ${dashboard.conversion.viewsToTipsPercent === null ? 'There isn’t enough data to calculate your views-to-tips conversion yet.' : `Your views-to-tips conversion is ${dashboard.conversion.viewsToTipsPercent}%.`}`;
    response.actions = [{ label: 'Explore analytics', to: '/dashboard/analytics' }];
  } else if (topic === 'fees') {
    response.answer = `The platform fee reported by your dashboard is ${dashboard.platformFeePercent}%. Payment-provider fees may apply separately; I don’t have a verified fee breakdown for an individual transaction. Check its payment details with Bachs.`;
    response.actions = [{ label: 'View my tips', to: '/dashboard/tips' }];
  } else if (topic === 'profile') {
    response.answer = `Your creator name is ${dashboard.displayName} and your username is @${dashboard.username}. You can edit your profile and copy your public support link from profile settings.`;
    response.actions = [{ label: 'Open my profile settings', to: '/dashboard/profile' }];
  } else {
    response.answer = `Hi ${dashboard.displayName}! I can help with your payout setup, Friday payouts, recorded support, goals, page views, fees, and profile. Try “Is my payout setup complete?” or “How much support have I received?” I can explain your account information, but I can’t change settings or send payouts for you.`;
    response.actions = [{ label: 'Open payout & settlement', to: '/dashboard#payouts' }];
  }
  return response;
}
