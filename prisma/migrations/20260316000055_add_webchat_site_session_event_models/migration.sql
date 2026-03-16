-- CreateEnum
CREATE TYPE "WebChatEventType" AS ENUM ('INIT', 'MESSAGE', 'OPEN', 'CLOSE', 'TYPING', 'ERROR');

-- CreateTable
CREATE TABLE "webchat_sites" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "channelId" TEXT,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "allowedDomains" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "themeConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webchat_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webchat_sessions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "externalSessionId" TEXT,
    "visitorId" TEXT NOT NULL,
    "fingerprint" TEXT,
    "metadata" JSONB,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webchat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webchat_events" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" "WebChatEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webchat_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webchat_sites_channelId_key" ON "webchat_sites"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "webchat_sites_publicKey_key" ON "webchat_sites"("publicKey");

-- CreateIndex
CREATE INDEX "webchat_sites_tenantId_idx" ON "webchat_sites"("tenantId");

-- CreateIndex
CREATE INDEX "webchat_sites_botId_idx" ON "webchat_sites"("botId");

-- CreateIndex
CREATE INDEX "webchat_sites_isActive_idx" ON "webchat_sites"("isActive");

-- CreateIndex
CREATE INDEX "webchat_sessions_conversationId_idx" ON "webchat_sessions"("conversationId");

-- CreateIndex
CREATE INDEX "webchat_sessions_lastSeenAt_idx" ON "webchat_sessions"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "webchat_sessions_siteId_visitorId_key" ON "webchat_sessions"("siteId", "visitorId");

-- CreateIndex
CREATE INDEX "webchat_events_siteId_createdAt_idx" ON "webchat_events"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "webchat_events_sessionId_createdAt_idx" ON "webchat_events"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "webchat_events_type_createdAt_idx" ON "webchat_events"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "webchat_sites" ADD CONSTRAINT "webchat_sites_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webchat_sites" ADD CONSTRAINT "webchat_sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webchat_sessions" ADD CONSTRAINT "webchat_sessions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webchat_sessions" ADD CONSTRAINT "webchat_sessions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "webchat_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webchat_events" ADD CONSTRAINT "webchat_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "webchat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webchat_events" ADD CONSTRAINT "webchat_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "webchat_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
