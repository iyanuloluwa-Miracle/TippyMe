<template>
  <div class="studio-page profile-workspace">
    <div class="studio-breadcrumb"><NuxtLink to="/dashboard">Workspace</NuxtLink><span aria-hidden="true">/</span><strong>Edit profile</strong></div>
    <header class="studio-page-header"><div><p class="studio-kicker">MAKE THIS SPACE YOURS</p><h1>Your page. Your personality.</h1><p class="studio-intro">Shape how supporters meet you, show their support, and stay connected.</p></div><NuxtLink v-if="profile?.publicPath" :to="profile.publicPath" class="studio-button studio-button--primary">Preview public page ↗</NuxtLink></header>

    <p
      v-if="loadError"
      class="mb-4 rounded-2xl border border-[#f3d0d7] bg-[#fff1f3] px-4 py-3 text-sm text-[#ac3047]"
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
      class="settings-layout"
    >
      <aside class="settings-sidebar">
        <nav class="settings-nav" aria-label="Profile settings">
          <NuxtLink v-for="section in settingsSections" :key="section.id" :to="{ path: '/dashboard/profile', hash: '#' + section.id }" :aria-current="activeSection === section.id ? 'page' : undefined" :class="{ selected: activeSection === section.id }"><span class="settings-nav-icon" aria-hidden="true">{{ section.icon }}</span><span><strong>{{ section.label }}</strong><small>{{ section.description }}</small></span><span aria-hidden="true">›</span></NuxtLink>
        </nav>
        <div class="settings-preview"><span class="studio-kicker">PROFILE PREVIEW</span><div class="settings-monogram" aria-hidden="true">{{ Array.from(displayName || 'Y')[0]?.toUpperCase() }}</div><strong>{{ displayName || 'Your creator name' }}</strong><span>@{{ username || 'yourname' }}</span><p>{{ bio || 'A few words about what you create.' }}</p><small>Save each section when you’re ready.</small></div>
      </aside>
      <div class="profile-editor">
      <!-- Identity -->
      <section
        v-show="activeSection === 'profile'"
        id="profile"
        class="studio-card settings-form"
        aria-labelledby="identity-heading"
      >
        <h2
          id="identity-heading"
          class="text-xl font-extrabold tracking-tight text-[#261b38]"
        >
          Identity
        </h2>
        <p class="mt-1 text-sm text-[#53445f]">
          Name, bio, username, and photo on your public page.
        </p>

        <div class="mt-5 space-y-4">
          <div>
            <p class="block text-sm text-[#261b38]">
              Profile photo
            </p>
            <div class="mt-2">
              <CreatorAvatarUploader
                v-model="avatarUrl"
                :seed="username || displayName || 'creator'"
                :alt="displayName || 'Profile photo'"
                size="lg"
                persist
                variant="light"
                hint="Click to change your photo"
                :disabled="identityPending"
                @uploaded="onAvatarUploaded"
              />
            </div>
          </div>

          <div>
            <label
              for="edit-display"
              class="block text-sm text-[#261b38]"
            >Display name</label>
            <input
              id="edit-display"
              v-model="displayName"
              type="text"
              maxlength="80"
              required
              class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base outline-none focus:border-cheer-leaf/40 focus:ring-2 focus:ring-cheer-leaf/30"
              placeholder="How supporters see you"
              :disabled="identityPending"
            >
          </div>

          <div>
            <div class="flex items-center justify-between gap-2">
              <label
                for="edit-bio"
                class="block text-sm text-[#261b38]"
              >Bio</label>
              <button
                type="button"
                class="text-xs font-bold text-[#6d3db0] hover:underline disabled:opacity-50"
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
              class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base outline-none focus:border-cheer-leaf/40 focus:ring-2 focus:ring-cheer-leaf/30"
              placeholder="A short line about your work"
              :disabled="identityPending"
            />
            <p
              v-if="aiHint"
              class="mt-1 text-xs text-[#53445f]"
            >
              {{ aiHint }}
            </p>
          </div>

          <div>
            <label
              for="edit-username"
              class="block text-sm text-[#261b38]"
            >Username</label>
            <div class="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 focus-within:border-cheer-leaf/40 focus-within:ring-2 focus-within:ring-cheer-leaf/30">
              <span class="shrink-0 text-sm text-[#53445f]">/</span>
              <input
                id="edit-username"
                v-model="username"
                type="text"
                autocomplete="username"
                maxlength="30"
                class="w-full bg-transparent py-2.5 text-base text-[#261b38] outline-none"
                placeholder="yourname"
                :disabled="identityPending"
                @input="onUsernameInput"
              >
            </div>
            <p
              v-if="usernameStatus"
              class="mt-2 text-sm"
              :class="usernameOk ? 'text-[#6d3db0]' : 'text-[#ac3047]'"
              role="status"
            >
              {{ usernameStatus }}
            </p>
            <p class="mt-1 text-xs text-[#53445f]">
              Lowercase letters, numbers, underscores. 3–30 characters.
            </p>
          </div>
        </div>

        <p
          v-if="identityError"
          class="mt-3 text-sm text-[#ac3047]"
          role="alert"
        >
          {{ identityError }}
        </p>
        <p
          v-if="identitySuccess"
          class="mt-3 text-sm text-[#6d3db0]"
          role="status"
        >
          {{ identitySuccess }}
        </p>

        <button
          type="button"
          class="mt-5 inline-flex items-center justify-center rounded-full bg-cheer-leaf px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          :disabled="identityPending || !canSaveIdentity"
          @click="saveIdentity"
        >
          {{ identityPending ? 'Saving…' : 'Save identity' }}
        </button>
      </section>

      <!-- Social -->
      <section
        v-show="activeSection === 'links'"
        id="links"
        class="studio-card settings-form"
        aria-labelledby="social-heading"
      >
        <h2
          id="social-heading"
          class="text-xl font-extrabold tracking-tight text-[#261b38]"
        >
          Social links
        </h2>
        <p class="mt-1 text-sm text-[#53445f]">
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
              :aria-label="`Social platform ${index + 1}`"
              class="rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3 py-2.5 text-sm"
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
              :aria-label="`Social URL ${index + 1}`"
              type="url"
              placeholder="https://"
              class="min-w-0 flex-1 rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-cheer-leaf/30"
              :disabled="socialPending"
            >
            <button
              type="button"
              class="text-sm text-[#ac3047]"
              :disabled="socialPending"
              @click="removeSocial(index)"
            >
              Remove
            </button>
          </div>
        </div>

        <button
          type="button"
          class="mt-3 text-sm font-bold text-[#6d3db0] disabled:opacity-50"
          :disabled="socialPending || socialLinks.length >= 5"
          @click="addSocial"
        >
          + Add link
        </button>

        <p
          v-if="socialError"
          class="mt-3 text-sm text-[#ac3047]"
          role="alert"
        >
          {{ socialError }}
        </p>
        <p
          v-if="socialSuccess"
          class="mt-3 text-sm text-[#6d3db0]"
          role="status"
        >
          {{ socialSuccess }}
        </p>

        <button
          type="button"
          class="mt-5 inline-flex items-center justify-center rounded-full bg-cheer-leaf px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          :disabled="socialPending"
          @click="saveSocial"
        >
          {{ socialPending ? 'Saving…' : 'Save social links' }}
        </button>
      </section>

      <!-- Support -->
      <section
        v-show="activeSection === 'support'"
        id="support"
        class="studio-card settings-form"
        aria-labelledby="support-heading"
      >
        <h2
          id="support-heading"
          class="text-xl font-extrabold tracking-tight text-[#261b38]"
        >
          Support settings
        </h2>
        <p class="mt-1 text-sm text-[#53445f]">
          Currency, message, and suggested tip amounts on your page.
        </p>

        <div
          v-if="needsCurrencyMigration"
          class="mt-4 rounded-2xl border border-[#f3d0d7] bg-[#fff1f3] px-4 py-3 text-sm text-[#ac3047]"
          role="alert"
        >
          Your preferred currency (ZAR) is no longer supported by Bachs. Choose a collection currency such as USD or NGN and save before supporters can tip you or you connect payouts.
        </div>

        <div class="mt-5 space-y-4">
          <div>
            <label
              for="edit-currency"
              class="block text-sm text-[#261b38]"
            >Preferred currency</label>
            <select
              id="edit-currency"
              v-model="currency"
              class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base"
              :disabled="settingsPending || payoutCountryLocked"
            >
              <option
                v-if="needsCurrencyMigration"
                value="ZAR"
              >
                ZAR (unsupported — choose another)
              </option>
              <option
                v-for="c in currencies"
                :key="c"
                :value="c"
              >
                {{ c }}
              </option>
            </select>
            <p class="mt-1 text-xs text-[#53445f]">
              {{ payoutCountryLocked
                ? 'Preferred currency is locked because Bachs Connect is already linked.'
                : 'Tips are priced in this currency. Bachs offers card for USD/NGN, bank transfer for NGN, and mobile money for most other local currencies. Pricing currency is separate from where you withdraw in Bachs.' }}
            </p>
          </div>

          <div>
            <label for="edit-payout-country" class="block text-sm text-[#261b38]">Payout country</label>
            <select
              id="edit-payout-country"
              v-model="payoutCountry"
              class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base"
              :disabled="settingsPending || payoutCountryLocked"
            >
              <option value="">Choose your country</option>
              <option
                v-for="country in payoutCountryOptions"
                :key="country.code"
                :value="country.code"
              >
                {{ country.label }}
              </option>
              <option
                v-if="showLegacyZaPayoutCountry"
                value="ZA"
              >
                South Africa (legacy — choose another)
              </option>
            </select>
            <p class="mt-1 text-xs text-[#53445f]">
              {{ payoutCountryLocked
                ? 'Payout country is locked because Bachs Connect is already linked.'
                : 'Choose where your Bachs payout account is based. This can be changed only before connecting payouts. Withdrawals are handled in Bachs, not TippyMe.' }}
            </p>
            <p
              v-if="needsLegacyPayoutMigration"
              class="mt-1 text-xs text-[#ac3047]"
            >
              South Africa is no longer available for new payout setup. Pick a supported payout country when you change currency.
            </p>
          </div>

          <div>
            <label
              for="edit-support"
              class="block text-sm text-[#261b38]"
            >Support message</label>
            <textarea
              id="edit-support"
              v-model="supportMessage"
              rows="3"
              maxlength="500"
              class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base outline-none focus:ring-2 focus:ring-cheer-leaf/30"
              placeholder="Thanks for supporting my work…"
              :disabled="settingsPending"
            />
          </div>

          <div>
            <label for="edit-thank-you" class="block text-sm text-[#261b38]">Automatic thank-you email</label>
            <textarea id="edit-thank-you" v-model="thankYouMessage" rows="3" maxlength="500" class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base outline-none focus:ring-2 focus:ring-cheer-leaf/30" placeholder="Thank you for helping me keep making…" :disabled="settingsPending" />
            <p class="mt-1 text-xs text-[#53445f]">Sent in the supporter’s receipt only after Bachs verifies payment.</p>
          </div>

          <div>
            <label class="block text-sm text-[#261b38]">Suggested tip amounts</label>
            <div class="mt-2 flex flex-wrap gap-2">
              <input
                v-for="(_, i) in tipAmounts"
                :key="i"
                v-model="tipAmounts[i]"
                :aria-label="`Suggested tip amount ${i + 1}`"
                type="text"
                inputmode="decimal"
                class="w-28 rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3 py-2 text-sm"
                :disabled="settingsPending"
              >
            </div>
            <p class="mt-1 text-xs text-[#53445f]">
              Decimal amounts (e.g. 1000.00). Up to 5 amounts.
            </p>
          </div>

          <div class="rounded-2xl border border-[#e7dfee] bg-[#b58bea0d] p-4">
            <label class="flex items-center gap-2 text-sm font-bold text-[#261b38]">
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
                  class="block text-sm text-[#261b38]"
                >Goal title</label>
                <input
                  id="edit-goal-title"
                  v-model="goalTitle"
                  type="text"
                  maxlength="80"
                  class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base"
                  placeholder="e.g. Laptop fund"
                  :disabled="settingsPending"
                >
              </div>
              <div>
                <label
                  for="edit-goal-amount"
                  class="block text-sm text-[#261b38]"
                >Target amount</label>
                <input
                  id="edit-goal-amount"
                  v-model="goalTargetAmount"
                  type="text"
                  inputmode="decimal"
                  class="mt-1.5 w-full rounded-xl border border-[#e7dfee] bg-[#ffffff] px-3.5 py-2.5 text-base"
                  placeholder="50000.00"
                  :disabled="settingsPending"
                >
              </div>
            </div>
          </div>
        </div>

        <p
          v-if="settingsError"
          class="mt-3 text-sm text-[#ac3047]"
          role="alert"
        >
          {{ settingsError }}
        </p>
        <p
          v-if="settingsSuccess"
          class="mt-3 text-sm text-[#6d3db0]"
          role="status"
        >
          {{ settingsSuccess }}
        </p>

        <button
          type="button"
          class="mt-5 inline-flex items-center justify-center rounded-full bg-cheer-leaf px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          :disabled="settingsPending"
          @click="saveSettings"
        >
          {{ settingsPending ? 'Saving…' : 'Save support settings' }}
        </button>
      </section>

      <section v-show="activeSection === 'account'" id="account" class="studio-card settings-danger">
        <h2 class="text-xl font-extrabold tracking-tight text-[#261b38]">
          Page and account
        </h2>
        <p class="mt-2 text-sm font-bold leading-relaxed text-[#53445f]">
          Pausing hides your public link. Closing signs you out and keeps payment records. It does not delete Bachs history.
        </p>
        <div class="mt-4 flex flex-wrap gap-2.5">
          <button
            type="button"
            class="rounded-full border border-[#e7dfee] bg-[#f7f4fb] px-4 py-2.5 text-sm font-bold text-[#261b38] hover:border-cheer-leaf/40 disabled:opacity-60"
            :disabled="accountBusy || !profile"
            @click="togglePage"
          >
            {{ profile?.isActive ? 'Pause public page' : 'Resume public page' }}
          </button>
          <button
            type="button"
            class="rounded-full border border-[#e7dfee] bg-[#f7f4fb] px-4 py-2.5 text-sm font-bold text-[#261b38] hover:border-cheer-leaf/40 disabled:opacity-60"
            :disabled="accountBusy"
            @click="downloadTips"
          >
            Download tips CSV
          </button>
          <button
            type="button"
            class="rounded-full border border-[#f3d0d7] bg-[#fff1f3] px-4 py-2.5 text-sm font-bold text-[#ac3047] hover:bg-[#ffe5eb] disabled:opacity-60"
            :disabled="accountBusy"
            @click="closeAccount"
          >
            Close account
          </button>
        </div>
        <p v-if="accountError" class="mt-3 text-sm text-[#ac3047]" role="alert">
          {{ accountError }}
        </p>
        <p v-if="accountNotice" class="mt-3 text-sm font-bold text-[#6d3db0]">
          {{ accountNotice }}
        </p>
      </section>

      <DashboardShareStudio
        v-if="profile?.publicPath"
        v-show="activeSection === 'sharing'"
        id="sharing"
        theme="light"
        :public-path="profile.publicPath"
        :display-name="profile.displayName"
      />

      <p class="pb-4 text-center text-sm text-[#53445f]">
        <NuxtLink
          v-if="profile.publicPath"
          :to="profile.publicPath"
          class="font-bold text-[#6d3db0] hover:underline"
        >
          View public page
        </NuxtLink>
        <span class="mx-2 text-[#53445f]">·</span>
        <NuxtLink
          to="/dashboard"
          class="font-bold text-[#53445f] hover:underline"
        >
          Back to overview
        </NuxtLink>
      </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreatorProfile, SocialPlatform } from '~/types/api';
import { ApiClientError } from '~/services/api';
import {
  ALLOWED_CURRENCIES,
  PAYOUT_COUNTRY_OPTIONS,
  SUGGESTED_PAYOUT_COUNTRY,
  isAllowedCurrency,
  isLegacyUnsupportedCurrency,
} from '~/utils/bachs-currencies';

definePageMeta({
  layout: 'dashboard',
  middleware: 'auth',
});

useHead({
  title: 'Edit profile — TippyMe',
});

const auth = useAuthStore();
const api = useApi();
const settingsRoute = useRoute();
const settingsSections = [
  { id: 'profile', label: 'Profile', description: 'Name, photo & bio', icon: '◈' },
  { id: 'links', label: 'Social links', description: 'Connect your worlds', icon: '↗' },
  { id: 'support', label: 'Support settings', description: 'Amounts, messages & goals', icon: '♡' },
  { id: 'sharing', label: 'Sharing tools', description: 'Embeds & GitHub badges', icon: '✦' },
  { id: 'account', label: 'Page & account', description: 'Visibility & account access', icon: '◎' },
];
const activeSection = computed(() => {
  const key = settingsRoute.hash.slice(1);
  return settingsSections.some((section) => section.id === key) ? key : 'profile';
});
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
const currencies = [...ALLOWED_CURRENCIES];
const payoutCountryOptions = PAYOUT_COUNTRY_OPTIONS;
const syncingProfile = ref(false);
const needsCurrencyMigration = computed(() =>
  isLegacyUnsupportedCurrency(currency.value),
);
const showLegacyZaPayoutCountry = computed(
  () => payoutCountry.value === 'ZA' || profile.value?.payoutCountry === 'ZA',
);
const payoutCountryLocked = computed(
  () => Boolean(profile.value?.payoutCountryLocked),
);
const needsLegacyPayoutMigration = computed(
  () =>
    !payoutCountryLocked.value &&
    (payoutCountry.value === 'ZA' || needsCurrencyMigration.value),
);

const canSaveIdentity = computed(() => {
  return Boolean(displayName.value.trim()) && usernameOk.value && username.value.length >= 3;
});

watch(currency, (next, prev) => {
  if (syncingProfile.value || payoutCountryLocked.value) return;
  if (!isAllowedCurrency(next)) return;
  // Clear legacy ZA when leaving ZAR so the creator must pick a supported country.
  if (prev && isLegacyUnsupportedCurrency(prev) && payoutCountry.value === 'ZA') {
    payoutCountry.value = SUGGESTED_PAYOUT_COUNTRY[next] ?? '';
    return;
  }
  if (payoutCountry.value) return;
  const suggested = SUGGESTED_PAYOUT_COUNTRY[next];
  if (suggested) payoutCountry.value = suggested;
});

onMounted(async () => {
  await loadProfile();
});

onUnmounted(() => {
  if (usernameTimer) clearTimeout(usernameTimer);
});

function applyProfile(p: CreatorProfile) {
  syncingProfile.value = true;
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
  const nextCurrency = p.currency || 'NGN';
  const storedPayout = p.payoutCountry ?? '';
  const suggested =
    !storedPayout && isAllowedCurrency(nextCurrency)
      ? SUGGESTED_PAYOUT_COUNTRY[nextCurrency] ?? ''
      : '';
  currency.value = nextCurrency;
  payoutCountry.value = storedPayout || suggested;
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
  nextTick(() => {
    syncingProfile.value = false;
  });
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
    if (isLegacyUnsupportedCurrency(currency.value)) {
      settingsError.value =
        'Choose a supported preferred currency (for example USD or NGN) before saving.';
      $toast.error(settingsError.value);
      return;
    }
    if (!payoutCountryLocked.value && payoutCountry.value === 'ZA') {
      settingsError.value =
        'Choose a supported payout country before saving. South Africa is no longer available for new Bachs payout setup.';
      $toast.error(settingsError.value);
      return;
    }
    if (
      !payoutCountryLocked.value &&
      isLegacyUnsupportedCurrency(profile.value?.currency ?? '') &&
      !isLegacyUnsupportedCurrency(currency.value) &&
      !payoutCountry.value
    ) {
      settingsError.value =
        'Choose a payout country when switching away from ZAR.';
      $toast.error(settingsError.value);
      return;
    }
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
      payoutCountry: payoutCountry.value
        ? payoutCountry.value
        : payoutCountryLocked.value
          ? undefined
          : null,
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

<style scoped>
.settings-layout { display: grid; grid-template-columns: 216px minmax(0, 1fr); gap: 24px; align-items: start; }.settings-sidebar { position: sticky; top: 24px; }.settings-nav { display: grid; gap: 8px; }.settings-nav a { display: flex; align-items: center; gap: 12px; border: 1px solid transparent; border-radius: 12px; padding: 12px; color: var(--dashboard-text-secondary, #53445f); }.settings-nav a.selected { border-color: #bc92e83d; background: #b491db17; color: #542b85; }.settings-nav a:hover { background: #b491db0c; }.settings-nav-icon { width: 22px; font-size: 22px; color: #6d3db0; }.settings-nav a > span:nth-child(2) { flex: 1; }.settings-nav strong { display: block; font-size: 14px; font-weight: 800; line-height: 1.4; }.settings-nav small { display: block; font-size: 12px; font-weight: 700; line-height: 1.5; color: var(--dashboard-text-secondary, #53445f); margin-top: 3px; }.settings-preview { padding: 24px 16px; margin-top: 24px; border-top: 1px solid #e7dfee; text-align: center; }.settings-monogram { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 20px; margin: 16px auto; background: #b697df20; border: 1px solid #d8b4fe29; color: #6d3db0; font-size: 28px; }.settings-preview > strong { display: block; font-size: 19px; overflow-wrap: anywhere; }.settings-preview > span:not(:first-child) { font-size: 12px; color: var(--dashboard-text-secondary, #53445f); overflow-wrap: anywhere; }.settings-preview p { font-size: 12px; color: var(--dashboard-text-secondary, #53445f); line-height: 1.5; overflow-wrap: anywhere; }.settings-preview small { font-size: 12px; color: var(--dashboard-text-secondary, #53445f); }.profile-editor { min-width: 0; }.profile-editor > section { scroll-margin-top: 24px; }.profile-editor > p:last-child { margin-top: 24px; }.settings-form { max-width: 880px; }.settings-form > button.bg-cheer-leaf { border-radius: 12px; background: #7540b4; color: #fff; }
.settings-form > button.bg-cheer-leaf:hover { background: #603197; }.settings-form :is(input, textarea, select) { color: #261b38; }.settings-form input[type='checkbox'] { accent-color: #7c4ac0; }.settings-danger { border-color: #f3d0d7; }
@media (max-width: 1100px) { .settings-layout { grid-template-columns: 180px minmax(0, 1fr); gap: 16px; }.settings-nav a { gap: 8px; padding: 10px; }.settings-nav small { font-size: 12px; } }
@media (max-width: 800px) { .settings-layout { grid-template-columns: minmax(0, 1fr); }.settings-sidebar { position: static; }.settings-preview { display: none; }.settings-nav { display: flex; overflow-x: auto; padding-bottom: 8px; }.settings-nav a { flex-shrink: 0; }.settings-nav small, .settings-nav a > span:last-child { display: none; }.settings-nav strong { font-size: 12px; }.settings-nav-icon { font-size: 18px; width: 18px; } }
</style>
