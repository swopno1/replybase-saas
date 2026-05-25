import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkLimit,
  checkBotLimit,
  checkChannelLimit,
  incrementUsage,
  incrementTenantUsage,
  getTenantLimits,
  usageBuffer,
  invalidateTenantCache,
  getUsageStatus,
  UsageZone,
} from '@/lib/subscription';
import { prisma } from '@/lib/prisma';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    usageLog: {
      aggregate: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
      groupBy: vi.fn(),
    },
    activityLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    bot: {
      count: vi.fn(),
    },
    contact: {
      count: vi.fn(),
    },
    channel: {
      count: vi.fn(),
    },
    crmConversation: {
      count: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// ─── Plan fixtures (must match pricing table exactly) ────────────────────────

const PLAN_FREE = {
  name: 'free',
  displayName: 'Free',
  monthlyMessageLimit: 100,    // AI Responses / Month
  dailyMessageLimit: 100,
  flowExecutionCap: 200,       // Automations / Month
  maxBots: 1,
};

const PLAN_LAUNCH = {
  name: 'launch',
  displayName: 'Launch',
  monthlyMessageLimit: 1000,   // AI Responses / Month
  dailyMessageLimit: 100,
  flowExecutionCap: 1500,      // Automations / Month
  maxBots: 2,
};

const PLAN_GROW = {
  name: 'grow',
  displayName: 'Grow',
  monthlyMessageLimit: 3500,   // AI Responses / Month
  dailyMessageLimit: 250,
  flowExecutionCap: 5000,      // Automations / Month
  maxBots: 5,
};

const PLAN_SCALE = {
  name: 'scale',
  displayName: 'Scale',
  monthlyMessageLimit: 7500,   // AI Responses / Month
  dailyMessageLimit: 500,
  flowExecutionCap: 10000,     // Automations / Month
  maxBots: 10,
};

const PLAN_BUSINESS = {
  name: 'business',
  displayName: 'Business',
  monthlyMessageLimit: 25000,  // AI Responses / Month
  dailyMessageLimit: 1500,
  flowExecutionCap: 40000,     // Automations / Month
  maxBots: 25,
};

function mockActiveSub(plan: Record<string, unknown>) {
  vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
    tenantId: 'tenant_1',
    status: 'ACTIVE',
    plan,
  } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.subscription.findFirst>>>);
}

function mockUser() {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    tenantId: 'tenant_1',
  } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>);
}


function mockUsageLogGrouped(logs: Array<{ date: Date; count: number; type?: string }>) {
  vi.mocked(prisma.usageLog.groupBy).mockResolvedValue(
    logs.map(log => ({
      date: log.date,
      type: log.type || 'message',
      _sum: { count: log.count }
    })) as any
  );
}
function mockUsageLog(count: number) {
  vi.mocked(prisma.usageLog.aggregate).mockResolvedValue({
    _sum: { count },
  } as unknown as Awaited<ReturnType<typeof prisma.usageLog.aggregate>>);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Plan limit values (pricing table compliance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
  });

  it.each([
    ['free',     PLAN_FREE,     100,   200,  1],
    ['launch',   PLAN_LAUNCH,   1000,  1500, 2],
    ['grow',     PLAN_GROW,     3500,  5000, 5],
    ['scale',    PLAN_SCALE,    7500,  10000, 10],
    ['business', PLAN_BUSINESS, 25000, 40000, 25],
  ])(
    '%s plan: monthlyMessageLimit=%d, flowExecutionCap=%d, maxBots=%d',
    async (planName, plan, expectedMessages, expectedFlow, expectedBots) => {
      mockActiveSub(plan);
      const limits = await getTenantLimits('tenant_1');
      expect(limits.monthlyMessageLimit).toBe(expectedMessages);
      expect(limits.flowExecutionCap).toBe(expectedFlow);
      expect(limits.maxBots).toBe(expectedBots);
    },
  );
});

describe('getTenantLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
  });

  it('returns suspended defaults when no subscription and no free plan exists', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null);
    const limits = await getTenantLimits('tenant_1');
    expect(limits.name).toBe('suspended');
    expect(limits.dailyMessageLimit).toBe(0);
    expect(limits.monthlyMessageLimit).toBe(0);
    expect(limits.flowExecutionCap).toBe(0);
  });

  it('returns free plan limits when no subscription but free plan exists', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.plan.findUnique).mockResolvedValue({
      ...PLAN_FREE,
      id: 'plan_free',
      displayName: 'Free',
    } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.plan.findUnique>>>);
    const limits = await getTenantLimits('tenant_1');
    expect(limits.monthlyMessageLimit).toBe(100);
    expect(limits.flowExecutionCap).toBe(200);
    expect(limits.maxBots).toBe(1);
  });

  it('returns active subscription plan limits', async () => {
    mockActiveSub(PLAN_SCALE);
    const limits = await getTenantLimits('tenant_1');
    expect(limits.name).toBe('scale');
    expect(limits.monthlyMessageLimit).toBe(7500);
    expect(limits.flowExecutionCap).toBe(10000);
    expect(limits.maxBots).toBe(10);
  });
});

describe('checkLimit — AI Responses (message type)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
    mockUser();
  });

  it('allows requests under monthly limit', async () => {
    mockActiveSub(PLAN_FREE);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    mockUsageLogGrouped([{ date: today, count: 50 }]);
    const result = await checkLimit('user_1', 'message');
    expect(result.allowed).toBe(true);
  });

  it('blocks requests when monthly limit is exceeded (free: 100 → 110 hard limit)', async () => {
    mockActiveSub(PLAN_FREE);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    mockUsageLogGrouped([{ date: today, count: 110 }]);
    const result = await checkLimit('user_1', 'message');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('blocks at hard limit for launch plan (1000 monthly → 1100 hard)', async () => {
    mockActiveSub(PLAN_LAUNCH);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    mockUsageLogGrouped([{ date: today, count: 1100 }]);
    const result = await checkLimit('user_1', 'message');
    expect(result.allowed).toBe(false);
  });

  it('allows at grace zone for scale plan — monthly only over 100%, daily ok', async () => {
    mockActiveSub(PLAN_SCALE);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    mockUsageLogGrouped([
       { date: today, count: 300 },
       { date: yesterday, count: 7700 } // Total 8000
    ]);
    const result = await checkLimit('user_1', 'message');
    // Grace zone (100%-110%) is still allowed
    expect(result.allowed).toBe(true);
  });
});

describe('checkLimit — Automations (flow_execution type, MONTHLY window)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
    mockUser();
  });

  it('allows flow executions under monthly cap', async () => {
    mockActiveSub(PLAN_FREE);
    mockUsageLog(100); // 100 out of 200
    const result = await checkLimit('user_1', 'flow_execution');
    expect(result.allowed).toBe(true);
  });

  it('blocks flow executions at hard limit (free: 200 cap → 220 hard)', async () => {
    mockActiveSub(PLAN_FREE);
    mockUsageLog(220); // 220 = 200 * 1.10
    const result = await checkLimit('user_1', 'flow_execution');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('allows flow executions at grace zone for launch (1500 cap, usage 1550)', async () => {
    mockActiveSub(PLAN_LAUNCH);
    mockUsageLog(1550); // 1550 / 1500 = 1.033 — grace zone, still allowed
    const result = await checkLimit('user_1', 'flow_execution');
    expect(result.allowed).toBe(true);
  });

  it('blocks flow executions when hard limit exceeded for scale (10000 cap → 11001 blocks)', async () => {
    mockActiveSub(PLAN_SCALE);
    mockUsageLog(11001); // 11001 > 10000 * 1.10
    const result = await checkLimit('user_1', 'flow_execution');
    expect(result.allowed).toBe(false);
  });

  it('returns monthly retryAfter for flow_execution (not daily)', async () => {
    mockActiveSub(PLAN_FREE);
    mockUsageLog(250);
    const result = await checkLimit('user_1', 'flow_execution');
    // retryAfter should be > 1 day (monthly reset)
    const oneDayInSeconds = 60 * 60 * 24;
    expect(result.retryAfter).toBeGreaterThan(oneDayInSeconds);
  });
});

describe('getUsageStatus', () => {
  it('returns SAFE zone at 0%', () => {
    const s = getUsageStatus(0, 1000);
    expect(s.zone).toBe(UsageZone.SAFE);
    expect(s.allowed).toBe(true);
  });

  it('returns WARNING zone at 90%', () => {
    const s = getUsageStatus(900, 1000);
    expect(s.zone).toBe(UsageZone.WARNING);
    expect(s.allowed).toBe(true);
  });

  it('returns GRACE zone at 100%', () => {
    const s = getUsageStatus(1000, 1000);
    expect(s.zone).toBe(UsageZone.GRACE);
    expect(s.allowed).toBe(true);
  });

  it('returns HARD zone at 110%', () => {
    const s = getUsageStatus(1100, 1000);
    expect(s.zone).toBe(UsageZone.HARD);
    expect(s.allowed).toBe(false);
  });

  it('returns HARD zone when limit is 0', () => {
    const s = getUsageStatus(0, 0);
    expect(s.zone).toBe(UsageZone.HARD);
    expect(s.allowed).toBe(false);
  });
});

describe('incrementUsage (buffered)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
    // Flush any leftover state from previous tests
    await usageBuffer.flush();
  });

  it('buffers usage and does not immediately write to DB', async () => {
    mockUser();
    mockActiveSub(PLAN_SCALE);
    mockUsageLog(10);

    await incrementUsage('user_1', 'message', 5);

    expect(prisma.usageLog.upsert).not.toHaveBeenCalled();
  });

  it('writes to DB when buffer is flushed', async () => {
    mockUser();
    mockActiveSub(PLAN_SCALE);
    mockUsageLog(10);

    await incrementUsage('user_1', 'message', 5);
    await usageBuffer.flush();

    expect(prisma.usageLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: 'tenant_1',
          type: 'message',
        }),
      }),
    );
  });
});

describe('incrementTenantUsage (buffered, tenant-direct)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
    // Flush any state left from previous tests
    await usageBuffer.flush();
    mockActiveSub(PLAN_BUSINESS);
    mockUsageLog(0);
  });

  it('buffers flow_execution without a user lookup', async () => {
    await incrementTenantUsage('tenant_1', 'flow_execution', 1);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.usageLog.upsert).not.toHaveBeenCalled();
  });

  it('flushes flow_execution to DB', async () => {
    await incrementTenantUsage('tenant_1', 'flow_execution', 3);
    await usageBuffer.flush();

    expect(prisma.usageLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: 'tenant_1',
          type: 'flow_execution',
        }),
      }),
    );
  });

  it('ignores amounts <= 0', async () => {
    await incrementTenantUsage('tenant_1', 'message', 0);
    await usageBuffer.flush();
    expect(prisma.usageLog.upsert).not.toHaveBeenCalled();
  });
});

describe('checkBotLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
  });

  it('allows bot creation when under limit', async () => {
    mockActiveSub(PLAN_LAUNCH); // maxBots: 2
    vi.mocked(prisma.bot.count).mockResolvedValue(1);
    const result = await checkBotLimit('tenant_1');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(2);
  });

  it('blocks bot creation when at limit', async () => {
    mockActiveSub(PLAN_FREE); // maxBots: 1
    vi.mocked(prisma.bot.count).mockResolvedValue(2);
    const result = await checkBotLimit('tenant_1');
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(1);
  });
});

describe('checkChannelLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
  });

  it('allows channel connection when under limit', async () => {
    mockActiveSub(PLAN_LAUNCH); // maxChannelsPerBot: 2
    vi.mocked(prisma.channel.count).mockResolvedValue(1);
    const result = await checkChannelLimit('tenant_1', 'bot_1');
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
  });

  it('blocks channel connection when at limit', async () => {
    mockActiveSub({ ...PLAN_FREE, maxChannelsPerBot: 1 });
    vi.mocked(prisma.channel.count).mockResolvedValue(2);
    const result = await checkChannelLimit('tenant_1', 'bot_1');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(2);
  });
});
