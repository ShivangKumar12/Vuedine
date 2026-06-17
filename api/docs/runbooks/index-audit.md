# Runbook — Database Index Audit

Run this monthly in staging against a prod-mirrored dataset. Captures slow
queries before they become customer pain.

## Why

Every endpoint serving > 1k req/day must run on a B-tree (or appropriate)
index — otherwise a sequential scan creeps in as table size grows, and one
day a list endpoint that was 5ms in dev is 800ms in prod with no code change.

Indexes are also costly: they slow writes, consume disk, and confuse the
planner if redundant. Auditing both directions matters.

## Checklist

### 1. Verify high-traffic queries are indexed

For every endpoint serving > 1k req/day:

- [ ] Capture the SQL Prisma generated (slow query log or `pg_stat_statements`)
- [ ] Run `EXPLAIN (ANALYZE, BUFFERS)` on it
- [ ] Reject `Seq Scan` on tables with > 10k rows
- [ ] Reject `Sort` rows with `Memory:` reported (means an `ORDER BY`-friendly
      index is missing)
- [ ] Reject `Rows Removed by Filter:` higher than rows returned (means the
      index doesn't cover the predicate)

### 2. Verify composite index ordering

Composite indexes are leftmost-prefixable. The most-selective column comes
first.

For Vuedine, the standard ordering is:

1. `tenantId` (always first — multi-tenant queries)
2. `branchId` (if relevant)
3. The high-cardinality filter column (e.g. `status`, `category`)
4. The sort column (e.g. `createdAt DESC`)

```sql
-- Good
CREATE INDEX idx_items_tenant_status_created
  ON items (tenant_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

-- Bad — leading column is too coarse to filter on
CREATE INDEX idx_items_status_tenant
  ON items (status, tenant_id);
```

### 3. Use partial indexes for soft-delete patterns

Every soft-deleted table benefits from `WHERE deletedAt IS NULL` partials.
The active set is what every read query actually touches.

```sql
CREATE INDEX idx_users_tenant_role_active
  ON users (tenant_id, role)
  WHERE deleted_at IS NULL;
```

Already applied:

- `items_tenantId_name_unique_active` (partial unique, Phase 5)

### 4. Drop unused indexes

Every index slows writes (Postgres maintains it on every INSERT/UPDATE).
Anything unused for 30 days is pure cost.

```sql
SELECT
  schemaname, relname, indexrelname,
  idx_scan, idx_tup_read, idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

Anything with `idx_scan = 0` after a week of full traffic is a candidate.
Verify the cluster has reset stats recently before pulling the trigger:

```sql
SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();
```

### 5. Review the top 20 queries by mean exec time

Requires `pg_stat_statements` (already enabled in `init.sql`).

```sql
SELECT
  substring(query, 1, 100) AS query,
  calls,
  mean_exec_time,
  total_exec_time,
  rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Anything > 50ms mean exec time deserves an EXPLAIN.

### 6. Reads against the read replica

Reports + analytics belong on the replica, not the primary.

- [ ] `/v1/reports/sales` uses `getReadClient()` from `db/prismaReplica.js`
- [ ] `/v1/transactions?range=...` (when added) uses the replica
- [ ] Operational reads (current orders, current cart) stay on the primary

## Production-critical: CONCURRENTLY

Always use `CREATE INDEX CONCURRENTLY` on prod. Plain `CREATE INDEX` takes
an `ACCESS EXCLUSIVE` lock, blocking all reads + writes on the table.

For Prisma migrations, generate raw SQL with:

```
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma \
                       --to-schema-datamodel    prisma/schema.prisma \
                       --script > migration.sql
```

then hand-edit to add `CONCURRENTLY` and apply via `prisma migrate deploy`.

## Done-when

- All endpoints serving > 1k req/day have `EXPLAIN ANALYZE` showing index hits
- No partial-style queries (e.g. `LIKE '%foo%'`) without `pg_trgm` GIN indexes
- Zero `idx_scan = 0` indexes that have been around > 30 days
- Findings logged in `docs/runbooks/index-audit-YYYY-MM-DD.md`
