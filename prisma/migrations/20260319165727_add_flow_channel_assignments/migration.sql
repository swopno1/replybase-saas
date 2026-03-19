-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_botId_fkey";

-- CreateTable
CREATE TABLE "flow_channel_assignments" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_channel_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_channel_assignments_flowId_idx" ON "flow_channel_assignments"("flowId");

-- CreateIndex
CREATE INDEX "flow_channel_assignments_channelId_idx" ON "flow_channel_assignments"("channelId");

-- CreateIndex
CREATE INDEX "flow_channel_assignments_channelId_isActive_idx" ON "flow_channel_assignments"("channelId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "flow_channel_assignments_channelId_key" ON "flow_channel_assignments"("channelId");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_channel_assignments" ADD CONSTRAINT "flow_channel_assignments_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_channel_assignments" ADD CONSTRAINT "flow_channel_assignments_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
