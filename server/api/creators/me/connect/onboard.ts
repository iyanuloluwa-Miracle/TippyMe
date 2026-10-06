import { getMethod, sendRedirect } from 'h3';
import { requireUser } from '../../../../lib/auth';
import { defineApiHandler } from '../../../../lib/define-api';
import { ApiError } from '../../../../lib/errors';
import { ConnectService } from '../../../../services/creators/connect.service';

/**
 * Bachs Connect onboarding.
 * Single handler for GET+POST so method-specific files cannot drift in deploy.
 */
export default defineApiHandler(async (event) => {
  const method = getMethod(event);

  // Accidental browser navigations used to hit a bare API 404 page.
  if (method === 'GET' || method === 'HEAD') {
    return sendRedirect(event, '/dashboard?connect=1', 302);
  }

  if (method !== 'POST') {
    throw new ApiError(
      405,
      'METHOD_NOT_ALLOWED',
      'Use POST to start Bachs Connect onboarding.',
    );
  }

  const user = await requireUser(event);
  return new ConnectService().startOnboarding(user.sub);
});
