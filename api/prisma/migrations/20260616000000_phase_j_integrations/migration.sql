-- Phase J — Integrations layer
-- Generic integration store + webhook event log + new audit actions.

-- 1. New enums
CREATE TYPE "IntegrationCategory" AS ENUM (
  'AGGREGATOR', 'PAYMENTS', 'MESSAGING', 'ACCOUNTING', 'REVIEWS', 'MARKETING', 'HARDWARE', 'AI'
);

CREATE TYPE "IntegrationStatus" AS ENUM (
  'CONNECTED', 'AVAILABLE', 'COMING_SOON', 'ERROR'
);

-- 2. New audit actions (idempotent)
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_CONNECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_DISCONNECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_TESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTEGRATION_SYNCED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'WEBHOOK_RECEIVED';

-- 3. integrations
CREATE TABLE "integrations" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "branchId"      TEXT,
  "provider"      TEXT NOT NULL,
  "category"      "IntegrationCategory" NOT NULL,
  "status"        "IntegrationStatus" NOT NULL DEFAULT 'AVAILABLE',
  "credentials"   JSONB,
  "webhookUrl"    TEXT,
  "webhookSecret" TEXT,
  "config"        JSONB,
  "meta"          JSONB,
  "lastSyncAt"    TIMESTAMP(3),
  "lastErrorAt"   TIMESTAMP(3),
  "lastError"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integrations_tenantId_branchId_provider_key"
  ON "integrations" ("tenantId", "branchId", "provider");
CREATE INDEX "integrations_provider_status_idx"
  ON "integrations" ("provider", "status");

-- 4. webhook_events
CREATE TABLE "webhook_events" (
  "id"            TEXT NOT NULL,
  "integrationId" TEXT,
  "provider"      TEXT NOT NULL,
  "externalId"    TEXT NOT NULL,
  "signature"     TEXT,
  "rawPayload"    JSONB NOT NULL,
  "receivedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt"   TIMESTAMP(3),
  "errorMessage"  TEXT,
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_provider_externalId_key"
  ON "webhook_events" ("provider", "externalId");
CREATE INDEX "webhook_events_processedAt_idx"
  ON "webhook_events" ("processedAt");
