-- CreateTable
CREATE TABLE "tenant_channel_statuses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "facebook" BOOLEAN NOT NULL DEFAULT false,
    "telegram" BOOLEAN NOT NULL DEFAULT true,
    "webchat" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_channel_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_channel_statuses_tenantId_key" ON "tenant_channel_statuses"("tenantId");

-- AddForeignKey
ALTER TABLE "tenant_channel_statuses" ADD CONSTRAINT "tenant_channel_statuses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
