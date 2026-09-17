import { RateLimitModel, isUniqueViolation, useDb } from '../db';
import { ApiError } from './errors';

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();

async function incrementWindow(id: string, resetAt: number): Promise<number> {
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
  return row?.count ?? 1;
}

function consumeMemory(key: string, limit: number, ttlMs: number, now: number): number | null {
  const windowStart = Math.floor(now / ttlMs) * ttlMs;
  const resetAt = windowStart + ttlMs;
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt });
    return null;
  }
  existing.count += 1;
  return existing.count > limit
    ? Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    : null;
}

/**
 * Shared counters in MongoDB, with the previous window counted in proportion
 * so a burst on the boundary cannot double the limit. If Mongo is unavailable,
 * fall back to this process so login and tips keep working.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  ttlMs: number,
): Promise<number | null> {
  const now = Date.now();
  try {
    await useDb();
    const windowStart = Math.floor(now / ttlMs) * ttlMs;
    const resetAt = windowStart + ttlMs;
    const previousStart = windowStart - ttlMs;
    const [current, previous] = await Promise.all([
      incrementWindow(`${key}:${windowStart}`, resetAt),
      RateLimitModel.findById(`${key}:${previousStart}`).lean<{ count?: number } | null>(),
    ]);
    const elapsedFraction = (now - windowStart) / ttlMs;
    const weighted = current + (previous?.count ?? 0) * (1 - elapsedFraction);
    return weighted > limit
      ? Math.max(1, Math.ceil((resetAt - now) / 1000))
      : null;
  } catch (err) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode?: number }).statusCode === 429) {
      throw err;
    }
    console.error(`Rate limit store unavailable, using local fallback: ${err instanceof Error ? err.message : 'unknown'}`);
    return consumeMemory(key, limit, ttlMs, now);
  }
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
