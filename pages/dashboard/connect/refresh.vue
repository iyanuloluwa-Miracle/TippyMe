<template>
  <div class="studio-page">
    <div class="studio-card mx-auto mt-8 max-w-lg text-center">
    <p class="studio-kicker">LET’S GET YOU CONNECTED</p>
    <h1 class="text-3xl font-bold text-[#261b38]">
      Refresh Connect link
    </h1>
    <p class="studio-muted mt-4" role="status">
      {{ message }}
    </p>
    <button
      type="button"
      class="studio-button studio-button--primary mt-8"
      :disabled="busy"
      @click="refresh"
    >
      {{ busy ? 'Working…' : 'Get a fresh Bachs link' }}
    </button>
    <NuxtLink to="/dashboard#payouts" class="studio-link mt-4 block">Back to payouts →</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ApiClientError } from '~/services/api';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
});

useHead({ title: 'Refresh Connect — TippyMe' });

const api = useApi();
const busy = ref(false);
const message = ref(
  'This Bachs onboarding link is no longer usable. TippyMe will issue a new one.',
);

async function refresh() {
  busy.value = true;
  try {
    const result = await api.startConnectOnboarding();
    if (result.onboardingUrl) {
      openBachsOnboardingUrl(result.onboardingUrl);
      return;
    }
    await navigateTo('/dashboard?connect=1');
  } catch (err) {
    message.value =
      err instanceof ApiClientError
        ? err.message
        : 'Could not refresh Connect onboarding.';
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void refresh();
});
</script>
