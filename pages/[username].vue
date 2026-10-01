<template>
  <div class="public-workspace">
    <div v-if="pending && !profile" class="public-loading" role="status"><div /><div /><span class="sr-only">Loading creator page…</span></div>
    <div v-else-if="error" class="public-error" role="alert"><span aria-hidden="true">♡</span><h1>This page is taking a little break.</h1><p>{{ error }}</p><NuxtLink to="/">Back to TippyMe →</NuxtLink></div>
    <div v-else-if="profile" class="public-grid">
      <section class="creator-story" aria-labelledby="creator-name">
        <div class="creator-story-top"><span class="public-kicker">INDEPENDENT WORK. REAL SUPPORT.</span><span class="creator-spark" aria-hidden="true">✦</span></div>
        <div class="creator-portrait"><img :src="avatarSrc" :alt="`${profile.displayName} profile photo`" width="96" height="96" decoding="async" fetchpriority="high"></div>
        <div class="creator-name-line"><h1 id="creator-name">{{ profile.displayName }}</h1><span v-if="profile.verificationStatus === 'VERIFIED'" class="creator-verified">✓ Verified</span></div>
        <p class="creator-address">tippyme.click{{ pathLabel }}</p>
        <p v-if="profile.bio" class="creator-bio">{{ profile.bio }}</p>
        <p v-else class="creator-bio">A space for the people who believe in my work.</p>
        <blockquote v-if="profile.supportMessage" class="creator-invitation"><span aria-hidden="true">“</span>{{ profile.supportMessage }}</blockquote>
        <nav v-if="profile.socialLinks?.length" class="creator-socials" aria-label="Find this creator elsewhere"><a v-for="(link, i) in profile.socialLinks" :key="link.id ?? `${link.platform}-${i}`" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.label || link.platform }} <span aria-hidden="true">↗</span></a></nav>
        <div v-if="supportGoal" class="public-goal">
          <p class="public-kicker">HELP MAKE IT HAPPEN</p><h2>{{ supportGoal.title }}</h2><div class="public-goal-values"><strong>{{ formatGoalMoney(supportGoal.raisedAmount, supportGoal.currency) }}</strong><span>{{ supportGoal.percent }}%</span></div>
          <div class="public-goal-track" role="progressbar" :aria-label="supportGoal.title" :aria-valuenow="supportGoal.percent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${Math.min(100, Math.max(0, supportGoal.percent))}%` }" /></div>
          <p class="public-goal-target">of {{ formatGoalMoney(supportGoal.targetAmount, supportGoal.currency) }} goal</p><p v-if="supportGoal.raisedIncomplete" class="public-goal-note">Other currencies are excluded where a reliable exchange rate is unavailable.</p>
        </div>
        <div class="creator-story-footer"><span aria-hidden="true">♡</span> Small gestures. Lasting impact.</div>
      </section>

      <section class="support-checkout" aria-labelledby="support-heading">
        <header class="support-checkout-heading"><span class="support-heart" aria-hidden="true">♡</span><div><p class="public-kicker">A LITTLE LOVE GOES A LONG WAY</p><h2 id="support-heading">Support {{ profile.displayName }}</h2></div></header>
        <p class="support-checkout-intro">Choose your amount. Add a little encouragement. Make their next chapter possible.</p>
        <div class="support-checkout-divider" />
        <SupportForm :username="profile.username" :display-name="profile.displayName" :currency="profile.currency" :suggested-amounts="profile.suggestedTipAmounts ?? []" :platform-fee-percent="pageFeePercent" />
        <div class="public-payment-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><span>Payment is handled by Bachs. Support is confirmed after verification.</span></div>
      </section>

      <div class="public-community"><CreatorPublicActivity v-if="recentSupporterNotes.length" :recent-supporter-notes="recentSupporterNotes" /><div v-else class="public-first-note"><span aria-hidden="true">✦</span><h2>Be part of the story.</h2><p>Your support and a few kind words can make a creator’s day.</p></div></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublicCreatorPage } from '~/types/api';
import { ApiClientError } from '~/services/api';
import { resolveAvatarUrl } from '~/utils/avatar';

definePageMeta({
  layout: 'creator',
});

const route = useRoute();
const api = useApi();
const { track } = useSabilytics();

const username = computed(() =>
  String(route.params.username || '').toLowerCase(),
);

const {
  data,
  pending,
  error: fetchError,
} = await useAsyncData(
  () => `public-creator:${username.value}`,
  () => api.getCreatorByUsername(username.value),
  {
    watch: [username],
    // Keep prior profile visible while refetching a different username.
    lazy: false,
  },
);

const profile = computed(() => data.value?.profile ?? null);
const recentSupporterNotes = computed(
  () => data.value?.recentSupporterNotes ?? [],
);
const supportGoal = computed(() => data.value?.supportGoal ?? null);
const pageFeePercent = computed(() => data.value?.platformFeePercent ?? 5);

function formatGoalMoney(amount: string, currency: string) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

const error = computed(() => {
  if (!fetchError.value) return null;
  const err = fetchError.value;
  if (err instanceof ApiClientError && err.statusCode === 404) {
    return 'This Tippy page does not exist.';
  }
  if (
    typeof err === 'object' &&
    err &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === 404
  ) {
    return 'This Tippy page does not exist.';
  }
  return 'Unable to load this page right now.';
});

const avatarSrc = computed(() => {
  if (!profile.value) return resolveAvatarUrl(null, username.value || 'creator', 128);
  return resolveAvatarUrl(profile.value.avatarUrl, profile.value.username, 128);
});

const pathLabel = computed(() => {
  const path = profile.value?.publicPath || `/${username.value}`;
  return path.startsWith('/') ? path : `/${path}`;
});

const origin = usePublicOrigin();
const seoTitle = computed(() =>
  profile.value
    ? `Support ${profile.value.displayName} — TippyMe`
    : 'Creator — TippyMe',
);
const seoDescription = computed(
  () =>
    profile.value?.supportMessage?.trim()
    || profile.value?.bio?.trim()
    || 'Send support and a message through TippyMe — no bank details in the chat.',
);
const seoImage = computed(() => {
  const raw = avatarSrc.value;
  if (!raw) return origin ? `${origin}/og/default.png` : '/og/default.png';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return origin ? `${origin}${raw.startsWith('/') ? raw : `/${raw}`}` : raw;
});

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogType: 'profile',
  ogUrl: computed(() => (origin ? `${origin}${pathLabel.value}` : undefined)),
  ogImage: seoImage,
  ogImageAlt: computed(() =>
    profile.value
      ? `${profile.value.displayName} on TippyMe`
      : 'TippyMe — One link for support',
  ),
  twitterCard: 'summary_large_image',
  twitterTitle: seoTitle,
  twitterDescription: seoDescription,
  twitterImage: seoImage,
});

useHead(() => ({
  link: origin
    ? [{ rel: 'canonical', href: `${origin}${pathLabel.value}` }]
    : [],
}));

// Analytics after first paint — never block rendering.
onMounted(() => {
  const page = data.value as PublicCreatorPage | null;
  if (!page?.profile?.username) return;
  track('tip_page_view', { username: page.profile.username });
  const source = typeof route.query.ref === 'string'
    ? route.query.ref
    : typeof route.query.utm_source === 'string'
      ? route.query.utm_source
      : undefined;
  void api.recordCreatorPageView(page.profile.username, source).catch(() => {
    // View counting must not block the tip page.
  });
});
</script>

<style scoped>
/* Match the dashboard’s bold, readable typography without changing shared checkout behavior. */
.public-workspace { font-weight: 700; }
.public-workspace :deep(:where(p, a, nav, label, legend, input, textarea, button, small, span)) { font-weight: 700; }
.support-checkout :deep(form legend) { font-size: 12px; }
.support-checkout :deep(form input::placeholder), .support-checkout :deep(form textarea::placeholder) { color: #64546f; font-weight: 700; opacity: 1; }
.public-community :deep(.text-cheer-leaf) { color: #6d3db0; font-size: 12px; }
.support-checkout :deep(form button[aria-pressed='true']) { background: #7142aa; border-color: #7142aa; color: #fff; box-shadow: none; }
.public-workspace { max-width: 1160px; padding: 48px 24px 64px; margin: 0 auto; }.public-grid { display: grid; grid-template-columns: minmax(0, .95fr) minmax(0, 1.05fr); gap: 24px; align-items: start; }.creator-story { position: relative; overflow: hidden; padding: 32px; border: 1px solid #e7dfee; border-radius: 20px; color: #261b38; background: radial-gradient(ellipse at 100% 0%, #e2d0f72b, transparent 65%), linear-gradient(145deg, #ffffff, #f6f0fc); box-shadow: 0 16px 40px #2c163508; }.creator-story-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.public-kicker { font-size: 12px; font-weight: 800; letter-spacing: .13em; margin: 0; color: #7540b4; }.creator-spark { color: #237350; font-size: 24px; }.creator-portrait { display: inline-block; margin-top: 32px; padding: 5px; border: 1px solid #e0c1ff29; border-radius: 28px; background: #e0c1ff0a; }.creator-portrait img { width: 96px; height: 96px; border-radius: 22px; object-fit: cover; }.creator-name-line { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 20px; }.creator-name-line h1 { margin: 0; font-size: 38px; font-weight: 800; letter-spacing: -.04em; line-height: 1.1; overflow-wrap: anywhere; max-width: 100%; }.creator-verified { font-size: 12px; color: #237350; padding: 3px 8px; background: #edf8f1; border: 1px solid #c9e5d4; border-radius: 6px; }.creator-address { color: #53445f; font-size: 13px; margin: 8px 0 0; overflow-wrap: anywhere; }.creator-bio { color: #4f405f; font-size: 17px; line-height: 1.6; margin: 24px 0; white-space: pre-wrap; overflow-wrap: anywhere; }.creator-invitation { margin: 24px 0 0; padding: 20px; border: 1px solid #e7dfee; border-radius: 16px; background: #c9abef08; font-size: 15px; line-height: 1.6; color: #594968; white-space: pre-wrap; overflow-wrap: anywhere; }.creator-invitation > span { display: block; color: #8153af; font-size: 32px; line-height: .8; margin: 8px 0; }.creator-socials { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }.creator-socials a { display: inline-flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #e0d4ec; border-radius: 10px; color: #6d3db0; font-size: 12px; }.creator-socials a:hover { color: #512780; background: #f2e9fa; }.creator-socials a span { color: #8153af; }.creator-story-footer { display: flex; align-items: center; gap: 8px; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e7dfee; font-size: 12px; color: #53445f; }.creator-story-footer span { color: #237350; }
.public-goal { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e7dfee; }.public-goal h2 { font-size: 20px; margin: 12px 0 16px; letter-spacing: -.02em; overflow-wrap: anywhere; }.public-goal-values { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }.public-goal-values strong { font-size: 26px; overflow-wrap: anywhere; }.public-goal-values span { color: #237350; font-size: 14px; }.public-goal-track { height: 6px; border-radius: 8px; overflow: hidden; margin: 12px 0; background: #d4b6f220; }.public-goal-track span { display: block; height: 100%; border-radius: inherit; background: #9567d2; }.public-goal-target { margin: 0; color: #53445f; font-size: 12px; }.public-goal-note { font-size: 12px; color: #53445f; line-height: 1.5; margin-top: 12px; }
.support-checkout { grid-column: 2; grid-row: 1 / span 2; padding: 32px; border: 1px solid #e3d9ef; border-radius: 20px; background: #fff; box-shadow: 0 16px 40px #2c163508; }.support-checkout-heading { display: flex; align-items: center; gap: 16px; }.support-heart { display: grid; place-items: center; flex-shrink: 0; width: 48px; height: 48px; border-radius: 16px; color: #663a9c; background: #f0e8fb; font-size: 28px; }.support-checkout-heading .public-kicker { color: #6d3db0; font-size: 12px; }.support-checkout-heading h2 { margin: 8px 0 0; color: #281936; font-size: 27px; letter-spacing: -.035em; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; }.support-checkout-intro { margin: 20px 0 24px; color: #53445f; font-size: 15px; line-height: 1.5; }.support-checkout-divider { height: 1px; background: #eee5f6; margin-bottom: 24px; }.support-checkout :deep(form) { color: #31223f; }.support-checkout :deep(form [class*='text-cheer-ink/4']), .support-checkout :deep(form [class*='text-cheer-ink/5']) { color: #53445f; }.support-checkout :deep(form :is(input:not([type='checkbox']), textarea)) { border-color: #e3d7ed; border-radius: 12px; background: #fcfaff; }.support-checkout :deep(form button) { border-radius: 12px; }.support-checkout :deep(form button[type='submit']) { background: #643a9d; box-shadow: 0 5px 14px #643a9d25; }.support-checkout :deep(form button[type='submit']:hover) { background: #4d297f; }.public-payment-note { display: flex; align-items: center; gap: 10px; border-top: 1px solid #eee5f6; margin-top: 24px; padding-top: 20px; color: #53445f; font-size: 12px; line-height: 1.5; }.public-payment-note svg { width: 18px; height: 18px; flex-shrink: 0; color: #8c6baf; }
.public-community { min-width: 0; }.public-community :deep(section) { border: 1px solid #e3d9ef; border-radius: 20px; box-shadow: 0 8px 24px #2c163506; }.public-community :deep([class*='text-cheer-ink/45']) { color: #53445f; }.public-community :deep(p) { overflow-wrap: anywhere; }.public-first-note { padding: 32px; background: #ffffff9c; border: 1px solid #e3d9ef; border-radius: 20px; color: #53445f; }.public-first-note > span { color: #976cbd; font-size: 24px; }.public-first-note h2 { color: #352344; font-size: 22px; margin: 12px 0; }.public-first-note p { font-size: 15px; line-height: 1.5; margin: 0; }
.public-loading { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }.public-loading > div { height: 480px; border-radius: 20px; background: #dbcde733; border: 1px solid #dbcee9; }.public-error { max-width: 560px; padding: 48px 32px; margin: 32px auto; background: white; border: 1px solid #e3d9ef; border-radius: 20px; text-align: center; color: #53445f; }.public-error > span { font-size: 40px; color: #8255a9; }.public-error h1 { font-size: 28px; color: #352344; margin: 16px 0; }.public-error a { display: inline-block; margin-top: 24px; color: #fff; background: #643a9d; padding: 12px 20px; border-radius: 12px; font-size: 14px; }.public-workspace :is(a, button):focus-visible { outline: 2px solid #b088d8; outline-offset: 4px; }
@media (max-width: 800px) { .public-workspace { padding: 24px 16px 48px; }.public-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }.support-checkout { grid-column: auto; grid-row: auto; }.creator-story, .support-checkout { padding: 24px; }.creator-name-line h1 { font-size: 32px; }.public-loading { grid-template-columns: minmax(0, 1fr); }.public-loading > div { height: 240px; } }
@media (max-width: 400px) { .creator-story, .support-checkout { padding: 20px; }.support-checkout-heading { gap: 12px; }.support-heart { width: 40px; height: 40px; }.support-checkout-heading h2 { font-size: 24px; }.public-kicker { font-size: 12px; } }
</style>
