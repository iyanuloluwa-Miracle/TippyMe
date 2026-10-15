import { requireUser } from '../../../../lib/auth';
import { defineApiHandler } from '../../../../lib/define-api';
import { ApiError } from '../../../../lib/errors';
import { assertRateLimit } from '../../../../lib/rate-limit';
import { PayoutService } from '../../../../services/creators/payout.service';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  await assertRateLimit(`payout:method:${user.sub}`, 10, 60_000);

  const body = await readBody<{
    bankCode?: string;
    accountNumber?: string;
    bankName?: string;
  }>(event);

  if (!body?.bankCode?.trim() || !body?.accountNumber?.trim()) {
    throw new ApiError(
      400,
      'VALIDATION',
      'Bank and account number are required.',
    );
  }

  return new PayoutService().saveMethod(user.sub, {
    bankCode: body.bankCode,
    accountNumber: body.accountNumber,
    bankName: body.bankName,
  });
});
