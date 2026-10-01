<template>
  <div class="creator-workspace">
    <header class="workspace-topbar">
      <div class="workspace-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Overview</strong></div>
      <div class="workspace-topbar-actions">
        <span class="workspace-date">{{ todayLabel }}</span>
        <NuxtLink v-if="dashboard" :to="dashboard.publicPath" class="workspace-button workspace-button--quiet">View public page <span aria-hidden="true">↗</span></NuxtLink>
      </div>
    </header>

    <div v-if="loadError" class="workspace-error" role="alert">
      <span>{{ loadError }}</span><button type="button" :disabled="loading" @click="loadAll">Try again</button>
    </div>

    <div v-if="loading" class="workspace-loading" role="status" aria-label="Loading your dashboard">
      <div class="skeleton skeleton-heading" />
      <div class="summary-grid"><div class="skeleton skeleton-card" /><div class="skeleton skeleton-card" /></div>
      <div class="metrics-grid"><div v-for="item in 3" :key="item" class="skeleton skeleton-metric" /></div>
      <span class="sr-only">Loading your dashboard…</span>
    </div>

    <template v-else-if="dashboard">
      <section class="workspace-welcome" aria-label="Your creator workspace">
        <div>
          <p class="workspace-eyebrow">YOUR CREATOR WORKSPACE</p>
          <h1>{{ greeting }}, <span>{{ dashboard.displayName }}.</span></h1>
          <p class="workspace-subtitle">A little support. More room to create.</p>
        </div>
        <div class="creator-identity">
          <CreatorAvatarUploader v-model="dashboard.avatarUrl" :seed="dashboard.username" :alt="dashboard.displayName" variant="light" persist hint="" @uploaded="onAvatarUploaded" />
          <div><span class="creator-handle">@{{ dashboard.username }}</span><NuxtLink to="/dashboard/profile">Edit profile <span aria-hidden="true">↗</span></NuxtLink></div>
        </div>
      </section>

      <div class="summary-grid">
        <section class="support-summary" aria-labelledby="support-summary-title">
          <div class="card-heading">
            <div class="label-with-icon"><span class="summary-icon"><DashboardNavIcon name="tips" /></span><h2 id="support-summary-title">Total verified support</h2></div>
            <span class="period-pill">All time</span>
          </div>
          <p v-if="dashboard.totals.successfulSupport !== null" class="support-amount">{{ formatMoney(dashboard.totals.successfulSupport, dashboard.currency) }}</p>
          <ul v-else class="support-currencies">
            <li v-for="row in dashboard.totals.byCurrency" :key="row.currency">{{ formatMoney(row.amount, row.currency) }}</li>
            <li v-if="!dashboard.totals.byCurrency.length">{{ formatMoney('0.00', dashboard.currency) }}</li>
          </ul>
          <p class="support-caption">{{ dashboard.totals.successfulTipCount ? 'Every tip is a vote for what you do.' : 'Your next chapter starts with your first supporter.' }}</p>
          <p v-if="dashboard.totals.converted" class="summary-note">Approximate total at current exchange rates. Original currency totals are below.</p>
          <p v-else-if="dashboard.totals.successfulSupport === null && dashboard.totals.byCurrency.length > 1" class="summary-note">Currencies are shown separately where conversion is unavailable.</p>
          <div class="settlement-split">
            <div><span><i class="status-dot status-dot--mint" />Settled to Bachs</span><strong>{{ settledSummary || 'None recorded' }}</strong></div>
            <div><span><i class="status-dot status-dot--amber" />Held by TippyMe</span><strong>{{ heldSummary || 'None recorded' }}</strong></div>
          </div>
          <div class="summary-bottom"><span>Support received, not a withdrawable balance.</span><NuxtLink to="/dashboard/tips">View transactions <span aria-hidden="true">↗</span></NuxtLink></div>
          <details v-if="dashboard.totals.converted" class="currency-details">
            <summary>Original currency totals</summary>
            <p v-for="row in dashboard.totals.byCurrency" :key="row.currency">{{ formatMoney(row.amount, row.currency) }} · {{ row.count }} tips</p>
          </details>
        </section>

        <section id="payouts" class="workspace-card payout-card" aria-labelledby="payout-heading">
          <div class="card-heading"><h2 id="payout-heading">Payouts, made clear</h2><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" class="card-symbol"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></svg></div>
          <div class="payout-status" :class="{ 'payout-status--ready': settlementReady }"><span class="status-dot" />{{ settlementLabel }}</div>
          <p class="payout-description">{{ payoutDescription }}</p>
          <dl class="payout-facts"><div><dt>Destination</dt><dd>{{ settlementReady ? 'Bachs balance' : 'Complete setup' }}</dd></div><div><dt>Friday payouts</dt><dd>{{ fridayLabel }}</dd></div></dl>
          <button v-if="!settlementReady" type="button" class="workspace-button workspace-button--primary" :disabled="connectBusy" @click="startConnect">{{ connectBusy ? 'Connecting…' : settlementOnboarding ? 'Finish payout setup' : 'Connect Bachs payouts' }} <span aria-hidden="true">→</span></button>
          <button v-else-if="dashboard.settlement.automatedFridayPayout !== 'CONFIGURED'" type="button" class="workspace-button workspace-button--primary" :disabled="connectBusy" @click="enableFriday">{{ connectBusy ? 'Saving…' : 'Enable Friday payouts' }} <span aria-hidden="true">→</span></button>
          <button v-else type="button" class="workspace-button workspace-button--quiet" :disabled="connectBusy" @click="startConnect">{{ connectBusy ? 'Opening…' : 'Manage Bachs setup' }} <span aria-hidden="true">↗</span></button>
          <p v-if="connectError" class="inline-error" role="alert">{{ connectError }}</p>
          <details class="payout-details"><summary>How settlement works</summary><p>{{ dashboard.settlement.message }}</p><p>The {{ platformFeeLabel }} platform fee applies to tips settled by destination charge. Held tips are not a withdrawable balance.</p></details>
        </section>
      </div>

      <section class="metrics-grid" aria-label="Performance at a glance">
        <div class="metric-card"><span class="metric-icon"><DashboardNavIcon name="tips" /></span><div><h2>Successful tips</h2><strong>{{ dashboard.totals.successfulTipCount }}</strong><p>Support that came through</p></div><span class="metric-scope">All time</span></div>
        <div class="metric-card"><span class="metric-icon"><DashboardNavIcon name="public" /></span><div><h2>Page views</h2><strong>{{ dashboard.linkViews.lifetime }}</strong><p>{{ dashboard.linkViews.thisWeek }} this week <span>(UTC)</span></p></div><span class="metric-scope">All time</span></div>
        <div class="metric-card"><span class="metric-icon"><DashboardNavIcon name="analytics" /></span><div><h2>{{ dashboard.totals.periodLabel }}</h2><strong class="metric-money">{{ dashboard.totals.periodSupport !== null ? formatMoney(dashboard.totals.periodSupport, dashboard.currency) : 'Unavailable' }}</strong><p>{{ dashboard.totals.periodTipCount }} successful tips <span>(UTC)</span></p></div></div>
      </section>

      <div class="workspace-columns">
        <div class="workspace-main-column">
          <DashboardPerformanceChart />
          <section class="workspace-card activity-card" aria-labelledby="recent-support-heading">
            <div class="card-heading"><div><p class="workspace-eyebrow">THE PEOPLE BEHIND YOUR PROGRESS</p><h2 id="recent-support-heading">Recent support</h2></div><NuxtLink to="/dashboard/tips" class="text-action">View all <span aria-hidden="true">↗</span></NuxtLink></div>
            <p v-if="tipsError" class="inline-error" role="alert">{{ tipsError }} <button type="button" @click="loadTips">Retry</button></p>
            <p v-else-if="tipsLoading" class="empty-state" role="status">Loading recent support…</p>
            <div v-else-if="tips.length" class="transactions-wrap">
              <table class="transactions"><caption class="sr-only">Your five most recent tips</caption><thead><tr><th scope="col">Supporter</th><th scope="col">Status</th><th scope="col" class="amount-cell">Amount</th></tr></thead><tbody>
                <tr v-for="tip in tips" :key="tip.id">
                  <td><div class="supporter-cell"><span class="supporter-initial" aria-hidden="true">{{ supporterInitial(tip) }}</span><div><strong>{{ supporterName(tip) }}</strong><time :datetime="tip.createdAt">{{ formatTipDate(tip.createdAt) }}</time><p v-if="tip.message" class="tip-note" :title="tip.message">{{ tip.message }}</p></div></div></td>
                  <td><span class="transaction-status" :class="tipStatusClass(tip.status)">{{ tipStatusLabel(tip.status) }}</span></td>
                  <td class="amount-cell"><strong>{{ formatMoney(tip.amount, tip.currency) }}</strong><small>{{ tip.currency }}</small></td>
                </tr>
              </tbody></table>
            </div>
            <div v-else class="empty-state"><span class="empty-symbol" aria-hidden="true">♡</span><h3>Your first supporter belongs here.</h3><p>Share your page with the people who love your work.</p><a href="#share-your-page" class="text-action">Get your support link →</a></div>
          </section>
        </div>

        <div class="workspace-side-column">
          <section id="share-your-page" class="workspace-card creator-share-card" aria-labelledby="share-heading">
            <div class="card-heading"><span class="share-symbol" aria-hidden="true"><DashboardNavIcon name="public" /></span><span class="small-badge">MADE FOR SHARING</span></div>
            <h2 id="share-heading">Your work deserves support.</h2><p class="card-description">One link for your bio, your next post, and your biggest fans.</p>
            <DashboardShareTippyLink compact variant="light" :public-url="dashboard.publicUrl" :public-path="dashboard.publicPath" :display-name="dashboard.displayName" :goal-title="dashboard.supportGoal?.title" :goal-percent="dashboard.supportGoal?.percent" />
          </section>

          <section class="workspace-card goal-card" aria-labelledby="goal-heading">
            <div class="card-heading"><h2 id="goal-heading">Your next milestone</h2><span class="goal-symbol" aria-hidden="true">◎</span></div>
            <template v-if="dashboard.supportGoal">
              <h3>{{ dashboard.supportGoal.title }}</h3><div class="goal-values"><strong>{{ formatMoney(dashboard.supportGoal.raisedAmount, dashboard.supportGoal.currency) }}</strong><span>{{ dashboard.supportGoal.percent }}%</span></div>
              <div class="goal-track" role="progressbar" :aria-valuenow="dashboard.supportGoal.percent" aria-valuemin="0" aria-valuemax="100" :aria-label="dashboard.supportGoal.title"><div :style="{ width: `${Math.min(100, Math.max(0, dashboard.supportGoal.percent))}%` }" /></div>
              <p class="goal-target">of {{ formatMoney(dashboard.supportGoal.targetAmount, dashboard.supportGoal.currency) }} goal</p>
              <p v-if="dashboard.supportGoal.raisedIncomplete" class="summary-note">Excludes currencies that couldn’t be converted.</p>
              <NuxtLink to="/dashboard/profile" class="text-action">Manage goal ↗</NuxtLink>
            </template>
            <div v-else><p class="card-description">A new project? Better gear? Give your community something to help you build.</p><NuxtLink to="/dashboard/profile" class="workspace-button workspace-button--quiet">Set a support goal <span aria-hidden="true">+</span></NuxtLink></div>
          </section>

          <section class="workspace-card messages-card" aria-labelledby="messages-heading">
            <div class="card-heading"><h2 id="messages-heading">A little encouragement</h2><span aria-hidden="true" class="quote-symbol">“</span></div>
            <ul v-if="dashboard.recentMessages.length" class="supporter-notes"><li v-for="message in dashboard.recentMessages.slice(0, 3)" :key="message.id"><blockquote>{{ message.message }}</blockquote><p><span class="status-dot status-dot--mint" />{{ supporterName(message) }}<span>{{ formatMoney(message.amount, message.currency) }}</span></p></li></ul>
            <p v-else class="card-description">Messages from your supporters will appear here. Good words for the days you need them.</p>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  CreatorDashboard,
  CreatorTip,
} from '~/types/api';
import { ApiClientError } from '~/services/api';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
});

useHead({
  title: 'Dashboard — TippyMe',
});

const auth = useAuthStore();
const api = useApi();
const { avatarUrl: avatarUrlState, setFromProfile } = useDashboardNav();

const loading = ref(true);
const tipsLoading = ref(false);
const tipsError = ref<string | null>(null);
const loadError = ref<string | null>(null);
const dashboard = ref<CreatorDashboard | null>(null);
const tips = ref<CreatorTip[]>([]);
const todayLabel = computed(() => new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date()));

function supporterName(tip: CreatorTip) {
  return tip.isAnonymous ? 'Anonymous supporter' : tip.supporterName?.trim() || 'Supporter';
}
function supporterInitial(tip: CreatorTip) { return tip.isAnonymous ? '♡' : Array.from(supporterName(tip))[0]?.toUpperCase() || 'S'; }
function formatTipDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
function tipStatusLabel(status: CreatorTip['status']) {
  const labels = { PAID: 'Paid', CREATED: 'Created', CHECKOUT_PENDING: 'Pending', REFUNDED: 'Refunded', DISPUTED: 'Disputed', FAILED: 'Failed', EXPIRED: 'Expired' };
  return labels[status];
}
function tipStatusClass(status: CreatorTip['status']) {
  return status === 'PAID' ? 'transaction-status--paid' : ['FAILED', 'EXPIRED', 'DISPUTED'].includes(status) ? 'transaction-status--alert' : 'transaction-status--pending';
}

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
});

const settlementReady = computed(
  () => dashboard.value?.settlement.destinationChargesEnabled === true,
);

const settlementOnboarding = computed(
  () => dashboard.value?.settlement.readiness === 'ONBOARDING',
);
const payoutDescription = computed(() => settlementReady.value
  ? 'New eligible tips settle to your connected Bachs balance. Your payout settings are right here.'
  : settlementOnboarding.value
    ? 'You’re almost there. Finish Bachs onboarding to enable payouts for new tips.'
    : 'Connect your Bachs account to start settling new tips to your creator balance.');

const settlementLabel = computed(() => {
  if (settlementReady.value) return 'Bachs payouts enabled';
  if (settlementOnboarding.value) return 'Onboarding incomplete';
  return 'Not configured yet';
});

const fridayLabel = computed(() => {
  const status = dashboard.value?.settlement.automatedFridayPayout;
  if (status === 'CONFIGURED') return 'Enabled';
  if (status === 'NOT_ENABLED' && settlementReady.value) return 'Not enabled';
  return 'After setup';
});

function moneyList(rows: { amount: string; currency: string }[] | undefined) {
  if (!rows?.length) return '';
  return rows.map((row) => formatMoney(row.amount, row.currency)).join(', ');
}

const platformFeeLabel = computed(() => {
  const percent = dashboard.value?.platformFeePercent ?? 5;
  return `${percent}%`;
});

const heldSummary = computed(() => moneyList(dashboard.value?.totals.heldByCurrency));
const settledSummary = computed(() => moneyList(dashboard.value?.totals.settledByCurrency));

const connectBusy = ref(false);
const connectError = ref<string | null>(null);

async function startConnect() {
  connectBusy.value = true;
  connectError.value = null;
  try {
    const result = await api.startConnectOnboarding();
    if (dashboard.value) {
      dashboard.value.settlement = result.settlement;
    }
    if (result.onboardingUrl) {
      openBachsOnboardingUrl(result.onboardingUrl);
      return;
    }
    if (result.settlement.automatedFridayPayout !== 'CONFIGURED') {
      const friday = await api.enableFridayPayout();
      if (dashboard.value) {
        dashboard.value.settlement = friday.settlement;
      }
    }
  } catch (err) {
    connectError.value =
      err instanceof ApiClientError
        ? err.message
        : 'Could not start Bachs Connect.';
  } finally {
    connectBusy.value = false;
  }
}

async function enableFriday() {
  connectBusy.value = true;
  connectError.value = null;
  try {
    const result = await api.enableFridayPayout();
    if (dashboard.value) {
      dashboard.value.settlement = result.settlement;
    }
  } catch (err) {
    connectError.value =
      err instanceof ApiClientError
        ? err.message
        : 'Could not enable Friday payouts.';
  } finally {
    connectBusy.value = false;
  }
}

watch(
  () => dashboard.value,
  (dash) => {
    if (!dash) return;
    setFromProfile({
      publicPath: dash.publicPath,
      avatarUrl: dash.avatarUrl,
    });
  },
  { immediate: true },
);

function onAvatarUploaded(url: string) {
  avatarUrlState.value = url;
  if (dashboard.value) {
    dashboard.value.avatarUrl = url;
  }
}

onMounted(async () => {
  await loadAll();
  // This section is rendered only after the account request finishes.
  if (window.location.hash === '#payouts') {
    await nextTick();
    document.getElementById('payouts')?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
});

async function loadAll() {
  loading.value = true;
  loadError.value = null;
  try {
    const result = await api.getMyDashboard();
    dashboard.value = result.dashboard;
    void loadTips();
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 401) {
      auth.setUser(null);
      await navigateTo('/login?next=/dashboard');
      return;
    }
    if (err instanceof ApiClientError && err.statusCode === 404) {
      await navigateTo('/onboarding');
      return;
    }
    loadError.value =
      err instanceof Error ? err.message : 'Could not load dashboard.';
  } finally {
    loading.value = false;
  }
}

async function loadTips() {
  if (tipsLoading.value) return;
  tipsLoading.value = true;
  tipsError.value = null;
  try {
    const result = await api.listMyTips({
      page: 1,
      pageSize: 5,
    });
    tips.value = result.tips;
  } catch (err) {
    tipsError.value =
      err instanceof Error ? err.message : 'Could not load tips.';
  } finally {
    tipsLoading.value = false;
  }
}

function formatMoney(amount: string, currency: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} ${amount}`;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${amount}`;
  }
}
</script>

<style scoped>
.creator-workspace {
  --workspace-muted: var(--dashboard-text-secondary, #53445f);
  --workspace-border: #e7dfee;
  color: #261b38;
  max-width: 1600px;
  margin: 0 auto;
  padding: 24px 32px 32px;
}
.workspace-topbar, .workspace-topbar-actions, .workspace-breadcrumb { display: flex; align-items: center; gap: 16px; }
.workspace-topbar { justify-content: space-between; padding-bottom: 24px; border-bottom: 1px solid var(--workspace-border); }
.workspace-breadcrumb { font-size: 14px; color: var(--workspace-muted); gap: 12px; }
.workspace-breadcrumb strong { color: #261b38; font-weight: 700; }
.workspace-date { font-size: 13px; color: var(--workspace-muted); }
.workspace-welcome { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 32px 0; }
.workspace-eyebrow { color: #6d3db0; font-size: 12px; font-weight: 800; letter-spacing: .13em; margin: 0 0 8px; }
.workspace-welcome h1 { margin: 0; font-size: clamp(26px, 2.8vw, 36px); line-height: 1.15; letter-spacing: -.035em; font-weight: 800; overflow-wrap: anywhere; }
.workspace-welcome h1 span { color: #6d3db0; }
.workspace-subtitle { color: var(--workspace-muted); font-size: 15px; margin: 8px 0 0; }
.creator-identity { display: flex; align-items: center; gap: 12px; flex-shrink: 0; max-width: 35%; }
.creator-identity > div:last-child { min-width: 0; }
.creator-identity :deep(button) { width: 48px; height: 48px; border-radius: 16px; }
.creator-handle { display: block; overflow: hidden; text-overflow: ellipsis; font-size: 14px; white-space: nowrap; }
.creator-identity a { color: var(--dashboard-text-secondary, #53445f); font-size: 13px; }
.summary-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr); gap: 24px; }
.workspace-card, .support-summary, .metric-card { min-width: 0; border: 1px solid var(--workspace-border); border-radius: 20px; box-shadow: 0 8px 24px #35204f06; }
.workspace-card { background: #ffffff; padding: 24px; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.card-heading h2 { margin: 0; font-size: 18px; letter-spacing: -.02em; font-weight: 800; line-height: 1.2; }
.card-symbol { width: 24px; height: 24px; flex-shrink: 0; color: #6d3db0; }
.support-summary { position: relative; padding: 24px 32px; overflow: hidden; background: radial-gradient(ellipse at 95% 0%, #d9c1fa35, transparent 60%), linear-gradient(115deg, #fff, #f5efff 72%); }
.support-summary::before { content: ''; position: absolute; top: -90px; right: -50px; width: 230px; height: 230px; border: 1px solid #e1caff0c; box-shadow: 0 0 0 28px #e1caff05, 0 0 0 56px #e1caff04; border-radius: 50%; pointer-events: none; }
.support-summary > * { position: relative; }
.label-with-icon { display: flex; align-items: center; gap: 12px; }
.label-with-icon h2 { font-size: 15px; font-weight: 700; }
.summary-icon, .metric-icon, .share-symbol { display: grid; place-items: center; width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; background: #ffffff; border: 1px solid #e7dfee; color: #6d3db0; }
.summary-icon svg, .metric-icon svg, .share-symbol svg { width: 23px; height: 23px; }
.period-pill { color: #6d3db0; border: 1px solid #e7dfee; border-radius: 8px; padding: 4px 10px; font-size: 12px; white-space: nowrap; }
.support-amount { margin: 24px 0 8px; font-size: clamp(32px, 3.7vw, 56px); line-height: 1.05; letter-spacing: -.045em; font-weight: 800; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.support-currencies { list-style: none; margin: 24px 0 8px; padding: 0; font-size: 30px; font-weight: 800; overflow-wrap: anywhere; }
.support-caption { margin: 0; font-size: 14px; color: var(--dashboard-text-secondary, #53445f); }
.summary-note { color: var(--dashboard-text-secondary, #53445f); font-size: 12px; line-height: 1.5; margin-top: 12px; }
.settlement-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e7dfee; }
.settlement-split > div { min-width: 0; }
.settlement-split span { display: flex; align-items: center; gap: 8px; color: var(--dashboard-text-secondary, #53445f); font-size: 12px; }
.settlement-split strong { display: block; margin-top: 8px; font-size: 17px; line-height: 1.25; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.status-dot { display: inline-block; flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.status-dot--mint { background: #237350; }.status-dot--amber { background: #986015; }
.summary-bottom { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 24px; color: var(--dashboard-text-secondary, #53445f); font-size: 12px; }
.summary-bottom a { color: #6d3db0; font-weight: 800; }
.currency-details { margin-top: 12px; color: var(--dashboard-text-secondary, #53445f); font-size: 12px; }.currency-details summary { cursor: pointer; }.currency-details p { margin: 4px 0; }
.payout-card { scroll-margin-top: 7rem; display: flex; flex-direction: column; align-items: stretch; }
.payout-status { display: flex; align-items: center; gap: 8px; width: fit-content; margin-top: 20px; padding: 4px 10px; border-radius: 8px; background: #fff6e7; color: #986015; font-size: 12px; font-weight: 700; }
.payout-status--ready { color: #237350; background: #edf8f1; }
.payout-description { color: var(--workspace-muted); font-size: 14px; line-height: 1.5; margin: 12px 0 16px; }
.payout-facts { display: grid; gap: 8px; margin: 0 0 20px; font-size: 13px; }.payout-facts div { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; }.payout-facts dt { color: var(--workspace-muted); }.payout-facts dd { margin: 0; font-weight: 700; }
.workspace-button { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 40px; padding: 8px 16px; border: 1px solid #e7dfee; border-radius: 12px; font-size: 13px; font-weight: 800; text-decoration: none; transition: background .16s ease, border-color .16s ease; }
.workspace-button--primary { color: #fff; background: #7540b4; border-color: #7540b4; }.workspace-button--primary:hover { background: #603197; }.workspace-button--quiet { color: #6d3db0; background: #ffffff; }.workspace-button--quiet:hover { background: #f1eafa; border-color: #e3caff55; }
.workspace-button:disabled { opacity: .6; cursor: wait; }.payout-card > .workspace-button { margin-top: auto; }
.payout-details { margin-top: 12px; color: var(--workspace-muted); font-size: 12px; line-height: 1.5; }.payout-details summary { cursor: pointer; }.payout-details p { margin-top: 8px; }
.metrics-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin: 24px 0; }
.metric-card { position: relative; display: flex; align-items: flex-start; gap: 16px; padding: 24px; background: #ffffff; }
.metric-icon { width: 36px; height: 36px; background: #b293f012; color: #6d3db0; }
.metric-card > div { min-width: 0; }.metric-card h2 { margin: 0; font-size: 13px; font-weight: 700; color: var(--dashboard-text-secondary, #53445f); }.metric-card strong { display: block; margin-top: 8px; font-size: 30px; font-weight: 800; line-height: 1.1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }.metric-card .metric-money { font-size: 25px; }.metric-card p { margin: 8px 0 0; font-size: 12px; color: var(--dashboard-text-secondary, #53445f); }.metric-card p span { font-size: 12px; }.metric-scope { position: absolute; top: 16px; right: 16px; color: var(--dashboard-text-secondary, #53445f); font-size: 12px; }
.workspace-columns { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr); gap: 24px; align-items: start; }
.workspace-main-column, .workspace-side-column { display: grid; gap: 24px; min-width: 0; }
.text-action { color: #6d3db0; font-size: 13px; font-weight: 800; white-space: nowrap; }.text-action:hover { color: #512780; text-decoration: underline; }
.activity-card { padding-bottom: 8px; }.activity-card > .card-heading { margin-bottom: 24px; }.activity-card .workspace-eyebrow { font-size: 12px; }
.transactions-wrap { overflow-x: auto; }.transactions { width: 100%; border-collapse: collapse; }.transactions th { padding: 0 0 12px; text-align: left; color: var(--dashboard-text-secondary, #53445f); font-size: 12px; font-weight: 700; }.transactions td { padding: 16px 0; border-top: 1px solid var(--workspace-border); }.transactions .amount-cell { text-align: right; padding-left: 8px; }.amount-cell strong { display: block; font-size: 15px; font-variant-numeric: tabular-nums; white-space: nowrap; }.amount-cell small { display: block; color: var(--dashboard-text-secondary, #53445f); font-size: 12px; margin-top: 3px; }
.supporter-cell { display: flex; align-items: center; gap: 12px; }.supporter-cell > div { min-width: 0; }.supporter-cell strong { display: block; font-size: 14px; overflow-wrap: anywhere; }.supporter-cell time { display: block; color: var(--dashboard-text-secondary, #53445f); font-size: 12px; margin-top: 2px; }.supporter-initial { display: grid; place-items: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 12px; color: #6d3db0; background: #bea1f115; font-size: 15px; }.tip-note { max-width: 170px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; color: var(--dashboard-text-secondary, #53445f); margin: 4px 0 0; }
.transaction-status { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }.transaction-status--paid { background: #edf8f1; color: #237350; }.transaction-status--alert { background: #fff1f3; color: #ac3047; }.transaction-status--pending { background: #fff6e7; color: #986015; }
.creator-share-card { background: radial-gradient(ellipse at top right, #855cc926, transparent 65%), #faf7ff; scroll-margin-top: 7rem; }.share-symbol { --nav-icon-accent: #7c4ac0; background: #9362ff20; }.small-badge { font-size: 12px; letter-spacing: .12em; color: #6d3db0; font-weight: 800; }.creator-share-card > h2 { margin: 20px 0 8px; max-width: 240px; font-size: 25px; letter-spacing: -.035em; line-height: 1.15; font-weight: 800; }.card-description { font-size: 14px; color: var(--workspace-muted); line-height: 1.5; margin: 12px 0 20px; }
.goal-symbol { color: #6d3db0; font-size: 26px; }.goal-card h3 { font-size: 15px; margin: 16px 0; color: var(--dashboard-text-secondary, #53445f); }.goal-values { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }.goal-values strong { font-size: 23px; overflow-wrap: anywhere; }.goal-values span { color: #6d3db0; font-size: 14px; }.goal-track { height: 6px; border-radius: 8px; background: #be9ae61a; margin: 12px 0; overflow: hidden; }.goal-track > div { height: 100%; background: #7c4ac0; border-radius: inherit; }.goal-target { font-size: 12px; color: var(--workspace-muted); margin: 0 0 16px; }.goal-card .workspace-button { width: 100%; }
.quote-symbol { color: #6d3db0; font-size: 36px; line-height: .7; }.supporter-notes { list-style: none; padding: 0; margin: 8px 0 0; }.supporter-notes li { padding: 16px 0; border-bottom: 1px solid var(--workspace-border); }.supporter-notes li:last-child { padding-bottom: 0; border-bottom: 0; }.supporter-notes blockquote { margin: 0; color: #261b38; font-size: 14px; line-height: 1.55; overflow-wrap: anywhere; }.supporter-notes p { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--dashboard-text-secondary, #53445f); margin: 12px 0 0; }.supporter-notes p > span:last-child { margin-left: auto; }
.empty-state { text-align: center; padding: 32px 16px; color: var(--workspace-muted); }.empty-state h3 { color: #261b38; font-size: 17px; margin: 8px 0; }.empty-state p { font-size: 13px; margin: 8px 0 16px; }.empty-symbol { color: #6d3db0; font-size: 32px; }
.workspace-error { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0; padding: 16px; border: 1px solid #f3d0d7; border-radius: 16px; color: #ac3047; background: #fff1f3; }.workspace-error button, .inline-error button { text-decoration: underline; }.inline-error { color: #ac3047; font-size: 13px; margin: 12px 0; }
.workspace-loading { padding-top: 32px; }.skeleton { background: #bc9bea13; border: 1px solid var(--workspace-border); border-radius: 20px; }.skeleton-heading { height: 56px; width: 60%; margin-bottom: 32px; }.skeleton-card { height: 320px; }.skeleton-metric { height: 128px; }
.creator-workspace :is(a, button, summary):focus-visible { outline: 2px solid #7c4ac0; outline-offset: 4px; }
@media (min-width: 1800px) { .creator-workspace { padding-top: 32px; } }
@media (max-width: 1200px) { .creator-workspace { padding: 24px; }.summary-grid { grid-template-columns: minmax(0, 1.25fr) minmax(280px, 1fr); gap: 16px; }.workspace-columns { grid-template-columns: minmax(0, 1.3fr) minmax(280px, 1fr); gap: 16px; }.workspace-card, .support-summary { padding: 20px; }.metric-card { padding: 20px 16px; gap: 12px; }.metric-scope { display: none; }.metric-icon { display: none; }.workspace-main-column, .workspace-side-column { gap: 16px; }.support-amount { font-size: 40px; }.supporter-initial { display: none; } }
@media (max-width: 1024px) { .summary-grid, .workspace-columns { grid-template-columns: minmax(0, 1fr); }.workspace-side-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }.creator-share-card { grid-row: span 2; }.creator-identity > div:last-child { display: none; }.supporter-initial { display: grid; }.metrics-grid { gap: 12px; }.payout-card > .workspace-button { align-self: flex-start; }.support-amount { font-size: 48px; }.workspace-date { display: none; } }
@media (max-width: 600px) { .creator-workspace { padding: 16px; }.workspace-topbar { gap: 8px; padding-bottom: 16px; }.workspace-breadcrumb { font-size: 12px; gap: 8px; }.workspace-topbar .workspace-button { font-size: 12px; padding: 8px 10px; min-height: 36px; }.workspace-welcome { padding: 24px 0; gap: 16px; }.workspace-welcome h1 { font-size: 26px; }.workspace-eyebrow { font-size: 12px; }.workspace-subtitle { font-size: 13px; }.creator-identity { max-width: 48px; }.summary-grid { gap: 16px; }.support-amount { font-size: 40px; }.settlement-split { gap: 12px; }.settlement-split strong { font-size: 15px; }.metrics-grid { grid-template-columns: minmax(0, 1fr); gap: 8px; margin: 16px 0; }.metric-card { padding: 16px; align-items: center; }.metric-icon { display: grid; }.metric-card > div { flex: 1; display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; }.metric-card strong, .metric-card .metric-money { grid-row: span 2; grid-column: 2; font-size: 24px; margin: 0; }.metric-card p { margin: 0; }.workspace-side-column { grid-template-columns: minmax(0, 1fr); }.creator-share-card { grid-row: auto; }.supporter-initial { display: none; }.transactions .amount-cell { padding-left: 4px; }.amount-cell strong { font-size: 13px; }.tip-note { max-width: 110px; }.supporter-cell strong { font-size: 13px; }.activity-card .workspace-eyebrow { max-width: 170px; line-height: 1.5; }.transaction-status { padding: 3px 6px; } }
@media (prefers-reduced-motion: reduce) { .workspace-button { transition: none; } }
</style>
