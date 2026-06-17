-- DropIndex
DROP INDEX "items_tenantId_name_key";

-- Partial unique index: name is unique per tenant ONLY among rows that
-- haven't been soft-deleted. Lets us re-use a name after deleting the old
-- entry without hard-purging history.
CREATE UNIQUE INDEX "items_tenantId_name_unique_active"
  ON "items" ("tenantId", "name")
  WHERE "deletedAt" IS NULL;
