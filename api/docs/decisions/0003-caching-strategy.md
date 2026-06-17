# 0003 — Caching Strategy

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Vuedine Engineering

## Context

We have two cache layers (Phase 3 + Phase 5):

- **Service-level cache** — `withCache({ key, ttl, prefix }, loader)` wraps an
  expensive query. Used by `itemsService.list` and any future service that
  reads from Postgres for a hot endpoint.
- **Route-level cache** — `cacheRoute({ ttl, prefix, keyFn })` middleware
  caches the entire HTTP response (status + body) for a given URL.

Both share Redis and the same version-pointer invalidation primitive
(`bumpVersion(prefix)` in `src/utils/cache.js`). A single bump invalidates
every key tagged with the old version in O(1) — without `SCAN`+`DEL`.

## Decision

The matrix below is the source of truth for what we cache, where, and for
how long. **Don't add caches without updating it.** Cache bugs that leak data
across tenants are the single highest-severity bug class we have.

| Data                                    | Layer             | TTL          | Invalidation                                           | Rationale                                                            |
| --------------------------------------- | ----------------- | ------------ | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Menu items list per tenant              | service + route   | 60s          | bump on create/update/delete                           | Hot read, low write — frontend hits it on every dashboard navigation |
| Menu items detail (`/items/:id`)        | none              | n/a          | n/a                                                    | Single-row lookup is sub-ms; cache key explosion not worth it        |
| Tenant config (taxes, currency, locale) | service           | 1h           | explicit on settings save                              | Read on every order; almost never changes                            |
| Branch metadata                         | service           | 1h           | explicit on settings save                              | Same                                                                 |
| User permissions / role lookup          | service           | 5m           | bump on role change + Redis denylist for instant kicks | 5m staleness is OK; force-revoke is the immediate-kick path          |
| Live orders / KDS tickets               | **never**         | —            | —                                                      | Realtime; uses pub/sub instead (Phase 8 socket.io)                   |
| Sales report (last 30d)                 | service           | 10m          | bump on day rollover                                   | Slow to compute, cache pays for itself                               |
| Subscription plans (marketing)          | service           | 24h          | manual via admin dashboard                             | Rarely changes                                                       |
| Search results (item search by name)    | service           | 60s          | implicit (TTL only)                                    | Fuzzy search is expensive; small staleness is fine                   |
| Receipt / order detail                  | none              | —            | —                                                      | Per-order, single read, no benefit                                   |
| OAuth state                             | Redis (NOT cache) | 10m          | one-shot delete after callback                         | Security state, not cache                                            |
| Password reset token                    | Redis (NOT cache) | TTL from env | one-shot delete on use                                 | Same                                                                 |

## Cache key conventions

Every cache key MUST include `tenantId`. Keys for personalized data MUST
include `userId`. Failing this is the biggest cause of cross-tenant leaks.

```
service:items:<tenantId>:<page>:<pageSize>:<filters>
route:items:<tenantId>:<userId>:<URL>
cache:meta:items                       ← version pointer (Phase 3)
auth:revoked:<userId>                  ← force-revoke marker (Phase 4)
pwreset:<sha256(token)>                ← password reset (Phase 4)
rl:global:<ip>                         ← rate limiter (Phase 3)
rl:login:<ip>:<email>                  ← login limiter (Phase 4)
rl:user:u:<userId>                     ← per-user limiter (Phase 3)
rl:whitelist                           ← Redis SET (Phase 3)
rl:blacklist                           ← Redis SET (Phase 3)
```

## Anti-patterns to avoid

1. **Caching authenticated responses without user/tenant in the key.**
   Leaks user A's data to user B. The current `cacheRoute` default keyFn
   includes both, but custom `keyFn` overrides bypass that protection — they
   must explicitly include `req.tenantId` and `req.user.id`.

2. **Adding a cache without an invalidation plan.** Mutations must call
   `bumpVersion('<prefix>')` explicitly. Otherwise the cache becomes a slow,
   silent source of incorrect responses.

3. **Caching realtime data.** Order lists, KDS tickets, table state — these
   are pub/sub territory. A cache hit serving 30s-old order data is worse
   than no cache at all.

4. **Choosing TTL > 1h without manual invalidation.** Even "rarely changes"
   data needs a kill switch. Either a `bumpVersion` on the matching write
   path, or a documented `redis-cli DEL cache:meta:<prefix>` runbook entry.

5. **Caching anything containing PII without thinking about GDPR.** A
   subject's right to erasure must extend to caches. Document any new cache
   that holds personal data.

## Cache hit-ratio observability

Phase 7 wires `cache_hits_total` and `cache_misses_total` per layer. The
target hit ratio for items list is **>= 70%** in steady state. A sustained
drop below that means either:

- A service deploy bumped the version (transient — recovers in 1 minute)
- The cache TTL is too short for the load pattern
- Bugs causing every request to use a unique cache key

Monitor via:

```promql
sum(rate(cache_hits_total[5m]))
  / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

Alert at < 50% for 30 minutes.
