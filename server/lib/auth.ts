import type { H3Event } from 'h3';
import {
  deleteCookie,
  getCookie,
  getHeader,
  setCookie,
} from 'h3';
import { SignJWT, jwtVerify } from 'jose';
import { ApiError } from './errors';
import { getServerEnv } from './env';

export const AUTH_COOKIE_NAME = 'tippyme_session';
export const AUTH_JWT_EXPIRES_IN = '24h';
const AUTH_COOKIE_MAX_AGE_SEC = 24 * 60 * 60;

export type AuthUserPayload = {
  sub: string;
  email: string;
};

type SessionClaims = AuthUserPayload & {
  passwordChangedAt: number;
  issuedAt: number;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().AUTH_SECRET);
}

export async function signAccessToken(
  payload: AuthUserPayload & { passwordChangedAt?: Date | null },
): Promise<string> {
  const pwd = payload.passwordChangedAt
    ? Math.floor(payload.passwordChangedAt.getTime() / 1000)
    : 0;
  return new SignJWT({ email: payload.email, pwd })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(AUTH_JWT_EXPIRES_IN)
    .sign(secretKey());
}

export async function verifyAccessToken(
  token: string,
): Promise<SessionClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const sub = payload.sub;
    const email = payload.email;
    if (typeof sub !== 'string' || typeof email !== 'string') {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
    return {
      sub,
      email,
      passwordChangedAt: typeof payload.pwd === 'number' ? payload.pwd : 0,
      issuedAt: typeof payload.iat === 'number' ? payload.iat : 0,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
}

function extractToken(event: H3Event): string | null {
  const cookieToken = getCookie(event, AUTH_COOKIE_NAME);
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }

  const header = getHeader(event, 'authorization');
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim() || null;
  }

  return null;
}

export async function requireUser(event: H3Event): Promise<AuthUserPayload> {
  const token = extractToken(event);
  if (!token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }
  const session = await verifyAccessToken(token);
  try {
    const { UserModel, useDb } = await import('../db');
    await useDb();
    const user = await UserModel.findById(session.sub).select('passwordChangedAt sessionRevokedAt closedAt').lean<{
      passwordChangedAt?: Date | null;
      sessionRevokedAt?: Date | null;
      closedAt?: Date | null;
    } | null>();
    const stored = user?.passwordChangedAt
      ? Math.floor(new Date(user.passwordChangedAt).getTime() / 1000)
      : 0;
    const revoked = user?.sessionRevokedAt
      ? Math.floor(new Date(user.sessionRevokedAt).getTime() / 1000)
      : 0;
    if (!user || user.closedAt || session.passwordChangedAt < stored || (revoked > 0 && session.issuedAt < revoked)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable.');
  }
  return { sub: session.sub, email: session.email };
}

export function setAuthCookie(event: H3Event, token: string): void {
  setCookie(event, AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  });
}

export function clearAuthCookie(event: H3Event): void {
  deleteCookie(event, AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: 'lax',
    path: '/',
  });
}

/** Prefer HTTPS APP_URL so cookies work behind TLS even if NODE_ENV is mis-set. */
function useSecureCookies(): boolean {
  const env = getServerEnv();
  return (
    env.NODE_ENV === 'production' || env.APP_URL.trim().startsWith('https://')
  );
}
