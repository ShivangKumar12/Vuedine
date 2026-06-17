import IORedis from 'ioredis';

/**
 * Test Redis lifecycle.
 *
 * Integration tests use a real Redis (the dev container, DB 15) so behaviour
 * matches prod for things rate-limiter-flexible / BullMQ depend on (Lua
 * scripts, eviction). Unit tests that genuinely need isolation can mock
 * `src/db/redis.js` with `ioredis-mock`.
 *
 * We FLUSHDB between tests, not FLUSHALL — only DB 15 is cleared.
 */

let redis = null;

export function getTestRedis() {
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6381/15', {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }
  return redis;
}

export async function resetTestRedis() {
  await getTestRedis().flushdb();
}

export async function teardownTestRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
