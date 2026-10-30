import { getServerEnv } from './env';
import { logError, logWarn, sanitizeLogText } from './logger';

/**
 * Optional Sentry-compatible error report. No-op when ERROR_MONITORING_DSN is empty.
 * Never include request bodies, OTP codes, or secrets.
 */
export function reportServerError(
  err: unknown,
  context?: { path?: string; method?: string; requestId?: string },
): void {
  const dsn = getServerEnv().ERROR_MONITORING_DSN?.trim();
  if (!dsn) return;

  const parsed = parseSentryDsn(dsn);
  if (!parsed) {
    logWarn('error_monitor.configuration.invalid_dsn');
    return;
  }

  const message =
    err instanceof Error ? sanitizeLogText(err.message, 500) : 'unknown error';
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const payload = {
    event_id: eventId,
    message,
    level: 'error',
    platform: 'node',
    tags: {
      path: sanitizeLogText(context?.path ?? '', 500),
      method: sanitizeLogText(context?.method ?? '', 16),
      request_id: sanitizeLogText(context?.requestId ?? '', 128),
    },
  };
  const envelope = [
    JSON.stringify({ event_id: eventId, dsn, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(payload),
  ].join('\n');

  void fetch(`${parsed.storeUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=tippyme/1.0`,
    },
    body: envelope,
  }).catch((sendErr) => {
    logError('error_monitor.delivery.failed', sendErr);
  });
}

function parseSentryDsn(dsn: string): { key: string; storeUrl: string } | null {
  try {
    const url = new URL(dsn);
    const key = decodeURIComponent(url.username);
    const project = url.pathname.replace(/^\//, '');
    if (!key || !project) return null;
    return {
      key,
      storeUrl: `${url.protocol}//${url.host}/api/${project}/envelope/`,
    };
  } catch {
    return null;
  }
}
