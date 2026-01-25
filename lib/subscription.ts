import { prisma } from "@/lib/prisma";

export async function getTenantLimits(tenantId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { tenantId, status: 'active' },
    include: { plan: true },
  });

  if (!subscription) {
    return {
      maxBots: 0,
      dailyMessageLimit: 0,
      name: 'suspended',
      displayName: 'Suspended',
      planName: 'Suspended', // Legacy/Extra
      id: 'suspended',
      currency: 'USD',
      price: 0,
      monthlyMessageLimit: 0,
      flowExecutionCap: 0,
      maxChannelsPerBot: 0,
      maxConversations: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      features: []
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

// Added missing export
export async function getTenantUsage(tenantId: string) {
  const limits = await getTenantLimits(tenantId);

  const botCount = await prisma.bot.count({
    where: { tenantId }
  });

  const messageCount = 0; // Mock until analytics are live

  return {
    ...limits,
    usage: {
      bots: botCount,
      messages: messageCount
    }
  };
}
// Alias for legacy support
export const getTenantSubscription = getTenantLimits;
