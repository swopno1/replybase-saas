-- AlterTable: add failure tracking fields to webhook_subscriptions
ALTER TABLE "webhook_subscriptions" ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "webhook_subscriptions" ADD COLUMN "lastDeliveredAt" TIMESTAMP(3);

-- CreateTable: webhook_delivery_logs
CREATE TABLE "webhook_delivery_logs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_delivery_logs_subscriptionId_idx" ON "webhook_delivery_logs"("subscriptionId");

-- CreateIndex
CREATE INDEX "webhook_delivery_logs_tenantId_idx" ON "webhook_delivery_logs"("tenantId");

-- CreateIndex
CREATE INDEX "webhook_delivery_logs_createdAt_idx" ON "webhook_delivery_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
