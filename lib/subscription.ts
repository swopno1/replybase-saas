// Count unique conversations created in the current month for Automations / Month
export async function getMonthlyConversationCount(
  tenantId: string,
): Promise<number> {
  const monthStart = startOfUtcMonth();
  const monthEnd = startOfNextUtcMonth(monthStart);
  return prisma.crmConversation.count({
    where: {
      contact: { tenantId },
      createdAt: {
        gte: monthStart,
        lt: monthEnd,
      },
    },
  });
}
import { prisma } from "@/lib/prisma";

const AGGREGATE_BOT_ID = "__aggregate_bot__";
const AGGREGATE_CHANNEL_ID = "__aggregate_channel__";

function startOfUtcDay(date = new Date()): Date {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function startOfUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcDay(date = new Date()): Date {
  const value = startOfUtcDay(date);
  value.setUTCDate(value.getUTCDate() + 1);
  return value;
}

function startOfNextUtcMonth(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function secondsUntil(target: Date, from = new Date()): number {
  return Math.max(1, Math.ceil((target.getTime() - from.getTime()) / 1000));
}

function normalizeUsageDimension(
  value: string | undefined,
  fallback: string,
): string {
  return value && value.length > 0 ? value : fallback;
}

async function getUsageCount(input: {
  tenantId: string;
  type: "message" | "flow_execution";
  startDate: Date;
  endDate?: Date;
}): Promise<number> {
  const result = await prisma.usageLog.aggregate({
    where: {
      tenantId: input.tenantId,
      type: input.type,
      date: input.endDate
        ? {
            gte: input.startDate,
            lt: input.endDate,
          }
        : {
            gte: input.startDate,
          },
    },
    _sum: {
      count: true,
    },
  });

  return result._sum.count ?? 0;
}

async function getActiveSubscriptionWithPlan(tenantId: string) {
  return prisma.subscription.findFirst({
    where: {
      tenantId,
      status: {
        in: ["active", "trialing"],
      },
    },
    include: { plan: true },
    orderBy: {
      currentPeriodEnd: "desc",
    },
  });
}

export async function getTenantLimits(tenantId: string) {
  const subscription = await getActiveSubscriptionWithPlan(tenantId);

  if (!subscription) {
    return {
      maxBots: 0,
      dailyMessageLimit: 0,
      name: "suspended",
      displayName: "Suspended",
      planName: "Suspended", // Legacy/Extra
      id: "suspended",
      currency: "GBP",
      price: 0,
      monthlyMessageLimit: 0,
      flowExecutionCap: 0,
      maxChannelsPerBot: 0,
      maxConversations: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      features: [],
    };
  }

  return {
    ...subscription.plan,
  };
}

export async function checkBotLimit(tenantId: string) {
  const limits = await getTenantLimits(tenantId);

  const botCount = await prisma.bot.count({
    where: { tenantId },
  });

  return {
    allowed: botCount < limits.maxBots,
    limit: limits.maxBots,
    current: botCount,
    planName: limits.displayName || limits.name,
  };
}

// Added missing export
export async function getTenantUsage(tenantId: string) {
  const limits = await getTenantLimits(tenantId);
  const today = startOfUtcDay();
  const monthStart = startOfUtcMonth();

  const [botCount, dailyMessages, monthlyMessages, dailyFlowExecutions] =
    await Promise.all([
      prisma.bot.count({
        where: { tenantId },
      }),
      getUsageCount({
        tenantId,
        type: "message",
        startDate: today,
        endDate: startOfNextUtcDay(today),
      }),
      getUsageCount({
        tenantId,
        type: "message",
        startDate: monthStart,
        endDate: startOfNextUtcMonth(monthStart),
      }),
      getUsageCount({
        tenantId,
        type: "flow_execution",
        startDate: today,
        endDate: startOfNextUtcDay(today),
      }),
    ]);

  return {
    ...limits,
    dailyMessages,
    monthlyMessages,
    dailyFlowExecutions,
    usage: {
      bots: botCount,
      messages: monthlyMessages,
    },
  };
}
// Alias for legacy support
export const getTenantSubscription = getTenantLimits;

/**
 * Rate limiting helpers (used by `lib/rate-limit.ts`)
 *
 * Enforces persisted usage limits using the `usage_logs` table.
 */
export async function checkLimit(
  userId: string,
  type: "message" | "flow_execution",
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  const limits = await getTenantLimits(user.tenantId);
  const now = new Date();
  const today = startOfUtcDay(now);

  if (type === "message") {
    const dailyLimit = limits.dailyMessageLimit;
    const monthlyLimit = limits.monthlyMessageLimit;

    if (!dailyLimit || dailyLimit <= 0 || !monthlyLimit || monthlyLimit <= 0) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const [dailyUsage, monthlyUsage] = await Promise.all([
      getUsageCount({
        tenantId: user.tenantId,
        type: "message",
        startDate: today,
        endDate: startOfNextUtcDay(today),
      }),
      getUsageCount({
        tenantId: user.tenantId,
        type: "message",
        startDate: startOfUtcMonth(now),
        endDate: startOfNextUtcMonth(now),
      }),
    ]);

    const dailyRemaining = Math.max(dailyLimit - dailyUsage, 0);
    const monthlyRemaining = Math.max(monthlyLimit - monthlyUsage, 0);

    if (dailyRemaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        limit: dailyLimit,
        retryAfter: secondsUntil(startOfNextUtcDay(now), now),
      };
    }

    if (monthlyRemaining <= 0) {
      return {
        allowed: false,
        remaining: 0,
        limit: monthlyLimit,
        retryAfter: secondsUntil(startOfNextUtcMonth(now), now),
      };
    }

    const monthlyIsTighter = monthlyRemaining < dailyRemaining;
    return {
      allowed: true,
      remaining: monthlyIsTighter ? monthlyRemaining : dailyRemaining,
      limit: monthlyIsTighter ? monthlyLimit : dailyLimit,
      retryAfter: monthlyIsTighter
        ? secondsUntil(startOfNextUtcMonth(now), now)
        : secondsUntil(startOfNextUtcDay(now), now),
    };
  }

  const limit = limits.flowExecutionCap;
  if (!limit || limit <= 0) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  const dailyUsage = await getUsageCount({
    tenantId: user.tenantId,
    type: "flow_execution",
    startDate: today,
    endDate: startOfNextUtcDay(today),
  });

  const remaining = Math.max(limit - dailyUsage, 0);
  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      retryAfter: secondsUntil(startOfNextUtcDay(now), now),
    };
  }

  return {
    allowed: true,
    remaining,
    limit,
    retryAfter: secondsUntil(startOfNextUtcDay(now), now),
  };
}

export async function incrementUsage(
  userId: string,
  type: "message" | "flow_execution",
  amount: number,
  botId?: string,
  channelId?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId || amount <= 0) {
    return;
  }

  const date = startOfUtcDay();
  const normalizedBotId = normalizeUsageDimension(botId, AGGREGATE_BOT_ID);
  const normalizedChannelId = normalizeUsageDimension(
    channelId,
    AGGREGATE_CHANNEL_ID,
  );

  await prisma.usageLog.upsert({
    where: {
      tenantId_type_date_botId_channelId: {
        tenantId: user.tenantId,
        type,
        date,
        botId: normalizedBotId,
        channelId: normalizedChannelId,
      },
    },
    create: {
      tenantId: user.tenantId,
      userId: null,
      botId: normalizedBotId,
      channelId: normalizedChannelId,
      type,
      count: amount,
      date,
    },
    update: {
      count: {
        increment: amount,
      },
    },
  });
}
