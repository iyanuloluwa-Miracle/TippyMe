import { AuthService } from '../../services/auth.service';
import { ApiError } from '../../lib/errors';
import { defineApiHandler } from '../../lib/define-api';
import { assertRateLimit } from '../../lib/rate-limit';
import { AUTH_THROTTLE_TTL_MS, AUTH_VERIFY_OTP_LIMIT } from '../../services/auth/otp.constants';

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  await assertRateLimit(`auth:reset-password:${ip}`, AUTH_VERIFY_OTP_LIMIT, AUTH_THROTTLE_TTL_MS);
  const body = await readBody<{ email?: string; code?: string; password?: string }>(event);
  if (typeof body?.email !== 'string' || typeof body.code !== 'string' || typeof body.password !== 'string') {
    throw new ApiError(400, 'INVALID_RESET', 'Email, code, and new password are required.');
  }
  return new AuthService().resetPassword(body.email, body.code, body.password);
});
