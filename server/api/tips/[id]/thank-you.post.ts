import { CreatorProfileModel, TipModel, toPlain, useDb } from '../../../db';
import type { LeanDoc } from '../../../db/lean';
import { TipStatus } from '../../../db/enums';
import type { CreatorProfile, Tip } from '../../../db/types';
import { OpenRouterAiService } from '../../../services/ai/openrouter.service';
import { ApiError } from '../../../lib/errors';
import { defineApiHandler } from '../../../lib/define-api';
import { assertRateLimit } from '../../../lib/rate-limit';
import { AUTH_THROTTLE_TTL_MS } from '../../../services/auth/otp.constants';
import { confirmationTokenMatches } from '../../../services/tips/confirmation-token';
import { decimalToAmountString } from '../../../services/tips/tips.types';

/**
 * Generate (or return cached) AI thank-you for a PAID tip.
 * Requires the confirmation token so the note cannot be read from the id alone.
 */
export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  await assertRateLimit(`tips:thank-you:${ip}`, 10, AUTH_THROTTLE_TTL_MS);

  const tipId = getRouterParam(event, 'id');
  if (!tipId) {
    throw new ApiError(400, 'INVALID_TIP', 'Tip id is required.');
  }

  const queryToken = getQuery(event).token;
  const body = await readBody<{ token?: string }>(event).catch(() => null);
  const token = typeof queryToken === 'string' ? queryToken : body?.token;

  await useDb();
  const tip = toPlain<Tip>(
    await TipModel.findOne({ _id: tipId }).lean<LeanDoc | null>(),
  );

  if (!tip || !confirmationTokenMatches(token, tip.confirmationTokenHash)) {
    throw new ApiError(404, 'TIP_NOT_FOUND', 'Tip not found.');
  }

  if (tip.status !== TipStatus.PAID) {
    throw new ApiError(
      409,
      'TIP_NOT_PAID',
      'Thank-you notes are available after payment confirms.',
    );
  }

  if (tip.aiThankYouMessage?.trim()) {
    return {
      message: tip.aiThankYouMessage,
      source: 'cached' as const,
    };
  }

  const creator = toPlain<CreatorProfile>(
    await CreatorProfileModel.findOne({ _id: tip.creatorId }).lean<
      LeanDoc | null
    >(),
  );

  if (!creator) {
    throw new ApiError(404, 'TIP_NOT_FOUND', 'Tip not found.');
  }

  const ai = new OpenRouterAiService();
  const generated = await ai.thankYouNote({
    creatorDisplayName: creator.displayName,
    supporterName: tip.supporterName,
    isAnonymous: tip.isAnonymous,
    tipMessage: tip.message,
    amount: decimalToAmountString(tip.amount),
    currency: tip.currency,
    supportMessage: creator.supportMessage,
  });

  await TipModel.updateOne(
    { _id: tip.id },
    { $set: { aiThankYouMessage: generated.message, updatedAt: new Date() } },
  );

  return {
    message: generated.message,
    source: generated.source,
  };
});
