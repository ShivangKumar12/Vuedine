import { RateLimiterRedis } from 'rate-limiter-flexible';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';
import { redis } from '../db/redis.js';
import { AppError } from '../utils/AppError.js';

/**
 * Sliding-window rate limiting backed by Redis.
 *
 * Why sliding window over fixed window:
 *   Fixed windows let an attacker burst at the boundary — e.g. 60 requests
 *   in the last second of one window plus 60 in the first second of the next
 *   = 120 in 2 seconds against a "60/minute" limit. Sliding window keeps a
 *   rolling count over the configured period.
 *
 * `rate-limiter-flexible` implements it efficiently with a single Redis
 * round-trip per check using a Lua script. `inMemoryBlockOnConsumed` keeps
 * already-blocked IPs from hitting Redis again — meaningful under DoS.
 */

/* ---------- Whitelist / blacklist (admin-managed via /v1/admin/ip) ---------- */

const WHITELIST_KEY = 'rl:whitelist';
const BLACKLIST_KEY = 'rl:blacklist';

export const ipAccess = {
  async allow(ip) {
    return redis.sadd(WHITELIST_KEY, ip);
  },
  async block(ip) {
    return redis.sadd(BLACKLIST_KEY, ip);
  },
  async unblock(ip) {
    return redis.srem(BLACKLIST_KEY, ip);
  },
  async unallow(ip) {
    return redis.srem(WHITELIST_KEY, ip);
  },
  async isAllowed(ip) {
    return (await redis.sismember(WHITELIST_KEY, ip)) === 1;
  },
  async isBlocked(ip) {
    return (await redis.sismember(BLACKLIST_KEY, ip)) === 1;
  },
  async listAllowed() {
    return redis.smembers(WHITELIST_KEY);
  },
  async listBlocked() {
    return redis.smembers(BLACKLIST_KEY);
  },
};

/* ---------- Limiter factory ---------- */

function makeLimiter({ keyPrefix, points, durationSec, blockDurationSec = 0 }) {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix,
    points,
    duration: durationSec,
    blockDuration: blockDurationSec,
    execEvenly: false,
    inMemoryBlockOnConsumed: points + 1, // hot-key protection
    inMemoryBlockDuration: durationSec,
  });
}

/* ---------- Pre-baked limiters ---------- */

const globalLimiter = makeLimiter({
  keyPrefix: 'rl:global',
  points: env.RATE_LIMIT_GLOBAL_MAX,
  durationSec: Math.ceil(env.RATE_LIMIT_GLOBAL_WINDOW_MS / 1000),
});

const loginLimiter = makeLimiter({
  keyPrefix: 'rl:login',
  points: env.RATE_LIMIT_LOGIN_MAX,
  durationSec: Math.ceil(env.RATE_LIMIT_LOGIN_WINDOW_MS / 1000),
  blockDurationSec: 900, // lock the offender out for 15 min after exhaustion
});

const userLimiter = makeLimiter({
  keyPrefix: 'rl:user',
  points: 600,
  durationSec: 60,
});

// Per-IP scan limiter (Phase G pitfall #3): prevents inflated QR metrics.
const scanLimiter = makeLimiter({
  keyPrefix: 'rl:scan',
  points: 30,
  durationSec: 60,
});

/* ---------- Headers ---------- */

function attachHeaders(res, rlRes, limit) {
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rlRes.remainingPoints)));
  res.setHeader(
    'X-RateLimit-Reset',
    String(Math.ceil(Date.now() / 1000 + rlRes.msBeforeNext / 1000)),
  );
}

/* ---------- Middleware factory ---------- */

function build(limiter, keyFn, limit, label) {
  return async function rateLimitMiddleware(req, res, next) {
    try {
      const ip = req.ip;

      if (await ipAccess.isBlocked(ip)) {
        return next(AppError.forbidden('IP blocked', 'IP_BLOCKED'));
      }
      if (await ipAccess.isAllowed(ip)) return next();

      const key = keyFn(req);
      if (!key) return next();

      const rlRes = await limiter.consume(key);
      attachHeaders(res, rlRes, limit);
      next();
    } catch (err) {
      // Library rejects with the result object on rate-limit; objects have msBeforeNext.
      if (err && typeof err.msBeforeNext === 'number') {
        attachHeaders(res, err, limit);
        res.setHeader('Retry-After', String(Math.ceil(err.msBeforeNext / 1000)));
        return next(AppError.tooMany('Too many requests, please slow down', 'RATE_LIMITED'));
      }

      // Operational error (e.g. Redis down) → fail open with a warning.
      // Better to allow the request through than 503 the whole API on a Redis blip.
      logger.warn('rate_limit.error', { label, message: err?.message ?? String(err) });
      next();
    }
  };
}

export const globalRateLimit = build(
  globalLimiter,
  (req) => req.ip,
  env.RATE_LIMIT_GLOBAL_MAX,
  'global',
);

export const loginRateLimit = build(
  loginLimiter,
  (req) => `${req.ip}:${(req.body?.email ?? '').toString().toLowerCase().slice(0, 100)}`,
  env.RATE_LIMIT_LOGIN_MAX,
  'login',
);

export const userRateLimit = build(
  userLimiter,
  (req) => (req.user ? `u:${req.user.id}` : null),
  600,
  'user',
);

export const scanRateLimit = build(
  scanLimiter,
  (req) => `scan:${req.ip}`,
  30,
  'scan',
);
