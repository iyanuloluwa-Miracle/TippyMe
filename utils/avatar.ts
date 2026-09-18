const DICEBEAR_BASE = 'https://api.dicebear.com/10.x/lorelei/png';

/** Fixed seeds so onboarding shows the same faces every time. */
export const PRESET_AVATAR_SEEDS = [
  'ada',
  'kemi',
  'zuri',
  'amal',
  'nio',
  'sora',
  'leila',
  'kai',
  'mira',
  'obi',
  'yasmin',
  'theo',
] as const;

export type PresetAvatar = { id: string; url: string };

/** Stable gallery of illustrated avatars a creator can choose. */
export function presetAvatarOptions(size = 128): PresetAvatar[] {
  return PRESET_AVATAR_SEEDS.map((seed) => ({
    id: seed,
    url: dicebearAvatarUrl(seed, size),
  }));
}

const DICEBEAR_UPSTREAM = DICEBEAR_BASE;

/** Same-origin path. The server fetches and caches the illustration. */
export function dicebearAvatarUrl(seed: string, size = 128): string {
  const normalized = seed.trim() || 'anonymous';
  return `/api/avatars/${encodeURIComponent(normalized)}?size=${size}`;
}

/** Upstream URL used only by the avatar proxy. */
export function dicebearUpstreamUrl(seed: string, size = 128): string {
  const normalized = seed.trim() || 'anonymous';
  return `${DICEBEAR_UPSTREAM}?seed=${encodeURIComponent(normalized)}&size=${size}`;
}

function presetSeedFromPath(pathname: string): string | null {
  const raw = pathname.slice('/api/avatars/'.length).split('/')[0]?.split('?')[0] ?? '';
  const seed = decodeURIComponent(raw);
  return (PRESET_AVATAR_SEEDS as readonly string[]).includes(seed) ? seed : null;
}

/** Preset gallery paths, or an uploaded photo URL. Rejects arbitrary strings and hotlinks. */
export function isAllowedAvatarUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (trimmed.startsWith('/api/avatars/')) return presetSeedFromPath(trimmed) != null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  if (parsed.pathname.startsWith('/api/avatars/')) return presetSeedFromPath(parsed.pathname) != null;
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'api.dicebear.com' || host.endsWith('.dicebear.com')) return false;
  // Byteship CDN: cdn.byteship.cloud/f/<project>/avatars/<user>/avatar.png
  const uploadedPhoto = /\/avatars\/[^/]+\/.+\.(png|jpe?g|webp|gif)$/i.test(parsed.pathname);
  const byteshipHost =
    host === 'byteship.dev' ||
    host.endsWith('.byteship.dev') ||
    host === 'byteship.cloud' ||
    host.endsWith('.byteship.cloud') ||
    host.includes('byteship');
  return uploadedPhoto && byteshipHost;
}

/** Turn a saved DiceBear preset URL into the same-origin path. Other URLs are unchanged. */
export function normalizeSavedAvatarUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === 'api.dicebear.com' || parsed.hostname.endsWith('.dicebear.com')) {
      const diceSeed = parsed.searchParams.get('seed')?.trim() ?? '';
      if ((PRESET_AVATAR_SEEDS as readonly string[]).includes(diceSeed)) {
        return dicebearAvatarUrl(diceSeed);
      }
    }
  } catch {
    // Relative preset paths stay as they are.
  }
  return trimmed;
}

/** Prefer a saved photo. Old DiceBear hotlinks are rewritten to the same-origin proxy. */
export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  seed: string,
  size = 128,
): string {
  const custom = avatarUrl?.trim();
  if (!custom) return dicebearAvatarUrl(seed, size);
  try {
    const parsed = new URL(custom);
    if (parsed.hostname === 'api.dicebear.com' || parsed.hostname.endsWith('.dicebear.com')) {
      const diceSeed = parsed.searchParams.get('seed')?.trim();
      if (diceSeed) return dicebearAvatarUrl(diceSeed, size);
    }
  } catch {
    // Relative preset paths are already same-origin.
  }
  return custom;
}
