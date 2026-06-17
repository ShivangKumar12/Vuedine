-- ============================================================
--  Phase E — Users admin, Roles & Permissions, Customers, Shifts
--
--  Adds: Role, Shift, CustomerProfile + CustomerTier enum.
--  Extends: User with Phase E columns.
--  New audit actions.
-- ============================================================

-- ---- AuditAction enum extensions ----
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_INVITED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_INVITE_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_PIN_RESET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_ROLE_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_TAGGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_PREFERENCES_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_ANONYMIZED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SHIFT_STARTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SHIFT_ENDED';

-- ---- Phase E enums ----
DO $$ BEGIN CREATE TYPE "CustomerTier" AS ENUM ('BRONZE','SILVER','GOLD','PLATINUM'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- Role ----
CREATE TABLE IF NOT EXISTS "roles" (
  "id"          TEXT PRIMARY KEY,
  "tenantId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "systemRole"  BOOLEAN NOT NULL DEFAULT false,
  "color"       TEXT NOT NULL DEFAULT 'from-violet-500 to-indigo-500',
  "members"     INTEGER NOT NULL DEFAULT 0,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt"   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_name_unique" ON "roles" ("tenantId", "name");
CREATE INDEX IF NOT EXISTS "roles_tenant_deletedAt_idx" ON "roles" ("tenantId", "deletedAt");

-- ---- Shift ----
CREATE TABLE IF NOT EXISTS "shifts" (
  "id"        TEXT PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  "branchId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endedAt"   TIMESTAMPTZ,
  "cashIn"    DECIMAL(12,2),
  "cashOut"   DECIMAL(12,2),
  "variance"  DECIMAL(12,2),
  "note"      TEXT,
  CONSTRAINT "shifts_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "shifts_user_startedAt_idx" ON "shifts" ("userId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "shifts_tenant_branch_startedAt_idx" ON "shifts" ("tenantId", "branchId", "startedAt" DESC);

-- ---- CustomerProfile ----
CREATE TABLE IF NOT EXISTS "customer_profiles" (
  "id"               TEXT PRIMARY KEY,
  "userId"           TEXT NOT NULL UNIQUE,
  "tenantId"         TEXT NOT NULL,
  "tier"             "CustomerTier" NOT NULL DEFAULT 'BRONZE',
  "totalSpend"       DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalOrders"      INTEGER NOT NULL DEFAULT 0,
  "lastOrderAt"      TIMESTAMPTZ,
  "birthday"         TIMESTAMPTZ,
  "city"             TEXT,
  "channels"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes"            TEXT,
  "loyaltyPoints"    INTEGER NOT NULL DEFAULT 0,
  "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
  "unsubscribedAt"   TIMESTAMPTZ,
  "anonymizedAt"     TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "customer_profiles_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "customer_profiles_tenant_tier_idx" ON "customer_profiles" ("tenantId", "tier");
CREATE INDEX IF NOT EXISTS "customer_profiles_tenant_spend_idx" ON "customer_profiles" ("tenantId", "totalSpend" DESC);
CREATE INDEX IF NOT EXISTS "customer_profiles_tenant_lastOrder_idx" ON "customer_profiles" ("tenantId", "lastOrderAt");
CREATE INDEX IF NOT EXISTS "customer_profiles_tenant_anonymized_idx" ON "customer_profiles" ("tenantId", "anonymizedAt");

-- ---- User column additions ----
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "salary"          DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "hourlyRate"      DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "invitedAt"       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "invitedBy"       TEXT,
  ADD COLUMN IF NOT EXISTS "inviteToken"     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastActiveAt"    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "customRoleId"    TEXT REFERENCES "roles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "pinHash"         TEXT;
