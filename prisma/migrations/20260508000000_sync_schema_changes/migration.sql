-- AlterTable
ALTER TABLE "channels" ADD COLUMN "tenantId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "channels_type_channelId_key" ON "channels"("type", "channelId");

-- CreateIndex
CREATE INDEX "channels_tenantId_idx" ON "channels"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_id_tenantId_key" ON "contacts"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "flows_id_tenantId_key" ON "flows"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "leads_id_tenantId_key" ON "leads"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
