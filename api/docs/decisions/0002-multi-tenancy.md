# 0002 — Multi-tenancy strategy: shared schema with `tenantId` column

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Vuedine Engineering

## Context

Vuedine is a SaaS — every restaurant (tenant) shares the same database. We need to decide how tenant data is isolated. The three mainstream options are:

1. **Shared schema, shared tables** — every row carries a `tenant_id` column. Queries filter by it.
2. **Shared schema, separate tables per tenant** — `items_tenant1`, `items_tenant2`. Doesn't scale past dozens of tenants.
3. **Separate schema (or database) per tenant** — strongest isolation, hardest to operate.

## Decision

**Shared schema with `tenant_id` column** on every business table, enforced by:

- A composite index leading with `tenantId` on every queryable column combination.
- A `tenantId` field injected into `req` by the auth middleware (from the JWT `tid` claim).
- A `withTenantScope(tenantId)` repository helper used in every service to forbid forgetting the filter.
- An integration test that asserts cross-tenant data leakage is impossible for every public endpoint.

## Rationale

| Criterion               | Shared schema     | Separate schema | Separate DB                        |
| ----------------------- | ----------------- | --------------- | ---------------------------------- |
| Operational complexity  | Low               | Medium          | High                               |
| Per-tenant cost         | $0.0X             | $0.X            | $X+                                |
| Scaling to 10k+ tenants | Linear            | Painful         | Impossible without dedicated infra |
| Backup granularity      | Whole DB          | Per-schema dump | Per-tenant                         |
| Per-tenant migrations   | Single migration  | N migrations    | N migrations                       |
| Isolation strength      | Application-level | Schema-level    | Strongest                          |
| Onboarding latency      | Instant           | Schema creation | DB provisioning                    |

For a restaurant POS aiming to onboard tenants quickly and cheaply, shared schema is the only viable pick. Restaurant data is not regulated like healthcare (HIPAA) or finance (SOX) — strong logical isolation with audit trails is sufficient.

## Enforcement

1. **Every business model carries `tenantId`** (and most carry `branchId`).
2. **Every query goes through a repository** — no `prisma.x.findMany()` in services. Repositories accept `tenantId` as the first argument.
3. **Auth middleware (Phase 4)** sets `req.tenantId` from the JWT. Routes that don't need it are explicit (public health, login).
4. **RBAC `requireBranchAccess` middleware (Phase 4)** further restricts to branches the user can see.
5. **Integration test pattern (Phase 10):** for every list endpoint, create two tenants, hit the endpoint authed as tenant A, assert tenant B's data is invisible.
6. **Cache keys always include `tenantId`** (Phase 3). Without this, a cached response leaks across tenants — the single biggest cache bug class.

## Tradeoffs

- **Noisy neighbor risk:** a tenant running a heavy report can affect others. Mitigation: read replicas for reports (Phase 8), per-tenant rate limiting on expensive endpoints, query timeouts.
- **Per-tenant export/delete:** GDPR right-to-erasure becomes a multi-table soft-delete cascade rather than a `DROP SCHEMA`. Implemented as a background job in Phase 6.
- **Backup granularity:** per-tenant restore requires logical filtering during recovery. Acceptable tradeoff at our scale.

## Future migration path

If a tenant grows large enough or signs an enterprise contract demanding hard isolation, we can move them to a dedicated schema (or DB) without changing application code — the `tenantId` filter still works, the connection string just points to a different database. Documented in `docs/runbooks/tenant-extraction.md` (Phase 14).

## Consequences

- Schema design (Phase 2) puts `tenantId` first in every composite index.
- Soft-delete middleware (Phase 2) and query helpers (Phase 5) assume tenant scoping.
- Cache invalidation patterns (Phase 3) version-pointer per `${namespace}:${tenantId}`.
- Test factories (Phase 10) accept a `tenantId` argument and default to a fresh tenant per test suite.
