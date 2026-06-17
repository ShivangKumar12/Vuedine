import bcrypt from 'bcrypt';

import { env } from '../../config/index.js';
import { redis } from '../../db/redis.js';
import { authEventsTotal } from '../../observability/metrics.js';
import { AppError } from '../../utils/AppError.js';
import { auditService } from '../audit/audit.service.js';

import { authRepo } from './auth.repository.js';
import { tokens } from './tokens.js';

/**
 * Auth service — business rules. No HTTP concerns here.
 *
 * Hardening choices documented inline:
 *   - Constant-time login (always run bcrypt.compare even on missing user)
 *   - Account lockout after MAX_FAILED_LOGINS
 *   - Refresh-token reuse detection → revoke entire family
 *   - Force-revoke via Redis denylist (admin can kick a user instantly)
 *   - Audit log on every meaningful event
 *   - Password reset never reveals whether the email exists
 */

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;
const REVOCATION_TTL_SEC = 60 * 60 * 24; // matches refresh TTL upper bound
// Pre-computed bcrypt hash so we can run compare even when the user doesn't exist
// (avoids leaking user existence via timing).
const DUMMY_HASH = '$2b$12$cJ5dKofFfZRUXAVECYWVU.PkN8iBVl7qV0rpHKwHOIzpW8tVmxd9G';

export const REVOKED_PREFIX = 'auth:revoked:';

export const authService = {
  async login({ email, password, tenantSlug, ip, userAgent }) {
    const user = await authRepo.findUserByEmail({ tenantSlug, email });

    // Always run bcrypt.compare — see DUMMY_HASH above.
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !passwordOk) {
      authEventsTotal.labels('login', 'failure').inc();
      if (user) {
        const updated = await authRepo.bumpFailedLogin(user.id);
        if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
          await authRepo.lockUser(user.id, new Date(Date.now() + LOCKOUT_MINUTES * 60_000));
          await auditService.record({
            tenantId: user.tenantId,
            userId: user.id,
            ip,
            userAgent,
            action: 'AUTH_LOGIN_FAILED',
            metadata: { locked: true, lockoutMinutes: LOCKOUT_MINUTES },
          });
        } else {
          await auditService.record({
            tenantId: user.tenantId,
            userId: user.id,
            ip,
            userAgent,
            action: 'AUTH_LOGIN_FAILED',
            metadata: { count: updated.failedLoginCount },
          });
        }
      }
      throw AppError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw AppError.unauthorized('Account temporarily locked', 'ACCOUNT_LOCKED');
    }
    if (user.status !== 'ACTIVE') {
      throw AppError.unauthorized(`Account is ${user.status.toLowerCase()}`, 'ACCOUNT_NOT_ACTIVE');
    }

    await authRepo.resetFailedLogin(user.id);
    authEventsTotal.labels('login', 'success').inc();

    const { raw, hash } = tokens.newRefreshToken();
    const session = await authRepo.createSession({
      userId: user.id,
      tenantId: user.tenantId,
      refreshHash: hash,
      expiresAt: new Date(Date.now() + tokens.refreshTtlMs),
      ip,
      userAgent,
    });

    await auditService.record({
      tenantId: user.tenantId,
      userId: user.id,
      ip,
      userAgent,
      action: 'AUTH_LOGIN',
      metadata: { sessionId: session.id },
    });

    // Make sure any pre-existing revocation marker for this user is cleared
    // (e.g. admin force-revoked yesterday, user just typed correct password).
    await redis.del(`${REVOKED_PREFIX}${user.id}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        branchIds: user.branchIds,
      },
      accessToken: tokens.signAccess(user),
      refreshToken: raw,
    };
  },

  async refresh({ refreshToken, ip, userAgent }) {
    if (!refreshToken) throw AppError.unauthorized('No refresh token', 'NO_REFRESH_TOKEN');
    const hash = tokens.hashRefresh(refreshToken);
    const session = await authRepo.findSessionByHash(hash);
    if (!session) throw AppError.unauthorized('Invalid refresh token', 'BAD_REFRESH_TOKEN');

    /* --------- Reuse detection --------- */
    if (session.rotatedToId || session.status !== 'ACTIVE') {
      authEventsTotal.labels('refresh', 'reuse').inc();
      await authRepo.revokeFamily(session.family);
      await auditService.record({
        tenantId: session.tenantId,
        userId: session.userId,
        ip,
        userAgent,
        action: 'AUTH_TOKEN_REUSE_DETECTED',
        metadata: { family: session.family, sessionId: session.id },
      });
      throw AppError.unauthorized('Refresh token reuse detected', 'TOKEN_REUSE');
    }

    if (session.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token expired', 'REFRESH_EXPIRED');
    }

    /* --------- Rotate --------- */
    const { raw, hash: newHash } = tokens.newRefreshToken();
    const newSession = await authRepo.rotateSession({
      oldId: session.id,
      newSessionData: {
        userId: session.userId,
        tenantId: session.tenantId,
        refreshTokenHash: newHash,
        family: session.family,
        expiresAt: new Date(Date.now() + tokens.refreshTtlMs),
        ip,
        userAgent,
      },
    });

    await auditService.record({
      tenantId: session.tenantId,
      userId: session.userId,
      ip,
      userAgent,
      action: 'AUTH_REFRESH',
      metadata: { newSessionId: newSession.id, family: session.family },
    });
    authEventsTotal.labels('refresh', 'success').inc();

    return {
      accessToken: tokens.signAccess(session.user),
      refreshToken: raw,
    };
  },

  async logout({ refreshToken, ip, userAgent }) {
    if (!refreshToken) return;
    const hash = tokens.hashRefresh(refreshToken);
    const session = await authRepo.findSessionByHash(hash);
    if (!session) return;
    await authRepo.revokeSession(session.id);
    await auditService.record({
      tenantId: session.tenantId,
      userId: session.userId,
      ip,
      userAgent,
      action: 'AUTH_LOGOUT',
      metadata: { sessionId: session.id },
    });
  },

  /**
   * Sign the user out of every device. Triggered by:
   *   - password reset
   *   - admin force-revoke
   *   - "log out everywhere" user action
   *
   * The Redis denylist makes still-valid access tokens 401 on the next call,
   * even though they're stateless. TTL matches the access token's max age.
   */
  async forceRevoke({ userId, ttlSec = REVOCATION_TTL_SEC }) {
    await authRepo.revokeFamilyForUser(userId);
    await redis.set(`${REVOKED_PREFIX}${userId}`, '1', 'EX', ttlSec);
  },

  /* ============================================================
   *  Password reset (token via Redis TTL)
   * ============================================================ */

  /**
   * Returns `{ token, userId }` when the email exists, `null` otherwise.
   * Callers MUST always respond 200 to avoid leaking which emails exist.
   * The email-sending side is wired in Phase 6 (queue + nodemailer).
   */
  async startPasswordReset(email) {
    const user = await authRepo.findUserByEmail({ email });
    if (!user) return null;

    const { raw } = tokens.newRefreshToken();
    const key = `pwreset:${tokens.hashRefresh(raw)}`;
    await redis.set(key, user.id, 'EX', env.PASSWORD_RESET_TTL_MIN * 60);

    return { token: raw, userId: user.id };
  },

  async completePasswordReset({ token, newPassword, ip, userAgent }) {
    const key = `pwreset:${tokens.hashRefresh(token)}`;
    const userId = await redis.get(key);
    if (!userId) {
      throw AppError.badRequest('Reset link expired or invalid', 'BAD_RESET_TOKEN');
    }
    await redis.del(key);

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_COST);
    await authRepo.setPassword(userId, passwordHash);
    await this.forceRevoke({ userId });

    await auditService.record({
      tenantId: null,
      userId,
      ip,
      userAgent,
      action: 'AUTH_PASSWORD_RESET',
      metadata: {},
    });
  },
};
