import { redis } from '../db/redis.js';
import { apiKeysService } from '../modules/apiKeys/apiKeys.service.js';
import { REVOKED_PREFIX } from '../modules/auth/auth.service.js';
import { tokens } from '../modules/auth/tokens.js';
import { AppError } from '../utils/AppError.js';

/**
 * authMiddleware — verify Bearer JWT, attach user to req.
 *
 *   req.user = { id, tenantId, role, branchIds }
 *   req.tenantId = <same as req.user.tenantId>  // shortcut for repos
 *
 * Even though the access token is stateless, we check Redis for a per-user
 * revocation marker (set by force-revoke / password reset). Hot path:
 * one ~1ms Redis EXISTS call per request — cached locally by ioredis after
 * the first hit.
 */
export async function authMiddleware(req, _res, next) {
  try {
    const header = req.get('Authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw AppError.unauthorized('Missing bearer token', 'NO_TOKEN');
    }

    let payload;
    try {
      payload = tokens.verifyAccess(token);
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'BAD_TOKEN';
      throw AppError.unauthorized(err.message, code);
    }

    if (await redis.exists(`${REVOKED_PREFIX}${payload.sub}`)) {
      throw AppError.unauthorized('Session revoked', 'SESSION_REVOKED');
    }

    req.user = {
      id: payload.sub,
      tenantId: payload.tid,
      role: payload.role,
      branchIds: payload.branchIds ?? [],
    };
    req.tenantId = payload.tid;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional auth — populate req.user when a valid token is present, do not
 * 401 if missing. Used for endpoints that have public + authenticated views
 * (e.g. landing page metrics).
 */
export async function optionalAuth(req, res, next) {
  if (!req.get('Authorization')) return next();
  return authMiddleware(req, res, next);
}

/**
 * apiKeyAuth — accept `Authorization: Bearer sk_live_...` for server-to-server
 * integration endpoints (webhook receivers, POS hardware sync).
 *
 *   req.user = { id: <apiKeyId>, tenantId, role: 'API_KEY', scopes: [...] }
 *
 * Distinct from JWT auth in two ways:
 *   1. role is the literal string 'API_KEY' so RBAC checks fall through cleanly
 *      — these requests should never reach human-only routes.
 *   2. `scopes` is attached for fine-grained checks; use `requireScope()` from
 *      the rbac middleware to gate routes.
 *
 * If a route accepts BOTH JWT and API key, mount this middleware first and
 * fall through to authMiddleware on miss. (See apiKeysOrJwtAuth below.)
 */
export async function apiKeyAuth(req, _res, next) {
  try {
    const header = req.get('Authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token?.startsWith('sk_')) {
      throw AppError.unauthorized('Missing API key', 'NO_API_KEY');
    }
    const result = await apiKeysService.verify(token);
    if (!result) {
      throw AppError.unauthorized('Invalid API key', 'BAD_API_KEY');
    }
    req.user = {
      id: result.id,
      tenantId: result.tenantId,
      role: 'API_KEY',
      scopes: result.scopes,
      branchIds: [], // API keys are tenant-wide; resource-level scopes gate access
    };
    req.tenantId = result.tenantId;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Compose: if `Authorization: Bearer sk_...` looks like an API key, route to
 * `apiKeyAuth`; otherwise fall through to standard JWT verification.
 */
export async function apiKeyOrJwtAuth(req, res, next) {
  const header = req.get('Authorization') ?? '';
  const [, token] = header.split(' ');
  if (token?.startsWith('sk_')) return apiKeyAuth(req, res, next);
  return authMiddleware(req, res, next);
}
