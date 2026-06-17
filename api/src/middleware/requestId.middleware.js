import { randomUUID } from 'node:crypto';

const HEADER = 'x-request-id';

// Accept inbound IDs only when they look like a sane id (alnum, dash, underscore).
// Anything else is replaced — guards against header-injection of newlines / control chars.
const SAFE_ID = /^[\w-]{8,128}$/;

/**
 * Inject a UUID per request, propagate it on the response and `req.id`.
 * Honors an inbound id from a load balancer / API gateway when present and safe.
 *
 *   req.id          // 'a1b2c3d4-...'
 *   res 'X-Request-Id'  // same value
 *
 * Every log line written downstream should carry this id so a single trace
 * can be reconstructed across services.
 */
export function requestId(req, res, next) {
  const inbound = req.get(HEADER);
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
