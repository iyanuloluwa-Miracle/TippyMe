import { ByteshipClient, ByteshipError } from '@byteship/js';
import { ApiError } from '../../lib/errors';
import { getServerEnv } from '../../lib/env';

const AVATAR_FOLDER_PREFIX = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const TOKEN_TTL_SECONDS = 15 * 60;

const AVATAR_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function getByteshipServerClient(): ByteshipClient {
  const apiKey = getServerEnv().BYTESHIP_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      'BYTESHIP_NOT_CONFIGURED',
      'Profile photo uploads are not configured yet.',
    );
  }
  return new ByteshipClient({ apiKey });
}

/** Folder prefix scoped to the authenticated user. */
export function avatarFolderForUser(userId: string): string {
  return `${AVATAR_FOLDER_PREFIX}/${userId}`;
}

function extensionForContentType(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'jpg';
}

/**
 * Upload an avatar on the server (API key stays off the browser).
 * Avoids browser CORS / "Failed to fetch" against Byteship storage.
 */
export async function uploadAvatarForUser(
  userId: string,
  input: { bytes: Buffer; contentType: string; filename?: string },
): Promise<{ url: string }> {
  const contentType = input.contentType.trim().toLowerCase();
  if (!AVATAR_CONTENT_TYPES.has(contentType)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Use a JPEG, PNG, WebP, or GIF image.',
    );
  }
  if (input.bytes.byteLength > MAX_AVATAR_BYTES) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      `Image must be under ${Math.round(MAX_AVATAR_BYTES / (1024 * 1024))}MB.`,
    );
  }
  if (input.bytes.byteLength === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Choose an image to upload.');
  }

  const folder = avatarFolderForUser(userId);
  const ext = extensionForContentType(contentType);
  const path = `${folder}/avatar.${ext}`;
  const file = new File(
    [new Uint8Array(input.bytes)],
    input.filename?.trim() || `avatar.${ext}`,
    { type: contentType },
  );

  try {
    const byteship = getByteshipServerClient();
    const uploaded = await byteship.upload(file, {
      visibility: 'public',
      path,
    });
    const url = uploaded.url?.trim();
    if (!url) {
      throw new ApiError(
        502,
        'BYTESHIP_UPLOAD_FAILED',
        'Upload finished but no public URL was returned.',
      );
    }
    return { url };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof ByteshipError) {
      throw new ApiError(
        err.status && err.status >= 400 && err.status < 600 ? err.status : 502,
        'BYTESHIP_UPLOAD_FAILED',
        err.message || 'Could not upload photo. Try again.',
      );
    }
    throw new ApiError(
      502,
      'BYTESHIP_UPLOAD_FAILED',
      'Could not upload photo. Try again.',
    );
  }
}

export async function createAvatarUploadToken(userId: string): Promise<{
  token: string;
  expiresAt: string;
  folder: string;
  maxUploadBytes: number;
}> {
  const folder = avatarFolderForUser(userId);
  const byteship = getByteshipServerClient();
  const { uploadToken } = await byteship.createUploadToken({
    folder,
    visibility: 'public',
    maxUploadBytes: MAX_AVATAR_BYTES,
    expiresInSeconds: TOKEN_TTL_SECONDS,
  });

  return {
    token: uploadToken.token,
    expiresAt: uploadToken.expiresAt,
    folder,
    maxUploadBytes: MAX_AVATAR_BYTES,
  };
}

export { MAX_AVATAR_BYTES, AVATAR_FOLDER_PREFIX, AVATAR_CONTENT_TYPES };
