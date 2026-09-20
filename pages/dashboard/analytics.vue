<template>
  <div class="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-cheer-leaf">
          Insights
        </p>
        <h1 class="mt-2 text-4xl font-extrabold tracking-tight text-cheer-ink">
          Analytics
        </h1>
      </div>
      <select
        v-model.number="days"
        class="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-cheer-ink"
        @change="load"
      >
        <option :value="7">Last 7 days</option>
        <option :value="30">Last 30 days</option>
        <option :value="90">Last 90 days</option>
      </select>
    </header>

    <p
      v-if="error"
      class="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700"
      role="alert"
    >
      {{ error }}
    </p>

    <div v-else-if="analytics" class="mt-6 space-y-5">
      <section class="grid gap-3 sm:grid-cols-3">
        <div
          v-for="item in cards"
          :key="item.label"
          class="rounded-3xl border border-black/6 bg-white p-5"
        >
          <p class="text-sm font-semibold text-cheer-ink/55">
            {{ item.label }}
          </p>
          <p class="mt-2 text-3xl font-extrabold text-cheer-ink">
            {{ item.value }}
          </p>
        </div>
      </section>

      <section class="rounded-3xl border border-black/6 bg-white p-5 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-extrabold tracking-tight text-cheer-ink">
            Daily activity
          </h2>
          <div class="flex flex-wrap items-center gap-4 text-xs font-semibold">
            <span class="inline-flex items-center gap-1.5 text-cheer-ink/70">
              <span class="h-2.5 w-2.5 rounded-sm bg-cheer-leaf" />
              Views
            </span>
            <span class="inline-flex items-center gap-1.5 text-cheer-ink/70">
              <span class="h-2.5 w-2.5 rounded-sm bg-[#f3af2f]" />
              Paid tips
            </span>
          </div>
        </div>

        <div
          v-if="!hasActivity"
          class="mt-8 rounded-2xl border border-dashed border-black/10 bg-[#f7f4ff] px-4 py-10 text-center"
        >
          <p class="font-semibold text-cheer-ink">
            No daily activity in this range yet
          </p>
          <p class="mt-1 text-sm text-cheer-ink/55">
            Share your Tippy link — views and paid tips will show up here.
          </p>
        </div>

        <div v-else class="mt-6">
          <div
            class="relative flex h-48 items-end gap-px sm:h-56 sm:gap-0.5"
            role="img"
            :aria-label="chartAriaLabel"
          >
            <div
              v-for="tick in yTicks"
              :key="tick.label"
              class="pointer-events-none absolute inset-x-0 border-t border-black/5"
              :style="{ bottom: `${tick.pct}%` }"
            >
              <span
                class="absolute -top-2.5 right-0 translate-y-[-100%] text-[0.65rem] font-medium text-cheer-ink/35 sm:right-auto sm:-left-1 sm:-translate-x-full"
              >
                {{ tick.label }}
              </span>
            </div>

            <div
              v-for="day in analytics.daily"
              :key="day.date"
              class="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <div
                class="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-10 hidden w-max -translate-x-1/2 rounded-xl bg-cheer-ink px-2.5 py-1.5 text-[0.7rem] font-semibold text-white shadow-lg group-hover:block group-focus-within:block"
              >
                <p>{{ formatDayLabel(day.date, true) }}</p>
                <p class="mt-0.5 font-medium text-white/75">
                  {{ day.views }} views · {{ day.paidTips }} tips
                </p>
              </div>

              <div class="flex h-full w-full items-end justify-center gap-0.5 px-[1px] sm:gap-1 sm:px-0.5">
                <div class="flex h-full w-full max-w-[12px] flex-col justify-end sm:max-w-[14px]">
                  <div
                    class="w-full rounded-t-md bg-gradient-to-t from-cheer-leaf to-[#b794ff] transition-[height] duration-300"
                    :style="{ height: barHeight(day.views) }"
                  />
                </div>
                <div class="flex h-full w-full max-w-[12px] flex-col justify-end sm:max-w-[14px]">
                  <div
                    class="w-full rounded-t-md bg-gradient-to-t from-[#d9920f] to-[#f3af2f] transition-[height] duration-300"
                    :style="{ height: barHeight(day.paidTips) }"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 flex justify-between gap-2 border-t border-black/6 pt-3 text-[0.65rem] font-semibold text-cheer-ink/45 sm:text-xs">
            <span
              v-for="label in xLabels"
              :key="label.key"
              class="min-w-0 flex-1 text-center"
              :class="label.align"
            >
              {{ label.text }}
            </span>
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-black/6 bg-white p-5 sm:p-6">
        <h2 class="text-xl font-extrabold tracking-tight text-cheer-ink">
          Where visits came from
        </h2>
        <p
          v-if="!analytics.sources.length"
          class="mt-3 text-sm text-cheer-ink/55"
        >
          No tracked referrals yet. Add
          <code class="rounded bg-black/5 px-1">?ref=instagram</code>
          to a shared link.
        </p>
        <ul v-else class="mt-3 divide-y divide-black/6">
          <li
            v-for="source in analytics.sources"
            :key="source.source"
            class="flex items-center justify-between gap-3 py-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-3 font-semibold text-cheer-ink">
                <span class="truncate">{{ source.source }}</span>
                <span class="shrink-0 tabular-nums">{{ source.views }} views</span>
              </div>
              <div class="mt-2 h-2 overflow-hidden rounded-full bg-cheer-mint/60">
                <div
                  class="h-full rounded-full bg-cheer-leaf"
                  :style="{ width: `${sourceBarWidth(source.views)}%` }"
                />
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <p v-else class="mt-6 text-cheer-ink/55">
      Loading analytics…
    </p>
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
  const pct = Math.max(6, (value / top) * 100);
  return `${Math.round(pct)}%`;
}

function sourceBarWidth(views: number): number {
  const top = analytics.value?.sources[0]?.views ?? 0;
  if (!top) return 0;
  return Math.max(6, Math.round((views / top) * 100));
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
  error.value = null;
  try {
    analytics.value = (await api.getMyAnalytics(days.value)).analytics;
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Could not load analytics.';
  }
}

onMounted(() => {
  void load();
});
</script>
