-- CreateTable
CREATE TABLE "system_health" (
    "id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3) NOT NULL,
    "details" JSONB,

    CONSTRAINT "system_health_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_health_system_key" ON "system_health"("system");
