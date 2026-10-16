import { createHmac, timingSafeEqual } from 'crypto';
import { BACHS_WEBHOOK_TOLERANCE_SECONDS } from './bachs.constants';

/**
 * Verify Bachs webhook signature per docs:
 * HMAC-SHA256 hex of "{timestamp}.{raw_body}" using endpoint signing secret.
 * Supports the legacy X-Bachs-Timestamp/X-Bachs-Signature pair and the
 * preferred X-Bachs-Signature-V2 header (`t=...,v1=...`). V2 can contain
 * multiple v1 values while an endpoint secret is being rotated.
 */
export function verifyBachsWebhookSignature(params: {
  rawBody: Buffer | string;
  secret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  signatureV2Header?: string | undefined;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  const {
    rawBody,
    secret,
    timestampHeader,
    signatureHeader,
    signatureV2Header,
    toleranceSeconds = BACHS_WEBHOOK_TOLERANCE_SECONDS,
    nowSeconds = Math.floor(Date.now() / 1000),
  } = params;

  if (!secret) {
    return false;
  }

  const v2 = parseV2Header(signatureV2Header);
  const effectiveTimestamp = v2?.timestamp ?? timestampHeader;
  const signatures = v2?.signatures.length
    ? v2.signatures
    : signatureHeader
      ? [signatureHeader]
      : [];

  if (!effectiveTimestamp || signatures.length === 0) return false;

  const timestamp = Number.parseInt(effectiveTimestamp, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const message = `${timestamp}.${body}`;
  const expected = createHmac('sha256', secret)
    .update(message, 'utf8')
    .digest('hex');

  try {
    const a = Buffer.from(expected, 'utf8');
    return signatures.some((signature) => {
      const b = Buffer.from(signature.trim(), 'utf8');
      return a.length === b.length && timingSafeEqual(a, b);
    });
  } catch {
    return false;
  }
}

function parseV2Header(
  header: string | undefined,
): { timestamp?: string; signatures: string[] } | null {
  if (!header) return null;

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    const value = rawValue.join('=').trim();
    if (rawKey === 't' && value) timestamp = value;
    if (rawKey === 'v1' && value) signatures.push(value);
  }

  return { timestamp, signatures };
}

function webhookString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Bachs bank-payout events identify the transfer as `withdrawal_id`
 * (`pay_…`). Older payloads used `payout_id` or `id`.
 */
export function readBachsPayoutWebhook(
  data: Record<string, unknown>,
  eventType: string,
): {
  id?: string;
  status: string;
  failureReason: string | null;
  amount?: string;
  currency?: string;
  destinationId?: string;
  payoutRequestId?: string;
} {
  const id =
    webhookString(data.withdrawal_id) ||
    webhookString(data.payout_id) ||
    webhookString(data.id);

  const explicit = webhookString(data.status);
  let status = explicit;
  if (!status) {
    if (eventType.includes('fail')) status = 'failed';
    else if (eventType.endsWith('.paid') || eventType.endsWith('.succeeded')) {
      status = 'paid';
    } else status = 'processing';
  }

  const metadata =
    data.metadata && typeof data.metadata === 'object'
      ? (data.metadata as Record<string, unknown>)
      : undefined;
  const amountValue = data.amount;
  const amount =
    typeof amountValue === 'string' || typeof amountValue === 'number'
      ? String(amountValue)
      : undefined;

  return {
    id,
    status,
    failureReason: webhookString(data.failure_reason) ?? null,
    amount,
    currency: webhookString(data.currency),
    destinationId:
      webhookString(data.destination) || webhookString(data.destination_id),
    payoutRequestId: metadata
      ? webhookString(metadata.tippyme_payout_request_id)
      : undefined,
  };
}
