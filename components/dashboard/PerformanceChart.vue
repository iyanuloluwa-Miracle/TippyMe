<template>
  <section class="performance-card" aria-labelledby="performance-title">
    <header class="performance-heading">
      <div><p class="performance-eyebrow">SMALL MOMENTS. REAL MOMENTUM.</p><h2 id="performance-title">Your community, in motion</h2></div>
      <label class="range-select"><span class="sr-only">Activity period</span><select v-model.number="days" @change="load"><option :value="7">Last 7 days</option><option :value="30">Last 30 days</option><option :value="90">Last 90 days</option></select></label>
    </header>
    <div class="performance-toolbar">
      <div class="metric-selector" role="group" aria-label="Chart metric"><button type="button" :aria-pressed="metric === 'views'" :class="{ selected: metric === 'views' }" @click="metric = 'views'">Page views</button><button type="button" :aria-pressed="metric === 'paidTips'" :class="{ selected: metric === 'paidTips' }" @click="metric = 'paidTips'">Successful tips</button></div>
      <span v-if="data && !loading && !error" class="chart-total"><strong>{{ metric === 'views' ? data.views : data.paidTips }}</strong> {{ metric === 'views' ? 'views' : 'tips' }}</span>
    </div>

    <div v-if="loading" class="chart-state" role="status">Loading your activity…</div>
    <div v-else-if="error" class="chart-state" role="alert"><p>We couldn’t load your activity.</p><button type="button" @click="load">Try again</button></div>
    <div v-else-if="!hasActivity" class="chart-state"><span aria-hidden="true">↗</span><h3>Your momentum starts here.</h3><p>No {{ metric === 'views' ? 'page views' : 'successful tips' }} recorded in these {{ days }} days.</p></div>
    <template v-else-if="data">
      <div class="chart-layout">
        <div class="chart-scale" aria-hidden="true"><span>{{ maximum }}</span><span>{{ maximum / 2 }}</span><span>0</span></div>
        <div class="chart-plot">
          <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="img" :aria-label="`Daily ${metric === 'views' ? 'page views' : 'successful tips'} over the last ${days} days. Exact values are available in the daily data table below.`">
            <path d="M0 1H640M0 90H640M0 179H640" stroke="#e7dfee" stroke-dasharray="3 5" vector-effect="non-scaling-stroke" />
            <rect v-for="(day, index) in data.daily" :key="day.date" :x="barX(index)" :y="178 - barHeight(day[metric])" :width="barWidth" :height="barHeight(day[metric])" rx="2" fill="#9567d2"><title>{{ day.date }}: {{ day[metric] }} {{ metric === 'views' ? 'views' : 'successful tips' }}</title></rect>
          </svg>
          <div class="chart-dates" aria-hidden="true"><span>{{ firstDate }}</span><span>{{ middleDate }}</span><span>{{ lastDate }}</span></div>
        </div>
      </div>
      <details class="chart-data"><summary>View daily data</summary><div class="chart-table-scroll"><table><caption class="sr-only">Daily activity in UTC</caption><thead><tr><th scope="col">Date (UTC)</th><th scope="col">Views</th><th scope="col">Successful tips</th></tr></thead><tbody><tr v-for="day in data.daily" :key="day.date"><th scope="row">{{ day.date }}</th><td>{{ day.views }}</td><td>{{ day.paidTips }}</td></tr></tbody></table></div></details>
    </template>
    <footer class="performance-footer"><span>{{ data && !loading && !error && data.conversionPercent !== null ? `${data.conversionPercent}% views-to-tips conversion` : 'Daily activity · UTC' }}</span><NuxtLink to="/dashboard/analytics">Explore analytics <span aria-hidden="true">↗</span></NuxtLink></footer>
  </section>
</template>

<script setup lang="ts">
import type { CreatorAnalytics } from '~/types/api';

const api = useApi();
const days = ref(30);
const metric = ref<'views' | 'paidTips'>('views');
const data = ref<CreatorAnalytics | null>(null);
const loading = ref(true);
const error = ref(false);
let requestId = 0;

const maximum = computed(() => {
  const max = Math.max(0, ...(data.value?.daily ?? []).map((day) => day[metric.value]));
  return Math.max(2, Math.ceil(max / 2) * 2);
});
const hasActivity = computed(() => data.value?.daily.some((day) => day[metric.value] > 0));
const slotWidth = computed(() => 640 / Math.max(1, data.value?.daily.length ?? 0));
const barWidth = computed(() => Math.max(1, slotWidth.value * .58));
const barX = (index: number) => slotWidth.value * index + (slotWidth.value - barWidth.value) / 2;
const barHeight = (value: number) => Math.max(0, value) / maximum.value * 174;
function dateLabel(value?: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
const firstDate = computed(() => dateLabel(data.value?.daily[0]?.date));
const middleDate = computed(() => dateLabel(data.value?.daily[Math.floor((data.value.daily.length - 1) / 2)]?.date));
const lastDate = computed(() => dateLabel(data.value?.daily.at(-1)?.date));

async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = false;
  try {
    const result = await api.getMyAnalytics(days.value);
    if (current === requestId) data.value = result.analytics;
  } catch {
    if (current === requestId) error.value = true;
  } finally {
    if (current === requestId) loading.value = false;
  }
}
onMounted(load);
onUnmounted(() => { requestId++; });
</script>

<style scoped>
.performance-card { min-width: 0; padding: 24px; border: 1px solid #e7dfee; border-radius: 20px; background: #ffffff; color: #261b38; box-shadow: 0 8px 24px #35204f06; }
.performance-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }.performance-heading h2 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.02em; line-height: 1.2; }.performance-eyebrow { color: #6d3db0; font-size: 9px; font-weight: 800; letter-spacing: .13em; margin: 0 0 8px; }
.range-select select { color: #6d3db0; background: #f7f4fb; border: 1px solid #e7dfee; padding: 6px 8px; border-radius: 8px; font: inherit; font-size: 12px; }
.performance-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin: 24px 0; }.metric-selector { display: inline-flex; gap: 4px; padding: 4px; border: 1px solid #e7dfee; border-radius: 10px; background: #f7f4fb; }.metric-selector button { color: #70647e; font-size: 11px; padding: 6px 10px; border-radius: 7px; }.metric-selector .selected { color: #6d3db0; background: #f1eafa; box-shadow: 0 1px 3px #0002; }.chart-total { font-size: 12px; color: #70647e; }.chart-total strong { font-size: 23px; color: #261b38; font-variant-numeric: tabular-nums; margin-right: 4px; }
.chart-layout { display: flex; gap: 12px; }.chart-scale { display: flex; flex-direction: column; justify-content: space-between; padding-bottom: 26px; width: 24px; font-size: 10px; color: #70647e; text-align: right; }.chart-plot { min-width: 0; flex: 1; }.chart-plot svg { display: block; width: 100%; height: 180px; overflow: visible; }.chart-plot rect:hover { fill: #7540b4; }.chart-dates { display: flex; justify-content: space-between; gap: 8px; padding-top: 12px; font-size: 10px; color: #70647e; }
.chart-state { display: flex; min-height: 210px; flex-direction: column; align-items: center; justify-content: center; padding: 24px; text-align: center; color: #70647e; font-size: 13px; }.chart-state > span { font-size: 32px; color: #6d3db0; }.chart-state h3 { color: #261b38; font-size: 16px; margin: 8px 0; }.chart-state p { margin: 8px 0; }.chart-state button { color: #6d3db0; text-decoration: underline; }
.performance-footer { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 16px; margin-top: 20px; border-top: 1px solid #e7dfee; font-size: 11px; color: #70647e; }.performance-footer a { color: #6d3db0; font-weight: 800; }.chart-data { font-size: 11px; color: #70647e; margin-top: 12px; }.chart-data summary { cursor: pointer; }.chart-table-scroll { max-height: 220px; overflow: auto; margin-top: 12px; }.chart-data table { width: 100%; border-collapse: collapse; }.chart-data th, .chart-data td { text-align: left; padding: 6px; border-bottom: 1px solid #e7dfee; }.chart-data th { font-weight: 600; }
button:focus-visible, select:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid #7c4ac0; outline-offset: 3px; }
@media (max-width: 1200px) { .performance-card { padding: 20px; } }
</style>
