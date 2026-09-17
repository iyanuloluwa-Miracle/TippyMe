import { defineEventHandler, getQuery, getRouterParam, setHeader, setResponseStatus } from 'h3';

const cache = new Map<string, { bytes: Buffer; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Same-origin avatar images so profiles do not depend on DiceBear staying reachable. */
export default defineEventHandler(async (event) => {
  const seed = getRouterParam(event, 'seed') ?? '';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(seed)) {
    setResponseStatus(event, 400);
    return { statusCode: 400, message: 'Unknown avatar.', error: 'INVALID_AVATAR' };
  }

  const sizeRaw = Number(getQuery(event).size ?? 128);
  const size = Number.isFinite(sizeRaw) ? Math.min(512, Math.max(32, Math.round(sizeRaw))) : 128;
  const key = `${seed}:${size}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    setHeader(event, 'Content-Type', 'image/png');
    setHeader(event, 'Cache-Control', 'public, max-age=86400');
    return cached.bytes;
  }

  try {
    const response = await fetch(
      `https://api.dicebear.com/10.x/lorelei/png?seed=${encodeURIComponent(seed)}&size=${size}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) throw new Error(`Avatar request returned ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    cache.set(key, { bytes, expiresAt: Date.now() + CACHE_TTL_MS });
    setHeader(event, 'Content-Type', 'image/png');
    setHeader(event, 'Cache-Control', 'public, max-age=86400');
    return bytes;
  } catch {
    setResponseStatus(event, 502);
    return {
      statusCode: 502,
      message: 'Avatar is temporarily unavailable.',
      error: 'AVATAR_UNAVAILABLE',
    };
  }
});
