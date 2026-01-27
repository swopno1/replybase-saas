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
    // Back-compat fields expected by /api/usage
    // These are mocked until analytics are implemented.
    dailyMessages: 0,
    monthlyMessages: messageCount,
    dailyFlowExecutions: 0,
    usage: {
      bots: botCount,
      messages: messageCount
    }
  };
}
// Alias for legacy support
export const getTenantSubscription = getTenantLimits;

/**
 * Rate limiting helpers (used by `lib/rate-limit.ts`)
 *
 * NOTE: This implementation is intentionally conservative and currently "fails open"
 * because detailed usage accounting is not yet implemented in analytics.
 * It enforces hard-zero limits for suspended tenants (limits.dailyMessageLimit === 0).
 */
export async function checkLimit(
  userId: string,
  type: "message" | "flow_execution"
): Promise<{ allowed: boolean; remaining: number; limit: number; retryAfter?: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  const limits = await getTenantLimits(user.tenantId);
  const limit =
    type === "message" ? limits.dailyMessageLimit : limits.flowExecutionCap;

  if (!limit || limit <= 0) {
    return { allowed: false, remaining: 0, limit: 0 };
  }

  // Usage counters are not implemented yet; allow for now.
  return { allowed: true, remaining: limit, limit };
}

export async function incrementUsage(
  userId: string,
  type: "message" | "flow_execution",
  amount: number,
  botId?: string,
  channelId?: string
): Promise<void> {
  // TODO: Persist usage accounting (daily/monthly buckets) and decrement remaining in `checkLimit`.
  // For now, this is a no-op to keep the system functional while analytics are mocked.
  void userId;
  void type;
  void amount;
  void botId;
  void channelId;
}
