import { reconcilePendingPayments } from '../services/payments/reconcile-pending';
import { getServerEnv } from '../lib/env';

export default defineNitroPlugin(() => {
  if (getServerEnv().NODE_ENV !== 'production') return;
  const timer = setInterval(() => {
    void reconcilePendingPayments().catch((err) => {
      console.error(`Payment reconciliation job failed: ${err instanceof Error ? err.message : 'unknown'}`);
    });
  }, 60_000);
  timer.unref?.();
});
