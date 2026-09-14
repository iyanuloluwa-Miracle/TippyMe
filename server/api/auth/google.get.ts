import { defineApiHandler } from '../../lib/define-api';
import { getServerEnv } from '../../lib/env';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_STATE_MAX_AGE_SEC,
  buildGoogleAuthorizeUrl,
  createOAuthState,
  requireGoogleOAuthConfig,
  sanitizeNextPath,
  sanitizeUsernameClaim,
} from '../../services/auth/google-oauth';

export default defineApiHandler(async (event) => {
  requireGoogleOAuthConfig();

  const query = getQuery(event);
  const { stateToken, cookieValue } = createOAuthState({
    next: sanitizeNextPath(query.next),
    username: sanitizeUsernameClaim(query.username),
  });

  const isProd = getServerEnv().NODE_ENV === 'production';
  setCookie(event, GOOGLE_OAUTH_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE_SEC,
  });

  return sendRedirect(event, buildGoogleAuthorizeUrl(stateToken), 302);
});
