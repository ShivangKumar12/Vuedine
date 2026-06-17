# Changelog

All notable changes to the Vuedine API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## SemVer applied to a REST API

| Change                                                               | Bump  |
| -------------------------------------------------------------------- | ----- |
| Add a new endpoint or new optional field                             | MINOR |
| Bug fix that doesn't change the schema                               | PATCH |
| Add a required field, remove a field, change response shape or codes | MAJOR |
| Drop or rename an endpoint                                           | MAJOR |

A breaking change always lands as a new URL prefix (`/v2/...`). The old version
stays alive under `/v1/...` for at least **6 months** with a `Sunset: <date>`
response header. Customers get the deprecation in writing the day a new
version goes live.

## [Unreleased]

### Added

- Phase 13 — OpenAPI 3.0 spec served at `/docs` (Swagger UI) and `/docs.json`.
  In production the docs are gated to `SUPER_ADMIN`/`OWNER`/`ADMIN`.
- Phase 13 — `npm run docs:generate` produces `docs/openapi.json` and
  `docs/postman.json` from the JSDoc annotations on each route. CI diffs the
  committed files against the live spec to catch undocumented changes.

## [0.1.0] — 2026-06-09

Initial pre-release. Phases 0–12 of the BACKEND_PHASES.md roadmap landed.

### Added

- Express 4 + Helmet + CORS + compression + cookie-parser bootstrap (Phase 1)
- Postgres 16 + Prisma 6.19 with multi-tenant schema, soft delete, slow-query
  logging, and read-replica stub (Phase 2)
- Redis 7 with sliding-window rate limiting, version-pointer cache helper,
  pub/sub primitives, and IP allow/deny sets (Phase 3)
- JWT (15m) + opaque refresh-token rotation (7d) with reuse detection,
  bcrypt + brute-force lockout, RBAC (`requireRole`, `requireBranchAccess`),
  CSRF Origin guard on `/refresh`, force-revoke via Redis denylist, password
  reset via Redis TTL (Phase 4)
- Items module — controller → service → repository, partial unique index
  on `(tenantId, name) WHERE deletedAt IS NULL`, route-level + service-level
  caching that share one prefix (Phase 5)
- 5 BullMQ queues (email/notification/report/webhook/dlq) with isolated
  worker process and Bull Board dashboard (Phase 6)
- Winston structured logs with daily rotation, Prometheus metrics
  (`http_requests_total`, durations, cache hits/misses, queue depth, auth
  events, audit failures), Grafana provisioning, Sentry + OTel lazy
  stubs (Phase 7)
- PM2 cluster ecosystem (`.cjs`), Nginx config with WebSocket upgrade,
  Socket.io gateway with Redis adapter and JWT handshake, PgBouncer in prod
  compose (Phase 8)
- OWASP Top 10 mitigations, AES-256-GCM field encryption, vault-ready
  secrets source, API keys with argon2id hashing, route-security audit
  script, supply-chain gate (Phase 9)
- Jest + supertest test suite — 45 tests across unit + integration,
  factories, real Postgres + Redis, k6 load scripts (Phase 10)
- Multi-stage Docker image (~400MB total), full local compose stack,
  hot-reload override, prod compose with PgBouncer + Certbot (Phase 11)
- GitHub Actions: CI (lint + audit + test matrix + image push to GHCR),
  staging auto-deploy, production manual-approval deploy with auto-rollback,
  tag-driven release workflow, Renovate config (Phase 12)

### Security

- argon2id for API key hashes (memoryCost 19MiB, timeCost 2 — OWASP min)
- bcrypt cost 12 for user passwords
- All `$queryRawUnsafe` / `$executeRawUnsafe` blocked by ESLint rule
- HSTS + CSP enabled in production helmet config
- CORS origins must be HTTPS-only in production (zod refinement enforces)
