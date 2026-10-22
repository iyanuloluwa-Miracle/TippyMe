/** Bachs REST defaults — from docs.bachs.io (sandbox vs production). */
export const BACHS_SANDBOX_BASE_URL = 'https://sandbox-api.bachs.io';
export const BACHS_PRODUCTION_BASE_URL = 'https://api.bachs.io';
export const BACHS_API_VERSION_PREFIX = '/v1';

/**
 * Sandbox and live are separate platforms. The key decides the host.
 * A configured URL that disagrees with the key is ignored, because a live
 * key cannot act as sandbox accounts (Bachs returns 403) and the reverse
 * is the same failure.
 */
export function resolveBachsBaseUrl(
  apiKey: string | undefined,
  configured?: string | null,
): string {
  const key = apiKey?.trim() ?? '';
  if (key.startsWith('sk_live_')) return BACHS_PRODUCTION_BASE_URL;
  if (key.startsWith('sk_sandbox_')) return BACHS_SANDBOX_BASE_URL;
  const explicit = configured?.trim().replace(/\/$/, '') ?? '';
  return explicit || BACHS_SANDBOX_BASE_URL;
}

/** Documented request timeout guidance (idempotency retry examples use ~30s). */
export const BACHS_REQUEST_TIMEOUT_MS = 30_000;

/** Documented webhook timestamp tolerance (seconds). */
export const BACHS_WEBHOOK_TOLERANCE_SECONDS = 300;

export const BACHS_CHECKOUT_STATUS = {
  OPEN: 'open',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
