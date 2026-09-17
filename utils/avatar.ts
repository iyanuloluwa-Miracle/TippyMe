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

/** Deterministic DiceBear avatar URL for a seed (username, display name, etc.). */
export function dicebearAvatarUrl(seed: string, size = 128): string {
  const normalized = seed.trim() || 'anonymous';
  return `${DICEBEAR_BASE}?seed=${encodeURIComponent(normalized)}&size=${size}`;
}

/** Prefer a custom avatar URL; otherwise fall back to DiceBear. */
export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  seed: string,
  size = 128,
): string {
  const custom = avatarUrl?.trim();
  if (custom) return custom;
  return dicebearAvatarUrl(seed, size);
}
