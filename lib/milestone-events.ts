import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Emit and record an onboarding milestone event for a tenant
 * Idempotent: only records the first occurrence of each milestone
 */
export async function recordMilestoneEvent(
  tenantId: string,
  milestoneId: "first-channel" | "first-automated-reply",
  context?: Prisma.JsonValue | null,
) {
  try {
    // Try to create the event (will fail silently if already exists due to unique constraint)

    const event = await prisma.onboardingMilestoneEvent.upsert({
      where: {
        tenantId_milestoneId: {
          tenantId,
          milestoneId,
        },
      },
      update: {}, // No-op if already exists
      create: {
        tenantId,
        milestoneId,
        context: context ?? undefined,
      },
    });

    return event;
  } catch (error) {
    console.error(
      `Failed to record milestone event [${milestoneId}] for tenant [${tenantId}]:`,
      error,
    );
    // Don't throw - allow the webhook to continue even if event recording fails
    return null;
  }
}

/**
 * Check if a tenant has completed a milestone
 */
export async function hasMilestoneCompleted(
  tenantId: string,
  milestoneId: "first-channel" | "first-automated-reply",
): Promise<boolean> {
  const event = await prisma.onboardingMilestoneEvent.findUnique({
    where: {
      tenantId_milestoneId: {
        tenantId,
        milestoneId,
      },
    },
  });
  return !!event;
}

/**
 * Get all completed milestones for a tenant
 */
export async function getCompletedMilestones(tenantId: string) {
  const events = await prisma.onboardingMilestoneEvent.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });
  return events;
}

/**
 * Get milestone completion stats across all tenants
 */
export async function getMilestoneStats(
  milestoneId: "first-channel" | "first-automated-reply",
) {
  const completed = await prisma.onboardingMilestoneEvent.count({
    where: { milestoneId },
  });

  const totalTenants = await prisma.tenant.count();

  return {
    milestoneId,
    completedCount: completed,
    totalTenants,
    completionRate: totalTenants > 0 ? completed / totalTenants : 0,
  };
}
