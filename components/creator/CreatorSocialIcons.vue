<template>
  <nav
    v-if="links.length"
    class="creator-social-icons"
    aria-label="Find this creator elsewhere"
  >
    <a
      v-for="(link, i) in links"
      :key="link.id ?? `${link.platform}-${i}`"
      :href="link.url"
      class="creator-social-icons__link"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="link.label || platformLabel(link.platform)"
      :title="link.label || platformLabel(link.platform)"
    >
      <span
        class="creator-social-icons__glyph"
        aria-hidden="true"
        v-html="platformIcon(link.platform)"
      />
    </a>
  </nav>
</template>

<script setup lang="ts">
import type { CreatorSocialLink, SocialPlatform } from '~/types/api';

defineProps<{
  links: CreatorSocialLink[];
}>();

function platformLabel(platform: SocialPlatform) {
  const labels: Record<SocialPlatform, string> = {
    X: 'X',
    INSTAGRAM: 'Instagram',
    LINKEDIN: 'LinkedIn',
    GITHUB: 'GitHub',
    YOUTUBE: 'YouTube',
    TIKTOK: 'TikTok',
    WEBSITE: 'Website',
    OTHER: 'Link',
  };
  return labels[platform] || 'Link';
}

function platformIcon(platform: SocialPlatform) {
  const common =
    'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  switch (platform) {
    case 'X':
      return `<svg ${common}><path d="M4 4l16 16M20 4L4 20"/></svg>`;
    case 'INSTAGRAM':
      return `<svg ${common}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg>`;
    case 'LINKEDIN':
      return `<svg ${common}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 11v6M8 8v.01M12 17v-4a2 2 0 0 1 4 0v4"/></svg>`;
    case 'GITHUB':
      return `<svg ${common}><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg>`;
    case 'YOUTUBE':
      return `<svg ${common}><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M10 9.5l5 2.5-5 2.5v-5z" fill="currentColor" stroke="none"/></svg>`;
    case 'TIKTOK':
      return `<svg ${common}><path d="M14 4v10.5a3.5 3.5 0 1 1-3-3.45V8.5c2.2.5 3.8 1.6 4.8 3.2V4h-1.8z"/></svg>`;
    case 'WEBSITE':
    case 'OTHER':
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`;
  }
}
</script>

<style scoped>
.creator-social-icons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.creator-social-icons__link {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid var(--page-border, #e7dfee);
  color: var(--page-accent, #6d3db0);
  background: color-mix(in srgb, var(--page-surface, #fff) 85%, transparent);
  transition: transform .18s ease, background .18s ease, border-color .18s ease;
}
.creator-social-icons__link:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 12%, transparent);
  border-color: color-mix(in srgb, var(--page-accent, #7c4ac0) 35%, transparent);
}
.creator-social-icons__glyph :deep(svg) {
  width: 18px;
  height: 18px;
  display: block;
}
</style>
