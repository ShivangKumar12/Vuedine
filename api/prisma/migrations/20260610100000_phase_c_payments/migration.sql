-- ============================================================
--  Phase C — Payments, Refunds, Settlements, PaymentSettings.
-- ============================================================

-- ---- AuditAction enum extensions ----
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_COMP';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_TIP';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SETTLEMENT_SYNCED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_SETTINGS_UPDATED';

-- ---- Phase C enums ----
DO $$ BEGIN CREATE TYPE "PaymentType" AS ENUM ('SALE', 'REFUND', 'TIP', 'COMP', 'SETTLEMENT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'LOYALTY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentTxStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- Payment ----
CREATE TABLE IF NOT EXISTS "payments" (
  "id"              TEXT PRIMARY KEY,
  "tenantId"        TEXT NOT NULL,
  "branchId"        TEXT NOT NULL,
  "orderId"         TEXT,
  "serial"          TEXT NOT NULL,
  "type"            "PaymentType" NOT NULL,
  "method"          "PaymentMethod" NOT NULL,
  "status"          "PaymentTxStatus" NOT NULL DEFAULT 'PENDING',
  "amount"          DECIMAL(12,2) NOT NULL,
  "fee"             DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency"        TEXT NOT NULL DEFAULT 'INR',
  "cashierId"       TEXT,
  "cashierName"     TEXT,
  "customerName"    TEXT,
  "reference"       TEXT,
  "gateway"         TEXT,
  "gatewayMeta"     JSONB,
  "channel"         TEXT,
  "parentPaymentId" TEXT,
  "webhookEventId"  TEXT,
  "capturedAt"      TIMESTAMPTZ,
  "failedReason"    TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt"       TIMESTAMPTZ,
  CONSTRAINT "payments_parent_fkey"
    FOREIGN KEY ("parentPaymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "payments_order_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_branch_serial_unique"
  ON "payments" ("branchId", "serial");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_gateway_webhook_unique"
  ON "payments" ("gateway", "webhookEventId")
  WHERE "webhookEventId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "payments_tenant_branch_type_status_idx"
  ON "payments" ("tenantId", "branchId", "type", "status");
CREATE INDEX IF NOT EXISTS "payments_tenant_branch_createdAt_idx"
  ON "payments" ("tenantId", "branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "payments_orderId_idx" ON "payments" ("orderId");
CREATE INDEX IF NOT EXISTS "payments_reference_idx" ON "payments" ("reference");

-- ---- Settlement ----
CREATE TABLE IF NOT EXISTS "settlements" (
  "id"             TEXT PRIMARY KEY,
  "tenantId"       TEXT NOT NULL,
  "gateway"        TEXT NOT NULL,
  "reference"      TEXT NOT NULL,
  "grossAmount"    DECIMAL(12,2) NOT NULL,
  "feeAmount"      DECIMAL(12,2) NOT NULL,
  "netAmount"      DECIMAL(12,2) NOT NULL,
  "paymentCount"   INTEGER NOT NULL DEFAULT 0,
  "settledAt"      TIMESTAMPTZ NOT NULL,
  "bankReference"  TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "settlements_gateway_reference_unique"
  ON "settlements" ("gateway", "reference");
CREATE INDEX IF NOT EXISTS "settlements_tenant_settledAt_idx"
  ON "settlements" ("tenantId", "settledAt");

-- ---- PaymentSettings ----
CREATE TABLE IF NOT EXISTS "payment_settings" (
  "id"                   TEXT PRIMARY KEY,
  "tenantId"             TEXT NOT NULL UNIQUE,
  "cashEnabled"          BOOLEAN NOT NULL DEFAULT true,
  "cardEnabled"          BOOLEAN NOT NULL DEFAULT true,
  "upiEnabled"           BOOLEAN NOT NULL DEFAULT true,
  "walletEnabled"        BOOLEAN NOT NULL DEFAULT true,
  "onlineEnabled"        BOOLEAN NOT NULL DEFAULT true,
  "loyaltyEnabled"       BOOLEAN NOT NULL DEFAULT true,
  "payOnDeliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "gateway"              TEXT NOT NULL DEFAULT 'razorpay',
  "razorpayKeyId"        TEXT,
  "razorpayKeySecret"    TEXT,
  "webhookSecret"        TEXT,
  "autoCapture"          BOOLEAN NOT NULL DEFAULT true,
  "partialPayments"      BOOLEAN NOT NULL DEFAULT true,
  "settlementSchedule"   TEXT NOT NULL DEFAULT 't-1',
  "refundPolicy"         TEXT NOT NULL DEFAULT 'full',
  "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- PaymentSerial ----
CREATE TABLE IF NOT EXISTS "payment_serials" (
  "id"       TEXT PRIMARY KEY,
  "branchId" TEXT NOT NULL,
  "bucket"   TEXT NOT NULL,
  "next"     INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_serials_branch_bucket_unique"
  ON "payment_serials" ("branchId", "bucket");
