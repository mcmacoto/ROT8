import crypto from 'crypto';

const SALT = process.env.HOST_TOKEN_SALT || 'rot8-pickleball-engine-secure-salt';

export interface HostTokenGeneration {
  rawToken: string;
  tokenHash: string;
}

/**
 * Generates a cryptographically secure random token and its HMAC-SHA256 digest.
 * The rawToken goes into the HttpOnly cookie.
 * The tokenHash is stored in the database `sessions.host_token_hash`.
 */
export function generateHostToken(): HostTokenGeneration {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashHostToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Computes the HMAC-SHA256 digest of a raw token.
 */
export function hashHostToken(rawToken: string): string {
  return crypto
    .createHmac('sha256', SALT)
    .update(rawToken)
    .digest('hex');
}

/**
 * Derives a deterministic raw host token from sessionId and joinPin.
 * Allows multiple authorized devices with the correct PIN to receive identical/valid host cookies.
 */
export function deriveSessionHostToken(sessionId: string, joinPin: string): string {
  return crypto
    .createHmac('sha256', SALT)
    .update(`session-host:${sessionId}:${joinPin.toUpperCase()}`)
    .digest('hex');
}

/**
 * Validates whether a presented raw token matches the stored token hash using constant-time comparison.
 * Also checks if the token matches the session's derived host token for multi-device support.
 */
export function validateHostToken(
  rawToken: string | undefined | null,
  storedHash: string,
  sessionId?: string,
  joinPin?: string
): boolean {
  if (!rawToken || !storedHash) return false;
  try {
    const computedHash = hashHostToken(rawToken);
    const bufComputed = Buffer.from(computedHash, 'hex');
    const bufStored = Buffer.from(storedHash, 'hex');
    if (bufComputed.length === bufStored.length && crypto.timingSafeEqual(bufComputed, bufStored)) {
      return true;
    }
  } catch {
    // continue to fallback check
  }

  // Multi-device fallback: check if rawToken is derived from session join_pin
  if (sessionId && joinPin) {
    try {
      const derivedToken = deriveSessionHostToken(sessionId, joinPin);
      if (rawToken === derivedToken) return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Cookie options helper for host auth
 */
export function getHostCookieConfig() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days session lifetime
  };
}
