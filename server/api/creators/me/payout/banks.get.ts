import { requireUser } from '../../../../lib/auth';
import { defineApiHandler } from '../../../../lib/define-api';
import { PayoutService } from '../../../../services/creators/payout.service';

export default defineApiHandler(async (event) => {
  await requireUser(event);
  const banks = await new PayoutService().listBanks();
  return { banks };
});
