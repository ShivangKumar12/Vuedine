-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('ACTIVE', 'SOLD_OUT', 'DRAFT');

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "emoji" TEXT,
    "imageUrl" TEXT,
    "veg" BOOLEAN NOT NULL DEFAULT true,
    "bestseller" BOOLEAN NOT NULL DEFAULT false,
    "branchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "items_tenantId_deletedAt_idx" ON "items"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "items_tenantId_status_deletedAt_idx" ON "items"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "items_tenantId_category_deletedAt_idx" ON "items"("tenantId", "category", "deletedAt");

-- CreateIndex
CREATE INDEX "items_tenantId_name_idx" ON "items"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "items_tenantId_name_key" ON "items"("tenantId", "name");
