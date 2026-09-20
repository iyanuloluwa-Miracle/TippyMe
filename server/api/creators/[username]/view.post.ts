import { CreatorsService } from '../../../services/creators/creators.service';
import { defineApiHandler } from '../../../lib/define-api';
import { consumeRateLimit } from '../../../lib/rate-limit';

const VIEW_LIMIT = 1;
const VIEW_TTL_MS = 60_000;

/**
 * Public tip-page view ping. Soft rate-limited: if over limit, return
 * { recorded: false } instead of 429 so refreshes don't break the page.
 */
export default defineApiHandler(async (event) => {
  const username = getRouterParam(event, 'username') ?? '';
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  const key = `tip-page-view:${normalizeKey(username)}:${ip}`;

  if (await consumeRateLimit(key, VIEW_LIMIT, VIEW_TTL_MS) != null) {
    return { recorded: false as const };
  }

  const creators = new CreatorsService();
  const body = await readBody<{ source?: string }>(event).catch(() => null);
  return creators.recordTipPageView(username, body?.source);
});

function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30) || 'unknown';
}
