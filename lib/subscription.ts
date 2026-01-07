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
 * Get tenant's subscription plan or default to free
 */
export async function getUserSubscription(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    throw new Error("User not found or no tenant");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: user.tenantId },
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
    tenantId: user.tenantId,
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
 * Get subscription limits for a user
 */
export async function getUserLimits(
  userId: string
): Promise<SubscriptionLimits> {
  const subscription = await getUserSubscription(userId);
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
 * Get current usage stats for a tenant
 */
export async function getUserUsage(
  userId: string,
  date: Date = new Date()
): Promise<UsageStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    throw new Error("User not found or no tenant");
  }

  const tenantId = user.tenantId;

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
  const limits = await getUserLimits(userId);
  const usage = await getUserUsage(userId);

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
  const limits = await getUserLimits(userId);
  const usage = await getUserUsage(userId);

  return usage.botCount < limits.maxBots;
}
