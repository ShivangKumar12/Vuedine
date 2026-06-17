-- Phase K — SaaS billing (plans, subscriptions, invoices, usage rollups)

-- 1. Enums
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'FAILED', 'VOID');

-- 2. New audit actions (idempotent)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PLAN_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RESUMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_ADDON_TOGGLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_PAID';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INVOICE_FAILED';

-- 3. plans
CREATE TABLE "plans" (
  "id"      TEXT NOT NULL,
  "slug"    TEXT NOT NULL,
  "name"    TEXT NOT NULL,
  "blurb"   TEXT,
  "monthly" DECIMAL(12,2) NOT NULL,
  "yearly"  DECIMAL(12,2) NOT NULL,
  "features" JSONB NOT NULL,
  "active"  BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_slug_key" ON "plans" ("slug");

-- 4. subscriptions
CREATE TABLE "subscriptions" (
  "id"             TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "planSlug"       TEXT NOT NULL,
  "cycle"          "BillingCycle" NOT NULL,
  "status"         "SubscriptionStatus" NOT NULL,
  "startedAt"      TIMESTAMP(3) NOT NULL,
  "renewsAt"       TIMESTAMP(3) NOT NULL,
  "cancelledAt"    TIMESTAMP(3),
  "trialEndsAt"    TIMESTAMP(3),
  "seatLimit"      INTEGER NOT NULL,
  "branchLimit"    INTEGER NOT NULL,
  "storageLimitGb" DECIMAL(8,2) NOT NULL,
  "aiQuota"        INTEGER NOT NULL,
  "meta"           JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_tenantId_key" ON "subscriptions" ("tenantId");

-- 5. invoices
CREATE TABLE "invoices" (
  "id"             TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "number"         TEXT NOT NULL,
  "period"         TEXT NOT NULL,
  "amount"         DECIMAL(12,2) NOT NULL,
  "taxAmount"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status"         "InvoiceStatus" NOT NULL,
  "paymentRef"     TEXT,
  "pdfUrl"         TEXT,
  "issuedAt"       TIMESTAMP(3) NOT NULL,
  "dueAt"          TIMESTAMP(3) NOT NULL,
  "paidAt"         TIMESTAMP(3),
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" ("number");
CREATE INDEX "invoices_tenantId_issuedAt_idx" ON "invoices" ("tenantId", "issuedAt" DESC);
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. usage_rollups
CREATE TABLE "usage_rollups" (
  "id"             TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "metric"         TEXT NOT NULL,
  "value"          DECIMAL(14,4) NOT NULL,
  "capturedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_rollups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "usage_rollups_subscriptionId_metric_capturedAt_idx"
  ON "usage_rollups" ("subscriptionId", "metric", "capturedAt");
ALTER TABLE "usage_rollups" ADD CONSTRAINT "usage_rollups_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
