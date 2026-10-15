import { requireUser } from '../../../../lib/auth';
import { defineApiHandler } from '../../../../lib/define-api';
import { PayoutService } from '../../../../services/creators/payout.service';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  return new PayoutService().getOverview(user.sub);
});
