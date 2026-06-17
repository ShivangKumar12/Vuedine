import IORedis from 'ioredis';

import { env } from '../config/index.js';

/**
 * Build a Redis connection configured for BullMQ.
 *
 * Important settings (different from the cache client in src/db/redis.js):
 *   - `maxRetriesPerRequest: null` — required by BullMQ. Without it, blocking
 *     commands like BRPOPLPUSH will return early and break worker semantics.
 *   - `enableReadyCheck: false` — also BullMQ requirement.
 *   - NO `keyPrefix` — BullMQ rejects it; use the `prefix` option on Queue /
 *     Worker / QueueEvents instead (see `bullPrefix` below).
 *
 * BullMQ uses one connection per Queue / Worker / QueueEvents instance. Each
 * call to this builder returns a NEW client — never share one across them.
 */
export function buildBullConnection() {
  return new IORedis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Namespace for BullMQ keys. Strips trailing colon from REDIS_KEY_PREFIX
 * so we land on `vuedine:bull` rather than `vuedine::bull`.
 *
 * Using a `bull` segment under the app's prefix keeps queue keys obviously
 * separate from cache keys in `redis-cli KEYS`.
 */
export const bullPrefix = `${env.REDIS_KEY_PREFIX.replace(/:$/, '')}:bull`;
