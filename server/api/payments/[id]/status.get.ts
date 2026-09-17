import { TipModel, toPlain, useDb } from '../../../db';
import type { LeanDoc } from '../../../db/lean';
import type { Tip } from '../../../db/types';
import { PaymentsService } from '../../../services/payments/payments.service';
import { ApiError } from '../../../lib/errors';
import { defineApiHandler } from '../../../lib/define-api';
import { assertRateLimit } from '../../../lib/rate-limit';
import { AUTH_THROTTLE_TTL_MS } from '../../../services/auth/otp.constants';
import { confirmationTokenMatches } from '../../../services/tips/confirmation-token';

const PAYMENT_STATUS_LIMIT = 30;

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  await assertRateLimit(`payments:status:${ip}`, PAYMENT_STATUS_LIMIT, AUTH_THROTTLE_TTL_MS);

  const id = getRouterParam(event, 'id') ?? '';
  const token = getQuery(event).token;
  const payments = new PaymentsService();
  const result = await payments.getPublicPaymentStatus(id);
  if (!result) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
  }

  await useDb();
  const tip = toPlain<Tip>(
    await TipModel.findOne({ _id: result.tipId })
      .select('confirmationTokenHash')
      .lean<LeanDoc | null>(),
  );
  if (
    tip?.confirmationTokenHash &&
    !confirmationTokenMatches(typeof token === 'string' ? token : undefined, tip.confirmationTokenHash)
  ) {
    throw new ApiError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.');
  }

  return result;
});
