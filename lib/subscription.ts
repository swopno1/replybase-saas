import logger from "./logger";
import { prisma } from "@/lib/prisma";
import { redis } from "./redis";

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

// --- Subscription Logic & Caching ---

const TENANT_LIMITS_CACHE = new Map<string, { data: any; expires: number }>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

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

/**
 * Optimized lookup for subscription status to avoid frequent DB hits in middleware/auth.
 * Uses the same 5-minute TTL cache as getTenantLimits.
 */
export async function getTenantSubscriptionStatus(tenantId: string): Promise<string> {
  const limits = await getTenantLimits(tenantId);
  return limits.subscriptionStatus || "active";
}

export async function getTenantLimits(tenantId: string) {
  const now = Date.now();

  // 1. Check L1 Cache (In-memory)
  const cachedL1 = TENANT_LIMITS_CACHE.get(tenantId);
  if (cachedL1 && cachedL1.expires > now) {
    return cachedL1.data;
  }

  // 2. Check L2 Cache (Redis)
  const cacheKey = `limits:${tenantId}`;
  try {
    const cachedL2 = await redis.get(cacheKey);
    if (cachedL2) {
      const data = JSON.parse(cachedL2);
      // Backfill L1
      TENANT_LIMITS_CACHE.set(tenantId, { data, expires: now + CACHE_TTL_MS });
      return data;
    }
  } catch (err) {
    logger.error({ error: err, tenantId }, "[Subscription] Redis cache get failed");
  }

  // 3. Database Lookup
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
      };
    }
  } else {
    limits = {
      ...subscription.plan,
      planName: subscription.plan.displayName,
      subscriptionStatus: subscription.status.toLowerCase(),
    };
  }

  // 4. Update Caches
  try {
    // Update L1
    TENANT_LIMITS_CACHE.set(tenantId, {
      data: limits,
      expires: now + CACHE_TTL_MS,
    });

    // Basic L1 size management
    if (TENANT_LIMITS_CACHE.size > 1000) {
      const firstKey = TENANT_LIMITS_CACHE.keys().next().value;
      if (firstKey) TENANT_LIMITS_CACHE.delete(firstKey);
    }

    // Update L2 (Redis)
    await redis.set(cacheKey, JSON.stringify(limits), "EX", 3600); // 1 hour TTL
  } catch (err) {
    logger.error({ error: err, tenantId }, "[Subscription] Cache update failed");
  }

  return limits;
}

/**
 * Clear cache for a specific tenant across all layers.
 * Useful when subscription or plan changes.
 */
export async function invalidateTenantCache(tenantId: string) {
  // Clear L1
  TENANT_LIMITS_CACHE.delete(tenantId);

  // Clear L2
  try {
    await redis.del(`limits:${tenantId}`);
  } catch (err) {
    logger.error({ error: err, tenantId }, "[Subscription] Redis cache invalidate failed");
  }
}

// Alias for backward compatibility if needed, though we should migrate to invalidateTenantCache
export const invalidateTenantLimitsCache = invalidateTenantCache;

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

  const [botCount, contactCount, dailyMessages, monthlyMessages, monthlyFlowExecutions] =
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
      // flowExecutionCap is a MONTHLY limit — count the full billing month
      getUsageCount({
        tenantId,
        type: "flow_execution",
        startDate: monthStart,
        endDate: startOfNextUtcMonth(monthStart),
      }),
    ]);

  return {
    ...limits,
    dailyMessages,
    monthlyMessages,
    monthlyFlowExecutions,
    usage: {
      bots: botCount,
      contacts: contactCount,
      messages: monthlyMessages,
      flowExecutions: monthlyFlowExecutions,
    },
  };
}

/**
 * Check if a bot can add more channels based on the plan's maxChannelsPerBot limit.
 */
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
    planName: limits.displayName || limits.name,
    status,
  }
}

export const checkBotLimits = checkBotLimit;

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

/**
 * Check tenant-wide limits for background processes where userId is not available.
 */
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
    return { allowed: status.allowed, current, limit, status };
  }

  if (type === "message") {
    const dailyLimit = limits.dailyMessageLimit;
    const monthlyLimit = limits.monthlyMessageLimit;

    // Check monthly first as it's the primary constraint
    const monthlyUsage = await getUsageCount({
      tenantId,
      type: "message",
      startDate: startOfUtcMonth(now),
      endDate: startOfNextUtcMonth(now),
    });
    const monthlyStatus = getUsageStatus(monthlyUsage, monthlyLimit);
    if (!monthlyStatus.allowed) {
      return { allowed: false, current: monthlyUsage, limit: monthlyLimit, status: monthlyStatus };
    }

    // Check daily
    const dailyUsage = await getUsageCount({
      tenantId,
      type: "message",
      startDate: today,
      endDate: startOfNextUtcDay(today),
    });
    const dailyStatus = getUsageStatus(dailyUsage, dailyLimit);
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
  return { allowed: status.allowed, current, limit, status };
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

  // flowExecutionCap is a MONTHLY limit — check against the full billing month
  const monthlyUsage = await getUsageCount({
    tenantId: user.tenantId,
    type: "flow_execution",
    startDate: startOfUtcMonth(now),
    endDate: startOfNextUtcMonth(now),
  });

  const status = getUsageStatus(monthlyUsage, limit);
  const remaining = Math.max(limit * HARD_LIMIT_THRESHOLD - monthlyUsage, 0);

  return {
    allowed: status.allowed,
    remaining: Math.floor(remaining),
    limit,
    retryAfter: secondsUntil(startOfNextUtcMonth(now), now),
    status,
  };
}

/**
 * Usage Buffering System
 * Redesign for scalability to prevent DB bottleneck on high-frequency writes.
 */

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
    // Ensure the process doesn't wait for this timer to exit
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

    // Proactive flush if buffer gets too large
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
      // Process in batches to avoid overwhelming the connection pool
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
      // Re-add failed entries back to buffer?
      // For simplicity in this MVP-to-Scale refactor, we log error.
      // In a production system, we would use a proper queue (Redis/SQS).
    } finally {
      this.isFlushing = false;
    }
  }
}

// Singleton instance
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

  // Add to in-memory buffer instead of immediate DB write
  usageBuffer.add({
    tenantId,
    type,
    date,
    botId: normalizedBotId,
    channelId: normalizedChannelId,
    count: amount,
  });

  // Background notification check
  // Note: Since usage is buffered, notification might be slightly delayed
  // This is an acceptable trade-off for scalability.
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

  const usageRatio = current / limit;
  let threshold = 0;

  // Define thresholds: 0.9, 1.0, 1.1
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
    // Get the current billing period to avoid spamming multiple alerts in the same period
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      select: { currentPeriodStart: true },
    });
    const periodStart = subscription?.currentPeriodStart || startOfUtcMonth();

    // Check if we already sent this specific threshold alert for this period
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
      const title =
        threshold >= 1.1
          ? "Critical Usage Limit: Service Restricted"
          : threshold >= 1.0
            ? "Usage Limit Reached"
            : `Usage Warning (${Math.floor(threshold * 100)}%)`;

      const description = `Your ${type.replace("_", " ")} usage has reached ${Math.floor(usageRatio * 100)}% of your plan limit (${current}/${limit}).`;

      // 1. Create In-App Notification (ActivityLog)
      await prisma.activityLog.create({
        data: {
          tenantId,
          type: logType,
          title,
          description,
          metadata: { threshold, current, limit, type },
        },
      });

      // 2. Send Email to Admins
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
  threshold >= 1.1
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

// Alias for legacy support
export const getTenantSubscription = getTenantLimits;
