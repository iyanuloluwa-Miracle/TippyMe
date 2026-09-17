import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../lib/errors';
import { defineApiHandler } from '../../lib/define-api';
import { assertRateLimit } from '../../lib/rate-limit';
import { AUTH_REQUEST_OTP_LIMIT, AUTH_THROTTLE_TTL_MS } from '../../services/auth/otp.constants';

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  await assertRateLimit(`auth:password-reset:${ip}`, AUTH_REQUEST_OTP_LIMIT, AUTH_THROTTLE_TTL_MS);
  const body = await readBody<{ email?: string }>(event);
  if (typeof body?.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    throw new ApiError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  }
  return new AuthService().requestPasswordReset(body.email);
});
