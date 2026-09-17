import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { getServerEnv } from '../../lib/env';

export function createConfirmationToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashConfirmationToken(token) };
}

export function hashConfirmationToken(token: string): string {
  return createHmac('sha256', getServerEnv().AUTH_SECRET)
    .update(token)
    .digest('hex');
}

export function confirmationTokenMatches(
  token: string | undefined,
  hash: string | null | undefined,
): boolean {
  if (!token || !hash) return false;
  const computed = hashConfirmationToken(token);
  const left = Buffer.from(computed);
  const right = Buffer.from(hash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
