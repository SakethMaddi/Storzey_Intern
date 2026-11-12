-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderStage_orderId_idx" ON "OrderStage"("orderId");

