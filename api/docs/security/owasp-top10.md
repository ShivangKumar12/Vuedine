# OWASP Top 10 (2021) — Vuedine API mitigation map

Last reviewed: 2026-06-09

This is the floor. Every feature added MUST be checked against this list
during code review. A control going green here doesn't mean the threat is
gone — it means we have one named defence between the threat and an incident.

## A01 — Broken Access Control

| Control                       | Where                                                            |
| ----------------------------- | ---------------------------------------------------------------- |
| Bearer JWT verification       | `src/middleware/auth.middleware.js`                              |
| Role-based access control     | `src/middleware/rbac.middleware.js` — `requireRole`              |
| Branch-scoped access          | `src/middleware/rbac.middleware.js` — `requireBranchAccess`      |
| Tenant scoping in every query | Repositories take `tenantId` from `req.user`, never from request |
| API-key scope check           | `requireScope` middleware (Phase 9)                              |
| Force-revoke (Redis denylist) | `auth.service.js` REVOKED_PREFIX                                 |
| Route audit script            | `npm run security:routes`                                        |

## A02 — Cryptographic Failures

| Control                                | Where                                       |
| -------------------------------------- | ------------------------------------------- |
| bcrypt cost 12 for user passwords      | `src/modules/auth/auth.service.js`          |
| argon2id for API key hashes            | `src/modules/apiKeys/apiKeys.service.js`    |
| SHA-256 of refresh tokens stored only  | `src/modules/auth/tokens.js`                |
| JWT secrets ≥32 chars enforced at boot | `src/config/env.js`                         |
| TLS 1.2+ at edge                       | Nginx (`docker/nginx/default.conf`)         |
| HSTS with preload in prod              | helmet config (`src/app.js`)                |
| Field-level AES-256-GCM                | `src/utils/crypto.js` — see `encryption.md` |

## A03 — Injection

| Control                                         | Where                                   |
| ----------------------------------------------- | --------------------------------------- |
| All DB calls through Prisma (parameterized)     | `src/db/prisma.js`                      |
| `$queryRawUnsafe` / `$executeRawUnsafe` blocked | ESLint `no-restricted-properties`       |
| zod input validation on every route             | `validate()` middleware                 |
| Strip `$` and prototype-pollution keys          | `src/middleware/security.middleware.js` |
| HTTP Parameter Pollution blocked                | `hpp()` in security middleware          |

## A04 — Insecure Design

Ongoing. Threat-model every feature during design review. Defense in depth:
helmet headers + Nginx headers (double-set), tenant scope at controller
**and** repository, RBAC on roles **and** scopes for API keys.

## A05 — Security Misconfiguration

| Control                          | Where                                    |
| -------------------------------- | ---------------------------------------- |
| `x-powered-by` removed           | `app.disable('x-powered-by')`            |
| CORS strict whitelist            | `src/app.js` cors config                 |
| `/metrics` gated                 | Bearer or SUPER_ADMIN/OWNER JWT          |
| `/queues` (Bull Board) gated     | basic auth gate                          |
| `audit-ci` blocks high+ vulns    | CI step                                  |
| `npm ci` not `npm install` in CI | (see CI workflow when wired in Phase 12) |

## A06 — Vulnerable & Outdated Components

| Control                            | Where                   |
| ---------------------------------- | ----------------------- |
| `audit-ci.json` with `high: true`  | `audit-ci.json`         |
| `npm audit` in CI                  | `npm run audit`         |
| Renovate config (planned Phase 12) | `.github/renovate.json` |
| package-lock.json committed        | repo root               |

Allowlisted advisories (review quarterly):

- **GHSA-58qx-3vcg-4xpx** — `ws` v8.0.0–8.20.0 transitive via `pm2`. Fix is a
  major pm2 downgrade. ws is only used by pm2's internal IPC, not by our
  request path. Re-evaluate whenever pm2 publishes a fix.
- **GHSA-r5fr-rjxr-66jc** — `lodash` Prototype Pollution / Code Injection
  transitive via `openapi-to-postmanv2`. Build-time-only tool; runs against
  our own committed `docs/openapi.json`, not user input. The exploit
  requires attacker-controlled YAML which we never feed it. Re-evaluate
  when openapi-to-postmanv2 publishes a fix.

## A07 — Identification & Authentication Failures

| Control                               | Where                  |
| ------------------------------------- | ---------------------- |
| Refresh token rotation + reuse detect | `auth.service.js`      |
| Brute force lockout (8 fails / 15min) | `auth.service.js`      |
| Password reset TTL                    | Redis TTL              |
| Login rate limit                      | `loginRateLimit`       |
| Session denylist on revoke            | Redis `REVOKED_PREFIX` |
| OAuth providers feature-flagged       | `env.FEATURE_OAUTH_*`  |

## A08 — Software & Data Integrity Failures

| Control                           | Where                              |
| --------------------------------- | ---------------------------------- |
| Locked `package-lock.json`        | repo root                          |
| `npm ci` in CI                    | (Phase 12)                         |
| Container image signing (planned) | (Phase 14)                         |
| Audit log append-only             | `AuditLog` table — no UPDATE / DEL |

## A09 — Security Logging & Monitoring Failures

| Control                           | Where                         |
| --------------------------------- | ----------------------------- |
| Structured winston logs           | `src/config/logger.js`        |
| Audit log table                   | `AuditLog`                    |
| `audit_failures_total` Prometheus | alert if > 0                  |
| `auth_events_total` Prometheus    | alert on token reuse spikes   |
| Sentry for exceptions             | `src/observability/sentry.js` |
| Daily-rotate file logs            | `winston-daily-rotate-file`   |

## A10 — Server-Side Request Forgery

| Control                                  | Where                              |
| ---------------------------------------- | ---------------------------------- |
| Outbound URL allowlist (per integration) | required for any new SSRF surface  |
| No user-supplied URL fetches             | review checklist in code review    |
| DNS rebinding guard                      | required for any URL-fetch feature |

When a feature lands that fetches user-supplied URLs (webhook receivers
testing endpoints, image-by-URL upload), wire it through a single helper
that:

1. Resolves DNS once
2. Rejects RFC 1918 / loopback / link-local addresses
3. Pins the resolved IP for the actual fetch
4. Caps response size + timeout

That helper is not yet written — first feature to need it adds it under
`src/utils/safeFetch.js`.

## Penetration test cadence

- Initial pen test: **within 90 days of launch**.
- Annual external test thereafter.
- Quarterly internal `security:routes` audit + dependency review.

## See also

- `docs/security/encryption.md` — field-level encryption details
- `docs/security/api-keys.md` — API key lifecycle
- `BACKEND_PHASES.md` — full security phase context
