import type { CreatorProfile } from '~/types/api';

type NavProfileFields = Pick<CreatorProfile, 'publicPath' | 'avatarUrl'>;

/**
 * Shared dashboard sidebar state (public tip page path + avatar).
 * Owned by the dashboard layout so every dashboard route keeps the Public page link.
 */
export function useDashboardNav() {
  const publicPath = useState<string | null>('dashboardPublicPath', () => null);
  const avatarUrl = useState<string | null>('dashboardAvatarUrl', () => null);
  const loading = useState('dashboardNavLoading', () => false);

  function setFromProfile(profile: NavProfileFields) {
    publicPath.value = profile.publicPath;
    avatarUrl.value = profile.avatarUrl;
  }

  function clear() {
    publicPath.value = null;
    avatarUrl.value = null;
  }

  async function ensureLoaded() {
    if (!import.meta.client) return;
    if (publicPath.value) return;
    if (loading.value) return;

    loading.value = true;
    try {
      const api = useApi();
      const { profile } = await api.getMyCreator();
      if (profile) {
        setFromProfile(profile);
      }
    } catch {
      // Pages handle auth / onboarding redirects; leave nav unset on failure.
    } finally {
      loading.value = false;
    }
  }

  return {
    publicPath,
    avatarUrl,
    ensureLoaded,
    setFromProfile,
    clear,
  };
}
