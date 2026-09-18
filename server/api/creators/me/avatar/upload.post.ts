import { readMultipartFormData } from 'h3';
import { requireUser } from '../../../../lib/auth';
import { defineApiHandler } from '../../../../lib/define-api';
import { ApiError } from '../../../../lib/errors';
import { assertRateLimit } from '../../../../lib/rate-limit';
import {
  MAX_AVATAR_BYTES,
  uploadAvatarForUser,
} from '../../../../services/byteship/byteship.service';

export default defineApiHandler(async (event) => {
  const user = await requireUser(event);
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  await assertRateLimit(`byteship:avatar-upload:${user.sub}:${ip}`, 10, 60_000);

  const parts = await readMultipartFormData(event);
  const filePart = parts?.find((part) => part.name === 'file');
  if (!filePart?.data?.byteLength) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Choose an image to upload.');
  }
  if (filePart.data.byteLength > MAX_AVATAR_BYTES) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `Image must be under ${Math.round(MAX_AVATAR_BYTES / (1024 * 1024))}MB.`,
    );
  }

  return uploadAvatarForUser(user.sub, {
    bytes: Buffer.from(filePart.data),
    contentType: filePart.type || 'application/octet-stream',
    filename: filePart.filename,
  });
});
