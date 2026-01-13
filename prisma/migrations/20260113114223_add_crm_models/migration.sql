-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_identities" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_conversations" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenantId_email_key" ON "contacts"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenantId_phone_key" ON "contacts"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "contact_identities_contactId_idx" ON "contact_identities"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_identities_contactId_type_value_key" ON "contact_identities"("contactId", "type", "value");

-- CreateIndex
CREATE INDEX "crm_conversations_contactId_idx" ON "crm_conversations"("contactId");

-- CreateIndex
CREATE INDEX "crm_messages_conversationId_idx" ON "crm_messages"("conversationId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversations" ADD CONSTRAINT "crm_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
