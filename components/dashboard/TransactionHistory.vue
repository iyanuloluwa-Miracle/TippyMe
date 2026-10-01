<template>
  <div class="history-scroll">
    <table class="history-table"><caption class="sr-only">Creator support transaction history</caption>
      <thead><tr><th scope="col">Supporter</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col" class="history-amount">Amount</th></tr></thead>
      <tbody><tr v-for="tip in tips" :key="tip.id">
        <td><div class="history-person"><span class="history-avatar" aria-hidden="true">{{ tip.isAnonymous ? '♡' : Array.from(name(tip))[0]?.toUpperCase() }}</span><div><strong>{{ name(tip) }}</strong><details v-if="tip.message" class="history-message"><summary>Read message</summary><p>{{ tip.message }}</p></details></div></div></td>
        <td><span class="history-status" :class="statusTone(tip.status)">{{ labels[tip.status] }}</span><small v-if="tip.paymentStatus" class="history-payment">Payment: {{ tip.paymentStatus.toLowerCase() }}</small></td>
        <td><time :datetime="tip.createdAt">{{ date(tip.createdAt) }}</time></td>
        <td class="history-amount"><strong>{{ money(tip.amount, tip.currency) }}</strong><small>{{ tip.currency }}</small></td>
      </tr></tbody>
    </table>
  </div>
</template>
<script setup lang="ts">
import type { CreatorTip, TipStatus } from '~/types/api';
defineProps<{ tips: CreatorTip[] }>();
const labels: Record<TipStatus, string> = { CREATED: 'Created', CHECKOUT_PENDING: 'Pending', PAID: 'Paid', FAILED: 'Failed', REFUNDED: 'Refunded', DISPUTED: 'Disputed', EXPIRED: 'Expired' };
const name = (tip: CreatorTip) => tip.isAnonymous ? 'Anonymous supporter' : tip.supporterName?.trim() || 'Supporter';
const statusTone = (status: TipStatus) => status === 'PAID' ? 'is-paid' : ['FAILED', 'EXPIRED', 'DISPUTED'].includes(status) ? 'is-alert' : 'is-pending';
function money(amount: string, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(amount)); }
  catch { return `${currency} ${amount}`; }
}
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}
</script>
<style scoped>
.history-scroll { overflow-x: auto; margin-top: 8px; }.history-table { width: 100%; border-collapse: collapse; min-width: 480px; }.history-table th { color: #70647e; font-size: 11px; font-weight: 600; text-align: left; padding: 16px 12px; }.history-table td { padding: 20px 12px; border-top: 1px solid #e7dfee; vertical-align: top; }.history-table tr:hover td { background: #c5a4ee05; }.history-person { display: flex; align-items: flex-start; gap: 12px; }.history-person strong { color: #261b38; font-size: 14px; overflow-wrap: anywhere; }.history-avatar { display: grid; place-items: center; width: 36px; height: 36px; flex-shrink: 0; background: #b993f019; color: #6d3db0; border-radius: 12px; font-size: 16px; }.history-message { margin-top: 4px; font-size: 12px; color: #6d3db0; }.history-message summary { cursor: pointer; }.history-message p { max-width: 360px; white-space: pre-wrap; overflow-wrap: anywhere; padding: 12px; background: #b993f00d; border-radius: 12px; line-height: 1.5; }.history-status { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; }.is-paid { color: #237350; background: #edf8f1; }.is-alert { color: #ac3047; background: #fff1f3; }.is-pending { color: #986015; background: #fff6e7; }.history-payment { display: block; margin-top: 5px; color: #70647e; font-size: 10px; }.history-table time { white-space: nowrap; font-size: 12px; color: #70647e; }.history-table .history-amount { text-align: right; white-space: nowrap; }.history-amount strong { font-size: 15px; color: #261b38; font-variant-numeric: tabular-nums; }.history-amount small { display: block; color: #70647e; font-size: 10px; margin-top: 4px; }
@media (max-width: 640px) { .history-avatar { display: none; }.history-table { min-width: 440px; }.history-table th, .history-table td { padding-left: 8px; padding-right: 8px; } }
</style>
