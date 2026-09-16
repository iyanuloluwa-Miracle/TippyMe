import { createApiClient } from '~/services/api';

function resolveBrowserBase(configured: string): string {
  const trimmed = configured.replace(/\/$/, '');

  // Prefer same-origin `/api` so the session cookie stays first-party.
  // Nitro serves `/api` in-process — leave NUXT_PUBLIC_API_URL empty.
  if (!trimmed) return '';
  try {
    const apiOrigin = new URL(trimmed, window.location.origin).origin;
    if (apiOrigin !== window.location.origin) {
      return '';
    }
  } catch {
    return '';
  }
  return trimmed;
}

export function useApi() {
  const config = useRuntimeConfig();
  const publicUrl = String(config.public.apiUrl ?? '');

  let base: string;
  if (import.meta.server) {
    // SSR → same Nitro process (absolute origin required for native fetch).
    const configured = publicUrl.replace(/\/$/, '');
    base = configured || useRequestURL().origin;
  } else {
    base = resolveBrowserBase(publicUrl);
  }

  // Native fetch does not forward the incoming browser cookie during SSR.
  // Pass it explicitly so route middleware can restore the session on refresh.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : {};
  return createApiClient(base, headers);
}
