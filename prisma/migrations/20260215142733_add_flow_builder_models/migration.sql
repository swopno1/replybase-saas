-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "flowId" TEXT,
ADD COLUMN     "pageId" TEXT,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "maxFlows" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "language" TEXT NOT NULL DEFAULT 'en',
    "fallbackMessage" TEXT DEFAULT 'Sorry, I didn''t understand that.',
    "maxTimeout" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_nodes" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_assignments" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flows_tenantId_idx" ON "flows"("tenantId");

-- CreateIndex
CREATE INDEX "flows_ownerId_idx" ON "flows"("ownerId");

-- CreateIndex
CREATE INDEX "flows_isGlobal_idx" ON "flows"("isGlobal");

-- CreateIndex
CREATE INDEX "flow_nodes_flowId_idx" ON "flow_nodes"("flowId");

-- CreateIndex
CREATE INDEX "flow_nodes_order_idx" ON "flow_nodes"("order");

-- CreateIndex
CREATE INDEX "flow_assignments_flowId_idx" ON "flow_assignments"("flowId");

-- CreateIndex
CREATE INDEX "flow_assignments_pageId_idx" ON "flow_assignments"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_assignments_pageId_key" ON "flow_assignments"("pageId");

-- CreateIndex
CREATE INDEX "flow_sessions_userId_idx" ON "flow_sessions"("userId");

-- CreateIndex
CREATE INDEX "flow_sessions_pageId_idx" ON "flow_sessions"("pageId");

-- CreateIndex
CREATE INDEX "flow_sessions_flowId_idx" ON "flow_sessions"("flowId");

-- CreateIndex
CREATE INDEX "flow_sessions_isActive_idx" ON "flow_sessions"("isActive");

-- CreateIndex
CREATE INDEX "leads_flowId_idx" ON "leads"("flowId");

-- CreateIndex
CREATE INDEX "leads_pageId_idx" ON "leads"("pageId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "facebook_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flows" ADD CONSTRAINT "flows_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_nodes" ADD CONSTRAINT "flow_nodes_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_assignments" ADD CONSTRAINT "flow_assignments_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_assignments" ADD CONSTRAINT "flow_assignments_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "facebook_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_sessions" ADD CONSTRAINT "flow_sessions_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
