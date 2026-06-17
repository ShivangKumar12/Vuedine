import { logger } from '../config/logger.js';
import { redis } from '../db/redis.js';
import { cacheHits, cacheMisses } from '../observability/metrics.js';

/**
 * Cache-aside (lazy-loading) pattern:
 *
 *   1. Try cache; on hit, return.
 *   2. On miss, run loader, write result, return.
 *   3. On cache error, fall through to loader (NEVER break the app for cache).
 *
 * Version-pointer invalidation:
 *   Bumping `cache:meta:<prefix>` by 1 invalidates every key sharing that
 *   prefix in O(1), without `SCAN` + `DEL`. Keys carry the version number in
 *   their name (`cache:v3:items:tenant-abc:...`), so a bump simply makes the
 *   old keys unreachable. They expire naturally via TTL.
 */

/** Try cache, return parsed value or null. Swallows errors. */
async function safeGet(fullKey) {
  try {
    const raw = await redis.get(fullKey);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn('cache.get_failed', { key: fullKey, message: err.message });
    return null;
  }
}

async function safeSet(fullKey, value, ttlSec) {
  try {
    await redis.set(fullKey, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    logger.warn('cache.set_failed', { key: fullKey, message: err.message });
  }
}

async function safeDel(fullKey) {
  try {
    await redis.del(fullKey);
  } catch (err) {
    logger.warn('cache.del_failed', { key: fullKey, message: err.message });
  }
}

/**
 * Read the current version pointer for a prefix. Default 1 if not set.
 * Use this with `cached({ key, version })` to enable instant invalidation
 * via `bumpVersion(prefix)`.
 */
export async function getVersion(prefix) {
  try {
    const v = await redis.get(`cache:meta:${prefix}`);
    return v ? parseInt(v, 10) : 1;
  } catch (err) {
    logger.warn('cache.version_read_failed', { prefix, message: err.message });
    return 1;
  }
}

/**
 * Atomically bump the version for a prefix → all existing cache entries
 * tagged with the old version become unreachable, expire by TTL.
 *
 * If the version was unset, this initializes it to 2 (so the bump always
 * yields a different number from the initial default of 1).
 */
export async function bumpVersion(prefix) {
  const key = `cache:meta:${prefix}`;
  try {
    const next = await redis.incr(key);
    // First bump on an unset key returns 1 — same as the default. Skip ahead.
    if (next === 1) {
      await redis.set(key, '2');
      return 2;
    }
    return next;
  } catch (err) {
    logger.warn('cache.version_bump_failed', { prefix, message: err.message });
    return null;
  }
}

/**
 * Low-level handle for an explicit key.
 *
 *   const c = cached({ key: `items:${tenantId}:${page}`, ttlSec: 60, version: 3 });
 *   await c.get();   await c.set(value);   await c.del();
 */
export function cached({ key, ttlSec = 60, version = 1 }) {
  const fullKey = `cache:v${version}:${key}`;
  return {
    get: () => safeGet(fullKey),
    set: (value) => safeSet(fullKey, value, ttlSec),
    del: () => safeDel(fullKey),
    fullKey,
  };
}

/**
 * High-level: wrap an async loader with cache-aside.
 *
 *   const items = await withCache(
 *     { key: `items:${tenantId}:${page}`, ttlSec: 300, prefix: 'items' },
 *     () => itemsRepo.list({ tenantId, page }),
 *   );
 *
 * If `prefix` is provided, the current version pointer is fetched and baked
 * into the cache key — so `bumpVersion(prefix)` invalidates all of it instantly.
 */
export async function withCache(opts, loader) {
  const { key, ttlSec = 60, prefix } = opts;
  const version = prefix ? await getVersion(prefix) : 1;
  const c = cached({ key, ttlSec, version });

  const hit = await c.get();
  if (hit !== null && hit !== undefined) {
    cacheHits.labels('service').inc();
    return hit;
  }
  cacheMisses.labels('service').inc();

  const fresh = await loader();
  if (fresh !== undefined && fresh !== null) await c.set(fresh);
  return fresh;
}
