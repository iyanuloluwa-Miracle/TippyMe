import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getServerEnv } from './env';

function keyFromSecret(): Buffer {
  return createHash('sha256').update(getServerEnv().AUTH_SECRET).digest();
}

/** Encrypt a short secret (e.g. bank account number) as base64 `iv:tag:cipher`. */
export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function openSecret(sealed: string): string {
  const [ivB64, tagB64, dataB64] = sealed.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid sealed secret');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFromSecret(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
