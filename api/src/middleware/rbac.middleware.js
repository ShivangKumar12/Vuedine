import { AppError } from '../utils/AppError.js';

/**
 * Role-based access control.
 *
 *   router.post('/items',
 *     authMiddleware,
 *     requireRole('OWNER', 'ADMIN', 'MANAGER'),
 *     handler
 *   );
 *
 * Coarse check by enum name. Finer-grained permissions (the matrix the
 * frontend already enumerates in pages/dashboard/UserRoles.tsx) layer on top
 * via a permission registry — added when we wire the permissions module.
 */
export function requireRole(...allowed) {
  const set = new Set(allowed);
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized('Auth required', 'NO_AUTH'));
    if (!set.has(req.user.role)) {
      return next(
        AppError.forbidden(`Requires role in [${[...set].join(', ')}]`, 'INSUFFICIENT_ROLE'),
      );
    }
    next();
  };
}

/**
 * Restricts the request to branches the user has been granted access to.
 * Owners and platform admins skip the check (they see everything).
 *
 *   router.get('/branches/:branchId/orders',
 *     authMiddleware,
 *     requireBranchAccess('branchId'),
 *     ...
 *   );
 */
export function requireBranchAccess(branchIdParam = 'branchId') {
  return (req, _res, next) => {
    const branchId = req.params[branchIdParam] ?? req.body?.branchId ?? req.query?.branchId;
    if (!branchId) return next(AppError.badRequest('branchId required', 'BRANCH_REQUIRED'));
    const role = req.user?.role;
    if (role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN') return next();
    if (!req.user?.branchIds?.includes(branchId)) {
      return next(AppError.forbidden('No access to this branch', 'BRANCH_FORBIDDEN'));
    }
    next();
  };
}

/**
 * Scope check for API-key authenticated requests.
 *
 *   router.post('/orders',
 *     apiKeyAuth,
 *     requireScope('orders:write'),
 *     handler
 *   );
 *
 * Human users (JWT auth) bypass scope checks — their role grants them the
 * full permission set already. API keys carry exactly the scopes they were
 * issued with, nothing more.
 */
export function requireScope(...needed) {
  return (req, _res, next) => {
    if (req.user?.role !== 'API_KEY') return next(); // human user — RBAC handled by requireRole
    const have = new Set(req.user.scopes ?? []);
    if (!needed.every((s) => have.has(s))) {
      return next(
        AppError.forbidden(`Missing scope(s): ${needed.join(', ')}`, 'INSUFFICIENT_SCOPE'),
      );
    }
    next();
  };
}
