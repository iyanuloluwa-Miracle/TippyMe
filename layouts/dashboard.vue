<template>
  <div class="dashboard-overview-shell relative flex min-h-dvh">
    <div class="relative z-10 hidden md:sticky md:top-0 md:flex md:h-dvh md:shrink-0">
      <DashboardSidebar
        :public-path="publicPath"
        :collapsed="sidebarCollapsed"
        collapsible
        @toggle="sidebarCollapsed = !sidebarCollapsed"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-50 md:hidden"
        @keydown.esc="closeMobileNav"
      >
        <button
          type="button"
          class="absolute inset-0 bg-cheer-ink/40 backdrop-blur-[3px]"
          aria-label="Close navigation"
          @click="closeMobileNav"
        />
        <div class="absolute inset-y-0 left-0 shadow-2xl shadow-black/40">
          <DashboardSidebar
            :public-path="publicPath"
            drawer
            @close="closeMobileNav"
            @navigate="mobileOpen = false"
          />
        </div>
      </div>
    </Teleport>

    <div class="relative z-0 flex min-w-0 flex-1 flex-col">
      <header
        class="dashboard-mobile-header sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-cheer-leaf/10 px-4 md:hidden"
      >
        <button
          ref="mobileToggle"
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full text-cheer-ink transition hover:bg-cheer-mint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cheer-leaf"
          aria-label="Open navigation"
          :aria-expanded="mobileOpen"
          @click="mobileOpen = true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div class="inline-flex items-center gap-2">
          <img
            src="/cheers-logo-nav.png"
            alt=""
            aria-hidden="true"
            class="h-5 w-auto shrink-0 object-contain"
            width="14"
            height="20"
            decoding="async"
          >
          <span class="text-sm font-bold leading-none tracking-tight text-cheer-ink">
            TippyMe
          </span>
        </div>
      </header>

      <main class="relative min-h-0 w-full flex-1 overflow-y-auto pb-24">
        <slot />
      </main>
    </div>
    <LandingAskTippyMe v-if="auth.user" v-show="!mobileOpen" :key="auth.user.id" dashboard />
  </div>
</template>

<script setup lang="ts">
import '~/assets/css/dashboard.css';
const { publicPath, ensureLoaded } = useDashboardNav();
const mobileOpen = ref(false);
const mobileToggle = ref<HTMLButtonElement | null>(null);
const sidebarCollapsed = useCookie<boolean>('tippyme-sidebar-collapsed', {
  default: () => false,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 365,
});
function closeMobileNav() {
  mobileOpen.value = false;
  mobileToggle.value?.focus();
}
const auth = useAuthStore();
const route = useRoute();

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);

onMounted(() => {
  void ensureLoaded();
});
</script>

<style scoped>
.dashboard-overview-shell {
  background-color: #f8f7fb;
  background-image: radial-gradient(ellipse 70% 35% at 20% 0%, #e5d7f530, transparent 80%), radial-gradient(ellipse 55% 40% at 100% 80%, #eae0fa25, transparent 80%), linear-gradient(#7440a803 1px, transparent 1px), linear-gradient(90deg, #7440a803 1px, transparent 1px);
  background-size: auto, auto, 32px 32px, 32px 32px;
}
.dashboard-overview-shell > div:first-child { border-right: 1px solid #e7dfee; }
.dashboard-mobile-header { background: #ffffff; border-color: #e7dfee; }
.dashboard-mobile-header button, .dashboard-mobile-header span { color: #30213f; }
.dashboard-mobile-header img { filter: none; }
</style>
