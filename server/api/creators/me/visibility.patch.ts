import { CreatorsService } from '../../../services/creators/creators.service';
import { requireUser } from '../../../lib/auth';
import { ApiError } from '../../../lib/errors';
import { defineApiHandler } from '../../../lib/define-api';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  const body = await readBody<{ active?: boolean }>(event);
  if (typeof body?.active !== 'boolean') {
    throw new ApiError(400, 'INVALID_ACTIVE', 'active must be true or false.');
  }
  const creators = new CreatorsService();
  const profile = await creators.setPageActive(user.sub, body.active);
  return { profile };
});
