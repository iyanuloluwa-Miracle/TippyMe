import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { verifyBachsWebhookSignature } from '../server/services/payments/bachs/bachs.webhook';

const secret = 'whsec_test_secret';
const rawBody = '{"id":"evt_test","type":"checkout.completed"}';
const timestamp = '1789516800';
const signature = createHmac('sha256', secret)
  .update(`${timestamp}.${rawBody}`, 'utf8')
  .digest('hex');

describe('verifyBachsWebhookSignature', () => {
  it('accepts the legacy signature headers', () => {
    expect(
      verifyBachsWebhookSignature({
        rawBody,
        secret,
        timestampHeader: timestamp,
        signatureHeader: signature,
        nowSeconds: Number(timestamp),
      }),
    ).toBe(true);
  });

  it('accepts any matching V2 signature during secret rotation', () => {
    expect(
      verifyBachsWebhookSignature({
        rawBody,
        secret,
        timestampHeader: undefined,
        signatureHeader: undefined,
        signatureV2Header: `t=${timestamp},v1=invalid,v1=${signature}`,
        nowSeconds: Number(timestamp),
      }),
    ).toBe(true);
  });

  it('rejects a stale V2 signature', () => {
    expect(
      verifyBachsWebhookSignature({
        rawBody,
        secret,
        timestampHeader: undefined,
        signatureHeader: undefined,
        signatureV2Header: `t=${timestamp},v1=${signature}`,
        nowSeconds: Number(timestamp) + 301,
      }),
    ).toBe(false);
  });
});
