-- 1. Customer Archival
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Customer_ownerId_isArchived_idx" ON "Customer"("ownerId", "isArchived");

-- 2. Order Status & Archival / Cancellation
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

CREATE INDEX IF NOT EXISTS "Order_ownerId_status_idx" ON "Order"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "Order_ownerId_isArchived_idx" ON "Order"("ownerId", "isArchived");
