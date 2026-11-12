-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_paymentId_key" ON "EmailOutbox"("paymentId");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextRetryAt_idx" ON "EmailOutbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_lockedAt_idx" ON "EmailOutbox"("status", "lockedAt");

-- AddForeignKey
ALTER TABLE "EmailOutbox" ADD CONSTRAINT "EmailOutbox_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

