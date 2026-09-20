/**
 * Absolute public URL for OG / Twitter cards (WhatsApp, X, iMessage, etc.).
 */
export function usePublicOrigin(): string {
  const config = useRuntimeConfig();
  const configured = String(config.public.appUrl ?? '').replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.client && typeof window !== 'undefined') {
    return window.location.origin;
  }
  try {
    return useRequestURL().origin;
  } catch {
    return '';
  }
}

const DEFAULT_TITLE = 'TippyMe — One link for support';
const DEFAULT_DESCRIPTION =
  'One link for African creators to receive support and messages — without pasting bank details in WhatsApp or DMs.';

export function useSiteSeo(options?: {
  title?: string;
  description?: string;
  path?: string;
  image?: string | null;
  imageAlt?: string;
}) {
  const origin = usePublicOrigin();
  const title = options?.title?.trim() || DEFAULT_TITLE;
  const description = options?.description?.trim() || DEFAULT_DESCRIPTION;
  const path = options?.path?.startsWith('/')
    ? options.path
    : options?.path
      ? `/${options.path}`
      : '/';
  const url = origin ? `${origin}${path === '/' ? '' : path}` : undefined;
  const image =
    options?.image?.trim() ||
    (origin ? `${origin}/og/default.png` : '/og/default.png');
  const imageAlt = options?.imageAlt?.trim() || 'TippyMe — One link for support';

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: 'website',
    ogUrl: url,
    ogImage: image,
    ogImageAlt: imageAlt,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
  });

  useHead({
    link: url ? [{ rel: 'canonical', href: url }] : [],
  });
}

export { DEFAULT_DESCRIPTION, DEFAULT_TITLE };
