import hpp from 'hpp';

import { logger } from '../config/logger.js';

/**
 * Cheap-but-effective hardening middleware bundle.
 *
 * Mount AFTER body parsers (so we have parsed objects to walk) and BEFORE
 * route handlers. Each piece is defense in depth — none of them substitute
 * for input validation in route schemas.
 *
 * Why custom sanitizer instead of `express-mongo-sanitize`?
 *   That package was archived in 2024 and pulls in old `lodash`. We don't
 *   use Mongo, but `$`-keys can still surface as prototype pollution vectors
 *   in JS object handling. A 30-line in-house version covers the same surface
 *   and stays in our supply chain.
 *
 * Why no `xss-clean`?
 *   Also abandoned. Real XSS prevention happens at:
 *     1. JSON-only responses (Express's default with res.json)
 *     2. CSP headers (helmet, configured in app.js for prod)
 *     3. React's auto-escaping on the frontend
 *   String mutation in the request body is theatre — and breaks legitimate
 *   payloads like markdown comments or product names with `<` in them.
 */

const SUSPICIOUS_KEY = /^[$_]/; // $ for Mongo operators, _ leading for proto chains
const PROTO_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Walks an arbitrary object and strips dangerous keys. Returns the count of
 * removed keys so the caller can decide to log loudly when it isn't zero.
 *
 * Iterative (BFS) to avoid stack overflow on deeply nested malicious payloads.
 * Caps work at MAX_NODES to prevent quadratic-time DoS via huge JSON.
 */
function sanitize(obj) {
  if (obj === null || typeof obj !== 'object') return 0;

  let removed = 0;
  const queue = [obj];
  let nodes = 0;
  const MAX_NODES = 10_000;

  while (queue.length && nodes < MAX_NODES) {
    const cur = queue.shift();
    nodes += 1;

    if (Array.isArray(cur)) {
      for (const v of cur) if (v && typeof v === 'object') queue.push(v);
      continue;
    }

    for (const key of Object.keys(cur)) {
      if (PROTO_KEYS.has(key) || SUSPICIOUS_KEY.test(key)) {
        // eslint-disable-next-line security/detect-object-injection
        delete cur[key];
        removed += 1;
        continue;
      }
      // eslint-disable-next-line security/detect-object-injection
      const v = cur[key];
      if (v && typeof v === 'object') queue.push(v);
    }
  }
  return removed;
}

/**
 * Strip `$`-prefixed and prototype-pollution keys from req.body / req.query.
 * req.params is router-scoped and string-typed, no risk there.
 */
export function sanitizeKeys(req, _res, next) {
  let removed = 0;
  if (req.body && typeof req.body === 'object') removed += sanitize(req.body);
  // req.query is read-only on Express 5; safe-guard for both express 4 and 5.
  if (req.query && typeof req.query === 'object') {
    try {
      removed += sanitize(req.query);
    } catch {
      /* sealed object — nothing to strip */
    }
  }
  if (removed > 0) {
    logger.warn('security.sanitize_dropped_keys', {
      requestId: req.id,
      path: req.path,
      method: req.method,
      removed,
    });
  }
  next();
}

/**
 * Apply the bundle. Mount in app.js after express.json() / urlencoded().
 *
 * @param {import('express').Express} app
 */
export function applySecurityHardening(app) {
  app.use(sanitizeKeys);

  // Block HTTP Parameter Pollution (?role=admin&role=user). Whitelist the
  // params we genuinely accept as repeated.
  app.use(
    hpp({
      whitelist: ['ids', 'tag', 'tags', 'category', 'branchIds', 'status'],
    }),
  );
}
