<template>
  <div
    ref="targetRef"
    class="motion-reveal relative mt-12 w-full max-w-4xl sm:mt-16"
    :class="{ 'is-visible': isVisible }"
  >
    <figure
      class="relative overflow-hidden rounded-2xl border border-white/5 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.55)]"
    >
      <video
        class="aspect-video w-full bg-[#0a0f0c] object-cover"
        controls
        playsinline
        preload="metadata"
        aria-label="TippyMe product demo video"
      >
        <source src="/tippy-demo-video.mp4" type="video/mp4" />
      </video>
      <figcaption class="sr-only">
        TippyMe product demo video
      </figcaption>
    </figure>
  </div>
</template>

<script setup lang="ts">
const { targetRef, isVisible } = useRevealOnScroll({ immediate: true });
</script>
