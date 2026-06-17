-- ============================================================
--  Phase A — Branches extended + Tables introduced.
--
--  Steps:
--    1. Add new nullable Branch columns + audit enum values.
--    2. Backfill qrSlug for existing branches (slugify(name)).
--    3. Set qrSlug NOT NULL + UNIQUE.
--    4. Create TableShape / TableStatus enums + tables table.
-- ============================================================

-- ---- AuditAction enum extensions ----
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BRANCH_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BRANCH_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BRANCH_TOGGLED_LIVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_QR_REGENERATED';

-- ---- Branch column additions ----
ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "email"          TEXT,
  ADD COLUMN IF NOT EXISTS "manager"        TEXT,
  ADD COLUMN IF NOT EXISTS "timezoneCode"   TEXT,
  ADD COLUMN IF NOT EXISTS "defaultPrep"    INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "serviceCharge"  DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxInclusive"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "diningSections" TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS "qrSlug"         TEXT;

-- Backfill qrSlug for existing rows: lower-case + dash + suffix to guarantee uniqueness.
UPDATE "branches"
SET "qrSlug" = COALESCE(
  "qrSlug",
  regexp_replace(lower(replace("name", '·', '-')), '[^a-z0-9]+', '-', 'g')
    || '-' || substring(id, 1, 6)
)
WHERE "qrSlug" IS NULL;

ALTER TABLE "branches"
  ALTER COLUMN "qrSlug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "branches_qrSlug_key" ON "branches" ("qrSlug");

-- ---- Table shape + status enums ----
DO $$ BEGIN
  CREATE TYPE "TableShape" AS ENUM ('round', 'square', 'rect');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TableStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'BILL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- Tables table ----
CREATE TABLE IF NOT EXISTS "tables" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "branchId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "section"   TEXT NOT NULL,
  "capacity"  INTEGER NOT NULL DEFAULT 4,
  "shape"     "TableShape" NOT NULL DEFAULT 'round',
  "status"    "TableStatus" NOT NULL DEFAULT 'FREE',
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "qrToken"   TEXT NOT NULL,
  "posLabel"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "tables_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tables_qrToken_key"        ON "tables" ("qrToken");
CREATE UNIQUE INDEX IF NOT EXISTS "tables_branchId_name_key"  ON "tables" ("branchId", "name");
CREATE INDEX IF NOT EXISTS "tables_tenantId_branchId_deletedAt_idx" ON "tables" ("tenantId", "branchId", "deletedAt");
CREATE INDEX IF NOT EXISTS "tables_tenantId_branchId_status_idx"    ON "tables" ("tenantId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "tables_qrToken_idx"               ON "tables" ("qrToken");

ALTER TABLE "tables"
  ADD CONSTRAINT "tables_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
