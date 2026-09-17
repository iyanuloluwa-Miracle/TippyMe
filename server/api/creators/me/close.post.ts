import { CreatorsService } from '../../../services/creators/creators.service';
import { clearAuthCookie, requireUser } from '../../../lib/auth';
import { defineApiHandler } from '../../../lib/define-api';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  const creators = new CreatorsService();
  await creators.closeAccount(user.sub);
  clearAuthCookie(event);
  return { ok: true };
});
