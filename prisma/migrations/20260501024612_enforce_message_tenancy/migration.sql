/*
  Warnings:

  - Made the column `tenantId` on table `crm_conversations` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tenantId` to the `crm_messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "crm_conversations" DROP CONSTRAINT "crm_conversations_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "crm_messages" DROP CONSTRAINT "crm_messages_conversationId_fkey";

-- AlterTable
ALTER TABLE "crm_conversations" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "crm_messages" ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "crm_messages_tenantId_idx" ON "crm_messages"("tenantId");

-- AddForeignKey
ALTER TABLE "crm_conversations" ADD CONSTRAINT "crm_conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
