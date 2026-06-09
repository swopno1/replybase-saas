import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import logger from "./logger";
import { getPlanConfig } from "./plans";

// Date utilities (inline to avoid import issues)
export function startOfUtcDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function startOfNextUtcDay(date: Date = new Date()): Date {
  const d = startOfUtcDay(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function startOfUtcMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function startOfNextUtcMonth(date: Date = new Date()): Date {
  const d = startOfUtcMonth(date);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export function secondsUntil(end: Date, start: Date = new Date()): number {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
}

const TENANT_LIMITS_CACHE = new Map<string, { data: any; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const AGGREGATE_BOT_ID = "ALL_BOTS";
const AGGREGATE_CHANNEL_ID = "ALL_CHANNELS";
const WARNING_THRESHOLD = 0.9; // 90% usage
const HARD_LIMIT_THRESHOLD = 1.1; // 110% usage

export enum UsageZone {
  SAFE = "SAFE",
  NORMAL = "NORMAL",
  WARNING = "WARNING",
  GRACE = "GRACE",
  EXCEEDED = "EXCEEDED",
  HARD = "HARD",
}

export interface UsageStatus {
  zone: UsageZone;
  ratio: number;
  message: string;
  allowed: boolean;
}

async function getUsageCount(input: {
  tenantId: string;
  type: "message" | "flow_execution";
  startDate: Date;
  endDate: Date;
}) {
  const result = await prisma.usageLog.aggregate({
    where: {
      tenantId: input.tenantId,
      type: input.type,
      date: {
        gte: input.startDate,
        lt: input.endDate,
      },
    },
    _sum: {
      count: true,
    },
  });

  return result._sum.count || 0;
}

export async function getMonthlyConversationCount(
  tenantId: string,
): Promise<number> {
  const now = new Date();
  const start = startOfUtcMonth(now);
  const end = startOfNextUtcMonth(now);

  return prisma.crmConversation.count({
    where: {
      tenantId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });
}

function normalizeUsageDimension(val: string | undefined, fallback: string) {
  return val || fallback;
}

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

export async function getTenantSubscriptionStatus(tenantId: string): Promise<string> {
  const limits = await getTenantLimits(tenantId);
  return limits.subscriptionStatus || "inactive";
}

export async function getTenantLimits(tenantId: string) {
  const now = Date.now();

  const cachedL1 = TENANT_LIMITS_CACHE.get(tenantId);
  if (cachedL1 && cachedL1.expires > now) {
    return cachedL1.data;
  }

  const cacheKey = `limits:${tenantId}`;
  try {
    const cachedL2 = await redis.get(cacheKey);
    if (cachedL2) {
      const data = JSON.parse(cachedL2);
      TENANT_LIMITS_CACHE.set(tenantId, { data, expires: now + CACHE_TTL_MS });
      return data;
    }
  } catch (err) {
    logger.error({ error: err, tenantId }, "[Subscription] Redis cache get failed");
  }

  const subscription = await getActiveSubscriptionWithPlan(tenantId);

  let limits;
  if (!subscription) {
    const freePlan = await prisma.plan.findUnique({
      where: { name: "free" },
    });

    if (freePlan) {
      limits = {
        ...freePlan,
        planName: freePlan.displayName,
        subscriptionStatus: "active",
        allowOverage: false,
      };
    } else {
      limits = {
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
        subscriptionStatus: "inactive",
        allowOverage: false,
      };
    }
  } else {
    limits = {
      ...subscription.plan,
      planName: subscription.plan.displayName,
      allowOverage: false,
      subscriptionStatus: subscription.status.toLowerCase(),
    };
  }

  try {
    TENANT_LIMITS_CACHE.set(tenantId, {
      data: limits,
      expires: now + CACHE_TTL_MS,
    });

    // Evict oldest 20% of entries when the cache exceeds 500 to prevent unbounded growth
    if (TENANT_LIMITS_CACHE.size > 500) {
      const evictCount = Math.ceil(TENANT_LIMITS_CACHE.size * 0.2);
      const keys = TENANT_LIMITS_CACHE.keys();
      for (let i = 0; i < evictCount; i++) {
        const next = keys.next();
        if (next.done) break;
        TENANT_LIMITS_CACHE.delete(next.value);
      }
    }

    await redis.set(cacheKey, JSON.stringify(limits), "EX", 3600);
  } catch (err) {
    logger.error({ error: err, tenantId }, "[Subscription] Cache update failed");
  }

  return limits;
}

export async function invalidateTenantCache(tenantId: string) {
  // Delete Redis first — if we deleted in-memory first, a concurrent request could
  // repopulate in-memory from stale Redis before we get to delete it.
  try {
    await redis.del(`limits:${tenantId}`);
  } catch (err) {
    logger.error({ error: err, tenantId }, "[Subscription] Redis cache invalidate failed");
  }
  TENANT_LIMITS_CACHE.delete(tenantId);
}

export const invalidateTenantLimitsCache = invalidateTenantCache;


export async function getTenantUsage(tenantId: string) {
  const now = new Date();
  const today = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const monthEnd = startOfNextUtcMonth(now);

  const usageLogs = await prisma.usageLog.groupBy({
    by: ["type", "date"],
    where: {
      tenantId,
      date: {
        gte: monthStart,
        lt: monthEnd,
      },
    },
    _sum: {
      count: true,
    },
  });

  let dailyMessages = 0;
  let monthlyMessages = 0;
  let monthlyFlowExecutions = 0;
  const todayTime = today.getTime();

  for (const log of usageLogs) {
    const count = log._sum.count ?? 0;
    if (log.type === "message") {
      monthlyMessages += count;
      if (log.date.getTime() === todayTime) {
        dailyMessages = count;
      }
    } else if (log.type === "flow_execution") {
      monthlyFlowExecutions += count;
    }
  }

  return {
    dailyMessages,
    monthlyMessages,
    monthlyFlowExecutions,
  };
}

export async function handlePlanDowngrade(tenantId: string, newPlanId: string) {
  return handlePlanChange(tenantId, newPlanId);
}

export async function handlePlanChange(tenantId: string, newPlanId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: newPlanId },
  });

  if (!plan) return;

  // Re-enable disabled bots up to the new plan's limit (covers upgrade path)
  const allBots = await prisma.bot.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  const enabledBots = allBots.filter((b) => b.enabled);
  const disabledBots = allBots.filter((b) => !b.enabled);

  if (enabledBots.length < plan.maxBots && disabledBots.length > 0) {
    const slotsAvailable = plan.maxBots - enabledBots.length;
    const botsToReEnable = disabledBots.slice(0, slotsAvailable);
    await prisma.bot.updateMany({
      where: { id: { in: botsToReEnable.map((b) => b.id) } },
      data: { enabled: true },
    });
  }

  // Disable excess bots beyond the new plan's limit (covers downgrade path)
  if (enabledBots.length > plan.maxBots) {
    const excessBots = enabledBots.slice(plan.maxBots);
    await prisma.bot.updateMany({
      where: { id: { in: excessBots.map((b) => b.id) } },
      data: { enabled: false },
    });
  }

  // Re-read bots after adjustments to handle channels correctly
  const activeBots = await prisma.bot.findMany({
    where: { tenantId, enabled: true },
    orderBy: { createdAt: "asc" },
  });

  for (const bot of activeBots) {
    const allChannels = await prisma.channel.findMany({
      where: { botId: bot.id },
      orderBy: { createdAt: "asc" },
    });

    const activeChannels = allChannels.filter((c) => c.isActive);
    const inactiveChannels = allChannels.filter((c) => !c.isActive);

    // Re-enable inactive channels up to the new limit
    if (activeChannels.length < plan.maxChannelsPerBot && inactiveChannels.length > 0) {
      const slotsAvailable = plan.maxChannelsPerBot - activeChannels.length;
      const channelsToReEnable = inactiveChannels.slice(0, slotsAvailable);
      await prisma.channel.updateMany({
        where: { id: { in: channelsToReEnable.map((c) => c.id) } },
        data: { isActive: true },
      });
    }

    // Disable excess channels beyond the new limit
    if (activeChannels.length > plan.maxChannelsPerBot) {
      const excessChannels = activeChannels.slice(plan.maxChannelsPerBot);
      await prisma.channel.updateMany({
        where: { id: { in: excessChannels.map((c) => c.id) } },
        data: { isActive: false },
      });
    }
  }
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
      message: "Limit exceeded.",
      allowed: false,
    };
  }

  if (ratio >= 1.0) {
    return {
      zone: UsageZone.GRACE,
      ratio,
      message: "Plan limit reached.",
      allowed: true,
    };
  }

  if (ratio >= WARNING_THRESHOLD) {
    return {
      zone: UsageZone.WARNING,
      ratio,
      message: "Approaching plan limit.",
      allowed: true,
    };
  }

  return {
    zone: UsageZone.SAFE,
    ratio,
    message: "Usage within limits.",
    allowed: true,
  };
}

export async function checkChannelLimit(tenantId: string, botId: string) {
  const limits = await getTenantLimits(tenantId);
  const channelCount = await prisma.channel.count({
    where: { botId, isActive: true },
  });

  const status = getUsageStatus(channelCount, limits.maxChannelsPerBot);

  return {
    allowed: status.allowed,
    limit: limits.maxChannelsPerBot,
    current: channelCount,
    planName: (limits as { planName?: string }).planName ?? "Free",
  };
}

export async function checkBotLimit(tenantId: string): Promise<{ allowed: boolean; limit: number; current: number; planName: string }> {
  const limits = await getTenantLimits(tenantId);
  const botCount = await prisma.bot.count({
    where: { tenantId },
  });

  const status = getUsageStatus(botCount, limits.maxBots);

  return {
    allowed: status.allowed,
    limit: limits.maxBots,
    current: botCount,
    planName: (limits as { planName?: string }).planName ?? "Free",
  };
}

export async function checkTenantUsageLimits(
  tenantId: string,
  type: "message" | "conversation" | "flow_execution"
): Promise<{ allowed: boolean; current: number; limit: number; status: UsageStatus }> {
  const limits = await getTenantLimits(tenantId);
  const now = new Date();
  const today = startOfUtcDay(now);

  if (type === "conversation") {
    const limit = limits.maxConversations;
    const current = await getMonthlyConversationCount(tenantId);
    const status = getUsageStatus(current, limit);
    return {
      allowed: limits.allowOverage ? true : status.allowed,
      current,
      limit,
      status: limits.allowOverage ? { ...status, allowed: true } : status
    };
  }

  if (type === "message") {
    const dailyLimit = limits.dailyMessageLimit;
    const monthlyLimit = limits.monthlyMessageLimit;

    const usageLogs = await prisma.usageLog.groupBy({
      by: ["date"],
      where: {
        tenantId,
        type: "message",
        date: {
          gte: startOfUtcMonth(now),
          lt: startOfNextUtcMonth(now),
        },
      },
      _sum: {
        count: true,
      },
    });

    let dailyUsage = 0;
    let monthlyUsage = 0;
    const todayTime = today.getTime();

    for (const log of usageLogs) {
      const count = log._sum.count ?? 0;
      monthlyUsage += count;
      if (log.date.getTime() === todayTime) {
        dailyUsage = count;
      }
    }

    const monthlyStatus = getUsageStatus(monthlyUsage, monthlyLimit);
    const dailyStatus = getUsageStatus(dailyUsage, dailyLimit);

    if (limits.allowOverage) {
      return {
        allowed: true,
        current: monthlyUsage > dailyUsage ? monthlyUsage : dailyUsage,
        limit: monthlyUsage > dailyUsage ? monthlyLimit : dailyLimit,
        status: { ...(monthlyStatus.ratio > dailyStatus.ratio ? monthlyStatus : dailyStatus), allowed: true }
      };
    }

    if (!monthlyStatus.allowed) {
      return { allowed: false, current: monthlyUsage, limit: monthlyLimit, status: monthlyStatus };
    }

    return { allowed: dailyStatus.allowed, current: dailyUsage, limit: dailyLimit, status: dailyStatus };
  }

  const limit = limits.flowExecutionCap;
  const current = await getUsageCount({
    tenantId,
    type: "flow_execution",
    startDate: startOfUtcMonth(now),
    endDate: startOfNextUtcMonth(now),
  });
  const status = getUsageStatus(current, limit);
  return {
    allowed: limits.allowOverage ? true : status.allowed,
    current,
    limit,
    status: limits.allowOverage ? { ...status, allowed: true } : status
  };
}

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

    const usageLogs = await prisma.usageLog.groupBy({
      by: ["date"],
      where: {
        tenantId: user.tenantId,
        type: "message",
        date: {
          gte: startOfUtcMonth(now),
          lt: startOfNextUtcMonth(now),
        },
      },
      _sum: {
        count: true,
      },
    });

    let dailyUsage = 0;
    let monthlyUsage = 0;
    const todayTime = today.getTime();

    for (const log of usageLogs) {
      const count = log._sum.count ?? 0;
      monthlyUsage += count;
      if (log.date.getTime() === todayTime) {
        dailyUsage = count;
      }
    }

    const dailyStatus = getUsageStatus(dailyUsage, dailyLimit);
    const monthlyStatus = getUsageStatus(monthlyUsage, monthlyLimit);

    const status = monthlyStatus.zone === UsageZone.HARD || dailyStatus.zone === UsageZone.HARD
      ? (monthlyStatus.zone === UsageZone.HARD ? monthlyStatus : dailyStatus)
      : (monthlyStatus.ratio > dailyStatus.ratio ? monthlyStatus : dailyStatus);

    const dailyRemaining = Math.max(dailyLimit * HARD_LIMIT_THRESHOLD - dailyUsage, 0);
    const monthlyRemaining = Math.max(monthlyLimit * HARD_LIMIT_THRESHOLD - monthlyUsage, 0);

    const monthlyIsTighter = monthlyRemaining < dailyRemaining;

    return {
      allowed: limits.allowOverage ? true : status.allowed,
      remaining: Math.floor(monthlyIsTighter ? monthlyRemaining : dailyRemaining),
      limit: monthlyIsTighter ? monthlyLimit : dailyLimit,
      retryAfter: monthlyIsTighter
        ? secondsUntil(startOfNextUtcMonth(now), now)
        : secondsUntil(startOfNextUtcDay(now), now),
      status: limits.allowOverage ? { ...status, allowed: true } : status,
    };
  }

  const limit = limits.flowExecutionCap;
  if (!limit || limit <= 0) {
    const status = { zone: UsageZone.HARD, ratio: 1, message: "Limit reached.", allowed: false };
    return { allowed: false, remaining: 0, limit: 0, status };
  }

  const monthlyUsage = await getUsageCount({
    tenantId: user.tenantId,
    type: "flow_execution",
    startDate: startOfUtcMonth(now),
    endDate: startOfNextUtcMonth(now),
  });

  const status = getUsageStatus(monthlyUsage, limit);
  const remaining = Math.max(limit * HARD_LIMIT_THRESHOLD - monthlyUsage, 0);

  return {
    allowed: limits.allowOverage ? true : status.allowed,
    remaining: Math.floor(remaining),
    limit,
    retryAfter: secondsUntil(startOfNextUtcMonth(now), now),
    status: limits.allowOverage ? { ...status, allowed: true } : status,
  };
}

interface UsageEntry {
  tenantId: string;
  type: "message" | "flow_execution";
  date: Date;
  botId: string;
  channelId: string;
  count: number;
}

class UsageBuffer {
  private buffer: Map<string, UsageEntry> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(private intervalMs: number = 10000) {
    if (typeof window === "undefined") {
      this.startFlushTimer();
    }
  }

  private startFlushTimer() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => this.flush(), this.intervalMs);
    if (this.flushInterval.unref) {
      this.flushInterval.unref();
    }
  }

  private getEntryKey(entry: Omit<UsageEntry, "count">): string {
    return `${entry.tenantId}:${entry.type}:${entry.date.toISOString()}:${entry.botId}:${entry.channelId}`;
  }

  public add(entry: UsageEntry) {
    const key = this.getEntryKey(entry);
    const existing = this.buffer.get(key);
    if (existing) {
      existing.count += entry.count;
    } else {
      this.buffer.set(key, { ...entry });
    }

    if (this.buffer.size >= 100) {
      this.flush();
    }
  }

  public async flush() {
    if (this.isFlushing || this.buffer.size === 0) return;
    this.isFlushing = true;

    const entries = Array.from(this.buffer.values());
    this.buffer.clear();

    try {
      for (const entry of entries) {
        await prisma.usageLog.upsert({
          where: {
            tenantId_type_date_botId_channelId: {
              tenantId: entry.tenantId,
              type: entry.type,
              date: entry.date,
              botId: entry.botId,
              channelId: entry.channelId,
            },
          },
          create: {
            tenantId: entry.tenantId,
            userId: null,
            botId: entry.botId,
            channelId: entry.channelId,
            type: entry.type,
            count: entry.count,
            date: entry.date,
          },
          update: {
            count: {
              increment: entry.count,
            },
          },
        });
      }
    } catch (error) {
      logger.error({ error: error }, "[UsageBuffer] Failed to flush usage logs:");
    } finally {
      this.isFlushing = false;
    }
  }
}

export const usageBuffer = new UsageBuffer();

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

  if (!user?.tenantId) {
    return;
  }

  return incrementTenantUsage(user.tenantId, type, amount, botId, channelId);
}

export async function incrementTenantUsage(
  tenantId: string,
  type: "message" | "flow_execution",
  amount: number,
  botId?: string,
  channelId?: string,
): Promise<void> {
  if (amount <= 0) {
    return;
  }

  const date = startOfUtcDay();
  const normalizedBotId = normalizeUsageDimension(botId, AGGREGATE_BOT_ID);
  const normalizedChannelId = normalizeUsageDimension(
    channelId,
    AGGREGATE_CHANNEL_ID,
  );

  usageBuffer.add({
    tenantId,
    type,
    date,
    botId: normalizedBotId,
    channelId: normalizedChannelId,
    count: amount,
  });

  setTimeout(async () => {
    try {
      const limits = await getTenantLimits(tenantId);
      const now = new Date();
      const usageCount = await getUsageCount({
        tenantId,
        type,
        startDate: type === "message" ? startOfUtcMonth(now) : startOfUtcDay(now),
        endDate: type === "message" ? startOfNextUtcMonth(now) : startOfNextUtcDay(now),
      });

      await notifyUsageIfNeeded(
        tenantId,
        type === "message" ? "monthly_messages" : "flow_executions",
        usageCount,
        type === "message" ? limits.monthlyMessageLimit : limits.flowExecutionCap
      );
    } catch (err) {
      logger.error({ error: err }, "Error in background usage notification:");
    }
  }, 0);
}

async function notifyUsageIfNeeded(
  tenantId: string,
  type: string,
  current: number,
  limit: number,
) {
  if (limit <= 0) return;

  const limits = await getTenantLimits(tenantId);
  const isOverageEnabled = limits.allowOverage;

  const usageRatio = current / limit;
  let threshold = 0;

  if (usageRatio >= 1.1) {
    threshold = 1.1;
  } else if (usageRatio >= 1.0) {
    threshold = 1.0;
  } else if (usageRatio >= WARNING_THRESHOLD) {
    threshold = WARNING_THRESHOLD;
  }

  if (threshold === 0) return;

  const logType =
    threshold >= 1.1
      ? "USAGE_LIMIT_RESTRICTED"
      : threshold >= 1.0
        ? "USAGE_LIMIT_EXCEEDED"
        : "USAGE_LIMIT_WARNING";

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      select: { currentPeriodStart: true },
    });
    const periodStart = subscription?.currentPeriodStart || startOfUtcMonth();

    const existing = await prisma.activityLog.findFirst({
      where: {
        tenantId,
        type: logType,
        metadata: {
          path: ["threshold"],
          equals: threshold,
        },
        createdAt: { gte: periodStart },
      },
    });

    if (!existing) {
      let title =
        threshold >= 1.1
          ? "Critical Usage Limit: Service Restricted"
          : threshold >= 1.0
            ? "Usage Limit Reached"
            : `Usage Warning (${Math.floor(threshold * 100)}%)`;

      let description = `Your ${type.replace("_", " ")} usage has reached ${Math.floor(usageRatio * 100)}% of your plan limit (${current}/${limit}).`;

      if (isOverageEnabled && threshold >= 1.0) {
        title = threshold >= 1.1 ? "Critical Usage: Overage Billing Active" : "Usage Limit Reached: Overage Billing Active";
        description += " Overage billing is enabled, so your service will remain active and you will be charged for the extra usage.";
      }

      await prisma.activityLog.create({
        data: {
          tenantId,
          type: logType,
          title,
          description,
          metadata: { threshold, current, limit, type },
        },
      });

      const admins = await prisma.user.findMany({
        where: { tenantId, isAdmin: true },
        select: { email: true, name: true },
      });

      const adminEmails = admins
        .map((a) => a.email)
        .filter((e): e is string => !!e);

      if (adminEmails.length > 0) {
        const { sendEmail } = await import("@/lib/email");
        const upgradeUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/settings?tab=billing`;

        await sendEmail({
          to: adminEmails,
          subject: `[ReplyBase] ${title}`,
          text: `
Hi there,

This is an automated alert regarding your ReplyBase usage.

${description}

${
  isOverageEnabled && threshold >= 1.0
    ? "Your service remains active because AI Overage is enabled. Additional usage will be charged manually at the end of the billing period."
    : threshold >= 1.1
      ? "Your service has been restricted to protect your account. Please upgrade immediately to restore full functionality."
      : threshold >= 1.0
        ? "You have reached your plan limit. Please consider upgrading to avoid service interruption."
        : "You are nearing your plan limit. We recommend checking your usage and considering an upgrade soon."
}

You can manage your subscription and upgrade here:
${upgradeUrl}

Best regards,
The ReplyBase Team
          `.trim(),
        });
      }

      logger.info(
        `[Usage Alert] Tenant ${tenantId} reached ${threshold * 100}% of ${type}. Notification sent.`,
      );
    }
  } catch (err) {
    logger.error({ error: err }, "Failed to process usage notification:");
  }
}

export async function isChannelTypeAllowed(tenantId: string, type: string) {
  const limits = await getTenantLimits(tenantId);
  const planName = limits.name?.toLowerCase() || "free";
  const config = getPlanConfig(planName);
  const allowedChannels = (config as any).allowedChannels || ["web"];
  const isAllowed = allowedChannels.includes(type.toLowerCase());

  return {
    allowed: isAllowed,
    planName: config.displayName,
    allowedChannels,
  };
}

export async function checkChannelLimitWithType(tenantId: string, botId: string, type: string) {
  const [limitStatus, typeStatus] = await Promise.all([
    checkChannelLimit(tenantId, botId),
    isChannelTypeAllowed(tenantId, type)
  ]);

  if (!typeStatus.allowed) {
    return {
      allowed: false,
      error: "UNSUPPORTED_CHANNEL",
      message: `The ${type} channel is not supported on the ${typeStatus.planName} plan. Please upgrade to access this channel.`,
      limit: limitStatus.limit,
      current: limitStatus.current
    };
  }

  if (!limitStatus.allowed) {
    return {
      allowed: false,
      error: "LIMIT_REACHED",
      message: `You have reached the maximum of ${limitStatus.limit} channels per bot on the ${limitStatus.planName} plan. Please upgrade.`,
      limit: limitStatus.limit,
      current: limitStatus.current
    };
  }

  return {
    allowed: true,
    limit: limitStatus.limit,
    current: limitStatus.current
  };
}
