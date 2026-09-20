<template>
  <div class="w-full px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
    <header class="mb-6 sm:mb-8">
      <p class="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-cheer-leaf">
        Workspace
      </p>
      <h1 class="mt-2 text-4xl font-extrabold tracking-tight text-cheer-ink sm:text-5xl">
        Edit profile
      </h1>
      <p class="mt-2 max-w-xl text-base font-semibold text-cheer-ink/85">
        Update how you appear on your Tippy page, your social links, and support settings.
      </p>
    </header>

    <p
      v-if="loadError"
      class="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      role="alert"
    >
      {{ loadError }}
    </p>

    <div
      v-if="loading"
      class="space-y-4"
    >
      <div class="dash-shimmer h-48 rounded-[1.75rem] opacity-30" />
      <div class="dash-shimmer h-40 rounded-[1.75rem] opacity-25" />
      <div class="dash-shimmer h-40 rounded-[1.75rem] opacity-20" />
    </div>

    <div
      v-else-if="profile"
      class="mx-auto max-w-2xl space-y-5"
    >
      <!-- Identity -->
      <section
        class="rounded-[1.75rem] border border-black/6 bg-white/85 p-5 shadow-[0_1px_0_rgba(26, 18, 40,0.04)] backdrop-blur-md sm:p-7"
        aria-labelledby="identity-heading"
      >
        <h2
          id="identity-heading"
          class="text-xl font-extrabold tracking-tight text-cheer-ink"
        >
          Identity
        </h2>
        <p class="mt-1 text-sm text-cheer-ink/55">
          Name, bio, username, and photo on your public page.
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <p class="block text-sm text-cheer-ink">
              Profile photo
            </p>
            <div class="mt-2">
              <CreatorAvatarUploader
                v-model="avatarUrl"
                :seed="username || displayName || 'creator'"
                :alt="displayName || 'Profile photo'"
                size="lg"
                persist
                hint="Click to change your photo"
                :disabled="identityPending"
                @uploaded="onAvatarUploaded"
              />
            </div>
          </div>

          <div>
            <label
              for="edit-display"
              class="block text-sm text-cheer-ink"
            >Display name</label>
            <input
              id="edit-display"
              v-model="displayName"
              type="text"
              maxlength="80"
              required
              class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base outline-none focus:border-cheer-leaf/40 focus:ring-2 focus:ring-cheer-leaf/30"
              placeholder="How supporters see you"
              :disabled="identityPending"
            >
          </div>

          <div>
            <div class="flex items-center justify-between gap-2">
              <label
                for="edit-bio"
                class="block text-sm text-cheer-ink"
              >Bio</label>
              <button
                type="button"
                class="text-xs font-semibold text-cheer-leaf hover:underline disabled:opacity-50"
                :disabled="identityPending || aiBusy"
                @click="polishBio"
              >
                {{ aiBusy ? 'Polishing…' : 'Polish with AI' }}
              </button>
            </div>
            <textarea
              id="edit-bio"
              v-model="bio"
              rows="3"
              maxlength="500"
              class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base outline-none focus:border-cheer-leaf/40 focus:ring-2 focus:ring-cheer-leaf/30"
              placeholder="A short line about your work"
              :disabled="identityPending"
            />
            <p
              v-if="aiHint"
              class="mt-1 text-xs text-cheer-ink/50"
            >
              {{ aiHint }}
            </p>
          </div>

          <div>
            <label
              for="edit-username"
              class="block text-sm text-cheer-ink"
            >Username</label>
            <div class="mt-1.5 flex items-center gap-2 rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 focus-within:border-cheer-leaf/40 focus-within:ring-2 focus-within:ring-cheer-leaf/30">
              <span class="shrink-0 text-sm text-cheer-ink/45">/</span>
              <input
                id="edit-username"
                v-model="username"
                type="text"
                autocomplete="username"
                maxlength="30"
                class="w-full bg-transparent py-2.5 text-base text-cheer-ink outline-none"
                placeholder="yourname"
                :disabled="identityPending"
                @input="onUsernameInput"
              >
            </div>
            <p
              v-if="usernameStatus"
              class="mt-2 text-sm"
              :class="usernameOk ? 'text-cheer-leaf' : 'text-red-700'"
              role="status"
            >
              {{ usernameStatus }}
            </p>
            <p class="mt-1 text-xs text-cheer-ink/50">
              Lowercase letters, numbers, underscores. 3–30 characters.
            </p>
          </div>
        </div>

        <p
          v-if="identityError"
          class="mt-3 text-sm text-red-700"
          role="alert"
        >
          {{ identityError }}
        </p>
        <p
          v-if="identitySuccess"
          class="mt-3 text-sm text-cheer-leaf"
          role="status"
        >
          {{ identitySuccess }}
        </p>

        <button
          type="button"
          class="mt-5 inline-flex items-center justify-center rounded-full bg-cheer-leaf px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          :disabled="identityPending || !canSaveIdentity"
          @click="saveIdentity"
        >
          {{ identityPending ? 'Saving…' : 'Save identity' }}
        </button>
      </section>

      <!-- Social -->
      <section
        class="rounded-[1.75rem] border border-black/6 bg-white/85 p-5 shadow-[0_1px_0_rgba(26, 18, 40,0.04)] backdrop-blur-md sm:p-7"
        aria-labelledby="social-heading"
      >
        <h2
          id="social-heading"
          class="text-xl font-extrabold tracking-tight text-cheer-ink"
        >
          Social links
        </h2>
        <p class="mt-1 text-sm text-cheer-ink/55">
          Optional — add up to a few links supporters can follow.
        </p>

        <div class="mt-4 space-y-3">
          <div
            v-for="(link, index) in socialLinks"
            :key="index"
            class="flex flex-col gap-2 sm:flex-row"
          >
            <select
              v-model="link.platform"
              class="rounded-xl border border-black/10 bg-[#f7f4ff] px-3 py-2.5 text-sm"
              :disabled="socialPending"
            >
              <option
                v-for="p in platforms"
                :key="p"
                :value="p"
              >
                {{ p }}
              </option>
            </select>
            <input
              v-model="link.url"
              type="url"
              placeholder="https://"
              class="min-w-0 flex-1 rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cheer-leaf/30"
              :disabled="socialPending"
            >
            <button
              type="button"
              class="text-sm text-red-700"
              :disabled="socialPending"
              @click="removeSocial(index)"
            >
              Remove
            </button>
          </div>
        </div>

        <button
          type="button"
          class="mt-3 text-sm font-semibold text-cheer-leaf disabled:opacity-50"
          :disabled="socialPending || socialLinks.length >= 5"
          @click="addSocial"
        >
          + Add link
        </button>

        <p
          v-if="socialError"
          class="mt-3 text-sm text-red-700"
          role="alert"
        >
          {{ socialError }}
        </p>
        <p
          v-if="socialSuccess"
          class="mt-3 text-sm text-cheer-leaf"
          role="status"
        >
          {{ socialSuccess }}
        </p>

        <button
          type="button"
          class="mt-5 inline-flex items-center justify-center rounded-full bg-cheer-leaf px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          :disabled="socialPending"
          @click="saveSocial"
        >
          {{ socialPending ? 'Saving…' : 'Save social links' }}
        </button>
      </section>

      <!-- Support -->
      <section
        class="rounded-[1.75rem] border border-black/6 bg-white/85 p-5 shadow-[0_1px_0_rgba(26, 18, 40,0.04)] backdrop-blur-md sm:p-7"
        aria-labelledby="support-heading"
      >
        <h2
          id="support-heading"
          class="text-xl font-extrabold tracking-tight text-cheer-ink"
        >
          Support settings
        </h2>
        <p class="mt-1 text-sm text-cheer-ink/55">
          Currency, message, and suggested tip amounts on your page.
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <label
              for="edit-currency"
              class="block text-sm text-cheer-ink"
            >Preferred currency</label>
            <select
              id="edit-currency"
              v-model="currency"
              class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base"
              :disabled="settingsPending"
            >
              <option
                v-for="c in currencies"
                :key="c"
                :value="c"
              >
                {{ c }}
              </option>
            </select>
          </div>

          <div>
            <label for="edit-payout-country" class="block text-sm text-cheer-ink">Payout country</label>
            <select id="edit-payout-country" v-model="payoutCountry" class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base" :disabled="settingsPending">
              <option value="">Choose your country</option>
              <option value="NG">Nigeria</option>
              <option value="GH">Ghana</option>
              <option value="KE">Kenya</option>
              <option value="ZA">South Africa</option>
            </select>
            <p class="mt-1 text-xs text-cheer-ink/50">Choose where your Bachs payout account is based. This can be changed only before connecting payouts.</p>
          </div>

          <div>
            <label
              for="edit-support"
              class="block text-sm text-cheer-ink"
            >Support message</label>
            <textarea
              id="edit-support"
              v-model="supportMessage"
              rows="3"
              maxlength="500"
              class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base outline-none focus:ring-2 focus:ring-cheer-leaf/30"
              placeholder="Thanks for supporting my work…"
              :disabled="settingsPending"
            />
          </div>

          <div>
            <label for="edit-thank-you" class="block text-sm text-cheer-ink">Automatic thank-you email</label>
            <textarea id="edit-thank-you" v-model="thankYouMessage" rows="3" maxlength="500" class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base outline-none focus:ring-2 focus:ring-cheer-leaf/30" placeholder="Thank you for helping me keep making…" :disabled="settingsPending" />
            <p class="mt-1 text-xs text-cheer-ink/50">Sent in the supporter’s receipt only after Bachs verifies payment.</p>
          </div>

          <div>
            <label class="block text-sm text-cheer-ink">Suggested tip amounts</label>
            <div class="mt-2 flex flex-wrap gap-2">
              <input
                v-for="(_, i) in tipAmounts"
                :key="i"
                v-model="tipAmounts[i]"
                type="text"
                inputmode="decimal"
                class="w-28 rounded-xl border border-black/10 bg-[#f7f4ff] px-3 py-2 text-sm"
                :disabled="settingsPending"
              >
            </div>
            <p class="mt-1 text-xs text-cheer-ink/50">
              Decimal amounts (e.g. 1000.00). Up to 5 amounts.
            </p>
          </div>

          <div class="rounded-2xl border border-black/8 bg-cheer-sand/50 p-4">
            <label class="flex items-center gap-2 text-sm font-semibold text-cheer-ink">
              <input
                v-model="goalActive"
                type="checkbox"
                class="rounded border-black/20"
                :disabled="settingsPending"
              >
              Show a support goal on my public page
            </label>
            <div
              v-if="goalActive"
              class="mt-3 space-y-3"
            >
              <div>
                <label
                  for="edit-goal-title"
                  class="block text-sm text-cheer-ink"
                >Goal title</label>
                <input
                  id="edit-goal-title"
                  v-model="goalTitle"
                  type="text"
                  maxlength="80"
                  class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base"
                  placeholder="e.g. Laptop fund"
                  :disabled="settingsPending"
                >
              </div>
              <div>
                <label
                  for="edit-goal-amount"
                  class="block text-sm text-cheer-ink"
                >Target amount</label>
                <input
                  id="edit-goal-amount"
                  v-model="goalTargetAmount"
                  type="text"
                  inputmode="decimal"
                  class="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f4ff] px-3.5 py-2.5 text-base"
                  placeholder="50000.00"
                  :disabled="settingsPending"
                >
              </div>
            </div>
          </div>
        </div>

        <p
          v-if="settingsError"
          class="mt-3 text-sm text-red-700"
          role="alert"
        >
          {{ settingsError }}
        </p>
        <p
          v-if="settingsSuccess"
          class="mt-3 text-sm text-cheer-leaf"
          role="status"
        >
          {{ settingsSuccess }}
        </p>

        <button
          type="button"
          class="mt-5 inline-flex items-center justify-center rounded-full bg-cheer-leaf px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          :disabled="settingsPending"
          @click="saveSettings"
        >
          {{ settingsPending ? 'Saving…' : 'Save support settings' }}
        </button>
      </section>

      <section class="mt-8 rounded-[1.75rem] border border-black/8 bg-white/80 px-5 py-6 sm:px-7">
        <h2 class="text-xl font-extrabold tracking-tight text-cheer-ink">
          Page and account
        </h2>
        <p class="mt-2 text-sm font-semibold leading-relaxed text-cheer-ink/75">
          Pausing hides your public link. Closing signs you out and keeps payment records. It does not delete Bachs history.
        </p>
        <div class="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            class="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-cheer-ink hover:border-cheer-leaf/40 disabled:opacity-60"
            :disabled="accountBusy || !profile"
            @click="togglePage"
          >
            {{ profile?.isActive ? 'Pause public page' : 'Resume public page' }}
          </button>
          <button
            type="button"
            class="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-cheer-ink hover:border-cheer-leaf/40 disabled:opacity-60"
            :disabled="accountBusy"
            @click="downloadTips"
          >
            Download tips CSV
          </button>
          <button
            type="button"
            class="rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
            :disabled="accountBusy"
            @click="closeAccount"
          >
            Close account
          </button>
        </div>
        <p v-if="accountError" class="mt-3 text-sm text-red-700" role="alert">
          {{ accountError }}
        </p>
        <p v-if="accountNotice" class="mt-3 text-sm font-semibold text-cheer-leaf">
          {{ accountNotice }}
        </p>
      </section>

      <section v-if="profile?.publicPath" class="mt-5 rounded-[1.75rem] border border-black/8 bg-white/80 px-5 py-6 sm:px-7">
        <h2 class="text-xl font-extrabold tracking-tight text-cheer-ink">Share on other sites</h2>
        <p class="mt-2 text-sm text-cheer-ink/70">
          Use an iframe on websites that allow embeds, or a GitHub badge (GitHub strips iframes from READMEs).
        </p>

        <div class="mt-5 space-y-6">
          <div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-cheer-ink">Website embed</h3>
              <button
                type="button"
                class="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-cheer-ink hover:border-cheer-leaf/40"
                @click="copyText(embedCode, 'embed')"
              >
                {{ copiedKey === 'embed' ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <textarea
              readonly
              class="mt-2 h-24 w-full rounded-xl border border-black/10 bg-[#f7f4ff] p-3 font-mono text-xs text-cheer-ink"
              :value="embedCode"
              @focus="($event.target as HTMLTextAreaElement).select()"
            />
          </div>

          <div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-cheer-ink">GitHub README badge</h3>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-cheer-ink hover:border-cheer-leaf/40"
                  @click="copyText(githubBadgeHtml, 'github-html')"
                >
                  {{ copiedKey === 'github-html' ? 'Copied!' : 'Copy HTML' }}
                </button>
                <button
                  type="button"
                  class="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-cheer-ink hover:border-cheer-leaf/40"
                  @click="copyText(githubBadgeMarkdown, 'github-md')"
                >
                  {{ copiedKey === 'github-md' ? 'Copied!' : 'Copy Markdown' }}
                </button>
              </div>
            </div>
            <p class="mt-1 text-xs text-cheer-ink/50">
              Paste into your profile or repo <code class="rounded bg-black/5 px-1">README.md</code>. Same approach Buy Me a Coffee uses (linked image, not an iframe).
            </p>
            <p
              v-if="shareUsesLocalhost"
              class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              Snippets currently use a localhost URL. Set <code class="rounded bg-black/5 px-1">NUXT_PUBLIC_APP_URL=https://tippyme.click</code> in production so GitHub can load the badge.
            </p>
            <div class="mt-3 flex items-center gap-3 rounded-xl border border-black/8 bg-[#f7f4ff] px-4 py-3">
              <a
                :href="publicTipUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex shrink-0"
              >
                <img
                  src="/badges/support-me.svg"
                  alt="Support me on TippyMe"
                  width="214"
                  height="48"
                  class="h-12 w-auto"
                >
              </a>
              <p class="text-xs text-cheer-ink/60">Preview — opens your Tippy page</p>
            </div>
            <textarea
              readonly
              class="mt-2 h-20 w-full rounded-xl border border-black/10 bg-[#f7f4ff] p-3 font-mono text-xs text-cheer-ink"
              :value="githubBadgeHtml"
              @focus="($event.target as HTMLTextAreaElement).select()"
            />
            <details class="mt-2">
              <summary class="cursor-pointer text-xs font-semibold text-cheer-leaf">Markdown version</summary>
              <textarea
                readonly
                class="mt-2 h-16 w-full rounded-xl border border-black/10 bg-[#f7f4ff] p-3 font-mono text-xs text-cheer-ink"
                :value="githubBadgeMarkdown"
                @focus="($event.target as HTMLTextAreaElement).select()"
              />
            </details>
          </div>

          <div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-bold text-cheer-ink">GitHub Sponsor button</h3>
              <button
                type="button"
                class="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-cheer-ink hover:border-cheer-leaf/40"
                @click="copyText(fundingYml, 'funding')"
              >
                {{ copiedKey === 'funding' ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <p class="mt-1 text-xs text-cheer-ink/50">
              Create <code class="rounded bg-black/5 px-1">.github/FUNDING.yml</code> on your default branch, then enable Sponsorships in repo settings.
            </p>
            <textarea
              readonly
              class="mt-2 h-16 w-full rounded-xl border border-black/10 bg-[#f7f4ff] p-3 font-mono text-xs text-cheer-ink"
              :value="fundingYml"
              @focus="($event.target as HTMLTextAreaElement).select()"
            />
          </div>
        </div>
      </section>

      <p class="pb-4 text-center text-sm text-cheer-ink/50">
        <NuxtLink
          v-if="profile.publicPath"
          :to="profile.publicPath"
          class="font-semibold text-cheer-leaf hover:underline"
        >
          View public page
        </NuxtLink>
        <span class="mx-2 text-cheer-ink/25">·</span>
        <NuxtLink
          to="/dashboard"
          class="font-semibold text-cheer-ink/70 hover:underline"
        >
          Back to overview
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreatorProfile, SocialPlatform } from '~/types/api';
import { ApiClientError } from '~/services/api';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
});

useHead({
  title: 'Edit profile — TippyMe',
});

const auth = useAuthStore();
const api = useApi();
const { $toast } = useNuxtApp();
const { avatarUrl: avatarUrlState, setFromProfile } = useDashboardNav();

const loading = ref(true);
const accountBusy = ref(false);
const accountError = ref<string | null>(null);
const accountNotice = ref<string | null>(null);
const loadError = ref<string | null>(null);
const profile = ref<CreatorProfile | null>(null);

const displayName = ref('');
const bio = ref('');
const avatarUrl = ref<string | null>(null);
const username = ref('');
const originalUsername = ref('');
const usernameOk = ref(true);
const usernameStatus = ref<string | null>(null);
let usernameTimer: ReturnType<typeof setTimeout> | null = null;
let usernameCheckSeq = 0;

const socialLinks = ref<{ platform: SocialPlatform; url: string }[]>([]);
const supportMessage = ref('');
const thankYouMessage = ref('');
const currency = ref('NGN');
const payoutCountry = ref('');
const tipAmounts = ref(['1000.00', '2500.00', '5000.00']);
const goalActive = ref(false);
const goalTitle = ref('');
const goalTargetAmount = ref('');
const aiBusy = ref(false);
const aiHint = ref<string | null>(null);

const identityPending = ref(false);
const identityError = ref<string | null>(null);
const identitySuccess = ref<string | null>(null);

const socialPending = ref(false);
const socialError = ref<string | null>(null);
const socialSuccess = ref<string | null>(null);

const settingsPending = ref(false);
const settingsError = ref<string | null>(null);
const settingsSuccess = ref<string | null>(null);

const platforms: SocialPlatform[] = [
  'X',
  'INSTAGRAM',
  'LINKEDIN',
  'GITHUB',
  'YOUTUBE',
  'TIKTOK',
  'WEBSITE',
  'OTHER',
];
const currencies = ['NGN', 'USD', 'GHS', 'KES', 'ZAR'];

const canSaveIdentity = computed(() => {
  return Boolean(displayName.value.trim()) && usernameOk.value && username.value.length >= 3;
});

const runtimeConfig = useRuntimeConfig();
const copiedKey = ref<string | null>(null);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

/** Absolute origin used in pasteable snippets (GitHub needs a public HTTPS URL). */
const shareOrigin = computed(() => {
  const configured = String(runtimeConfig.public.appUrl ?? '').replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.client && typeof window !== 'undefined') return window.location.origin;
  return '';
});

const publicTipUrl = computed(() => {
  if (!profile.value?.publicPath) return '';
  return `${shareOrigin.value}${profile.value.publicPath}`;
});

const badgeImageUrl = computed(() => `${shareOrigin.value}/badges/support-me.svg`);

const embedCode = computed(() => {
  if (!profile.value?.publicPath) return '';
  return `<iframe src="${shareOrigin.value}/embed${profile.value.publicPath}" title="Support ${profile.value.displayName}" width="320" height="250" style="border:0;max-width:100%"></iframe>`;
});

const githubBadgeMarkdown = computed(() => {
  if (!publicTipUrl.value) return '';
  return `[![Support me on TippyMe](${badgeImageUrl.value})](${publicTipUrl.value})`;
});

const githubBadgeHtml = computed(() => {
  if (!publicTipUrl.value) return '';
  return `<a href="${publicTipUrl.value}" target="_blank"><img src="${badgeImageUrl.value}" alt="Support me on TippyMe" height="41" /></a>`;
});

const fundingYml = computed(() => {
  if (!publicTipUrl.value) return '';
  return `# .github/FUNDING.yml\ncustom: ${publicTipUrl.value}\n`;
});

const shareUsesLocalhost = computed(() => /localhost|127\.0\.0\.1/i.test(shareOrigin.value));

async function copyText(value: string, key: string) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    copiedKey.value = key;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedKey.value = null;
    }, 2000);
    $toast.success('Copied');
  } catch {
    $toast.error('Could not copy. Select the text and copy manually.');
  }
}

onMounted(async () => {
  await loadProfile();
});

onUnmounted(() => {
  if (usernameTimer) clearTimeout(usernameTimer);
  if (copiedTimer) clearTimeout(copiedTimer);
});

function applyProfile(p: CreatorProfile) {
  profile.value = p;
  displayName.value = p.displayName;
  bio.value = p.bio ?? '';
  avatarUrl.value = p.avatarUrl;
  username.value = p.username;
  originalUsername.value = p.username;
  usernameOk.value = true;
  usernameStatus.value = null;
  socialLinks.value = p.socialLinks.map((l) => ({
    platform: l.platform,
    url: l.url,
  }));
  supportMessage.value = p.supportMessage ?? '';
  thankYouMessage.value = p.thankYouMessage ?? '';
  currency.value = p.currency || 'NGN';
  payoutCountry.value = p.payoutCountry ?? '';
  tipAmounts.value =
    p.suggestedTipAmounts.length > 0
      ? [...p.suggestedTipAmounts]
      : ['1000.00', '2500.00', '5000.00'];
  while (tipAmounts.value.length < 3) {
    tipAmounts.value.push('');
  }
  if (tipAmounts.value.length > 5) {
    tipAmounts.value = tipAmounts.value.slice(0, 5);
  }

  goalActive.value = Boolean(p.goalActive);
  goalTitle.value = p.goalTitle ?? '';
  goalTargetAmount.value = p.goalTargetAmount ?? '';

  setFromProfile(p);
}

async function loadProfile() {
  loading.value = true;
  loadError.value = null;
  try {
    const { profile: me } = await api.getMyCreator();
    if (!me) {
      await navigateTo('/onboarding');
      return;
    }
    applyProfile(me);
  } catch (err) {
    if (err instanceof ApiClientError && err.statusCode === 401) {
      auth.setUser(null);
      await navigateTo('/login?next=/dashboard/profile');
      return;
    }
    if (err instanceof ApiClientError && err.statusCode === 404) {
      await navigateTo('/onboarding');
      return;
    }
    loadError.value =
      err instanceof Error ? err.message : 'Could not load profile.';
  } finally {
    loading.value = false;
  }
}

function onAvatarUploaded(url: string) {
  avatarUrl.value = url;
  avatarUrlState.value = url;
  if (profile.value) {
    profile.value.avatarUrl = url;
  }
}

function onUsernameInput() {
  username.value = username.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  usernameOk.value = false;
  usernameStatus.value = null;
  identityError.value = null;
  identitySuccess.value = null;
  if (usernameTimer) clearTimeout(usernameTimer);
  usernameTimer = setTimeout(() => {
    void checkUsername();
  }, 350);
}

async function checkUsername() {
  const seq = ++usernameCheckSeq;
  const candidate = username.value;
  if (candidate === originalUsername.value) {
    usernameOk.value = true;
    usernameStatus.value = null;
    return;
  }
  if (candidate.length < 3) {
    usernameStatus.value = 'At least 3 characters.';
    usernameOk.value = false;
    return;
  }
  try {
    const result = await api.checkUsername(candidate);
    if (seq !== usernameCheckSeq || candidate !== username.value) return;
    if (result.available) {
      usernameOk.value = true;
      usernameStatus.value = 'Available';
    } else {
      usernameOk.value = false;
      usernameStatus.value =
        result.reason === 'RESERVED'
          ? 'Reserved — pick another'
          : result.reason === 'TAKEN'
            ? 'Already taken'
            : 'Invalid username';
    }
  } catch {
    if (seq !== usernameCheckSeq || candidate !== username.value) return;
    usernameOk.value = false;
    usernameStatus.value = 'Could not check availability';
  }
}

function addSocial() {
  socialLinks.value.push({ platform: 'WEBSITE', url: '' });
}

function removeSocial(index: number) {
  socialLinks.value.splice(index, 1);
}

function mapError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.statusCode >= 500) {
      return 'Something went wrong. Please try again.';
    }
    return err.message || 'Unable to save.';
  }
  return 'Something went wrong. Please try again.';
}

async function saveIdentity() {
  identityPending.value = true;
  identityError.value = null;
  identitySuccess.value = null;
  try {
    if (!displayName.value.trim()) {
      identityError.value = 'Display name is required.';
      $toast.error(identityError.value);
      return;
    }
    if (!usernameOk.value) {
      identityError.value = 'Choose an available username.';
      $toast.error(identityError.value);
      return;
    }
    const { profile: updated } = await api.updateMyCreator({
      displayName: displayName.value.trim(),
      bio: bio.value.trim() || null,
      username: username.value,
      ...(avatarUrl.value?.trim() ? { avatarUrl: avatarUrl.value.trim() } : {}),
    });
    applyProfile(updated);
    identitySuccess.value = 'Identity saved.';
    $toast.success(identitySuccess.value);
  } catch (err) {
    identityError.value = mapError(err);
    $toast.error(identityError.value);
  } finally {
    identityPending.value = false;
  }
}

async function saveSocial() {
  socialPending.value = true;
  socialError.value = null;
  socialSuccess.value = null;
  try {
    for (const link of socialLinks.value) {
      if (link.url.trim() && !/^https?:\/\//i.test(link.url.trim())) {
        socialError.value = 'Social links must start with http:// or https://';
        $toast.error(socialError.value);
        return;
      }
    }
    const links = socialLinks.value
      .filter((l) => l.url.trim())
      .map((l, i) => ({
        platform: l.platform,
        url: l.url.trim(),
        sortOrder: i,
      }));
    const { profile: updated } = await api.replaceMySocialLinks(links);
    applyProfile(updated);
    socialSuccess.value = 'Social links saved.';
    $toast.success(socialSuccess.value);
  } catch (err) {
    socialError.value = mapError(err);
    $toast.error(socialError.value);
  } finally {
    socialPending.value = false;
  }
}

async function saveSettings() {
  settingsPending.value = true;
  settingsError.value = null;
  settingsSuccess.value = null;
  try {
    const amounts = tipAmounts.value.map((a) => a.trim()).filter(Boolean);
    if (amounts.length === 0) {
      settingsError.value = 'Add at least one suggested tip amount.';
      $toast.error(settingsError.value);
      return;
    }
    const { profile: updated } = await api.updateMyCreatorSettings({
      supportMessage: supportMessage.value.trim() || null,
      thankYouMessage: thankYouMessage.value.trim() || null,
      currency: currency.value,
      payoutCountry: payoutCountry.value || undefined,
      suggestedTipAmounts: amounts,
      goalActive: goalActive.value,
      goalTitle: goalActive.value ? goalTitle.value.trim() || null : null,
      goalTargetAmount: goalActive.value
        ? goalTargetAmount.value.trim() || null
        : null,
    });
    applyProfile(updated);
    settingsSuccess.value = 'Support settings saved.';
    $toast.success(settingsSuccess.value);
  } catch (err) {
    settingsError.value = mapError(err);
    $toast.error(settingsError.value);
  } finally {
    settingsPending.value = false;
  }
}

async function polishBio() {
  aiBusy.value = true;
  aiHint.value = null;
  try {
    const result = await api.polishBio({
      displayName: displayName.value.trim() || username.value,
      draft: bio.value,
    });
    bio.value = result.bio;
    if (result.supportCta && !supportMessage.value.trim()) {
      supportMessage.value = result.supportCta;
    }
    aiHint.value =
      result.source === 'openrouter'
        ? 'Polished with OpenRouter AI — review before saving.'
        : 'Local AI assist used (add OPENROUTER_API_KEY for live OpenRouter).';
  } catch (err) {
    aiHint.value = mapError(err);
  } finally {
    aiBusy.value = false;
  }
}

async function togglePage() {
  if (!profile.value) return;
  accountBusy.value = true;
  accountError.value = null;
  accountNotice.value = null;
  try {
    const next = !profile.value.isActive;
    const { profile: updated } = await api.setPageActive(next);
    applyProfile(updated);
    accountNotice.value = next ? 'Public page is live again.' : 'Public page is paused.';
    $toast.success(accountNotice.value);
  } catch (err) {
    accountError.value = mapError(err);
    $toast.error(accountError.value);
  } finally {
    accountBusy.value = false;
  }
}

async function downloadTips() {
  accountBusy.value = true;
  accountError.value = null;
  accountNotice.value = null;
  try {
    const response = await fetch('/api/creators/me/tips/export', { credentials: 'include' });
    if (!response.ok) {
      accountError.value = 'Unable to download tips right now.';
      $toast.error(accountError.value);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tippyme-tips.csv';
    link.click();
    URL.revokeObjectURL(url);
    accountNotice.value = 'Tip export downloaded. Anonymous rows omit the supporter name.';
    $toast.success('Tip export downloaded');
  } catch {
    accountError.value = 'Unable to download tips right now.';
    $toast.error(accountError.value);
  } finally {
    accountBusy.value = false;
  }
}

async function closeAccount() {
  if (!window.confirm('Close your account? Your public page will go offline and you will be signed out. Payment records stay.')) {
    return;
  }
  accountBusy.value = true;
  accountError.value = null;
  try {
    await api.closeAccount();
    auth.setUser(null);
    await navigateTo('/login');
  } catch (err) {
    accountError.value = mapError(err);
    accountBusy.value = false;
  }
}
</script>
