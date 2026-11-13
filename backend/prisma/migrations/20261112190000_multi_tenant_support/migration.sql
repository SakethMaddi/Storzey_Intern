-- ============================================================================
-- 1. PRE-MIGRATION VALIDATION CHECKS (Execute before any modifications)
-- ============================================================================
DO $$
DECLARE
    v_owner_count INTEGER;
    v_customer_count INTEGER;
    v_order_count INTEGER;
    v_orphaned_orders INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_owner_count FROM "Owner";
    SELECT COUNT(*) INTO v_customer_count FROM "Customer";
    SELECT COUNT(*) INTO v_order_count FROM "Order";

    -- A. Disallow ambiguous legacy owner assignment
    IF v_owner_count > 1 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % owners. Ambiguous legacy data assignment.', v_owner_count;
    END IF;

    -- B. Disallow records if no owner exists
    IF v_owner_count = 0 AND (v_customer_count > 0 OR v_order_count > 0) THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % customers and % orders, but no legacy owner.', v_customer_count, v_order_count;
    END IF;

    -- C. Disallow orphaned orders that reference missing customers
    SELECT COUNT(*) INTO v_orphaned_orders
    FROM "Order" o
    LEFT JOIN "Customer" c ON o."customerId" = c."id"
    WHERE c."id" IS NULL;

    IF v_orphaned_orders > 0 THEN
        RAISE EXCEPTION 'MIGRATION ABORTED: Found % orders referencing non-existent customers.', v_orphaned_orders;
    END IF;
END $$;

-- ============================================================================
-- 2. ALTER OWNER TABLE
-- ============================================================================
ALTER TABLE "Owner" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Owner" ADD COLUMN IF NOT EXISTS "businessName" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Owner_phone_key" ON "Owner"("phone");

-- ============================================================================
-- 3. ADD TENANT COLUMNS (Temporarily nullable for backfill)
-- ============================================================================
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;

-- ============================================================================
-- 4. SAFE BACKFILL FOR LEGACY SINGLE-OWNER RECORDS
-- ============================================================================
DO $$
DECLARE
    v_owner_id INTEGER;
BEGIN
    SELECT "id" INTO v_owner_id FROM "Owner" ORDER BY "id" ASC LIMIT 1;
    IF v_owner_id IS NOT NULL THEN
        UPDATE "Customer" SET "ownerId" = v_owner_id WHERE "ownerId" IS NULL;
        UPDATE "Order" SET "ownerId" = v_owner_id WHERE "ownerId" IS NULL;
    END IF;
END $$;

-- ============================================================================
-- 5. ENFORCE NOT NULL
-- ============================================================================
ALTER TABLE "Customer" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "ownerId" SET NOT NULL;

-- ============================================================================
-- 6. DROP LEGACY CONSTRAINTS & REDUNDANT INDEXES SAFELY
-- ============================================================================
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_customerId_fkey";
DROP INDEX IF EXISTS "Customer_phone_idx";
DROP INDEX IF EXISTS "EmailOutbox_status_lockedAt_idx";
DROP INDEX IF EXISTS "Order_customerId_idx";

-- ============================================================================
-- 7. RESTORE COMPOSITE TENANT INTEGRITY AT DATABASE LEVEL
-- ============================================================================
-- A. Owner foreign keys
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- B. Customer composite unique constraint (id, ownerId)
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_id_ownerId_key"
  UNIQUE ("id", "ownerId");

-- C. Order composite foreign key referencing Customer (id, ownerId)
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_customerId_ownerId_fkey"
  FOREIGN KEY ("customerId", "ownerId")
  REFERENCES "Customer"("id", "ownerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- D. Tenant-scoped customer phone uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_ownerId_phone_key" ON "Customer"("ownerId", "phone");

-- ============================================================================
-- 8. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS "Customer_ownerId_name_idx" ON "Customer"("ownerId", "name");
CREATE INDEX IF NOT EXISTS "Order_ownerId_createdAt_idx" ON "Order"("ownerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Order_ownerId_customerId_idx" ON "Order"("ownerId", "customerId");
CREATE INDEX IF NOT EXISTS "Order_ownerId_paymentStatus_idx" ON "Order"("ownerId", "paymentStatus");

