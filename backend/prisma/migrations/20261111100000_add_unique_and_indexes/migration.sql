-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrderStage_orderId_name_key" ON "OrderStage"("orderId", "name");

