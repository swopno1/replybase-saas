import { prisma } from "@/lib/prisma";

const AGGREGATE_BOT_ID = "__aggregate_bot__";
const AGGREGATE_CHANNEL_ID = "__aggregate_channel__";

// Industry standards for usage management
const WARNING_THRESHOLD = 0.9;  // 90% usage
const GRACE_THRESHOLD = 1.0;    // 100% usage
const HARD_LIMIT_THRESHOLD = 1.1; // 110% usage

export enum UsageZone {
  SAFE = "SAFE",
  WARNING = "WARNING",
  GRACE = "GRACE",
  HARD = "HARD",
}

export interface UsageStatus {
  zone: UsageZone;
  ratio: number;
  message: string;
  allowed: boolean;
}

// --- Date Utilities ---

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

// --- Helper Functions ---

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

// --- Subscription Logic ---

async function getActiveSubscriptionWithPlan(tenantId: string) {
  return prisma.subscription.findFirst({
    where: {
      tenantId,
      status: {
        in: ["ACTIVE", "TRIALING"],
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
    const freePlan = await prisma.plan.findUnique({
      where: { name: "free" },
    });

    if (freePlan) {
      return {
        ...freePlan,
        planName: freePlan.displayName,
      };
    }

    return {
      maxBots: 0,
      dailyMessageLimit: 0,
      name: "suspended",
      displayName: "Suspended",
      planName: "Suspended",
      id: "suspended",
      currency: "GBP",
      price: 0,
      monthlyMessageLimit: 0,
      flowExecutionCap: 0,
      maxChannelsPerBot: 0,
      maxConversations: 0,
      maxContacts: 0,
      maxIntegrations: 0,
      maxFlows: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      features: [],
    };
  }

  return {
    ...subscription.plan,
    planName: subscription.plan.displayName,
  };
}

export function getUsageStatus(current: number, limit: number): UsageStatus {
  if (limit <= 0) {
    return {
      zone: UsageZone.HARD,
      ratio: 1,
      message: "Limit reached. Please upgrade your plan.",
      allowed: false,
    };
  }

  const ratio = current / limit;

  if (ratio >= HARD_LIMIT_THRESHOLD) {
    return {
      zone: UsageZone.HARD,
      ratio,
      message: "Hard limit exceeded. Action blocked.",
      allowed: false,
    };
  }

  if (ratio >= GRACE_THRESHOLD) {
    return {
      zone: UsageZone.GRACE,
      ratio,
      message: "You've exceeded your limit. Upgrade recommended to avoid service interruption.",
      allowed: true,
    };
  }

  if (ratio >= WARNING_THRESHOLD) {
    return {
      zone: UsageZone.WARNING,
      ratio,
      message: "You're nearing your limit. Consider upgrading soon.",
      allowed: true,
    };
  }

  return {
    zone: UsageZone.SAFE,
    ratio,
    message: "",
    allowed: true,
  };
}

// --- Usage Monitoring ---

export async function getTenantUsage(tenantId: string) {
  const limits = await getTenantLimits(tenantId);
  const today = startOfUtcDay();
  const monthStart = startOfUtcMonth();

  const [botCount, contactCount, dailyMessages, monthlyMessages, dailyFlowExecutions] =
    await Promise.all([
      prisma.bot.count({
        where: { tenantId },
      }),
      prisma.contact.count({
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
      contacts: contactCount,
      messages: monthlyMessages,
    },
  };
}

export async function checkBotLimit(tenantId: string) {
  const limits = await getTenantLimits(tenantId);
  const botCount = await prisma.bot.count({
    where: { tenantId },
  });

  const status = getUsageStatus(botCount, limits.maxBots);

  return {
    allowed: status.allowed,
    limit: limits.maxBots,
    current: botCount,
    planName: limits.displayName || limits.name,
    status,
  };
}

// --- Downgrade Handling ---

export async function handlePlanDowngrade(tenantId: string, newPlanId: string) {
  const newPlan = await prisma.plan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) return;

  // 1. Check Bot/Integration limits
  const bots = await prisma.bot.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  if (bots.length > newPlan.maxBots) {
    const botsToDeactivate = bots.slice(newPlan.maxBots);
    await prisma.bot.updateMany({
      where: { id: { in: botsToDeactivate.map((b) => b.id) } },
      data: { enabled: false },
    });
    
    await prisma.activityLog.create({
      data: {
        tenantId,
        type: "PLAN_DOWNGRADE_ADJUSTMENT",
        title: "Integration Limits Adjusted",
        description: `Downgraded to ${newPlan.displayName}. ${botsToDeactivate.length} bot(s) were deactivated but your data is preserved.`,
      }
    });
  }

  // 2. Check Channels per bot
  for (const bot of bots) {
    const channels = await prisma.channel.findMany({
      where: { botId: bot.id },
      orderBy: { createdAt: "asc" },
    });

    if (channels.length > newPlan.maxChannelsPerBot) {
      const channelsToDeactivate = channels.slice(newPlan.maxChannelsPerBot);
      await prisma.channel.updateMany({
        where: { id: { in: channelsToDeactivate.map((c) => c.id) } },
        data: { enabled: false },
      });
    }
  }
}

// --- Rate Limiting Enforcement ---

export async function checkLimit(
  userId: string,
  type: "message" | "flow_execution",
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
  status: UsageStatus;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { 
      allowed: false, 
      remaining: 0, 
      limit: 0,
      status: { zone: UsageZone.HARD, ratio: 1, message: "Unauthorized", allowed: false }
    };
  }

  const limits = await getTenantLimits(user.tenantId);
  const now = new Date();
  const today = startOfUtcDay(now);

  if (type === "message") {
    const dailyLimit = limits.dailyMessageLimit;
    const monthlyLimit = limits.monthlyMessageLimit;

    if (!dailyLimit || dailyLimit <= 0 || !monthlyLimit || monthlyLimit <= 0) {
      const status = { zone: UsageZone.HARD, ratio: 1, message: "No active plan limits found.", allowed: false };
      return { allowed: false, remaining: 0, limit: 0, status };
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

    const dailyStatus = getUsageStatus(dailyUsage, dailyLimit);
    const monthlyStatus = getUsageStatus(monthlyUsage, monthlyLimit);

    const status = monthlyStatus.zone === UsageZone.HARD || dailyStatus.zone === UsageZone.HARD
      ? (monthlyStatus.zone === UsageZone.HARD ? monthlyStatus : dailyStatus)
      : (monthlyStatus.ratio > dailyStatus.ratio ? monthlyStatus : dailyStatus);

    const dailyRemaining = Math.max(dailyLimit * HARD_LIMIT_THRESHOLD - dailyUsage, 0);
    const monthlyRemaining = Math.max(monthlyLimit * HARD_LIMIT_THRESHOLD - monthlyUsage, 0);

    const monthlyIsTighter = monthlyRemaining < dailyRemaining;
    
    return {
      allowed: status.allowed,
      remaining: Math.floor(monthlyIsTighter ? monthlyRemaining : dailyRemaining),
      limit: monthlyIsTighter ? monthlyLimit : dailyLimit,
      retryAfter: monthlyIsTighter
        ? secondsUntil(startOfNextUtcMonth(now), now)
        : secondsUntil(startOfNextUtcDay(now), now),
      status,
    };
  }

  const limit = limits.flowExecutionCap;
  if (!limit || limit <= 0) {
    const status = { zone: UsageZone.HARD, ratio: 1, message: "Limit reached.", allowed: false };
    return { allowed: false, remaining: 0, limit: 0, status };
  }

  const dailyUsage = await getUsageCount({
    tenantId: user.tenantId,
    type: "flow_execution",
    startDate: today,
    endDate: startOfNextUtcDay(today),
  });

  const status = getUsageStatus(dailyUsage, limit);
  const remaining = Math.max(limit * HARD_LIMIT_THRESHOLD - dailyUsage, 0);

  return {
    allowed: status.allowed,
    remaining: Math.floor(remaining),
    limit,
    retryAfter: secondsUntil(startOfNextUtcDay(now), now),
    status,
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

  // Check for notifications after incrementing
  const limits = await getTenantLimits(user.tenantId);
  const now = new Date();
  
  if (type === "message") {
    const dailyUsage = await getUsageCount({
      tenantId: user.tenantId,
      type: "message",
      startDate: startOfUtcDay(now),
      endDate: startOfNextUtcDay(now),
    });
    await notifyUsageIfNeeded(user.tenantId, "daily_messages", dailyUsage, limits.dailyMessageLimit);
  } else if (type === "flow_execution") {
    const dailyUsage = await getUsageCount({
      tenantId: user.tenantId,
      type: "flow_execution",
      startDate: startOfUtcDay(now),
      endDate: startOfNextUtcDay(now),
    });
    await notifyUsageIfNeeded(user.tenantId, "flow_executions", dailyUsage, limits.flowExecutionCap);
  }
}

async function notifyUsageIfNeeded(tenantId: string, type: string, current: number, limit: number) {
  if (limit <= 0) return;
  
  const usageRatio = current / limit;
  let threshold = 0;

  if (usageRatio >= 1.0) {
    threshold = 1.0;
  } else if (usageRatio >= WARNING_THRESHOLD) {
    threshold = WARNING_THRESHOLD;
  }

  if (threshold === 0) return;

  const logType = threshold === 1.0 ? "USAGE_LIMIT_EXCEEDED" : "USAGE_LIMIT_WARNING";
  
  try {
    const today = startOfUtcDay();
    const existing = await prisma.activityLog.findFirst({
      where: {
        tenantId,
        type: logType,
        createdAt: { gte: today }
      }
    });

    if (!existing) {
      await prisma.activityLog.create({
        data: {
          tenantId,
          type: logType,
          title: threshold === 1.0 ? "Usage Limit Reached" : `Usage Warning (${Math.floor(threshold * 100)}%)`,
          description: `Your ${type.replace('_', ' ')} usage has reached ${Math.floor(usageRatio * 100)}% of your plan limit (${current}/${limit}).`,
          metadata: { threshold, current, limit, type }
        }
      });
      console.log(`[Usage Alert] Tenant ${tenantId} reached ${threshold * 100}% of ${type}`);
    }
  } catch (err) {
    console.error("Failed to process usage notification:", err);
  }
}

// Alias for legacy support
export const getTenantSubscription = getTenantLimits;
