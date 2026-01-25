import { prisma } from "@/lib/prisma";

export async function getTenantLimits(tenantId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: 'active' },
    include: { plan: true },
  });

  if (!subscription) {
    // Return free tier or zero limits if no active sub, but safer to assume Free for now if we allow it
    // Or we return a "locked" state.
    // Based on middleware, they can't even get here if inactive, UNLESS we allow "free" plan which might not have a stripe sub?
    // Actually, Phase 2 seeding put Free, Starter, Pro in DB.
    // If they are on Free, they should have a subscription record with 'free' plan if we are strict.
    // Fallback to strict 0 limits if no sub found.
    return {
      maxBots: 0,
      dailyMessageLimit: 0,
      planName: 'Suspended'
    };
  }

  return {
    ...subscription.plan
  };
}

export async function checkBotLimit(tenantId: string) {
  const limits = await getTenantLimits(tenantId);

  const botCount = await prisma.bot.count({
    where: { tenantId }
  });

  return {
    allowed: botCount < limits.maxBots,
    limit: limits.maxBots,
    current: botCount,
    planName: limits.displayName || limits.name
  };
}
