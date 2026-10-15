import { requireUser } from '../../../../lib/auth';
import { defineApiHandler } from '../../../../lib/define-api';
import { assertRateLimit } from '../../../../lib/rate-limit';
import { PayoutService } from '../../../../services/creators/payout.service';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  await assertRateLimit(`payout:request:${user.sub}`, 5, 60_000);

  let amount: string | undefined;
  try {
    const body = await readBody<{ amount?: string }>(event);
    amount = typeof body?.amount === 'string' ? body.amount : undefined;
  } catch {
    amount = undefined;
  }

  return new PayoutService().requestPayout(user.sub, { amount });
});
