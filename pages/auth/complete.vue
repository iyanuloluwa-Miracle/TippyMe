<template>
  <div class="motion-animate w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 text-center shadow-md shadow-black/5 sm:p-8">
    <template v-if="!error">
      <p class="text-sm font-semibold uppercase tracking-wide text-cheer-leaf">
        Google
      </p>
      <h1 class="mt-2 text-2xl font-bold tracking-tight text-cheer-ink sm:text-3xl">
        Signing you in…
      </h1>
      <p class="mt-2 text-sm font-semibold text-cheer-ink/85">
        Confirming your TippyMe session.
      </p>
    </template>
    <template v-else>
      <h1 class="text-2xl font-bold tracking-tight text-cheer-ink sm:text-3xl">
        Sign-in incomplete
      </h1>
      <p class="mt-3 text-sm text-red-700" role="alert">
        {{ error }}
      </p>
      <NuxtLink
        to="/login"
        class="mt-6 inline-flex w-full items-center justify-center rounded-full bg-cheer-leaf px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-105"
      >
        Back to log in
      </NuxtLink>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
});

useHead({
  title: 'Signing in — TippyMe',
});

const route = useRoute();
const auth = useAuthStore();

const error = ref<string | null>(null);

function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (trimmed.includes('\\') || trimmed.includes('://')) return null;
  return trimmed.slice(0, 512);
}

onMounted(async () => {
  await auth.fetchMe();

  if (!auth.isAuthenticated) {
    error.value =
      'We could not confirm your Google session. Please try Continue with Google again.';
    return;
  }

  const next = safeNextPath(route.query.next);
  if (next) {
    await navigateTo(next);
    return;
  }
  if (auth.user?.hasCreatorProfile) {
    await navigateTo('/dashboard');
    return;
  }
  await navigateTo('/onboarding');
});
</script>
