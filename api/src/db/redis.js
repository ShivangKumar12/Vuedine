import IORedis from 'ioredis';

import { config, env } from '../config/index.js';
import { logger } from '../config/logger.js';

/**
 * Main Redis client — used for cache + rate limiting.
 *
 * NOT shared with:
 *   - BullMQ (Phase 6) — needs `maxRetriesPerRequest: null` to survive blips
 *   - Pub/Sub (this file's `pubsub.js` sibling) — subscriber-mode connections
 *     can only run subscribe/unsubscribe commands
 *
 * Retry strategy: exponential backoff capped at 5s. ioredis retries internally
 * on transient errors; we just emit log lines so we know what's going on.
 */

function buildRedis() {
  const r = new IORedis(env.REDIS_URL, {
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS ? {} : undefined,
    keyPrefix: env.REDIS_KEY_PREFIX,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times) => {
      const delay = Math.min(times * 200, 5_000);
      logger.warn('redis.retry', { attempt: times, delayMs: delay });
      return delay;
    },
    reconnectOnError: (err) => {
      // READONLY error indicates a failover from primary to replica → reconnect.
      if (err.message.includes('READONLY')) return true;
      return false;
    },
    lazyConnect: false,
  });

  r.on('connect', () => logger.info('redis.connected'));
  r.on('ready', () => logger.info('redis.ready'));
  r.on('error', (err) =>
    logger.error('redis.error', { message: err?.message ?? err?.code ?? String(err) }),
  );
  r.on('end', () => logger.warn('redis.end'));
  r.on('reconnecting', (delayMs) => logger.warn('redis.reconnecting', { delayMs }));

  return r;
}

const globalForRedis = globalThis;
export const redis = globalForRedis.__vuedineRedis ?? buildRedis();
if (!config.isProd) globalForRedis.__vuedineRedis = redis;

/** Health probe — fast PING with a short deadline. */
export async function pingRedis() {
  const pong = await redis.ping();
  return pong === 'PONG';
}

/** Graceful shutdown helper. Called from server.js on SIGTERM. */
export async function disconnectRedis() {
  // `quit` waits for pending commands; `disconnect` is force.
  try {
    await redis.quit();
  } catch (err) {
    logger.warn('redis.quit_failed', { message: err.message });
    redis.disconnect();
  }
}
