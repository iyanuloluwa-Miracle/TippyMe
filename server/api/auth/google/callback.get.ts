import { defineApiHandler } from '../../../lib/define-api';
import { setAuthCookie } from '../../../lib/auth';
import { getServerEnv } from '../../../lib/env';
import { AuthService } from '../../../services/auth.service';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  parseAndValidateOAuthState,
} from '../../../services/auth/google-oauth';

function redirectWithError(appUrl: string, code: string): string {
  const url = new URL('/login', appUrl);
  url.searchParams.set('error', code);
  return url.toString();
}

export default defineApiHandler(async (event) => {
  const appUrl = getServerEnv().APP_URL.replace(/\/$/, '');
  const query = getQuery(event);
  const isProd = getServerEnv().NODE_ENV === 'production';

  const clearStateCookie = () => {
    deleteCookie(event, GOOGLE_OAUTH_STATE_COOKIE, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  };

  try {
    if (typeof query.error === 'string' && query.error) {
      clearStateCookie();
      return sendRedirect(
        event,
        redirectWithError(appUrl, 'google_denied'),
        302,
      );
    }

    const code = typeof query.code === 'string' ? query.code : '';
    if (!code) {
      clearStateCookie();
      return sendRedirect(
        event,
        redirectWithError(appUrl, 'google_failed'),
        302,
      );
    }

    const state =
      typeof query.state === 'string' ? query.state : undefined;
    const cookieValue = getCookie(event, GOOGLE_OAUTH_STATE_COOKIE);
    const payload = parseAndValidateOAuthState(state, cookieValue);
    clearStateCookie();

    const auth = new AuthService();
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
    const { response, accessToken } = await auth.loginWithGoogle(code, {
      ipAddress: ip,
      userAgent: getHeader(event, 'user-agent') ?? undefined,
    });

    setAuthCookie(event, accessToken);

    if (payload.next) {
      return sendRedirect(event, `${appUrl}${payload.next}`, 302);
    }
    if (response.user.hasCreatorProfile) {
      return sendRedirect(event, `${appUrl}/dashboard`, 302);
    }
    if (payload.username) {
      const onboarding = new URL('/onboarding', appUrl);
      onboarding.searchParams.set('username', payload.username);
      return sendRedirect(event, onboarding.toString(), 302);
    }
    return sendRedirect(event, `${appUrl}/onboarding`, 302);
  } catch (err) {
    clearStateCookie();
    console.warn(
      `Google OAuth callback failed: ${err instanceof Error ? err.message : 'unknown'}`,
    );
    return sendRedirect(
      event,
      redirectWithError(appUrl, 'google_failed'),
      302,
    );
  }
});
