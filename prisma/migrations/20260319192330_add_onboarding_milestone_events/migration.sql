-- CreateTable
CREATE TABLE "onboarding_milestone_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_milestone_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "onboarding_milestone_events_tenantId_idx" ON "onboarding_milestone_events"("tenantId");

-- CreateIndex
CREATE INDEX "onboarding_milestone_events_milestoneId_idx" ON "onboarding_milestone_events"("milestoneId");

-- CreateIndex
CREATE INDEX "onboarding_milestone_events_createdAt_idx" ON "onboarding_milestone_events"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_milestone_events_tenantId_milestoneId_key" ON "onboarding_milestone_events"("tenantId", "milestoneId");

-- AddForeignKey
ALTER TABLE "onboarding_milestone_events" ADD CONSTRAINT "onboarding_milestone_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
