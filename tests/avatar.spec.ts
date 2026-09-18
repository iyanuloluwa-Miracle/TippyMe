import { describe, expect, it } from 'vitest';
import { dicebearAvatarUrl, isAllowedAvatarUrl, presetAvatarOptions, resolveAvatarUrl } from '../utils/avatar';
import { normalizeClaimUsername } from '../utils/username-claim';

describe('avatar helpers', () => {
  it('builds a same-origin avatar path from a seed', () => {
    expect(dicebearAvatarUrl('abdul')).toBe('/api/avatars/abdul?size=128');
  });

  it('falls back to anonymous seed when empty', () => {
    expect(dicebearAvatarUrl('  ')).toBe('/api/avatars/anonymous?size=128');
  });

  it('resolveAvatarUrl prefers a custom URL', () => {
    expect(resolveAvatarUrl('https://cdn.example/a.png', 'abdul')).toBe(
      'https://cdn.example/a.png',
    );
  });

  it('rewrites a saved DiceBear hotlink to the same-origin avatar', () => {
    expect(resolveAvatarUrl(
      'https://api.dicebear.com/10.x/lorelei/png?seed=ada&size=128',
      'abdul',
    )).toBe('/api/avatars/ada?size=128');
  });

  it('resolveAvatarUrl uses the same-origin avatar when avatarUrl is null', () => {
    expect(resolveAvatarUrl(null, 'abdul')).toBe('/api/avatars/abdul?size=128');
  });

  it('allows preset paths and uploaded photos, not arbitrary strings', () => {
    expect(isAllowedAvatarUrl(dicebearAvatarUrl('ada'))).toBe(true);
    expect(isAllowedAvatarUrl('https://cdn.byteship.dev/avatars/user/avatar.png')).toBe(true);
    expect(
      isAllowedAvatarUrl(
        'https://cdn.byteship.cloud/f/p_x7K9mQ/avatars/user/avatar.png',
      ),
    ).toBe(true);
    expect(isAllowedAvatarUrl('https://api.dicebear.com/10.x/lorelei/png?seed=ada')).toBe(false);
    expect(isAllowedAvatarUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedAvatarUrl('x')).toBe(false);
  });

  it('returns a stable gallery of selectable avatars', () => {
    const options = presetAvatarOptions();
    expect(options).toHaveLength(12);
    expect(new Set(options.map((option) => option.url)).size).toBe(12);
    expect(options[0]).toEqual({
      id: 'ada',
      url: dicebearAvatarUrl('ada'),
    });
    expect(presetAvatarOptions()).toEqual(options);
  });
});

describe('normalizeClaimUsername', () => {
  it('lowercases and strips invalid characters', () => {
    expect(normalizeClaimUsername('Abdul-Sam!')).toBe('abdulsam');
  });

  it('caps length at 30', () => {
    expect(normalizeClaimUsername('a'.repeat(40))).toHaveLength(30);
  });
});
