<template>
  <div
    ref="targetRef"
    class="motion-reveal relative mt-12 w-full max-w-4xl sm:mt-16"
    :class="{ 'is-visible': isVisible }"
  >
    <figure
      class="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border border-white/5 shadow-[0_28px_70px_-40px_rgba(0,0,0,0.55)] md:w-full"
    >
      <!-- Mobile: portrait product demo -->
      <video
        class="aspect-[9/16] w-[min(100%,280px)] bg-[#0a0f0c] object-cover md:hidden"
        autoplay
        muted
        loop
        playsinline
        controls
        preload="metadata"
        aria-label="TippyMe product demo video (mobile)"
      >
        <source src="/tippyme-mobile-demo-web.mp4" type="video/mp4" />
      </video>

      <!-- Desktop: landscape product demo -->
      <video
        class="hidden aspect-video w-full bg-[#0a0f0c] object-cover md:block"
        autoplay
        muted
        loop
        playsinline
        controls
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
