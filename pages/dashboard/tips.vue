<template>
  <div class="studio-page">
    <div class="studio-breadcrumb"><NuxtLink to="/dashboard">Workspace</NuxtLink><span aria-hidden="true">/</span><strong>Tips</strong></div>
    <header class="studio-page-header"><div><p class="studio-kicker">EVERY BIT OF SUPPORT, IN ONE PLACE</p><h1>Your support ledger.</h1><p class="studio-intro">The people backing your work. Follow every tip from checkout to confirmation.</p></div><button type="button" class="studio-button studio-button--primary" :disabled="exporting" @click="exportTips">{{ exporting ? 'Preparing export…' : 'Export all tips' }} <span aria-hidden="true">↓</span></button></header>
    <p v-if="exportNotice" class="studio-muted" role="status">{{ exportNotice }}</p>
    <div v-if="loadError" class="studio-error" role="alert">{{ loadError }} <button type="button" :disabled="tipsLoading" @click="loadTips()">Try again</button></div>
    <section class="studio-card" aria-labelledby="ledger-heading">
      <div class="studio-card-heading"><div><h2 id="ledger-heading">Transaction history</h2><p class="studio-muted">{{ tipsPage ? tipsPage.total + ' tips matching this view' : 'Your recorded support history' }}</p></div><NuxtLink to="/dashboard#payouts" class="studio-link">Payout &amp; settlement ↗</NuxtLink></div>
      <div class="studio-toolbar">
        <div class="studio-tabs" role="group" aria-label="Quick status filters"><button v-for="filter in quickFilters" :key="filter.label" type="button" :aria-pressed="statusFilter === filter.value" :disabled="tipsLoading" @click="selectStatus(filter.value)">{{ filter.label }}</button></div>
        <div class="studio-toolbar-actions"><label for="tips-status" class="studio-muted">Status</label><select id="tips-status" v-model="statusFilter" :disabled="tipsLoading" @change="onFilterChange"><option value="">All statuses</option><option v-for="(label, value) in statuses" :key="value" :value="value">{{ label }}</option></select></div>
      </div>
      <div v-if="loading || tipsLoading" class="studio-empty" role="status">Loading your support history…</div>
      <DashboardTransactionHistory v-else-if="tips.length" :tips="tips" />
      <div v-else-if="!loadError" class="studio-empty"><DashboardNavIcon name="tips" /><h3>{{ statusFilter ? 'No tips in this view yet.' : 'Your first supporter belongs here.' }}</h3><p>{{ statusFilter ? 'Try a different status to find the support you’re looking for.' : 'Share your TippyMe page with the people who believe in your work.' }}</p><button v-if="statusFilter" type="button" class="studio-button" @click="selectStatus('')">Show all tips</button><NuxtLink v-else to="/dashboard/profile#sharing" class="studio-button">Get your sharing tools ↗</NuxtLink></div>
      <div v-if="tipsPage && tipsPage.totalPages > 1" class="studio-pagination"><button type="button" class="studio-button" :disabled="page <= 1 || tipsLoading" @click="goPage(page - 1)">← Previous</button><span>Page {{ page }} of {{ tipsPage.totalPages }}</span><button type="button" class="studio-button" :disabled="page >= tipsPage.totalPages || tipsLoading" @click="goPage(page + 1)">Next →</button></div>
    </section>
    <p class="studio-muted mt-6">Support records are not a withdrawable balance. Payouts and transfers are handled through Bachs.</p>
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
const statuses: Record<TipStatus, string> = { CREATED: 'Created', CHECKOUT_PENDING: 'Checkout pending', PAID: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded', DISPUTED: 'Disputed', EXPIRED: 'Expired' };
const quickFilters: { label: string; value: TipStatus | '' }[] = [{ label: 'All tips', value: '' }, { label: 'Paid', value: 'PAID' }, { label: 'Pending', value: 'CHECKOUT_PENDING' }];
const exporting = ref(false);
const exportNotice = ref('');
function selectStatus(value: TipStatus | '') { statusFilter.value = value; onFilterChange(); }
async function exportTips() {
  exporting.value = true;
  exportNotice.value = '';
  try {
    const response = await fetch('/api/creators/me/tips/export', { credentials: 'include' });
    if (!response.ok) throw new Error('Unable to export');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url; link.download = 'tippyme-tips.csv'; link.click(); URL.revokeObjectURL(url);
    exportNotice.value = 'Your full tip history has been downloaded.';
  } catch { exportNotice.value = 'The export could not be downloaded. Please try again.'; }
  finally { exporting.value = false; }
}

onMounted(() => {
  void loadTips(true);
});

async function loadTips(initial = false) {
  if (tipsLoading.value) return;
  if (initial) {
    loading.value = true;
  }
  tipsLoading.value = true;
  loadError.value = null;
  tips.value = [];
  tipsPage.value = null;
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
