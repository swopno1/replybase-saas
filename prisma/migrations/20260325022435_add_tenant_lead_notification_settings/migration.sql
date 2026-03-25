-- CreateTable
CREATE TABLE "tenant_lead_notification_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "emailRecipients" JSONB NOT NULL DEFAULT '[]',
    "telegramChatIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_lead_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_lead_notification_settings_tenantId_key" ON "tenant_lead_notification_settings"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_lead_notification_settings_tenantId_idx" ON "tenant_lead_notification_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "tenant_lead_notification_settings" ADD CONSTRAINT "tenant_lead_notification_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
