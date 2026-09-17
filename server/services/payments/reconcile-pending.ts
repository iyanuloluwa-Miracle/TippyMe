import { PaymentTransactionModel, TipModel, toPlain, useDb } from '../../db';
import type { LeanDoc } from '../../db/lean';
import type { PaymentTransaction, Tip } from '../../db/types';
import { PaymentProvider, PaymentStatus } from '../../db/enums';
import { consumeRateLimit } from '../../lib/rate-limit';
import { WebhookFulfilmentService } from '../webhooks/webhook-fulfilment.service';

const PROCESSING_INTERVAL_MS = 5 * 60_000;
const SUCCEEDED_INTERVAL_MS = 15 * 60_000;
const RETRY_AFTER_FAILURE_MS = 2 * 60_000;

/** Recover pending checkouts and detect later reversals of paid checkouts. */
export async function reconcilePendingPayments(): Promise<void> {
  if (await consumeRateLimit('payments:reconcile-job', 1, 60_000) != null) return;
  await useDb();
  const fulfilment = new WebhookFulfilmentService();
  for (let index = 0; index < 40; index++) {
    const now = new Date();
    const payment = toPlain<PaymentTransaction>(await PaymentTransactionModel.findOneAndUpdate(
      {
        provider: PaymentProvider.BACHS,
        providerReference: { $type: 'string' },
        createdAt: { $lt: new Date(now.getTime() - 30_000) },
        $or: [
          {
            status: PaymentStatus.PROCESSING,
            $or: [
              { lastReconciledAt: null },
              { lastReconciledAt: { $lt: new Date(now.getTime() - PROCESSING_INTERVAL_MS) } },
            ],
          },
          {
            status: PaymentStatus.SUCCEEDED,
            $or: [
              { lastReconciledAt: null },
              { lastReconciledAt: { $lt: new Date(now.getTime() - SUCCEEDED_INTERVAL_MS) } },
            ],
          },
        ],
      },
      { $set: { lastReconciledAt: now } },
      { sort: { lastReconciledAt: 1, createdAt: 1 }, returnDocument: 'after' },
    ).lean<LeanDoc | null>());
    if (!payment) return;
    const interval = payment.status === PaymentStatus.PROCESSING
      ? PROCESSING_INTERVAL_MS
      : SUCCEEDED_INTERVAL_MS;
    const releaseForRetry = () => PaymentTransactionModel.updateOne(
      { _id: payment.id },
      { $set: { lastReconciledAt: new Date(now.getTime() - interval + RETRY_AFTER_FAILURE_MS) } },
    );
    const tip = toPlain<Tip>(await TipModel.findOne({ paymentTransactionId: payment.id }).lean<LeanDoc | null>());
    if (!tip || !payment.providerReference) {
      await releaseForRetry();
      continue;
    }
    try {
      const result = await fulfilment.processSignedBachsEvent({
        providerEventId: `reconcile_${payment.id}_${Math.floor(now.getTime() / 120_000)}`,
        eventType: 'checkout.reconciled',
        tipId: tip.id,
        verification: { status: 'pending', providerReference: payment.providerReference },
      });
      if (!result.ok) await releaseForRetry();
    } catch (err) {
      await releaseForRetry();
      console.error(`Pending payment reconciliation failed payment=${payment.id}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}
