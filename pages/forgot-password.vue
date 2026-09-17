<template>
  <div class="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
    <h1 class="text-3xl font-bold text-cheer-ink">Reset your password</h1>
    <p class="mt-2 text-sm text-cheer-ink/70">Enter your email. If it has a password account, we’ll send a reset code.</p>
    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-semibold text-cheer-ink">Email
        <input v-model="email" type="email" required autocomplete="email" class="mt-1 w-full rounded-xl border p-3">
      </label>
      <template v-if="sent">
        <label class="block text-sm font-semibold text-cheer-ink">Reset code
          <input v-model="code" inputmode="numeric" required maxlength="6" autocomplete="one-time-code" class="mt-1 w-full rounded-xl border p-3">
        </label>
        <label class="block text-sm font-semibold text-cheer-ink">New password
          <input v-model="password" type="password" required minlength="8" autocomplete="new-password" class="mt-1 w-full rounded-xl border p-3">
        </label>
      </template>
      <p v-if="message" role="status" class="text-sm text-cheer-leaf">{{ message }}</p>
      <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
      <button type="submit" :disabled="pending" class="rounded-full bg-cheer-leaf px-6 py-3 font-semibold text-white disabled:opacity-60">
        {{ pending ? 'Please wait…' : sent ? 'Set new password' : 'Send reset code' }}
      </button>
    </form>
    <NuxtLink to="/login" class="mt-5 inline-block text-sm font-semibold text-cheer-leaf hover:underline">Back to login</NuxtLink>
  </div>
</template>

<script setup lang="ts">
import { ApiClientError } from '~/services/api';
definePageMeta({ layout: 'auth' });
useHead({ title: 'Reset password — TippyMe' });
const api = useApi();
const email = ref('');
const code = ref('');
const password = ref('');
const sent = ref(false);
const pending = ref(false);
const message = ref('');
const error = ref('');
async function submit() {
  pending.value = true;
  error.value = '';
  message.value = '';
  try {
    if (!sent.value) {
      await api.requestPasswordReset(email.value.trim());
      sent.value = true;
      message.value = 'If this email has a password account, a reset code is on its way.';
    } else {
      await api.resetPassword(email.value.trim(), code.value.trim(), password.value);
      await navigateTo('/login');
    }
  } catch (err) {
    error.value = err instanceof ApiClientError ? err.message : 'Please try again.';
  } finally {
    pending.value = false;
  }
}
</script>
