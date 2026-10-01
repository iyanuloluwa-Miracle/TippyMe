<template>
  <div class="studio-page">
    <div class="studio-breadcrumb"><NuxtLink to="/dashboard">Workspace</NuxtLink><span aria-hidden="true">/</span><strong>Analytics</strong></div>
    <header class="studio-page-header"><div><p class="studio-kicker">UNDERSTAND YOUR MOMENTUM</p><h1>A closer look at your reach.</h1><p class="studio-intro">See how people find your page, what brings them back, and when they choose to support.</p></div><label class="analytics-range"><span class="sr-only">Analytics date range</span><select v-model.number="days" @change="load"><option :value="7">Last 7 days</option><option :value="30">Last 30 days</option><option :value="90">Last 90 days</option></select></label></header>
    <div v-if="error" class="studio-error" role="alert">{{ error }}<button type="button" @click="load">Try again</button></div>
    <div v-if="loading" role="status"><div class="studio-skeleton" /><div class="studio-skeleton" style="height: 320px" /><span class="sr-only">Loading analytics…</span></div>
    <div v-else-if="analytics && !error" class="studio-card-stack">
      <section class="studio-summary-grid analytics-metrics" aria-label="Performance for selected date range"><div v-for="(item, index) in cards" :key="item.label" class="studio-stat"><p>{{ item.label }}</p><strong>{{ item.value }}</strong><small>{{ ['Visits to your public page', 'Verified successful support', 'Views that became tips'][index] }}</small></div></section>
      <div class="analytics-columns">
        <section class="studio-card analytics-chart">
          <div class="studio-card-heading"><div><h2>Activity over time</h2><p class="studio-muted">Your daily views and paid tips · UTC</p></div><div class="analytics-legend"><span><i />Views</span><span><i />Paid tips</span></div></div>
          <div v-if="!hasActivity" class="studio-empty"><DashboardNavIcon name="analytics" /><h3>A fresh start for your page.</h3><p>No activity in this date range yet. Share your link to start building momentum.</p><NuxtLink to="/dashboard/profile#sharing" class="studio-link">Find your sharing tools ↗</NuxtLink></div>
          <div v-else class="analytics-plot-wrap">
            <div class="analytics-plot" role="img" :aria-label="chartAriaLabel">
              <div v-for="tick in yTicks" :key="tick.label" class="analytics-grid-line" :style="{ bottom: `${tick.pct}%` }"><span>{{ tick.label }}</span></div>
              <div v-for="day in analytics.daily" :key="day.date" class="analytics-day" :title="`${formatDayLabel(day.date, true)}: ${day.views} views, ${day.paidTips} paid tips`"><div class="analytics-bar analytics-bar--views" :style="{ height: barHeight(day.views) }" /><div class="analytics-bar analytics-bar--tips" :style="{ height: barHeight(day.paidTips) }" /></div>
            </div>
            <div class="analytics-axis"><span v-for="label in xLabels" :key="label.key">{{ label.text }}</span></div>
          </div>
          <details class="analytics-data"><summary>View exact daily values</summary><div class="analytics-table-scroll"><table><caption class="sr-only">Daily analytics in UTC</caption><thead><tr><th scope="col">Date</th><th scope="col">Views</th><th scope="col">Paid tips</th></tr></thead><tbody><tr v-for="day in analytics.daily" :key="day.date"><th scope="row">{{ formatDayLabel(day.date, true) }}</th><td>{{ day.views }}</td><td>{{ day.paidTips }}</td></tr></tbody></table></div></details>
        </section>
        <section class="studio-card"><p class="studio-kicker">DISCOVERY</p><h2>Where they find you</h2><p class="studio-muted">Referrals recorded for this date range.</p><ul v-if="analytics.sources.length" class="referral-list"><li v-for="source in analytics.sources" :key="source.source"><div><strong>{{ source.source }}</strong><span>{{ source.views }} views</span></div><div class="referral-track"><span :style="{ width: `${sourceBarWidth(source.views)}%` }" /></div></li></ul><div v-else class="studio-empty"><p>No tracked referrals yet. Add a source tag to your next shared link.</p></div><div class="referral-tip"><span aria-hidden="true">✦</span><p>Know what’s working. Add <code>?ref=instagram</code> to your link to track visits from your bio.</p></div></section>
      </div>
      <aside class="studio-card analytics-next"><div><p class="studio-kicker">KEEP THE CONVERSATION GOING</p><h2>Make your next share count.</h2><p class="studio-muted">Try your support link in a post, a project README, or your social bio.</p></div><NuxtLink to="/dashboard/profile#sharing" class="studio-button studio-button--primary">Open sharing tools ↗</NuxtLink></aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreatorAnalytics } from '~/types/api';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
});

useHead({ title: 'Analytics — TippyMe' });

const api = useApi();
const days = ref(30);
const analytics = ref<CreatorAnalytics | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);
let requestId = 0;
onUnmounted(() => { requestId++; });

const maxValue = computed(() => {
  const daily = analytics.value?.daily ?? [];
  return Math.max(
    0,
    ...daily.map((item) => item.views),
    ...daily.map((item) => item.paidTips),
  );
});

const scaleMax = computed(() => niceCeiling(maxValue.value));

const hasActivity = computed(() => maxValue.value > 0);

const cards = computed(() => {
  if (!analytics.value) return [];
  return [
    { label: 'Link views', value: analytics.value.views },
    { label: 'Paid tips', value: analytics.value.paidTips },
    {
      label: 'View → tip conversion',
      value:
        analytics.value.conversionPercent == null
          ? '—'
          : `${analytics.value.conversionPercent}%`,
    },
  ];
});

const yTicks = computed(() => {
  const top = scaleMax.value;
  if (top <= 0) return [];
  return [0, 0.5, 1].map((fraction) => {
    const value = Math.round(top * fraction);
    return {
      label: String(value),
      pct: fraction * 100,
    };
  });
});

const xLabels = computed(() => {
  const daily = analytics.value?.daily ?? [];
  if (!daily.length) return [];
  const first = daily[0]!;
  const mid = daily[Math.floor((daily.length - 1) / 2)]!;
  const last = daily[daily.length - 1]!;
  return [
    { key: 'first', text: formatDayLabel(first.date), align: 'text-left' },
    { key: 'mid', text: formatDayLabel(mid.date), align: 'text-center' },
    { key: 'last', text: formatDayLabel(last.date), align: 'text-right' },
  ];
});

const chartAriaLabel = computed(() => {
  if (!analytics.value) return 'Daily activity chart';
  return `Daily activity for the last ${days.value} days. ${analytics.value.views} views and ${analytics.value.paidTips} paid tips.`;
});

function niceCeiling(value: number): number {
  if (value <= 0) return 0;
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function barHeight(value: number): string {
  const top = scaleMax.value;
  if (top <= 0 || value <= 0) return '0%';
  return `${(value / top) * 100}%`;
}

function sourceBarWidth(views: number): number {
  const top = Math.max(0, ...(analytics.value?.sources ?? []).map((source) => source.views));
  if (!top) return 0;
  return Math.max(0, Math.min(100, (views / top) * 100));
}

function formatDayLabel(isoDate: string, long = false): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    month: long ? 'short' : 'short',
    day: 'numeric',
    ...(long ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = null;
  try {
    const result = await api.getMyAnalytics(days.value);
    if (current === requestId) analytics.value = result.analytics;
  } catch (err) {
    if (current === requestId) error.value =
      err instanceof Error ? err.message : 'Could not load analytics.';
  } finally {
    if (current === requestId) loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.analytics-metrics { margin-bottom: 0; }.analytics-columns { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(260px, 1fr); gap: 24px; align-items: start; }.analytics-legend { display: flex; gap: 16px; font-size: 11px; color: #70647e; }.analytics-legend span { display: flex; align-items: center; gap: 6px; }.analytics-legend i { width: 8px; height: 8px; border-radius: 3px; background: #7c4ac0; }.analytics-legend span:last-child i { background: #237350; }
.analytics-plot-wrap { padding-left: 24px; margin-top: 40px; }.analytics-plot { position: relative; height: 240px; display: flex; align-items: flex-end; gap: 3px; }.analytics-grid-line { position: absolute; left: 0; right: 0; border-top: 1px dashed #e7dfee; pointer-events: none; }.analytics-grid-line > span { position: absolute; right: calc(100% + 8px); top: -7px; color: #70647e; font-size: 10px; }.analytics-day { display: flex; align-items: flex-end; justify-content: center; gap: 2px; height: 100%; min-width: 0; flex: 1; position: relative; }.analytics-bar { width: 45%; max-width: 14px; border-radius: 3px 3px 0 0; }.analytics-bar--views { background: #7c4ac0; }.analytics-bar--tips { background: #237350; }.analytics-day:hover { background: #e0c7fa0a; }.analytics-axis { display: flex; justify-content: space-between; gap: 8px; margin-top: 16px; font-size: 10px; color: #70647e; }
.analytics-data { margin-top: 24px; color: #70647e; font-size: 12px; }.analytics-data summary { cursor: pointer; }.analytics-table-scroll { max-height: 260px; overflow: auto; margin-top: 12px; }.analytics-data table { width: 100%; border-collapse: collapse; }.analytics-data th, .analytics-data td { text-align: left; padding: 8px; border-bottom: 1px solid #e7dfee; }.analytics-data th { font-weight: 600; }.referral-list { list-style: none; margin: 24px 0; padding: 0; display: grid; gap: 24px; }.referral-list li > div:first-child { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }.referral-list strong { overflow-wrap: anywhere; }.referral-list li span { color: #70647e; white-space: nowrap; }.referral-track { height: 6px; background: #c29be418; border-radius: 6px; overflow: hidden; margin-top: 12px; }.referral-track span { display: block; height: 100%; background: #7c4ac0; border-radius: inherit; }.referral-tip { display: flex; align-items: flex-start; gap: 12px; border-top: 1px solid #e7dfee; padding-top: 16px; color: #70647e; font-size: 12px; line-height: 1.5; }.referral-tip p { margin: 0; }.referral-tip > span { color: #237350; }.referral-tip code { font-size: 10px; overflow-wrap: anywhere; }.analytics-next { display: flex; align-items: center; justify-content: space-between; gap: 24px; background: radial-gradient(ellipse at right, #7247a62b, transparent 70%), #ffffff; }.analytics-next .studio-button { flex-shrink: 0; }
@media (max-width: 1100px) { .analytics-columns { grid-template-columns: minmax(0, 1fr); }.referral-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .analytics-plot { height: 190px; gap: 1px; }.analytics-day { gap: 1px; }.analytics-next { flex-direction: column; align-items: flex-start; }.analytics-columns { gap: 16px; }.referral-list { grid-template-columns: minmax(0, 1fr); } }
</style>
