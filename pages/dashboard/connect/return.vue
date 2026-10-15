<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'auth' });
await navigateTo('/dashboard#payouts', { replace: true });
</script>

<template>
  <p class="sr-only">Redirecting to payouts…</p>
</template>
