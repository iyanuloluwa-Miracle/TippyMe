import { TipsService } from '../../../services/tips/tips.service';
import { defineApiHandler } from '../../../lib/define-api';
import { assertRateLimit } from '../../../lib/rate-limit';
import { AUTH_THROTTLE_TTL_MS } from '../../../services/auth/otp.constants';

const PUBLIC_TIP_READ_LIMIT = 30;

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  await assertRateLimit(`tips:public:${ip}`, PUBLIC_TIP_READ_LIMIT, AUTH_THROTTLE_TTL_MS);
  const id = getRouterParam(event, 'id') ?? '';
  const token = getQuery(event).token;
  const tips = new TipsService();
  const tip = await tips.getPublicTip(id, typeof token === 'string' ? token : undefined);
  return { tip };
});
