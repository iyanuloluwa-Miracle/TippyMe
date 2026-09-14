<template>
  <article
    class="flex h-full flex-col rounded-2xl border border-black/10 bg-white p-5 shadow-sm shadow-black/5 sm:p-6"
  >
    <div class="flex items-center gap-3">
      <img
        :src="testimonial.photo"
        :alt="testimonial.name"
        class="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-black/10"
        width="56"
        height="56"
        loading="lazy"
        decoding="async"
      />
      <div class="min-w-0">
        <cite class="block truncate text-lg font-bold not-italic tracking-tight text-cheer-ink">
          {{ testimonial.name }}
        </cite>
        <p class="truncate text-sm font-semibold text-cheer-ink/55">
          {{ testimonial.role }}, {{ testimonial.location }}
        </p>
      </div>
    </div>

    <p class="mt-5 flex-1 text-lg font-semibold leading-relaxed text-cheer-ink/90">
      “{{ testimonial.quote }}”
    </p>
  </article>
</template>

<script setup lang="ts">
import type { Testimonial } from '~/types/landing';

defineProps<{
  testimonial: Testimonial;
}>();
</script>
