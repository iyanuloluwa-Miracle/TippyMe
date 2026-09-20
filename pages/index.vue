<template>
  <div>
    <LandingHeroSection />
    <LandingStackSection />
    <LandingProblemSection />
    <LandingHowItWorksSection />
    <LandingFeaturesSection />
    <LandingTestimonialsSection />
    <LandingTrustSection />
    <LandingFaqSection />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();

useSiteSeo({
  title: 'TippyMe — One link for support',
  description:
    'One link for African creators to receive support and messages — without pasting bank details in WhatsApp or DMs.',
  path: '/',
});

// Browser scroll restoration / leftover #faq can land visitors on FAQ.
onMounted(() => {
  if (route.hash) return;
  window.scrollTo({ top: 0, left: 0 });
});
</script>
