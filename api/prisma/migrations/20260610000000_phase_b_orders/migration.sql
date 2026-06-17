-- ============================================================
--  Phase B — Orders, Sessions, KDS, Public PWA backend.
--
--  Adds the core operational data model: Order, OrderItem, OrderEvent,
--  TableSession, OrderSerial, GuestSignal. All tenant + branch-scoped.
-- ============================================================

-- ---- AuditAction enum extensions ----
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_REFIRED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ORDER_LINE_PREPARED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_SESSION_OPENED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_SESSION_CLOSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_SESSION_TRANSFERRED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TABLE_SESSION_MERGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KDS_TICKET_BUMPED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'KDS_TICKET_RECALLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_RING_WAITER';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_REQUEST_BILL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GUEST_FEEDBACK';

-- ---- Phase B enums ----
DO $$ BEGIN CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrderChannel" AS ENUM ('POS', 'WAITER', 'QR', 'ONLINE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrderSource" AS ENUM ('POS', 'WAITER', 'QR', 'ZOMATO', 'SWIGGY', 'VUEDINE_DIRECT', 'WHATSAPP', 'QR_PAY'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SERVED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrderPriority" AS ENUM ('NORMAL', 'RUSH'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrderStation" AS ENUM ('HOT', 'COLD', 'BAR', 'DESSERT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OrderEventType" AS ENUM ('CREATED', 'ACCEPTED', 'STARTED', 'READY', 'DISPATCHED', 'DELIVERED', 'SERVED', 'CANCELLED', 'RECALLED', 'LINE_PREPARED', 'WAITER_RING', 'BILL_REQUESTED', 'FEEDBACK_RECEIVED', 'NOTE_ADDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TableSessionStatus" AS ENUM ('OPEN', 'PREPARING', 'SERVED', 'AWAITING_PAYMENT', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SessionPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CARD', 'UPI', 'WALLET', 'ONLINE', 'PAY_LATER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "GuestSignalType" AS ENUM ('WAITER_RING', 'BILL_REQUEST', 'FEEDBACK', 'HELP'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- TableSession ----
CREATE TABLE IF NOT EXISTS "table_sessions" (
  "id"            TEXT PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  "branchId"      TEXT NOT NULL,
  "tableId"       TEXT NOT NULL,
  "guestName"     TEXT,
  "guestPhone"    TEXT,
  "partySize"     INTEGER NOT NULL DEFAULT 2,
  "status"        "TableSessionStatus" NOT NULL DEFAULT 'OPEN',
  "paymentStatus" "SessionPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "openedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "closedAt"      TIMESTAMPTZ,
  "subtotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "serviceTotal"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tipTotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grandTotal"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "metadata"      JSONB,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt"     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "table_sessions_tenant_branch_status_idx"
  ON "table_sessions" ("tenantId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "table_sessions_tenant_table_status_idx"
  ON "table_sessions" ("tenantId", "tableId", "status");
CREATE INDEX IF NOT EXISTS "table_sessions_tenant_openedAt_idx"
  ON "table_sessions" ("tenantId", "openedAt");

-- ---- Order ----
CREATE TABLE IF NOT EXISTS "orders" (
  "id"             TEXT PRIMARY KEY,
  "tenantId"       TEXT NOT NULL,
  "branchId"       TEXT NOT NULL,
  "sessionId"      TEXT,
  "tableId"        TEXT,

  "serial"         TEXT NOT NULL,
  "token"          TEXT NOT NULL,
  "type"           "OrderType" NOT NULL,
  "channel"        "OrderChannel" NOT NULL,
  "source"         "OrderSource" NOT NULL DEFAULT 'POS',
  "station"        "OrderStation" NOT NULL DEFAULT 'HOT',
  "priority"       "OrderPriority" NOT NULL DEFAULT 'NORMAL',
  "status"         "OrderStatus" NOT NULL DEFAULT 'PENDING',

  "guestName"      TEXT,
  "guestPhone"     TEXT,
  "tableLabel"     TEXT,

  "deliveryAddress" TEXT,
  "deliveryNotes"   TEXT,
  "driverName"      TEXT,
  "driverPhone"     TEXT,
  "etaMinutes"      INTEGER,

  "subtotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "serviceTotal"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tipTotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grandTotal"    DECIMAL(12,2) NOT NULL DEFAULT 0,

  "promoCode"     TEXT,
  "taxBreakdown"  JSONB,

  "paymentMode"    "PaymentMode" NOT NULL DEFAULT 'PAY_LATER',
  "paymentStatus"  "SessionPaymentStatus" NOT NULL DEFAULT 'UNPAID',

  "acceptedAt"   TIMESTAMPTZ,
  "startedAt"    TIMESTAMPTZ,
  "readyAt"      TIMESTAMPTZ,
  "servedAt"     TIMESTAMPTZ,
  "dispatchedAt" TIMESTAMPTZ,
  "deliveredAt"  TIMESTAMPTZ,
  "cancelledAt"  TIMESTAMPTZ,
  "cancelReason" TEXT,
  "notes"        TEXT,

  "idempotencyKey" TEXT,
  "metadata"       JSONB,

  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deletedAt"  TIMESTAMPTZ,

  CONSTRAINT "orders_session_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "table_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_branch_serial_unique"
  ON "orders" ("branchId", "serial");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenant_idempotency_unique"
  ON "orders" ("tenantId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "orders_tenant_branch_status_idx"
  ON "orders" ("tenantId", "branchId", "status");
CREATE INDEX IF NOT EXISTS "orders_tenant_branch_createdAt_idx"
  ON "orders" ("tenantId", "branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_tenant_branch_channel_status_idx"
  ON "orders" ("tenantId", "branchId", "channel", "status");
CREATE INDEX IF NOT EXISTS "orders_tenant_branch_source_idx"
  ON "orders" ("tenantId", "branchId", "source");
CREATE INDEX IF NOT EXISTS "orders_session_idx"
  ON "orders" ("sessionId");
CREATE INDEX IF NOT EXISTS "orders_table_idx"
  ON "orders" ("tableId");

-- ---- OrderItem ----
CREATE TABLE IF NOT EXISTS "order_items" (
  "id"           TEXT PRIMARY KEY,
  "orderId"      TEXT NOT NULL,
  "itemId"       TEXT,
  "itemName"     TEXT NOT NULL,
  "emoji"        TEXT,
  "qty"          INTEGER NOT NULL DEFAULT 1,
  "unitPrice"    DECIMAL(12,2) NOT NULL,
  "lineTotal"    DECIMAL(12,2) NOT NULL,
  "variantLabel" TEXT,
  "variantId"    TEXT,
  "addons"       JSONB,
  "notes"        TEXT,
  "spice"        INTEGER,
  "station"      "OrderStation" NOT NULL DEFAULT 'HOT',
  "prepared"     BOOLEAN NOT NULL DEFAULT false,
  "preparedAt"   TIMESTAMPTZ,
  "preparedBy"   TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "order_items_order_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items" ("orderId");
CREATE INDEX IF NOT EXISTS "order_items_orderId_prepared_idx" ON "order_items" ("orderId", "prepared");

-- ---- OrderEvent ----
CREATE TABLE IF NOT EXISTS "order_events" (
  "id"        TEXT PRIMARY KEY,
  "orderId"   TEXT NOT NULL,
  "type"      "OrderEventType" NOT NULL,
  "actorId"   TEXT,
  "actorName" TEXT,
  "message"   TEXT,
  "metadata"  JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "order_events_order_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "order_events_orderId_createdAt_idx"
  ON "order_events" ("orderId", "createdAt");

-- ---- OrderSerial ----
CREATE TABLE IF NOT EXISTS "order_serials" (
  "id"       TEXT PRIMARY KEY,
  "branchId" TEXT NOT NULL,
  "bucket"   TEXT NOT NULL,
  "next"     INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_serials_branch_bucket_unique"
  ON "order_serials" ("branchId", "bucket");

-- ---- GuestSignal ----
CREATE TABLE IF NOT EXISTS "guest_signals" (
  "id"         TEXT PRIMARY KEY,
  "tenantId"   TEXT NOT NULL,
  "branchId"   TEXT NOT NULL,
  "tableId"    TEXT,
  "orderId"    TEXT,
  "type"       "GuestSignalType" NOT NULL,
  "guestName"  TEXT,
  "guestPhone" TEXT,
  "message"    TEXT,
  "rating"     INTEGER,
  "resolved"   BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMPTZ,
  "resolvedBy" TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "guest_signals_tenant_branch_resolved_createdAt_idx"
  ON "guest_signals" ("tenantId", "branchId", "resolved", "createdAt");
CREATE INDEX IF NOT EXISTS "guest_signals_orderId_idx" ON "guest_signals" ("orderId");
