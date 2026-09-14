import { defineApiHandler } from '../../../lib/define-api';
import { setAuthCookie } from '../../../lib/auth';
import { ApiError } from '../../../lib/errors';
import { getServerEnv } from '../../../lib/env';
import { AuthService } from '../../../services/auth.service';
import { parseAndValidateOAuthState } from '../../../services/auth/google-oauth';

function redirectWithError(appUrl: string, code: string): string {
  const url = new URL('/login', appUrl);
  url.searchParams.set('error', code);
  return url.toString();
}

function errorCodeFor(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.error) {
      case 'INVALID_OAUTH_STATE':
        return 'google_state';
      case 'GOOGLE_TOKEN_EXCHANGE_FAILED':
        return 'google_token';
      case 'GOOGLE_USERINFO_FAILED':
        return 'google_profile';
      case 'GOOGLE_EMAIL_REQUIRED':
      case 'GOOGLE_EMAIL_UNVERIFIED':
        return 'google_email';
      case 'GOOGLE_AUTH_UNAVAILABLE':
        return 'google_config';
      case 'GOOGLE_ACCOUNT_CONFLICT':
        return 'google_conflict';
      default:
        return 'google_failed';
    }
  }
  return 'google_failed';
}

export default defineApiHandler(async (event) => {
  const appUrl = getServerEnv().APP_URL.replace(/\/$/, '');
  const query = getQuery(event);

  try {
    if (typeof query.error === 'string' && query.error) {
      return sendRedirect(
        event,
        redirectWithError(appUrl, 'google_denied'),
        302,
      );
    }

    const code = typeof query.code === 'string' ? query.code : '';
    if (!code) {
      return sendRedirect(
        event,
        redirectWithError(appUrl, 'google_failed'),
        302,
      );
    }

    const state =
      typeof query.state === 'string' ? query.state : undefined;
    const payload = parseAndValidateOAuthState(state);

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
    const code = errorCodeFor(err);
    console.warn(
      `Google OAuth callback failed code=${code}: ${err instanceof Error ? err.message : 'unknown'}`,
    );
    return sendRedirect(event, redirectWithError(appUrl, code), 302);
  }
});
