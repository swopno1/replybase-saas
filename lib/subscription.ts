import { prisma } from "./prisma";

export interface SubscriptionLimits {
  dailyMessageLimit: number;
  monthlyMessageLimit: number;
  flowExecutionCap: number;
  maxBots: number;
  maxChannelsPerBot: number;
}

export interface UsageStats {
  dailyMessages: number;
  monthlyMessages: number;
  dailyFlowExecutions: number;
  botCount: number;
}

/**
 * DEPRECATED: Use getTenantSubscription instead.
 * @deprecated
 */
export async function _DEPRECATED_getUserSubscription(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    throw new Error("User not found or no tenant");
  }

  return getTenantSubscription(user.tenantId);
}

/**
 * Get a tenant's active subscription plan or a default free plan.
 * This is the source of truth for all plan-related limits and features.
 * @param tenantId The ID of the tenant.
 * @returns The tenant's subscription object, including the plan details.
 */
export async function getTenantSubscription(tenantId: string) {
  if (!tenantId) {
    throw new Error("Tenant ID is required");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: tenantId },
    include: { plan: true },
  });

  if (subscription && subscription.status === "active") {
    return subscription;
  }

  // Return free plan if no active subscription
  const freePlan = await prisma.plan.findUnique({
    where: { name: "free" },
  });

  if (!freePlan) {
    throw new Error("Free plan not found in database");
  }

  return {
    id: "free",
    tenantId: tenantId,
    planId: freePlan.id,
    status: "active" as const,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    plan: freePlan,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * DEPRECATED: Use getTenantLimits instead.
 * @deprecated
 */
export async function _DEPRECATED_getUserLimits(
  userId: string
): Promise<SubscriptionLimits> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.tenantId) throw new Error("User not found or no tenant");
  return getTenantLimits(user.tenantId);
}

/**
 * Get subscription limits for a tenant.
 * @param tenantId The ID of the tenant.
 * @returns The subscription limits based on the tenant's plan.
 */
export async function getTenantLimits(
  tenantId: string
): Promise<SubscriptionLimits> {
  const subscription = await getTenantSubscription(tenantId);
  const plan = subscription.plan;

  return {
    dailyMessageLimit: plan.dailyMessageLimit,
    monthlyMessageLimit: plan.monthlyMessageLimit,
    flowExecutionCap: plan.flowExecutionCap,
    maxBots: plan.maxBots,
    maxChannelsPerBot: plan.maxChannelsPerBot,
  };
}

/**
 * DEPRECATED: Use getTenantUsage instead.
 * @deprecated
 */
export async function _DEPRECATED_getUserUsage(
  userId: string,
  date: Date = new Date()
): Promise<UsageStats> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.tenantId) throw new Error("User not found or no tenant");
  return getTenantUsage(user.tenantId, date);
}

/**
 * Get current usage stats for a tenant.
 * @param tenantId The ID of the tenant.
 * @param date The date to calculate usage for (defaults to now).
 * @returns An object with the tenant's current usage stats.
 */
export async function getTenantUsage(
  tenantId: string,
  date: Date = new Date()
): Promise<UsageStats> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);

  // Daily message count
  const dailyMessages = await prisma.usageLog.aggregate({
    where: {
      tenantId,
      type: "message",
      date: {
        gte: startOfDay,
      },
    },
    _sum: {
      count: true,
    },
  });

  // Monthly message count
  const monthlyMessages = await prisma.usageLog.aggregate({
    where: {
      tenantId,
      type: "message",
      date: {
        gte: startOfMonth,
      },
    },
    _sum: {
      count: true,
    },
  });

  // Daily flow executions
  const dailyFlowExecutions = await prisma.usageLog.aggregate({
    where: {
      tenantId,
      type: "flow_execution",
      date: {
        gte: startOfDay,
      },
    },
    _sum: {
      count: true,
    },
  });

  // Bot count
  const botCount = await prisma.bot.count({
    where: {
      tenantId,
    },
  });

  return {
    dailyMessages: dailyMessages._sum.count || 0,
    monthlyMessages: monthlyMessages._sum.count || 0,
    dailyFlowExecutions: dailyFlowExecutions._sum.count || 0,
    botCount,
  };
}

/**
 * Check if tenant has exceeded their limits
 */
export async function checkLimit(
  userId: string,
  type: "message" | "flow_execution"
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.tenantId) throw new Error("User not found or no tenant");

  const limits = await getTenantLimits(user.tenantId);
  const usage = await getTenantUsage(user.tenantId);

  if (type === "message") {
    const limit = limits.dailyMessageLimit;
    const used = usage.dailyMessages;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: used < limit,
      remaining,
      limit,
    };
  } else if (type === "flow_execution") {
    const limit = limits.flowExecutionCap;
    const used = usage.dailyFlowExecutions;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: used < limit,
      remaining,
      limit,
    };
  }

  throw new Error(`Unknown limit type: ${type}`);
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  userId: string,
  type: "message" | "flow_execution",
  count: number = 1,
  botId?: string,
  channelId?: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    throw new Error("User not found or no tenant");
  }

  const tenantId = user.tenantId;

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  await prisma.usageLog.upsert({
    where: {
      tenantId_type_date_botId_channelId: {
        tenantId,
        type,
        date,
        botId: botId || "",
        channelId: channelId || "",
      },
    },
    create: {
      tenantId,
      type,
      date,
      count,
      botId: botId || null,
      channelId: channelId || null,
    },
    update: {
      count: {
        increment: count,
      },
    },
  });
}

/**
 * Check if tenant can create more bots
 */
export async function canCreateBot(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.tenantId) throw new Error("User not found or no tenant");

  const limits = await getTenantLimits(user.tenantId);
  const usage = await getTenantUsage(user.tenantId);

  return usage.botCount < limits.maxBots;
}
