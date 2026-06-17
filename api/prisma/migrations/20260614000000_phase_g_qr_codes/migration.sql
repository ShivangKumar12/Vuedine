-- Phase G — QR Codes & scan analytics
-- Hand-written migration (apply with: npx prisma migrate deploy)

-- Enums
CREATE TYPE "QrType" AS ENUM ('TABLE', 'COUNTER', 'TAKEAWAY', 'DELIVERY', 'MARKETING');
CREATE TYPE "QrStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- New audit actions
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_CODE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_CODE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_CODE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'QR_CODE_REGENERATED';

-- qr_codes
CREATE TABLE "qr_codes" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "branchId"    TEXT NOT NULL,
  "type"        "QrType" NOT NULL,
  "label"       TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "token"       TEXT NOT NULL,
  "status"      "QrStatus" NOT NULL DEFAULT 'ACTIVE',
  "thumbnail"   TEXT,
  "scans"       INTEGER NOT NULL DEFAULT 0,
  "ordersCount" INTEGER NOT NULL DEFAULT 0,
  "tableId"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),
  CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "qr_codes_token_key" ON "qr_codes"("token");
CREATE UNIQUE INDEX "qr_codes_tableId_key" ON "qr_codes"("tableId");
CREATE INDEX "qr_codes_tenantId_branchId_type_idx" ON "qr_codes"("tenantId", "branchId", "type");
CREATE INDEX "qr_codes_token_idx" ON "qr_codes"("token");

ALTER TABLE "qr_codes"
  ADD CONSTRAINT "qr_codes_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- qr_scans
CREATE TABLE "qr_scans" (
  "id"        TEXT NOT NULL,
  "qrCodeId"  TEXT NOT NULL,
  "ip"        TEXT,
  "userAgent" TEXT,
  "referrer"  TEXT,
  "city"      TEXT,
  "at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "qr_scans_qrCodeId_at_idx" ON "qr_scans"("qrCodeId", "at");

ALTER TABLE "qr_scans"
  ADD CONSTRAINT "qr_scans_qrCodeId_fkey"
  FOREIGN KEY ("qrCodeId") REFERENCES "qr_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
