-- Phase H — Communications: Campaigns, Push, Messages
-- Hand-written migration (apply with: npx prisma migrate deploy)

-- Enums
CREATE TYPE "CampaignType" AS ENUM ('PUSH', 'EMAIL', 'SMS', 'WHATSAPP');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "CampaignEventType" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'UNSUBSCRIBED', 'BOUNCED');
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'SMS', 'INSTAGRAM', 'WEBCHAT');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED');
CREATE TYPE "MessageSender" AS ENUM ('CUSTOMER', 'AGENT', 'BOT');

-- New audit actions
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CAMPAIGN_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CAMPAIGN_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CAMPAIGN_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CAMPAIGN_SCHEDULED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CAMPAIGN_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CAMPAIGN_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SEGMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SEGMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PUSH_SUBSCRIBED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PUSH_UNSUBSCRIBED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_IMPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CUSTOMER_BULK_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MESSAGE_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MESSAGE_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_STATUS_CHANGED';

-- notification_campaigns
CREATE TABLE "notification_campaigns" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "type"          "CampaignType" NOT NULL,
  "title"         TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "imageUrl"      TEXT,
  "imageEmoji"    TEXT,
  "ctaLabel"      TEXT,
  "ctaUrl"        TEXT,
  "audience"      TEXT NOT NULL,
  "audienceQuery" JSONB,
  "audienceSize"  INTEGER NOT NULL DEFAULT 0,
  "status"        "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledFor"  TIMESTAMP(3),
  "sentAt"        TIMESTAMP(3),
  "delivered"     INTEGER NOT NULL DEFAULT 0,
  "opened"        INTEGER NOT NULL DEFAULT 0,
  "clicked"       INTEGER NOT NULL DEFAULT 0,
  "failed"        INTEGER NOT NULL DEFAULT 0,
  "unsubscribed"  INTEGER NOT NULL DEFAULT 0,
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  "deletedAt"     TIMESTAMP(3),
  CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notification_campaigns_tenantId_status_scheduledFor_idx"
  ON "notification_campaigns"("tenantId", "status", "scheduledFor");

-- campaign_events
CREATE TABLE "campaign_events" (
  "id"         TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "customerId" TEXT,
  "type"       "CampaignEventType" NOT NULL,
  "channel"    TEXT NOT NULL,
  "meta"       JSONB,
  "at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campaign_events_campaignId_type_idx" ON "campaign_events"("campaignId", "type");
CREATE INDEX "campaign_events_customerId_at_idx" ON "campaign_events"("customerId", "at");
ALTER TABLE "campaign_events"
  ADD CONSTRAINT "campaign_events_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- push_subscriptions
CREATE TABLE "push_subscriptions" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "endpoint"   TEXT NOT NULL,
  "keys"       JSONB NOT NULL,
  "platform"   TEXT NOT NULL,
  "deviceId"   TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_tenantId_userId_idx" ON "push_subscriptions"("tenantId", "userId");

-- segments
CREATE TABLE "segments" (
  "id"        TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "rule"      JSONB NOT NULL,
  "systemKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "segments_tenantId_name_key" ON "segments"("tenantId", "name");

-- conversations
CREATE TABLE "conversations" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "branchId"      TEXT,
  "customerId"    TEXT,
  "channel"       "ConversationChannel" NOT NULL,
  "externalRef"   TEXT,
  "status"        "ConversationStatus" NOT NULL DEFAULT 'OPEN',
  "unread"        INTEGER NOT NULL DEFAULT 0,
  "starred"       BOOLEAN NOT NULL DEFAULT false,
  "tags"          TEXT[] DEFAULT ARRAY[]::TEXT[],
  "agentId"       TEXT,
  "customerName"  TEXT,
  "customerPhone" TEXT,
  "lastAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSnippet"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conversations_tenantId_status_lastAt_idx" ON "conversations"("tenantId", "status", "lastAt" DESC);
CREATE INDEX "conversations_customerId_lastAt_idx" ON "conversations"("customerId", "lastAt" DESC);
CREATE INDEX "conversations_externalRef_idx" ON "conversations"("externalRef");

-- messages
CREATE TABLE "messages" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "sender"         "MessageSender" NOT NULL,
  "body"           TEXT NOT NULL,
  "attachments"    JSONB,
  "read"           BOOLEAN NOT NULL DEFAULT false,
  "externalRef"    TEXT,
  "at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "messages_conversationId_at_idx" ON "messages"("conversationId", "at");
CREATE INDEX "messages_externalRef_idx" ON "messages"("externalRef");
ALTER TABLE "messages"
  ADD CONSTRAINT "messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
