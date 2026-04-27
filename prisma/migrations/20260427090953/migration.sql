/*
  Warnings:

  - You are about to drop the `oidc_models` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cancelToken]` on the table `data_deletion_requests` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'SUPERADMIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DataDeletionStatus" ADD VALUE 'ERROR';
ALTER TYPE "DataDeletionStatus" ADD VALUE 'CANCELLED';

-- DropIndex
DROP INDEX "contacts_tenantId_email_key";

-- DropIndex
DROP INDEX "contacts_tenantId_phone_key";

-- AlterTable
ALTER TABLE "bots" ADD COLUMN     "context" JSONB;

-- AlterTable
ALTER TABLE "data_deletion_requests" ADD COLUMN     "cancelToken" TEXT,
ADD COLUMN     "scheduledDeletionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "aiApiKey" TEXT,
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" TEXT DEFAULT 'default',
ADD COLUMN     "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingData" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "onboardingStep" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "oidc_models";

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue" (
    "id" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "tenantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_activities" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_history" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "metrics" JSONB,
    "output" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_stripeInvoiceId_key" ON "revenue"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "revenue_tenantId_idx" ON "revenue"("tenantId");

-- CreateIndex
CREATE INDEX "revenue_paidAt_idx" ON "revenue"("paidAt");

-- CreateIndex
CREATE INDEX "admin_activities_adminId_idx" ON "admin_activities"("adminId");

-- CreateIndex
CREATE INDEX "admin_activities_createdAt_idx" ON "admin_activities"("createdAt");

-- CreateIndex
CREATE INDEX "admin_activities_entityType_entityId_idx" ON "admin_activities"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "test_history_type_idx" ON "test_history"("type");

-- CreateIndex
CREATE INDEX "test_history_status_idx" ON "test_history"("status");

-- CreateIndex
CREATE INDEX "test_history_createdAt_idx" ON "test_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "data_deletion_requests_cancelToken_key" ON "data_deletion_requests"("cancelToken");

-- CreateIndex
CREATE INDEX "webhook_logs_source_event_idx" ON "webhook_logs"("source", "event");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue" ADD CONSTRAINT "revenue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_activities" ADD CONSTRAINT "admin_activities_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
