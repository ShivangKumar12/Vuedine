import { logger } from '../config/logger.js';

/**
 * Attach a request-scoped logger to `req.log`. Every line written through
 * `req.log` carries the same correlation metadata, so a single `requestId`
 * traces the full request flow across services + workers.
 *
 *   req.log.info('order.created', { orderId });
 *
 *   → 2026-06-08T... INFO order.created {"requestId":"…","method":"POST","path":"/v1/orders","userId":"…","orderId":"…"}
 *
 * Mounted in app.js after `requestId` so the id is always available.
 */
export function attachLogger(req, _res, next) {
  req.log = logger.child({
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    ...(req.user
      ? {
          userId: req.user.id,
          tenantId: req.user.tenantId,
          role: req.user.role,
        }
      : {}),
  });
  next();
}
