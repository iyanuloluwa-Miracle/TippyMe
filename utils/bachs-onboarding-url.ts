/**
 * Hosted Bachs Connect links must be absolute https URLs on Bachs,
 * never TippyMe `/api/...` paths (opening those as pages 404s).
 */
export function isSafeBachsOnboardingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'bachs.io' || host.endsWith('.bachs.io');
  } catch {
    return false;
  }
}

/** Open hosted Connect onboarding; prefer same-tab redirect (popup-safe). */
export function openBachsOnboardingUrl(url: string): void {
  if (!import.meta.client) return;
  if (!isSafeBachsOnboardingUrl(url)) {
    throw new Error('Received an invalid Bachs onboarding link.');
  }
  window.location.assign(url);
}
