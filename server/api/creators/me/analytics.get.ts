import { CreatorsService } from '../../../services/creators/creators.service';
import { requireUser } from '../../../lib/auth';
import { defineApiHandler } from '../../../lib/define-api';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  const raw = getQuery(event).days;
  const days = typeof raw === 'string' ? Number(raw) : 30;
  return { analytics: await new CreatorsService().getAnalytics(user.sub, days) };
});
