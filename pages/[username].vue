<template>
  <div
    class="public-workspace"
    :data-theme="themeId"
    :style="themeStyle"
  >
    <div
      v-if="pending && !profile"
      class="public-loading"
      role="status"
    >
      <div /><div /><span class="sr-only">Loading creator page…</span>
    </div>
    <div
      v-else-if="error"
      class="public-error"
      role="alert"
    >
      <span aria-hidden="true">♡</span>
      <h1>This page is taking a little break.</h1>
      <p>{{ error }}</p>
      <NuxtLink to="/">
        Back to TippyMe →
      </NuxtLink>
    </div>

    <div
      v-else-if="profile"
      class="public-stage"
    >
      <article class="public-card">
        <div
          class="public-cover"
          :class="{ 'public-cover--empty': !coverSrc }"
        >
          <img
            v-if="coverSrc"
            :src="coverSrc"
            alt=""
            class="public-cover__image"
            width="1200"
            height="375"
            decoding="async"
            fetchpriority="high"
          >
        </div>

        <div class="public-identity">
          <div class="public-portrait">
            <img
              :src="avatarSrc"
              :alt="`${profile.displayName} profile photo`"
              width="96"
              height="96"
              decoding="async"
              fetchpriority="high"
            >
          </div>
          <div class="public-identity__text">
            <div class="creator-name-line">
              <h1 id="creator-name">
                {{ profile.displayName }}
              </h1>
              <span
                v-if="profile.verificationStatus === 'VERIFIED'"
                class="creator-verified"
              >✓ Verified</span>
            </div>
            <p class="creator-handle">
              @{{ profile.username }}
            </p>
            <p
              v-if="profile.bio"
              class="creator-bio"
            >
              {{ profile.bio }}
            </p>
            <p
              v-else
              class="creator-bio"
            >
              A space for the people who believe in my work.
            </p>
            <CreatorSocialIcons :links="profile.socialLinks || []" />
            <p
              v-if="profile.supportMessage"
              class="creator-mantra"
            >
              <span aria-hidden="true">♡</span>
              {{ profile.supportMessage }}
            </p>
          </div>
        </div>

        <div
          v-if="supportGoal"
          class="public-goal"
        >
          <p class="public-kicker">
            HELP MAKE IT HAPPEN
          </p>
          <h2>{{ supportGoal.title }}</h2>
          <div class="public-goal-values">
            <strong>{{ formatGoalMoney(supportGoal.raisedAmount, supportGoal.currency) }}</strong>
            <span>{{ supportGoal.percent }}%</span>
          </div>
          <div
            class="public-goal-track"
            role="progressbar"
            :aria-label="supportGoal.title"
            :aria-valuenow="supportGoal.percent"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span :style="{ width: `${Math.min(100, Math.max(0, supportGoal.percent))}%` }" />
          </div>
          <p class="public-goal-target">
            of {{ formatGoalMoney(supportGoal.targetAmount, supportGoal.currency) }} goal
          </p>
        </div>

        <div class="public-columns">
          <div class="public-community">
            <CreatorPublicActivity
              v-if="recentSupporterNotes.length"
              :recent-supporter-notes="recentSupporterNotes"
            />
            <div
              v-else
              class="public-first-note"
            >
              <span aria-hidden="true">✦</span>
              <h2>A little wall of encouragement</h2>
              <p>Be the first to leave a note with your support.</p>
            </div>
          </div>

          <div class="public-aside">
            <section
              class="support-checkout"
              aria-labelledby="support-heading"
            >
              <header class="support-checkout-heading">
                <span
                  class="support-heart"
                  aria-hidden="true"
                >♡</span>
                <div>
                  <p class="public-kicker">
                    A LITTLE LOVE GOES A LONG WAY
                  </p>
                  <h2 id="support-heading">
                    Support {{ profile.displayName }}
                  </h2>
                </div>
              </header>
              <p class="support-checkout-intro">
                Choose your amount. Add a little encouragement. Make their next chapter possible.
              </p>
              <div class="support-checkout-divider" />
              <SupportForm
                :username="profile.username"
                :display-name="profile.displayName"
                :currency="profile.currency"
                :suggested-amounts="profile.suggestedTipAmounts ?? []"
                :platform-fee-percent="pageFeePercent"
              />
              <div class="public-payment-note">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                ><rect
                  x="5"
                  y="10"
                  width="14"
                  height="11"
                  rx="3"
                /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
                <span>Secure checkout with Bachs</span>
              </div>
            </section>

            <CreatorSupportHeatmap
              v-if="supportActivity.length"
              :days="supportActivity"
            />
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PublicCreatorPage } from '~/types/api';
import { ApiClientError } from '~/services/api';
import { resolveAvatarUrl } from '~/utils/avatar';
import { getPageTheme, pageThemeCssVars } from '~/utils/page-themes';

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
    lazy: false,
  },
);

const profile = computed(() => data.value?.profile ?? null);
const recentSupporterNotes = computed(
  () => data.value?.recentSupporterNotes ?? [],
);
const supportGoal = computed(() => data.value?.supportGoal ?? null);
const supportActivity = computed(() => data.value?.supportActivity ?? []);
const pageFeePercent = computed(() => data.value?.platformFeePercent ?? 5);
const themeId = computed(() => profile.value?.pageThemeId || 'classic');
const theme = computed(() => getPageTheme(themeId.value));
const themeStyle = computed(() => pageThemeCssVars(themeId.value));

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

const coverSrc = computed(() => profile.value?.coverImageUrl?.trim() || null);

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
  const raw = coverSrc.value || avatarSrc.value;
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
  link: [
    ...(origin
      ? [{ rel: 'canonical', href: `${origin}${pathLabel.value}` }]
      : []),
    {
      rel: 'stylesheet',
      href: `https://fonts.googleapis.com/css2?family=${theme.value.fonts.googleQuery}&display=swap`,
    },
  ],
  bodyAttrs: {
    class: 'public-creator-body',
  },
}));

onMounted(() => {
  const page = data.value as PublicCreatorPage | null;
  if (!page?.profile?.username) return;
  track('tip_page_view', { username: page.profile.username });
  const source = typeof route.query.ref === 'string'
    ? route.query.ref
    : typeof route.query.utm_source === 'string'
      ? route.query.utm_source
      : undefined;
  void api.recordCreatorPageView(page.profile.username, source).catch(() => {});
});
</script>

<style scoped>
.public-workspace {
  font-weight: 700;
  font-family: var(--page-font-body, 'Darker Grotesque', sans-serif);
  color: var(--page-ink, #261b38);
  background: var(--page-bg, linear-gradient(165deg, #f7f2ff 0%, #efe6fb 42%, #faf7ff 100%));
  background-attachment: fixed;
  min-height: 100vh;
  width: 100%;
  margin: 0;
  padding: 28px 20px 56px;
  position: relative;
}
.public-workspace::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--page-glow, radial-gradient(ellipse at 20% 0%, #855cc933, transparent 55%));
}
.public-workspace > * { position: relative; z-index: 1; }
.public-workspace :deep(:where(p, a, nav, label, legend, input, textarea, button, small, span)) { font-weight: 700; }
.support-checkout :deep(form legend) { font-size: 12px; }
.support-checkout :deep(form input::placeholder),
.support-checkout :deep(form textarea::placeholder) {
  color: var(--page-muted, #64546f); font-weight: 700; opacity: 1;
}
.support-checkout :deep(form button[aria-pressed='true']) {
  background: var(--page-cta, #7142aa);
  border-color: var(--page-cta, #7142aa);
  color: var(--page-cta-text, #fff);
  box-shadow: none;
}

.public-stage { max-width: 1080px; margin: 0 auto; }
.public-card {
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid var(--page-border, #e7dfee);
  background: var(--page-surface, #ffffffee);
  box-shadow: 0 24px 60px #00000012;
  animation: page-rise .55s ease both;
}

.public-cover {
  position: relative;
  height: clamp(140px, 22vw, 220px);
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--page-accent, #7c4ac0) 28%, transparent),
      color-mix(in srgb, var(--page-cta, #603197) 18%, transparent));
}
.public-cover--empty::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 30%, #ffffff55, transparent 40%),
    radial-gradient(circle at 80% 20%, #ffffff33, transparent 35%);
}
.public-cover__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.public-identity {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 18px 20px;
  padding: 0 28px 8px;
  margin-top: -42px;
  align-items: end;
}
.public-portrait {
  width: 96px;
  height: 96px;
  padding: 4px;
  border-radius: 22px;
  background: var(--page-surface, #fff);
  border: 1px solid var(--page-border, #e7dfee);
  box-shadow: 0 10px 24px #00000014;
}
.public-portrait img {
  width: 100%;
  height: 100%;
  border-radius: 18px;
  object-fit: cover;
  display: block;
}
.public-identity__text { min-width: 0; padding-bottom: 4px; }
.creator-name-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.creator-name-line h1 {
  margin: 0;
  font-family: var(--page-font-display, inherit);
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 800;
  letter-spacing: -.04em;
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.creator-verified {
  font-size: 12px;
  color: var(--page-accent, #237350);
  padding: 3px 8px;
  background: color-mix(in srgb, var(--page-accent, #237350) 12%, transparent);
  border: 1px solid var(--page-border, #c9e5d4);
  border-radius: 6px;
}
.creator-handle {
  margin: 4px 0 0;
  color: var(--page-muted, #53445f);
  font-size: 14px;
}
.creator-bio {
  margin: 14px 0 0;
  color: var(--page-muted, #4f405f);
  font-size: 16px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 54ch;
}
.public-identity__text :deep(.creator-social-icons) { margin-top: 16px; }
.creator-mantra {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0 0;
  color: var(--page-muted, #594968);
  font-size: 14px;
}
.creator-mantra > span { color: var(--page-accent, #8153af); }

.public-goal {
  margin: 8px 28px 0;
  padding: 18px 0 0;
  border-top: 1px solid var(--page-border, #e7dfee);
}
.public-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .13em;
  margin: 0;
  color: var(--page-kicker, #7540b4);
}
.public-goal h2 {
  font-family: var(--page-font-display, inherit);
  font-size: 18px;
  margin: 8px 0 12px;
  letter-spacing: -.02em;
}
.public-goal-values {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.public-goal-values strong { font-size: 22px; }
.public-goal-values span { color: var(--page-accent, #237350); font-size: 13px; }
.public-goal-track {
  height: 6px;
  border-radius: 8px;
  overflow: hidden;
  margin: 10px 0;
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 15%, transparent);
}
.public-goal-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--page-accent, #9567d2);
  transition: width .8s ease;
}
.public-goal-target { margin: 0; color: var(--page-muted, #53445f); font-size: 12px; }

.public-columns {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, .9fr);
  gap: 20px;
  padding: 24px 28px 28px;
  align-items: start;
}
.public-aside { display: grid; gap: 16px; }
.support-checkout {
  padding: 24px;
  border: 1px solid var(--page-border, #e3d9ef);
  border-radius: 20px;
  background: color-mix(in srgb, var(--page-surface, #fff) 92%, transparent);
  box-shadow: 0 12px 32px #0000000a;
}
.support-checkout-heading { display: flex; align-items: center; gap: 14px; }
.support-heart {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  color: var(--page-accent, #663a9c);
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 12%, transparent);
  font-size: 24px;
}
.support-checkout-heading h2 {
  margin: 6px 0 0;
  color: var(--page-ink, #281936);
  font-family: var(--page-font-display, inherit);
  font-size: 24px;
  letter-spacing: -.035em;
  font-weight: 800;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.support-checkout-intro {
  margin: 16px 0 18px;
  color: var(--page-muted, #53445f);
  font-size: 14px;
  line-height: 1.5;
}
.support-checkout-divider {
  height: 1px;
  background: var(--page-border, #eee5f6);
  margin-bottom: 18px;
}
.support-checkout :deep(form :is(input:not([type='checkbox']), textarea)) {
  border-color: var(--page-border, #e3d7ed);
  border-radius: 12px;
  background: color-mix(in srgb, var(--page-surface, #fff) 80%, transparent);
}
.support-checkout :deep(form button) { border-radius: 12px; transition: transform .18s ease, background .18s ease; }
.support-checkout :deep(form button[type='submit']) {
  background: var(--page-cta, #643a9d);
  color: var(--page-cta-text, #fff);
  box-shadow: 0 5px 14px color-mix(in srgb, var(--page-cta, #643a9d) 25%, transparent);
}
.support-checkout :deep(form button[type='submit']:hover) {
  transform: translateY(-1px);
  filter: brightness(1.05);
}
.public-payment-note {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--page-border, #eee5f6);
  margin-top: 20px;
  padding-top: 16px;
  color: var(--page-muted, #53445f);
  font-size: 12px;
  line-height: 1.5;
}
.public-payment-note svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--page-accent, #8c6baf);
}

.public-community :deep(section) {
  border: 1px solid var(--page-border, #e3d9ef);
  border-radius: 20px;
  box-shadow: 0 8px 24px #00000008;
  background: color-mix(in srgb, var(--page-surface, #fff) 96%, transparent);
}
.public-community :deep([class*='text-cheer-leaf']) { color: var(--page-accent, #6d3db0); }
.public-community :deep([class*='text-cheer-ink/45']) { color: var(--page-muted, #53445f); }
.public-first-note {
  padding: 28px;
  background: color-mix(in srgb, var(--page-surface, #fff) 90%, transparent);
  border: 1px solid var(--page-border, #e3d9ef);
  border-radius: 20px;
  color: var(--page-muted, #53445f);
}
.public-first-note > span { color: var(--page-accent, #976cbd); font-size: 22px; }
.public-first-note h2 {
  color: var(--page-ink, #352344);
  font-family: var(--page-font-display, inherit);
  font-size: 20px;
  margin: 10px 0;
}
.public-first-note p { font-size: 14px; line-height: 1.5; margin: 0; }

.public-loading {
  max-width: 1080px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}
.public-loading > div {
  height: 220px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--page-accent, #7c4ac0) 12%, transparent);
  border: 1px solid var(--page-border, #dbcee9);
}
.public-error {
  max-width: 560px;
  padding: 48px 32px;
  margin: 32px auto;
  background: var(--page-surface, white);
  border: 1px solid var(--page-border, #e3d9ef);
  border-radius: 20px;
  text-align: center;
  color: var(--page-muted, #53445f);
}
.public-error > span { font-size: 40px; color: var(--page-accent, #8255a9); }
.public-error h1 { font-size: 28px; color: var(--page-ink, #352344); margin: 16px 0; }
.public-error a {
  display: inline-block;
  margin-top: 24px;
  color: var(--page-cta-text, #fff);
  background: var(--page-cta, #643a9d);
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
}
.public-workspace :is(a, button):focus-visible {
  outline: 2px solid var(--page-accent, #b088d8);
  outline-offset: 4px;
}
@keyframes page-rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .public-card { animation: none; }
  .support-checkout :deep(form button) { transition: none; }
}
@media (max-width: 860px) {
  .public-columns { grid-template-columns: minmax(0, 1fr); }
  .public-aside { order: -1; }
}
@media (max-width: 560px) {
  .public-workspace { padding: 16px 12px 40px; }
  .public-card { border-radius: 22px; }
  .public-identity,
  .public-goal,
  .public-columns { padding-left: 18px; padding-right: 18px; }
  .public-identity {
    grid-template-columns: 1fr;
    margin-top: -36px;
    align-items: start;
  }
  .public-portrait { width: 84px; height: 84px; }
}
</style>
