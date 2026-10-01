<template>
  <div class="studio-page">
    <div class="studio-card mx-auto mt-8 max-w-lg text-center">
    <p class="studio-kicker">YOUR PAYOUT SETUP</p>
    <h1 class="text-3xl font-bold text-[#261b38]">
      Bachs Connect
    </h1>
    <p class="studio-muted mt-4" role="status">
      {{ message }}
    </p>
    <div class="mt-8 flex flex-col gap-3">
      <button
        type="button"
        class="studio-button studio-button--primary"
        :disabled="busy"
        @click="continueOnboarding"
      >
        {{ busy ? 'Working…' : primaryLabel }}
      </button>
      <NuxtLink
        to="/dashboard"
        class="studio-link"
      >
        Back to dashboard
      </NuxtLink>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ApiClientError } from '~/services/api';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
});

useHead({ title: 'Connect — TippyMe' });

const route = useRoute();
const api = useApi();
const busy = ref(false);
const message = ref(
  route.path.includes('refresh')
    ? 'Your Bachs onboarding link expired. Generate a fresh one to finish Connect setup.'
    : 'Welcome back. Confirm settlement status on your dashboard — redirects alone do not prove onboarding finished.',
);
const primaryLabel = computed(() =>
  route.path.includes('refresh') ? 'Get a fresh link' : 'Refresh Connect status',
);

async function continueOnboarding() {
  busy.value = true;
  try {
    const result = await api.startConnectOnboarding();
    if (result.onboardingUrl) {
      openBachsOnboardingUrl(result.onboardingUrl);
      return;
    }
    if (result.settlement.automatedFridayPayout !== 'CONFIGURED') {
      await api.enableFridayPayout();
    }
    await navigateTo('/dashboard?connect=1');
  } catch (err) {
    message.value =
      err instanceof ApiClientError
        ? err.message
        : 'Could not continue Connect onboarding.';
  } finally {
    busy.value = false;
  }
}
</script>
