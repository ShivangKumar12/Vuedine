-- Phase F — Tenant settings, Taxes, Branding, Hardware
-- Hand-written migration (prisma migrate dev hangs on PowerShell; apply with migrate deploy).

-- ----------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------
CREATE TYPE "WeekStart" AS ENUM ('MONDAY', 'SUNDAY', 'SATURDAY');

CREATE TYPE "HardwareType" AS ENUM (
  'RECEIPT_PRINTER', 'KOT_PRINTER', 'KDS_DISPLAY', 'OSS_DISPLAY',
  'CASH_DRAWER', 'CUSTOMER_DISPLAY', 'WEIGHING_SCALE'
);

-- New audit actions
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAX_SLAB_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAX_SLAB_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAX_SLAB_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_METHOD_CONFIG_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HARDWARE_DEVICE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HARDWARE_DEVICE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HARDWARE_DEVICE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HARDWARE_DEVICE_PAIRED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'NOTIFICATION_PREFS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TENANT_DATA_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TENANT_ANONYMIZED';

-- ----------------------------------------------------------------
-- Tenant extensions
-- ----------------------------------------------------------------
ALTER TABLE "tenants"
  ADD COLUMN "gstin"           TEXT,
  ADD COLUMN "pan"             TEXT,
  ADD COLUMN "fssai"           TEXT,
  ADD COLUMN "description"     TEXT,
  ADD COLUMN "logoUrl"         TEXT,
  ADD COLUMN "bannerUrl"       TEXT,
  ADD COLUMN "contactEmail"    TEXT,
  ADD COLUMN "contactPhone"    TEXT,
  ADD COLUMN "brandColor"      TEXT NOT NULL DEFAULT '#EC1B7C',
  ADD COLUMN "brandTheme"      TEXT NOT NULL DEFAULT 'light',
  ADD COLUMN "customDomain"    TEXT,
  ADD COLUMN "invoicePrefix"   TEXT NOT NULL DEFAULT 'INV',
  ADD COLUMN "invoiceSequence" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "numberLocale"    TEXT NOT NULL DEFAULT 'en-IN',
  ADD COLUMN "weekStart"       "WeekStart" NOT NULL DEFAULT 'MONDAY',
  ADD COLUMN "weightUnit"      TEXT NOT NULL DEFAULT 'g',
  ADD COLUMN "demoMode"        BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "tenants_customDomain_key" ON "tenants"("customDomain");

-- ----------------------------------------------------------------
-- tax_slabs
-- ----------------------------------------------------------------
CREATE TABLE "tax_slabs" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "branchId"  TEXT,
  "name"      TEXT NOT NULL,
  "rate"      DECIMAL(5,2) NOT NULL,
  "hsnCodes"  TEXT[] DEFAULT ARRAY[]::TEXT[],
  "inclusive" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "tax_slabs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tax_slabs_tenantId_branchId_idx" ON "tax_slabs"("tenantId", "branchId");

-- ----------------------------------------------------------------
-- payment_method_configs
-- ----------------------------------------------------------------
CREATE TABLE "payment_method_configs" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "branchId"      TEXT,
  "method"        "PaymentMethod" NOT NULL,
  "enabled"       BOOLEAN NOT NULL DEFAULT true,
  "preferred"     BOOLEAN NOT NULL DEFAULT false,
  "serviceCharge" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "meta"          JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_method_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_method_configs_tenantId_branchId_method_key"
  ON "payment_method_configs"("tenantId", "branchId", "method");

-- ----------------------------------------------------------------
-- hardware_devices
-- ----------------------------------------------------------------
CREATE TABLE "hardware_devices" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "branchId"     TEXT NOT NULL,
  "type"         "HardwareType" NOT NULL,
  "label"        TEXT NOT NULL,
  "model"        TEXT,
  "ip"           TEXT,
  "macAddress"   TEXT,
  "station"      "OrderStation",
  "pairedAt"     TIMESTAMP(3),
  "lastSeenAt"   TIMESTAMP(3),
  "pairingToken" TEXT NOT NULL,
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "deletedAt"    TIMESTAMP(3),
  CONSTRAINT "hardware_devices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hardware_devices_pairingToken_key" ON "hardware_devices"("pairingToken");
CREATE INDEX "hardware_devices_tenantId_branchId_type_idx" ON "hardware_devices"("tenantId", "branchId", "type");

-- ----------------------------------------------------------------
-- notification_preferences
-- ----------------------------------------------------------------
CREATE TABLE "notification_preferences" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "branchId"  TEXT,
  "userId"    TEXT,
  "event"     TEXT NOT NULL,
  "channel"   TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "notification_preferences_tenantId_branchId_userId_event_chan_key"
  ON "notification_preferences"("tenantId", "branchId", "userId", "event", "channel");
