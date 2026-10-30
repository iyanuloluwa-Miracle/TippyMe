import { reconcilePendingPayments } from '../services/payments/reconcile-pending';
import { getServerEnv } from '../lib/env';
import { logError } from '../lib/logger';

export default defineNitroPlugin(() => {
  if (getServerEnv().NODE_ENV !== 'production') return;
  const timer = setInterval(() => {
    void reconcilePendingPayments().catch((err) => {
      logError('payment.reconciliation.job_failed', err);
    });
  }, 60_000);
  timer.unref?.();
});
