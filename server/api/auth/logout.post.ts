import { defineApiHandler } from '../../lib/define-api';
import { clearAuthCookie, requireUser } from '../../lib/auth';
import { UserModel, useDb } from '../../db';

export default defineApiHandler(async (event) => {
  try {
    const user = await requireUser(event);
    await useDb();
    await UserModel.updateOne(
      { _id: user.sub },
      { $set: { sessionRevokedAt: new Date(), updatedAt: new Date() } },
    );
  } catch {
    // Still clear the cookie if the session was already invalid.
  }
  clearAuthCookie(event);
  return { ok: true };
});
