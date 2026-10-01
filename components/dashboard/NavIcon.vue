<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <!-- A miniature workspace, with a highlighted summary tile. -->
    <template v-if="name === 'overview'">
      <rect x="3" y="3" width="7" height="10" rx="2" fill="currentColor" fill-opacity=".16" />
      <rect x="14" y="11" width="7" height="10" rx="2" fill="currentColor" fill-opacity=".16" />
      <rect x="3" y="17" width="7" height="4" rx="1.5" />
      <path class="icon-accent" d="M14 5h7M17.5 1.5v7" stroke-width="2" />
    </template>
    <!-- A support coin and heart, rather than a currency-specific symbol. -->
    <template v-else-if="name === 'tips'">
      <path d="M4 13v4c0 2.2 3.6 4 8 4s8-1.8 8-4v-4" />
      <path d="M4 13c0 2.2 3.6 4 8 4s8-1.8 8-4" />
      <path d="M5.2 9.5C4.4 10.1 4 10.8 4 11.5c0 2.2 3.6 4 8 4s8-1.8 8-4c0-.7-.4-1.4-1.2-2" fill="currentColor" fill-opacity=".16" />
      <path class="icon-accent" d="M12 10.8 7.9 7A2.8 2.8 0 0 1 12 3.2 2.8 2.8 0 0 1 16.1 7Z" fill="currentColor" fill-opacity=".18" />
      <path d="M8 17v2M16 17v2" />
    </template>
    <!-- Real analytics: a rising trend over three data columns. -->
    <template v-else-if="name === 'analytics'">
      <path d="M3 3v18h18" />
      <path d="M7 20v-6h3v6M13 20v-9h3v9M19 20v-5h2v5" fill="currentColor" fill-opacity=".18" />
      <path class="icon-accent" d="m6 10 5-4 4 2 6-5M17 3h4v4" />
    </template>
    <!-- Creator identity card with a distinct editing pencil. -->
    <template v-else-if="name === 'profile'">
      <path d="M11 20H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5" fill="currentColor" fill-opacity=".1" />
      <circle cx="9" cy="8" r="2.2" />
      <path d="M5.5 15a3.5 3.5 0 0 1 7 0M15 6h1" />
      <path class="icon-accent" d="m14 17 5.7-5.7a1.4 1.4 0 0 1 2 2L16 19l-3 1 1-3ZM18.5 12.5l2 2" fill="currentColor" fill-opacity=".12" />
    </template>
    <!-- A published creator page with a launch arrow. -->
    <template v-else-if="name === 'public'">
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" fill="currentColor" fill-opacity=".1" />
      <path d="M3 9h18M6 6.5h.01M9 6.5h.01M6 13h4M6 16h2" />
      <path class="icon-accent" d="m13 17 5-5M13 12h5v5" />
    </template>
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: 'overview' | 'tips' | 'analytics' | 'profile' | 'public' }>();
</script>

<style scoped>
.icon-accent { color: var(--nav-icon-accent, #ceff83); }
</style>
