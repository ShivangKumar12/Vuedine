-- ============================================================
--  Phase D — Promotions: Coupons + Offers
--
--  Adds Promotion, PromotionRedemption, OrderPromotion + enums.
--  Unified engine powering code-redeemed coupons and auto-applied offers.
-- ============================================================

-- ---- AuditAction enum extensions ----
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_REDEEMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_PAUSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_RESUMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_EXPIRED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROMOTION_ACTIVATED';

-- ---- Phase D enums ----
DO $$ BEGIN CREATE TYPE "PromotionType" AS ENUM ('COUPON', 'OFFER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PromotionKind" AS ENUM ('PERCENTAGE', 'FLAT', 'BOGO', 'FREE_ITEM', 'COMBO', 'HAPPY_HOUR', 'LOYALTY', 'FESTIVAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PromotionStatus" AS ENUM ('ACTIVE', 'SCHEDULED', 'PAUSED', 'EXPIRED', 'ENDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PromotionScope" AS ENUM ('WHOLE_ORDER', 'ITEMS', 'CATEGORIES'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- Promotion ----
CREATE TABLE IF NOT EXISTS "promotions" (
  "id"               TEXT PRIMARY KEY,
  "tenantId"         TEXT NOT NULL,
  "type"             "PromotionType" NOT NULL,
  "kind"             "PromotionKind" NOT NULL,
  "status"           "PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "summary"          TEXT,
  "emoji"            TEXT,
  "hero"             TEXT,
  "code"             TEXT,
  "value"            DECIMAL(12,2) NOT NULL DEFAULT 0,
  "minOrder"         DECIMAL(12,2) NOT NULL DEFAULT 0,
  "maxDiscount"      DECIMAL(12,2),
  "startsAt"         TIMESTAMPTZ NOT NULL,
  "endsAt"           TIMESTAMPTZ NOT NULL,
  "startTime"        TEXT,
  "endTime"          TEXT,
  "days"             "DayOfWeek"[] NOT NULL DEFAULT ARRAY[]::"DayOfWeek"[],
  "channels"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "usageLimit"       INTEGER NOT NULL DEFAULT 0,
  "perUserLimit"     INTEGER NOT NULL DEFAULT 1,
  "used"             INTEGER NOT NULL DEFAULT 0,
  "scope"            "PromotionScope" NOT NULL DEFAULT 'WHOLE_ORDER',
  "targetItemIds"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "targetCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "autoApply"        BOOLEAN NOT NULL DEFAULT false,
  "trigger"          JSONB,
  "redemptions"      INTEGER NOT NULL DEFAULT 0,
  "revenue"          DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt"        TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS "promotions_tenant_code_unique"
  ON "promotions" ("tenantId", "code");
CREATE INDEX IF NOT EXISTS "promotions_tenant_type_status_idx"
  ON "promotions" ("tenantId", "type", "status");
CREATE INDEX IF NOT EXISTS "promotions_tenant_autoApply_status_idx"
  ON "promotions" ("tenantId", "autoApply", "status");

-- ---- PromotionRedemption ----
CREATE TABLE IF NOT EXISTS "promotion_redemptions" (
  "id"          TEXT PRIMARY KEY,
  "promotionId" TEXT NOT NULL,
  "orderId"     TEXT NOT NULL,
  "customerId"  TEXT,
  "amountSaved" DECIMAL(12,2) NOT NULL,
  "at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "promotion_redemptions_promotion_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "promotion_redemptions_promotion_at_idx"
  ON "promotion_redemptions" ("promotionId", "at");
CREATE INDEX IF NOT EXISTS "promotion_redemptions_customer_promotion_idx"
  ON "promotion_redemptions" ("customerId", "promotionId");

-- ---- OrderPromotion ----
CREATE TABLE IF NOT EXISTS "order_promotions" (
  "id"          TEXT PRIMARY KEY,
  "orderId"     TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "code"        TEXT,
  "amountSaved" DECIMAL(12,2) NOT NULL,

  CONSTRAINT "order_promotions_order_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_promotions_promotion_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_promotions_order_promotion_unique"
  ON "order_promotions" ("orderId", "promotionId");
CREATE INDEX IF NOT EXISTS "order_promotions_promotion_idx"
  ON "order_promotions" ("promotionId");
