import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';
import ms from 'ms';

import { env } from '../../config/index.js';

/**
 * Token primitives. Two kinds:
 *
 *   1. Access token — short-lived JWT (15m). Carries identity + role + branchIds.
 *      Sent via `Authorization: Bearer <jwt>`. Stateless verification.
 *
 *   2. Refresh token — opaque random 256-bit string (7d). Stored as SHA-256
 *      hash in `Session.refreshTokenHash`. Delivered as an httpOnly cookie
 *      scoped to /v1/auth so it's never sent to feature routes.
 *
 * Refresh tokens belong to a "family" — one shared id per login. When a
 * refresh is rotated, the old session row records `rotatedToId`. If a request
 * comes in with a token whose row already has rotatedToId set, that's a
 * replay → revoke the entire family. (OWASP-recommended pattern.)
 */

const ACCESS_TTL_MS = ms(env.JWT_ACCESS_TTL);
const REFRESH_TTL_MS = ms(env.JWT_REFRESH_TTL);

export const tokens = {
  accessTtlMs: ACCESS_TTL_MS,
  refreshTtlMs: REFRESH_TTL_MS,

  /** Sign a short-lived access JWT. */
  signAccess(user) {
    return jwt.sign(
      {
        sub: user.id,
        tid: user.tenantId ?? null,
        role: user.role,
        branchIds: user.branchIds ?? [],
      },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: env.JWT_ACCESS_TTL,
        issuer: 'vuedine',
        audience: 'vuedine-api',
      },
    );
  },

  /** Verify an access token. Throws on bad signature / expired / wrong audience. */
  verifyAccess(token) {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'vuedine',
      audience: 'vuedine-api',
    });
  },

  /** Build a fresh opaque refresh token + its hash for DB storage. */
  newRefreshToken() {
    const raw = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  },

  /** Hash an inbound refresh token to look it up against `Session.refreshTokenHash`. */
  hashRefresh(raw) {
    return createHash('sha256').update(raw).digest('hex');
  },

  /** Cookie options for the refresh cookie. Path-scoped to /v1/auth. */
  refreshCookieOptions(isProd) {
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: REFRESH_TTL_MS,
    };
  },
};
