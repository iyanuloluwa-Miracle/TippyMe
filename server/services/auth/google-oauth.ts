import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../../lib/errors';
import { getServerEnv } from '../../lib/env';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export type GoogleOAuthStatePayload = {
  nonce: string;
  /** unix ms when issued */
  iat: number;
  next?: string;
  username?: string;
};

export type GoogleUserInfo = {
  googleId: string;
  email: string;
  emailVerified: boolean;
};

export function isGoogleOAuthConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function requireGoogleOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const env = getServerEnv();
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new ApiError(
      503,
      'GOOGLE_AUTH_UNAVAILABLE',
      'Google sign-in is not configured.',
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${env.APP_URL.replace(/\/$/, '')}/api/auth/google/callback`,
  };
}

/** Safe same-origin relative path only (open-redirect guard). */
export function sanitizeNextPath(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return undefined;
  if (trimmed.includes('\\') || trimmed.includes('://')) return undefined;
  return trimmed.slice(0, 512);
}

export function sanitizeUsernameClaim(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
  return normalized.length >= 3 ? normalized : undefined;
}

function stateSecret(): string {
  return getServerEnv().AUTH_SECRET;
}

function signPayload(body: string): string {
  return createHmac('sha256', stateSecret()).update(body).digest('base64url');
}

/**
 * Signed OAuth `state` (no cookie). Survives Brave Shields / strict cookie
 * blocking on the Google → app redirect.
 */
export function createOAuthState(opts?: {
  next?: string;
  username?: string;
}): string {
  const payload: GoogleOAuthStatePayload = {
    nonce: randomBytes(16).toString('base64url'),
    iat: Date.now(),
    ...(opts?.next ? { next: opts.next } : {}),
    ...(opts?.username ? { username: opts.username } : {}),
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const sig = signPayload(body);
  return `${body}.${sig}`;
}

export function parseAndValidateOAuthState(
  stateToken: string | undefined,
): GoogleOAuthStatePayload {
  if (!stateToken || !stateToken.includes('.')) {
    throw new ApiError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Please try again.',
    );
  }

  const [body, sig] = stateToken.split('.');
  if (!body || !sig) {
    throw new ApiError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Please try again.',
    );
  }

  const expected = signPayload(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    throw new ApiError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Please try again.',
    );
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as GoogleOAuthStatePayload;
    if (!parsed?.nonce || typeof parsed.iat !== 'number') {
      throw new Error('invalid payload');
    }
    if (Date.now() - parsed.iat > STATE_MAX_AGE_MS || parsed.iat > Date.now() + 60_000) {
      throw new ApiError(
        400,
        'INVALID_OAUTH_STATE',
        'Google sign-in expired. Please try again.',
      );
    }
    return {
      nonce: parsed.nonce,
      iat: parsed.iat,
      next: sanitizeNextPath(parsed.next),
      username: sanitizeUsernameClaim(parsed.username),
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Please try again.',
    );
  }
}

export function buildGoogleAuthorizeUrl(stateToken: string): string {
  const { clientId, redirectUri } = requireGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: stateToken,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleUserInfo> {
  const { clientId, clientSecret, redirectUri } = requireGoogleOAuthConfig();

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokenBody = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenBody.access_token) {
    console.warn(
      `[google-oauth] token exchange failed status=${tokenRes.status} error=${tokenBody.error ?? 'unknown'} desc=${tokenBody.error_description ?? ''} redirect_uri=${redirectUri}`,
    );
    throw new ApiError(
      401,
      'GOOGLE_TOKEN_EXCHANGE_FAILED',
      'Google sign-in failed. Please try again.',
    );
  }

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  if (!userRes.ok) {
    console.warn(`[google-oauth] userinfo failed status=${userRes.status}`);
    throw new ApiError(
      401,
      'GOOGLE_USERINFO_FAILED',
      'Google sign-in failed. Please try again.',
    );
  }

  const profile = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
  };

  const googleId = typeof profile.sub === 'string' ? profile.sub : '';
  const email =
    typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  const emailVerified =
    profile.email_verified === true || profile.email_verified === 'true';

  if (!googleId || !email) {
    throw new ApiError(
      400,
      'GOOGLE_EMAIL_REQUIRED',
      'Google did not return a verified email for this account.',
    );
  }
  if (!emailVerified) {
    throw new ApiError(
      400,
      'GOOGLE_EMAIL_UNVERIFIED',
      'Your Google email must be verified to continue.',
    );
  }

  return { googleId, email, emailVerified };
}
