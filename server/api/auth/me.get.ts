import { AuthService } from '../../services/auth.service';
import { defineApiHandler } from '../../lib/define-api';
import { ApiError } from '../../lib/errors';
import { clearAuthCookie, requireUser } from '../../lib/auth';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  const auth = new AuthService();
  const publicUser = await auth.getUserById(user.sub);
  if (!publicUser) {
    clearAuthCookie(event);
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  return { user: publicUser };
});
