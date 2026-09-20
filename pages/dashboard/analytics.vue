<template>
  <div class="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><p class="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-cheer-leaf">Insights</p><h1 class="mt-2 text-4xl font-extrabold tracking-tight text-cheer-ink">Analytics</h1></div>
      <select v-model.number="days" class="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold" @change="load"><option :value="7">Last 7 days</option><option :value="30">Last 30 days</option><option :value="90">Last 90 days</option></select>
    </header>
    <p v-if="error" class="mt-5 rounded-2xl bg-red-50 p-4 text-red-700">{{ error }}</p>
    <div v-else-if="analytics" class="mt-6 space-y-5">
      <section class="grid gap-3 sm:grid-cols-3"><div v-for="item in cards" :key="item.label" class="rounded-3xl border border-black/6 bg-white p-5"><p class="text-sm font-semibold text-cheer-ink/55">{{ item.label }}</p><p class="mt-2 text-3xl font-extrabold text-cheer-ink">{{ item.value }}</p></div></section>
      <section class="rounded-3xl border border-black/6 bg-white p-5"><h2 class="text-xl font-extrabold text-cheer-ink">Daily activity</h2><div class="mt-5 flex h-36 items-end gap-1"><div v-for="day in analytics.daily" :key="day.date" class="min-w-0 flex-1 rounded-t bg-cheer-leaf/75" :style="{ height: `${Math.max(3, maxViews ? day.views / maxViews * 100 : 3)}%` }" :title="`${day.date}: ${day.views} views, ${day.paidTips} paid tips`" /></div></section>
      <section class="rounded-3xl border border-black/6 bg-white p-5"><h2 class="text-xl font-extrabold text-cheer-ink">Where visits came from</h2><p v-if="!analytics.sources.length" class="mt-3 text-sm text-cheer-ink/55">No tracked referrals yet. Add <code>?ref=instagram</code> to a shared link.</p><ul v-else class="mt-3 divide-y divide-black/6"><li v-for="source in analytics.sources" :key="source.source" class="flex justify-between py-3 font-semibold text-cheer-ink"><span>{{ source.source }}</span><span>{{ source.views }} views</span></li></ul></section>
    </div>
    <p v-else class="mt-6 text-cheer-ink/55">Loading analytics…</p>
  </div>
</template>
<script setup lang="ts">
import type { CreatorAnalytics } from '~/types/api';
definePageMeta({ layout: 'dashboard', middleware: 'auth' });
useHead({ title: 'Analytics — TippyMe' });
const api = useApi(); const days = ref(30); const analytics = ref<CreatorAnalytics | null>(null); const error = ref<string | null>(null);
const maxViews = computed(() => Math.max(0, ...(analytics.value?.daily.map((item) => item.views) ?? [])));
const cards = computed(() => analytics.value ? [{ label: 'Link views', value: analytics.value.views }, { label: 'Paid tips', value: analytics.value.paidTips }, { label: 'View → tip conversion', value: analytics.value.conversionPercent == null ? '—' : `${analytics.value.conversionPercent}%` }] : []);
async function load() { error.value = null; try { analytics.value = (await api.getMyAnalytics(days.value)).analytics; } catch (err) { error.value = err instanceof Error ? err.message : 'Could not load analytics.'; } }
onMounted(() => { void load(); });
</script>
