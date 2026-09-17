import { RateLimitModel, isUniqueViolation, useDb } from '../db';
import { ApiError } from './errors';

/** Shared fixed-window counters in MongoDB, consistent across app instances. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  ttlMs: number,
): Promise<number | null> {
  await useDb();
  const now = Date.now();
  const windowStart = Math.floor(now / ttlMs) * ttlMs;
  const resetAt = windowStart + ttlMs;
  const id = `${key}:${windowStart}`;
  let row;
  try {
    row = await RateLimitModel.findOneAndUpdate(
      { _id: id },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(resetAt) } },
      { upsert: true, returnDocument: 'after' },
    );
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    row = await RateLimitModel.findOneAndUpdate(
      { _id: id }, { $inc: { count: 1 } }, { returnDocument: 'after' },
    );
  }
  return (row?.count ?? limit + 1) > limit
    ? Math.max(1, Math.ceil((resetAt - now) / 1000))
    : null;
}

export async function assertRateLimit(
  key: string,
  limit: number,
  ttlMs: number,
): Promise<void> {
  const retryAfterSeconds = await consumeRateLimit(key, limit, ttlMs);
  if (retryAfterSeconds != null) {
    throw new ApiError(
      429,
      'RATE_LIMITED',
      'Too many requests. Please try again shortly.',
      retryAfterSeconds,
    );
  }
}
