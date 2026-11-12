-- CreateTable
CREATE TABLE "Owner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentLinkExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderStage" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

