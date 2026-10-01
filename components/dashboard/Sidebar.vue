<template>
  <aside
    class="dashboard-sidebar relative flex h-full shrink-0 flex-col overflow-hidden text-[#30213f]"
    :class="{ 'dashboard-sidebar--collapsed': collapsed }"
    aria-label="Dashboard sidebar"
  >
    <div class="sidebar-brand relative flex shrink-0 items-center gap-2 px-5">
      <NuxtLink
        to="/"
        aria-label="TippyMe home"
        class="inline-flex items-center gap-2.5 rounded-sm transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cheer-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <img
          src="/tippyme-mark.png"
          alt=""
          aria-hidden="true"
          class="h-7 w-auto shrink-0 object-contain"
          width="19"
          height="28"
          decoding="async"
        >
        <span :class="collapsed ? 'sr-only' : 'text-lg font-bold leading-none tracking-tight'">
          TippyMe
        </span>
      </NuxtLink>
      <button
        v-if="collapsible"
        type="button"
        class="sidebar-toggle"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-expanded="!collapsed"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="emit('toggle')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="h-5 w-5">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M9 4v16" />
          <path :d="collapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'" />
        </svg>
      </button>
      <button v-if="drawer" type="button" class="sidebar-toggle" aria-label="Close navigation" @click="emit('close')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true" class="h-5 w-5"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>

    <nav class="relative flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pt-2" aria-label="Dashboard">
      <p :class="collapsed ? 'sr-only' : 'px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#80718f]'">
        Workspace
      </p>

      <NuxtLink
        v-for="link in primaryLinks"
        :key="link.to"
        :to="link.to"
        :aria-current="isActive(link.to) ? 'page' : undefined"
        :title="collapsed ? link.label : undefined"
        class="sidebar-link group flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.9375rem] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cheer-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        :class="
          isActive(link.to)
            ? 'bg-[#eee5fa] text-[#542b85]'
            : 'text-[#6b5b7b] hover:bg-[#f5effc] hover:text-[#603197]'
        "
        @click="emit('navigate')"
      >
        <span
          class="workspace-icon"
          :class="{ 'workspace-icon--active': isActive(link.to) }"
          aria-hidden="true"
        >
          <DashboardNavIcon :name="link.icon" />
        </span>
        <span :class="collapsed ? 'sr-only' : 'whitespace-nowrap'">{{ link.label }}</span>
      </NuxtLink>

      <NuxtLink
        v-if="publicPath"
        :to="publicPath"
        :title="collapsed ? 'Public page' : undefined"
        class="sidebar-link group flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.9375rem] font-bold text-[#6b5b7b] transition-all duration-200 hover:bg-[#f5effc] hover:text-[#603197] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cheer-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        @click="emit('navigate')"
      >
        <span
          class="workspace-icon"
          aria-hidden="true"
        >
          <DashboardNavIcon name="public" />
        </span>
        <span :class="collapsed ? 'sr-only' : 'whitespace-nowrap'">Public page</span>
      </NuxtLink>
    </nav>

    <div class="relative mt-auto shrink-0 border-t border-[#e7dfee] px-4 py-5">
      <div
        v-if="auth.user?.email"
        class="flex items-center gap-3"
        :class="{ 'justify-center': collapsed }"
        :title="collapsed ? auth.user.email : undefined"
      >
        <img
          :src="avatarSrc"
          alt=""
          aria-hidden="true"
          class="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[#eee5fa]"
          width="40"
          height="40"
          decoding="async"
        >
        <div :class="collapsed ? 'sr-only' : 'min-w-0'">
          <p class="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#80718f]">
            Signed in
          </p>
          <p
            class="truncate text-sm font-medium text-[#4e3b60]"
            :title="auth.user.email"
          >
            {{ auth.user.email }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="motion-cta mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[#e7dfee] bg-white py-2.5 text-sm font-semibold text-[#5d4276] transition hover:border-cheer-leaf/40 hover:bg-[#f5effc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cheer-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60"
        :title="collapsed ? 'Sign out' : undefined"
        :disabled="loggingOut"
        @click="onLogout"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="h-5 w-5 shrink-0"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M10 12h11m-4-4 4 4-4 4" /></svg>
        <span :class="{ 'sr-only': collapsed }">{{ loggingOut ? 'Signing out…' : 'Sign out' }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { dashboardNavLinks } from '~/data/navigation';
import { resolveAvatarUrl } from '~/utils/avatar';

const props = defineProps<{
  publicPath?: string | null;
  collapsed?: boolean;
  collapsible?: boolean;
  drawer?: boolean;
}>();

const emit = defineEmits<{
  navigate: [];
  toggle: [];
  close: [];
}>();

const route = useRoute();
const auth = useAuthStore();
const loggingOut = ref(false);
const avatarUrlState = useState<string | null>('dashboardAvatarUrl', () => null);

const workspaceIcons = {
  '/dashboard': 'overview',
  '/dashboard/tips': 'tips',
  '/dashboard/analytics': 'analytics',
  '/dashboard/profile': 'profile',
} as const;
const primaryLinks = dashboardNavLinks.map((link) => ({
  ...link,
  icon: workspaceIcons[link.to as keyof typeof workspaceIcons],
}));

const avatarSrc = computed(() => {
  const username = props.publicPath?.replace(/^\//, '').trim();
  const seed = username || auth.user?.email?.split('@')[0] || 'user';
  return resolveAvatarUrl(avatarUrlState.value, seed);
});

function isActive(path: string) {
  // Exact match for /dashboard so nested routes (e.g. /dashboard/profile)
  // do not keep Overview highlighted.
  if (path === '/dashboard') {
    return route.path === '/dashboard';
  }
  return route.path === path || route.path.startsWith(`${path}/`);
}

async function onLogout() {
  loggingOut.value = true;
  try {
    await auth.logout();
    await navigateTo('/');
  } finally {
    loggingOut.value = false;
  }
}
</script>

<style scoped>
.dashboard-sidebar { width: 17.5rem; max-width: 100vw; transition: width .22s ease; background: linear-gradient(180deg, #fff 70%, #faf7ff); }
.dashboard-sidebar--collapsed { width: 5.25rem; }
.sidebar-brand { min-height: 4.5rem; }
.sidebar-toggle {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  margin-left: auto;
  border: 1px solid #e7dfee;
  border-radius: .7rem;
  color: #705483;
  background: #ffffff;
  transition: color .2s ease, background .2s ease;
}
.sidebar-toggle:hover { color: #7540b4; background: #eee5fa; }
.sidebar-toggle:focus-visible { outline: 2px solid #7540b4; outline-offset: 3px; }
.dashboard-sidebar--collapsed .sidebar-brand { flex-direction: column; justify-content: center; min-height: 7rem; padding: .8rem 0; gap: .8rem; }
.dashboard-sidebar--collapsed .sidebar-toggle { margin-left: 0; }
.dashboard-sidebar--collapsed .sidebar-link { justify-content: center; gap: 0; padding: .6rem .5rem; }
.workspace-icon {
  --nav-icon-accent: #9573bd;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid #ece5f3;
  border-radius: .75rem;
  color: #7b5c96;
  background: #f7f3fc;
  box-shadow: inset 0 1px 0 #ffffff06;
  transition: color .2s ease, border-color .2s ease, background .2s ease, transform .2s ease;
}
.workspace-icon svg { width: 1.4rem; height: 1.4rem; }
.group:hover .workspace-icon, .group:focus-visible .workspace-icon {
  --nav-icon-accent: #7540b4;
  color: #65399a;
  border-color: #9573bd40;
  background: #eee5fa;
  transform: translateY(-1px);
}
.workspace-icon.workspace-icon--active,
.group:hover .workspace-icon--active,
.group:focus-visible .workspace-icon--active {
  --nav-icon-accent: #ceff83;
  color: #f0e8ff;
  border-color: #67409e;
  background: linear-gradient(145deg, #603699, #3b1d7a);
  box-shadow: 0 3px 8px #3b1d7a25, inset 0 1px 0 #ffffff20;
}
@media (prefers-reduced-motion: reduce) {
  .dashboard-sidebar, .sidebar-toggle, .sidebar-link { transition: none; }
  .workspace-icon { transition: none; }
  .group:hover .workspace-icon, .group:focus-visible .workspace-icon { transform: none; }
}
</style>
