/**
 * Route security audit.
 *
 * Walks the v1 router tree and asserts every route has, in its full
 * middleware chain (router.use() inheritance + per-route handlers), at
 * least one auth middleware — OR the route is on the explicit
 * `PUBLIC_ALLOWLIST`.
 *
 * Run:
 *   npm run security:routes
 *
 * Exit code:
 *   0 — all routes safe
 *   1 — at least one route violates policy (CI should block)
 */

import { v1Router } from '../src/routes.v1.js';

/** Routes that are explicitly safe to expose publicly (no auth required). */
const PUBLIC_ALLOWLIST = new Set([
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'POST /auth/password/reset/start',
  'POST /auth/password/reset/complete',
  // OSS — customer-facing token board on the wall TV
  'GET /oss/:branchSlug/tokens',
  // Public PWA — guest QR / menu / order / track / signal
  'GET /public/qr/:branchSlug/:qrToken',
  'GET /public/menu/:branchSlug',
  'POST /public/orders/calculate',
  'POST /public/cart/apply-coupon',
  'POST /public/orders',
  'GET /public/orders/:orderId',
  'POST /public/orders/:orderId/signal',
  // Inbound payment gateway webhooks (signature-verified inside the handler)
  'POST /webhooks/razorpay',
  // Phase H — inbound messaging webhooks (signature-verified inside the handler)
  'POST /webhooks/whatsapp',
  'POST /webhooks/sms',
  'POST /webhooks/instagram',
  // Phase J — inbound aggregator webhooks (signature-verified inside the handler)
  'POST /webhooks/zomato',
  'POST /webhooks/swiggy',
  // Phase K — SaaS billing webhook (signature-verified inside the handler)
  'POST /webhooks/billing',
  // Phase E — invite links are public (no auth needed to resolve/accept)
  'GET /users/invite/:token',
  'POST /users/invite/:token/accept',
]);

/** Names of middlewares that count as "authenticated". */
const AUTH_NAMES = new Set(['authMiddleware', 'apiKeyAuth', 'apiKeyOrJwtAuth', 'optionalAuth']);

function nameOf(fn) {
  return typeof fn === 'function' ? fn.name || '<anon>' : '<non-fn>';
}

/**
 * Express router layer triage.
 *   - layer.route present  → it's a leaf route (GET /items/:id)
 *   - layer.handle.stack present + layer.name === 'router' → mounted sub-router
 *   - everything else → top-level middleware applied via router.use()
 */
function isRoute(layer) {
  return Boolean(layer?.route);
}
function isSubRouter(layer) {
  return layer?.name === 'router' && Array.isArray(layer?.handle?.stack);
}

/**
 * Recover the URL prefix a sub-router was mounted at.
 * Express stores it as a regex; for the common `router.use('/items', sub)`
 * case the regex source is `^\/items\/?(?=\/|$)`.
 */
function recoverPrefix(layer) {
  if (layer?.regexp?.fast_slash) return '';
  const src = layer?.regexp?.toString() ?? '';
  const m = src.match(/\^\\(\/[A-Za-z0-9_-]+)/);
  return m?.[1] ?? '';
}

/**
 * Walk a router's stack, yielding `{ method, path, chain }` for every leaf.
 * `chain` includes BOTH inherited router-level middleware (from `router.use`)
 * AND per-route handlers, in execution order.
 */
function* walk(stack, prefix = '', inherited = []) {
  // First pass: gather router-level middleware (anything before / between
  // routes that isn't itself a route or sub-router). Express runs them in
  // declaration order, so order matters.
  const routerLevel = [];
  for (const layer of stack) {
    if (!isRoute(layer) && !isSubRouter(layer) && typeof layer?.handle === 'function') {
      routerLevel.push(nameOf(layer.handle));
    }
  }
  const cumulative = [...inherited, ...routerLevel];

  // Second pass: emit routes / descend into sub-routers.
  for (const layer of stack) {
    if (isRoute(layer)) {
      const handlers = (layer.route.stack ?? []).map((h) => nameOf(h.handle));
      const verbs = Object.keys(layer.route.methods ?? {}).map((v) => v.toUpperCase());
      for (const verb of verbs) {
        yield {
          method: verb,
          path: `${prefix}${layer.route.path}`,
          chain: [...cumulative, ...handlers],
        };
      }
    } else if (isSubRouter(layer)) {
      yield* walk(layer.handle.stack, prefix + recoverPrefix(layer), cumulative);
    }
  }
}

function isAuthed(chain) {
  return chain.some((n) => AUTH_NAMES.has(n));
}

const findings = [];
let total = 0;
let violations = 0;

for (const route of walk(v1Router.stack ?? [])) {
  total += 1;
  const key = `${route.method} ${route.path}`;
  if (PUBLIC_ALLOWLIST.has(key)) continue;
  if (!isAuthed(route.chain)) {
    violations += 1;
    findings.push(route);
  }
}

// eslint-disable-next-line no-console -- this is a CLI tool
console.log(`Audited ${total} v1 routes — ${violations} violations\n`);

if (violations > 0) {
  for (const f of findings) {
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${f.method} ${f.path}`);
    // eslint-disable-next-line no-console
    console.error(`    chain: [${f.chain.join(', ')}]\n`);
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log('✓ All v1 routes are authenticated or explicitly allowlisted.');
process.exit(0);
