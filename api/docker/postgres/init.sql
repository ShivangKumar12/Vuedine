-- ============================================================
--  Vuedine Postgres bootstrap
--  Runs once when the postgres data volume is empty.
--  Enables extensions every tenant relies on.
-- ============================================================

-- Cryptographic helpers (gen_random_uuid, digest, ...)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Case-insensitive text type for emails / usernames.
CREATE EXTENSION IF NOT EXISTS "citext";

-- Trigram indexes for fuzzy item / customer search.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- GIN composite indexes (used for jsonb columns later).
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Useful for slow-query analysis in production.
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
