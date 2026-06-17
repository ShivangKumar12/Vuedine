import { httpRequestDuration, httpRequestsTotal } from '../observability/metrics.js';

/**
 * Records request count + duration histograms for every HTTP request.
 *
 * IMPORTANT — uses the matched route PATTERN (`/items/:id`), not `req.path`
 * (`/items/abc123`). Without that, every distinct id becomes a unique label
 * → cardinality explosion → Prometheus eats RAM.
 *
 * Falls back to `unmatched` for routes that 404'd at the router level.
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const route = resolveRouteLabel(req);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, seconds);
  });

  next();
}

/**
 * Build a stable label from the matched Express route. Falls back to the
 * mount path so health/metrics still get useful labels, and to `unmatched`
 * so we don't lose 404s entirely.
 */
function resolveRouteLabel(req) {
  // For routes mounted via Router.use('/v1/items', ...), `req.route.path` is
  // the relative pattern ('/' or '/:id'); `req.baseUrl` is the prefix.
  const routePath = req.route?.path;
  if (routePath) return `${req.baseUrl ?? ''}${routePath}`.replace(/\/\//g, '/');
  if (req.baseUrl) return req.baseUrl;
  return 'unmatched';
}
