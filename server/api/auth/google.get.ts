import { defineApiHandler } from '../../lib/define-api';
import {
  buildGoogleAuthorizeUrl,
  createOAuthState,
  requireGoogleOAuthConfig,
  sanitizeNextPath,
  sanitizeUsernameClaim,
} from '../../services/auth/google-oauth';

export default defineApiHandler(async (event) => {
  requireGoogleOAuthConfig();

  const query = getQuery(event);
  const stateToken = createOAuthState({
    next: sanitizeNextPath(query.next),
    username: sanitizeUsernameClaim(query.username),
  });

  return sendRedirect(event, buildGoogleAuthorizeUrl(stateToken), 302);
});
