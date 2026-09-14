import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '../../lib/errors';
import { getServerEnv } from '../../lib/env';

export const GOOGLE_OAUTH_STATE_COOKIE = 'tippyme_google_oauth';
export const GOOGLE_OAUTH_STATE_MAX_AGE_SEC = 600;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export type GoogleOAuthStatePayload = {
  nonce: string;
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
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(
      503,
      'GOOGLE_AUTH_UNAVAILABLE',
      'Google sign-in is not configured.',
    );
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
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

export function createOAuthState(opts?: {
  next?: string;
  username?: string;
}): { stateToken: string; cookieValue: string } {
  const nonce = randomBytes(24).toString('base64url');
  const payload: GoogleOAuthStatePayload = {
    nonce,
    ...(opts?.next ? { next: opts.next } : {}),
    ...(opts?.username ? { username: opts.username } : {}),
  };
  const cookieValue = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const stateToken = hashState(cookieValue);
  return { stateToken, cookieValue };
}

export function parseAndValidateOAuthState(
  stateToken: string | undefined,
  cookieValue: string | undefined,
): GoogleOAuthStatePayload {
  if (!stateToken || !cookieValue) {
    throw new ApiError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Please try again.',
    );
  }
  if (hashState(cookieValue) !== stateToken) {
    throw new ApiError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Please try again.',
    );
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(cookieValue, 'base64url').toString('utf8'),
    ) as GoogleOAuthStatePayload;
    if (!parsed || typeof parsed.nonce !== 'string' || !parsed.nonce) {
      throw new Error('missing nonce');
    }
    return {
      nonce: parsed.nonce,
      next: sanitizeNextPath(parsed.next),
      username: sanitizeUsernameClaim(parsed.username),
    };
  } catch {
    throw new ApiError(
      400,
      'INVALID_OAUTH_STATE',
      'Google sign-in expired. Please try again.',
    );
  }
}

function hashState(cookieValue: string): string {
  return createHash('sha256').update(cookieValue).digest('base64url');
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

  if (!tokenRes.ok) {
    throw new ApiError(
      401,
      'GOOGLE_TOKEN_EXCHANGE_FAILED',
      'Google sign-in failed. Please try again.',
    );
  }

  const tokenBody = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!tokenBody.access_token) {
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
