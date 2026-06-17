import { createHash } from 'node:crypto';

import { logger } from '../config/logger.js';
import { redis } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';

/**
 * Idempotency-Key middleware.
 *
 * Spec (RFC draft `Idempotency-Key`):
 *   - Same key + same body within window → return the previously-stored
 *     response (so replays from a flaky network never create duplicates).
 *   - Same key + different body → 409 conflict.
 *   - Missing key → handler runs normally.
 *
 * Storage: Redis hash `{ status, body, hash, completedAt }` keyed by
 *   `idempo:${tenantId}:${key}` with a 24h TTL.
 *
 * Use:
 *   router.post('/orders', idempotency({ scope: 'orders' }), createOrder);
 *
 * Note: In the orders DB layer we ALSO use a unique index on
 * (tenantId, idempotencyKey). Redis is the fast first line of defence;
 * the DB constraint is the durable backstop.
 */


const TTL_SEC = 24 * 60 * 60;

function hashBody(body) {
  return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

export function idempotency({ scope = 'default' } = {}) {
  return async (req, res, next) => {
    const key = req.get('Idempotency-Key') || req.get('idempotency-key');
    if (!key) return next();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
      return next(
        AppError.badRequest('Idempotency-Key must be 8–128 chars [A-Za-z0-9_-]', 'IDEMPOTENCY_KEY_INVALID'),
      );
    }

    const tenantBucket = req.tenantId ?? req.body?.branchSlug ?? 'public';
    const cacheKey = `idempo:${scope}:${tenantBucket}:${key}`;
    const reqHash = hashBody({ url: req.originalUrl, body: req.body });

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.hash !== reqHash) {
          return next(
            AppError.conflict(
              'Idempotency-Key reused with a different request body',
              'IDEMPOTENCY_KEY_REUSED',
            ),
          );
        }
        if (parsed.status === 'pending') {
          // Another request is in flight — tell the client to retry shortly.
          return next(
            AppError.conflict('Request in progress, retry shortly', 'IDEMPOTENCY_IN_FLIGHT'),
          );
        }
        // Replay the stored response.
        res.status(parsed.responseStatus ?? 200).json(parsed.responseBody);
        return;
      }

      // Reserve the key as pending. NX prevents two concurrent fast clients
      // both creating new orders.
      const reserved = await redis.set(
        cacheKey,
        JSON.stringify({ status: 'pending', hash: reqHash }),
        'EX',
        TTL_SEC,
        'NX',
      );
      if (!reserved) {
        return next(
          AppError.conflict('Request in progress, retry shortly', 'IDEMPOTENCY_IN_FLIGHT'),
        );
      }

      // Wrap res.json so we capture and persist the response body.
      const origJson = res.json.bind(res);
      res.json = (body) => {
        const out = origJson(body);
        const status = res.statusCode;
        // Only persist 2xx responses — error responses should be retryable.
        if (status >= 200 && status < 300) {
          redis
            .set(
              cacheKey,
              JSON.stringify({
                status: 'completed',
                hash: reqHash,
                responseStatus: status,
                responseBody: body,
                completedAt: Date.now(),
              }),
              'EX',
              TTL_SEC,
            )
            .catch((err) => logger.warn('idempotency.persist_failed', { message: err.message }));
        } else {
          // Failed: free the key so the client can retry.
          redis
            .del(cacheKey)
            .catch((err) => logger.warn('idempotency.release_failed', { message: err.message }));
        }
        return out;
      };

      // Provide the key to handlers so they can also persist it on the order
      // row for the unique-index backstop.
      req.idempotencyKey = key;
      next();
    } catch (err) {
      // Cache failures must never block the request.
      logger.warn('idempotency.error', { message: err.message });
      req.idempotencyKey = key;
      next();
    }
  };
}
