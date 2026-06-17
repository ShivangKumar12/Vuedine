import { cacheHits, cacheMisses } from '../observability/metrics.js';
import { cached, getVersion } from '../utils/cache.js';

/**
 * Cache GET responses by URL + tenant. Skips on:
 *   - non-GET methods
 *   - `Cache-Control: no-cache` from the client
 *   - non-2xx responses (we never cache failures)
 *
 *   router.get('/items', cacheRoute({ ttlSec: 60, prefix: 'items' }), itemsController.list);
 *
 * Tenant scoping is automatic via `req.tenantId` (set by auth middleware in Phase 4).
 *
 * 🔒 SECURITY — for authenticated routes, key MUST include user/tenant. The
 * default keyFn does this. Override only if you understand the leakage risk.
 */
export function cacheRoute({ ttlSec = 60, prefix, keyFn } = {}) {
  return async function cacheRouteMiddleware(req, res, next) {
    if (req.method !== 'GET') return next();
    if (req.get('Cache-Control') === 'no-cache') return next();

    const tenantPart = req.tenantId ?? 'public';
    const userPart = req.user?.id ?? 'anon';
    const key = keyFn ? keyFn(req) : `route:${tenantPart}:${userPart}:${req.originalUrl}`;

    const version = prefix ? await getVersion(prefix) : 1;
    const c = cached({ key, ttlSec, version });

    const hit = await c.get();
    if (hit !== null && hit !== undefined) {
      cacheHits.labels('route').inc();
      res.setHeader('X-Cache', 'HIT');
      return res.status(hit.status ?? 200).json(hit.body);
    }
    cacheMisses.labels('route').inc();

    res.setHeader('X-Cache', 'MISS');

    // Wrap res.json so we can store the response after the controller runs.
    const origJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-forget: cache failure must not break the response.
        c.set({ status: res.statusCode, body }).catch(() => {});
      }
      return origJson(body);
    };

    next();
  };
}
