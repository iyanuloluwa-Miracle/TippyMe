import { defineApiHandler } from '../../../lib/define-api';
import { setAuthCookie } from '../../../lib/auth';
import { ApiError } from '../../../lib/errors';
import { AuthService } from '../../../services/auth.service';
import {
  parseAndValidateOAuthState,
  sanitizeNextPath,
} from '../../../services/auth/google-oauth';

function redirectWithError(code: string): string {
  return `/login?error=${encodeURIComponent(code)}`;
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

/** Build same-host relative /auth/complete URL with a safe next destination. */
function completeRedirect(opts: {
  next?: string;
  hasCreatorProfile: boolean;
  username?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.next) {
    params.set('next', opts.next);
  } else if (opts.hasCreatorProfile) {
    params.set('next', '/dashboard');
  } else if (opts.username) {
    params.set('next', `/onboarding?username=${opts.username}`);
  } else {
    params.set('next', '/onboarding');
  }
  return `/auth/complete?${params.toString()}`;
}

export default defineApiHandler(async (event) => {
  const query = getQuery(event);

  try {
    if (typeof query.error === 'string' && query.error) {
      return sendRedirect(event, redirectWithError('google_denied'), 302);
    }

    const code = typeof query.code === 'string' ? query.code : '';
    if (!code) {
      return sendRedirect(event, redirectWithError('google_failed'), 302);
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

    return sendRedirect(
      event,
      completeRedirect({
        next: sanitizeNextPath(payload.next),
        hasCreatorProfile: response.user.hasCreatorProfile,
        username: payload.username,
      }),
      302,
    );
  } catch (err) {
    const code = errorCodeFor(err);
    console.warn(
      `Google OAuth callback failed code=${code}: ${err instanceof Error ? err.message : 'unknown'}`,
    );
    return sendRedirect(event, redirectWithError(code), 302);
  }
});
