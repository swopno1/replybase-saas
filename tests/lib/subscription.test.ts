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
  handlePlanChange,
  handlePlanDowngrade,
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
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    contact: {
      count: vi.fn(),
    },
    channel: {
      count: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
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

// ─── helpers for handlePlanChange tests ──────────────────────────────────────

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan_grow',
    name: 'grow',
    displayName: 'Grow',
    maxBots: 5,
    maxChannelsPerBot: 3,
    ...overrides,
  };
}

function makeBot(id: string, enabled = true) {
  return { id, tenantId: 'tenant_1', enabled, createdAt: new Date() };
}

function makeChannel(id: string, botId: string, isActive = true) {
  return { id, botId, isActive, createdAt: new Date() };
}

describe('handlePlanChange — batch channel query (Task 056)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
    vi.mocked(prisma.bot.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.channel.updateMany).mockResolvedValue({ count: 0 } as any);
  });

  it('returns early when plan is not found', async () => {
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(null);
    await handlePlanChange('tenant_1', 'plan_missing');
    expect(prisma.bot.findMany).not.toHaveBeenCalled();
    expect(prisma.channel.findMany).not.toHaveBeenCalled();
  });

  it('fetches all channels in a SINGLE query regardless of bot count', async () => {
    const plan = makePlan({ maxChannelsPerBot: 2 });
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(plan as any);

    const bots = [makeBot('bot_1'), makeBot('bot_2'), makeBot('bot_3')];
    vi.mocked(prisma.bot.findMany)
      .mockResolvedValueOnce(bots as any)   // allBots
      .mockResolvedValueOnce(bots as any);  // activeBots

    // All channels across all bots in one call
    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      makeChannel('ch_1', 'bot_1'),
      makeChannel('ch_2', 'bot_1'),
      makeChannel('ch_3', 'bot_2'),
      makeChannel('ch_4', 'bot_3'),
    ] as any);

    await handlePlanChange('tenant_1', 'plan_grow');

    // Must be called exactly once (not once per bot)
    expect(prisma.channel.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.channel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { botId: { in: ['bot_1', 'bot_2', 'bot_3'] } },
      }),
    );
  });

  it('disables excess channels in a single updateMany on downgrade', async () => {
    // Downgrade to maxChannelsPerBot=1 — each bot has 2 active channels → 1 excess per bot
    const plan = makePlan({ maxChannelsPerBot: 1 });
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(plan as any);

    const bots = [makeBot('bot_1'), makeBot('bot_2')];
    vi.mocked(prisma.bot.findMany)
      .mockResolvedValueOnce(bots as any)
      .mockResolvedValueOnce(bots as any);

    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      makeChannel('ch_a1', 'bot_1', true),
      makeChannel('ch_a2', 'bot_1', true),  // excess
      makeChannel('ch_b1', 'bot_2', true),
      makeChannel('ch_b2', 'bot_2', true),  // excess
    ] as any);

    await handlePlanChange('tenant_1', 'plan_grow');

    // Only one updateMany call for disabling (none to enable)
    expect(prisma.channel.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.channel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining(['ch_a2', 'ch_b2']) } },
        data: { isActive: false },
      }),
    );
  });

  it('re-enables inactive channels in a single updateMany on upgrade', async () => {
    // Upgrade to maxChannelsPerBot=3 — bot_1 has 1 active + 2 inactive → both should be re-enabled
    const plan = makePlan({ maxChannelsPerBot: 3 });
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(plan as any);

    const bots = [makeBot('bot_1')];
    vi.mocked(prisma.bot.findMany)
      .mockResolvedValueOnce(bots as any)
      .mockResolvedValueOnce(bots as any);

    vi.mocked(prisma.channel.findMany).mockResolvedValue([
      makeChannel('ch_1', 'bot_1', true),
      makeChannel('ch_2', 'bot_1', false),
      makeChannel('ch_3', 'bot_1', false),
    ] as any);

    await handlePlanChange('tenant_1', 'plan_grow');

    expect(prisma.channel.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.channel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining(['ch_2', 'ch_3']) } },
        data: { isActive: true },
      }),
    );
  });

  it('skips channel queries entirely when no active bots remain', async () => {
    const plan = makePlan();
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(plan as any);

    // All bots are disabled
    vi.mocked(prisma.bot.findMany)
      .mockResolvedValueOnce([makeBot('bot_1', false)] as any) // allBots
      .mockResolvedValueOnce([] as any);                       // activeBots (empty)

    await handlePlanChange('tenant_1', 'plan_grow');

    expect(prisma.channel.findMany).not.toHaveBeenCalled();
    expect(prisma.channel.updateMany).not.toHaveBeenCalled();
  });

  it('disables excess bots on downgrade', async () => {
    // Downgrade to maxBots=1 — 3 enabled bots → 2 must be disabled
    const plan = makePlan({ maxBots: 1, maxChannelsPerBot: 5 });
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(plan as any);

    const allBots = [makeBot('bot_1'), makeBot('bot_2'), makeBot('bot_3')];
    vi.mocked(prisma.bot.findMany)
      .mockResolvedValueOnce(allBots as any)     // allBots
      .mockResolvedValueOnce([allBots[0]] as any); // activeBots after adjustment

    vi.mocked(prisma.channel.findMany).mockResolvedValue([] as any);

    await handlePlanChange('tenant_1', 'plan_grow');

    expect(prisma.bot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['bot_2', 'bot_3'] } },
        data: { enabled: false },
      }),
    );
  });

  it('handlePlanDowngrade delegates to handlePlanChange', async () => {
    const plan = makePlan();
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(plan as any);
    vi.mocked(prisma.bot.findMany).mockResolvedValue([] as any);

    await handlePlanDowngrade('tenant_1', 'plan_grow');

    expect(prisma.plan.findUnique).toHaveBeenCalledWith({ where: { id: 'plan_grow' } });
  });
});
