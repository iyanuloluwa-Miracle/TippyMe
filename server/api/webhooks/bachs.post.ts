import { PaymentsService } from '../../services/payments/payments.service';
import { WebhookFulfilmentService } from '../../services/webhooks/webhook-fulfilment.service';
import { ApiError } from '../../lib/errors';
import { defineApiHandler } from '../../lib/define-api';
import { assertRateLimit } from '../../lib/rate-limit';

/**
 * Bachs webhook receiver.
 * Requires raw body for signature verification.
 * Flow: verify signature → update a payout, fulfil a tip checkout, or acknowledge other signed events.
 */
export default defineApiHandler(async (event) => {
  const rawBody = await readRawBody(event, false);
  if (!rawBody || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
    throw new ApiError(400, 'WEBHOOK_MALFORMED', 'Empty webhook payload.');
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  await assertRateLimit(`webhooks:bachs:${ip}`, 120, 60_000);

  const headers = getRequestHeaders(event);
  const payments = new PaymentsService();
  const parsed = await payments.handleWebhook({
    rawBody,
    headers,
  });

  if (!parsed.acknowledged) {
    const raw =
      typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    let malformed = false;
    try {
      JSON.parse(raw);
    } catch {
      malformed = true;
    }

    if (malformed) {
      throw new ApiError(
        400,
        'WEBHOOK_MALFORMED',
        'Malformed webhook payload.',
      );
    }

    throw new ApiError(401, 'WEBHOOK_INVALID', 'Invalid webhook signature.');
  }

  if (!parsed.providerEventId || !parsed.eventType) {
    throw new ApiError(
      400,
      'WEBHOOK_MALFORMED',
      'Webhook acknowledged but missing required fields.',
    );
  }

  if (parsed.payout) {
    let updated = false;
    if (parsed.payout.id) {
      const { PayoutService } = await import(
        '../../services/creators/payout.service'
      );
      updated = await new PayoutService().applyProviderPayoutUpdate({
        bachsPayoutId: parsed.payout.id,
        status: parsed.payout.status || parsed.eventType,
        failureReason: parsed.payout.failureReason,
        amount: parsed.payout.amount,
        currency: parsed.payout.currency,
        destinationId: parsed.payout.destinationId,
        payoutRequestId: parsed.payout.payoutRequestId,
      });
      if (!updated) {
        console.warn(
          `Bachs ${parsed.eventType} ${parsed.providerEventId} did not match a payout request`,
        );
      }
    }
    setResponseStatus(event, 200);
    return {
      ok: true,
      outcome: updated ? 'payout_updated' : 'payout_ignored',
    };
  }

  const fulfilment = new WebhookFulfilmentService();
  const result = await fulfilment.processSignedBachsEvent({
    providerEventId: parsed.providerEventId,
    eventType: parsed.eventType,
    tipId: parsed.tipId,
    verification: parsed.verification,
  });

  if (result.retryable) {
    throw new ApiError(
      503,
      'WEBHOOK_VERIFY_FAILED',
      'Unable to verify payment with provider. Please retry.',
    );
  }

  setResponseStatus(event, 200);
  return { ok: true, outcome: result.outcome };
});
