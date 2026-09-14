<template>
  <div class="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        <p class="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-cheer-leaf">
          Workspace
        </p>
        <h1 class="mt-2 text-4xl font-extrabold tracking-tight text-cheer-ink sm:text-5xl">
          Tips
        </h1>
        <p class="mt-2 max-w-xl text-base font-semibold text-cheer-ink/85">
          Every tip on your Tippy page — filter by status and browse your full history.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <label class="sr-only" for="tips-status">Filter by status</label>
        <select
          id="tips-status"
          v-model="statusFilter"
          class="rounded-full border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-cheer-ink transition hover:border-cheer-leaf/30 focus:border-cheer-leaf focus:outline-none focus:ring-2 focus:ring-cheer-leaf/20"
          :disabled="loading"
          @change="onFilterChange"
        >
          <option value="">
            All statuses
          </option>
          <option value="PAID">
            Paid
          </option>
          <option value="CHECKOUT_PENDING">
            Checkout pending
          </option>
          <option value="CREATED">
            Created
          </option>
          <option value="FAILED">
            Failed
          </option>
          <option value="EXPIRED">
            Expired
          </option>
        </select>
      </div>
    </header>

    <p
      v-if="loadError"
      class="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div
      v-if="loading && !tipsPage"
      class="space-y-3"
    >
      <div class="dash-shimmer h-16 rounded-2xl opacity-30" />
      <div class="dash-shimmer h-16 rounded-2xl opacity-25" />
      <div class="dash-shimmer h-16 rounded-2xl opacity-20" />
      <div class="dash-shimmer h-16 rounded-2xl opacity-15" />
    </div>

    <section
      v-else
      class="rounded-[1.75rem] border border-black/6 bg-white/85 p-5 shadow-[0_1px_0_rgba(26, 18, 40,0.04)] backdrop-blur-md sm:p-7"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-cheer-ink/55">
          <template v-if="tipsPage">
            {{ tipsPage.total }} tip{{ tipsPage.total === 1 ? '' : 's' }}
          </template>
          <template v-else>
            Loading…
          </template>
        </p>
        <p
          v-if="tipsLoading"
          class="text-xs font-semibold text-cheer-ink/40"
        >
          Updating…
        </p>
      </div>

      <ul
        v-if="tips.length"
        class="mt-4 divide-y divide-black/6"
        :class="tipsLoading ? 'opacity-60' : ''"
      >
        <DashboardTipRow
          v-for="tip in tips"
          :key="tip.id"
          :tip="tip"
        />
      </ul>
      <p
        v-else
        class="mt-6 rounded-2xl bg-cheer-sand/70 px-4 py-10 text-center text-sm text-cheer-ink/55"
      >
        No tips match this filter.
      </p>

      <div
        v-if="tipsPage && tipsPage.totalPages > 1"
        class="mt-6 flex items-center justify-between gap-3 text-sm"
      >
        <button
          type="button"
          class="motion-cta rounded-full border border-black/10 bg-white px-4 py-2 font-semibold disabled:opacity-40"
          :disabled="page <= 1 || tipsLoading"
          @click="goPage(page - 1)"
        >
          Previous
        </button>
        <span class="text-cheer-ink/55">
          Page {{ page }} of {{ tipsPage.totalPages }}
        </span>
        <button
          type="button"
          class="motion-cta rounded-full border border-black/10 bg-white px-4 py-2 font-semibold disabled:opacity-40"
          :disabled="page >= tipsPage.totalPages || tipsLoading"
          @click="goPage(page + 1)"
        >
          Next
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { CreatorTip, CreatorTipsPage, TipStatus } from '~/types/api';
import { ApiClientError } from '~/services/api';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
});

useHead({
  title: 'Tips — TippyMe',
});

const api = useApi();
const auth = useAuthStore();

const loading = ref(true);
const tipsLoading = ref(false);
const loadError = ref<string | null>(null);
const tipsPage = ref<CreatorTipsPage | null>(null);
const tips = ref<CreatorTip[]>([]);
const page = ref(1);
const statusFilter = ref<TipStatus | ''>('');

const PAGE_SIZE = 20;

onMounted(() => {
  void loadTips(true);
});

async function loadTips(initial = false) {
  if (initial) {
    loading.value = true;
  }
  tipsLoading.value = true;
  loadError.value = null;
  try {
    tipsPage.value = await api.listMyTips({
      page: page.value,
      pageSize: PAGE_SIZE,
      status: statusFilter.value || undefined,
    });
    tips.value = tipsPage.value.tips;
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 401) {
      auth.setUser(null);
      await navigateTo('/login?next=/dashboard/tips');
      return;
    }
    if (err instanceof ApiClientError && err.statusCode === 404) {
      await navigateTo('/onboarding');
      return;
    }
    loadError.value =
      err instanceof Error ? err.message : 'Could not load tips.';
  } finally {
    loading.value = false;
    tipsLoading.value = false;
  }
}

function onFilterChange() {
  page.value = 1;
  void loadTips();
}

function goPage(next: number) {
  page.value = next;
  void loadTips();
}
</script>
