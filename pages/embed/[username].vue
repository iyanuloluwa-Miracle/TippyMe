<template>
  <main class="min-h-screen bg-transparent p-3 font-sans">
    <a v-if="profile" :href="`/${profile.username}`" target="_blank" rel="noopener" class="block rounded-2xl border border-black/10 bg-white p-5 text-center no-underline shadow-sm">
      <img :src="avatar" alt="" class="mx-auto h-14 w-14 rounded-full object-cover" width="56" height="56">
      <p class="mt-3 font-bold text-[#1a1228]">Support {{ profile.displayName }}</p>
      <p v-if="profile.supportMessage" class="mt-1 text-sm text-[#6b5f8a]">{{ profile.supportMessage }}</p>
      <span class="mt-4 inline-block rounded-full bg-[#9362ff] px-4 py-2 text-sm font-bold text-white">Send support</span>
    </a>
  </main>
</template>
<script setup lang="ts">
import type { CreatorProfile } from '~/types/api';
import { resolveAvatarUrl } from '~/utils/avatar';
definePageMeta({ layout: false });
const route = useRoute(); const api = useApi();
const { data } = await useAsyncData(`embed-${route.params.username}`, () => api.getCreatorByUsername(String(route.params.username)));
const profile = computed<CreatorProfile | null>(() => data.value?.profile ?? null);
const avatar = computed(() => profile.value ? resolveAvatarUrl(profile.value.avatarUrl, profile.value.username) : '');
</script>
