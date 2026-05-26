import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLimit, checkTenantUsageLimits } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
    usageLog: {
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    crmConversation: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('AI Overage Logic', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('should allow usage when limit is exceeded but allowOverage is true (checkLimit)', async () => {
    const tenantId = 'tenant-overage-on-' + Math.random();
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-1', tenantId });

    (prisma.subscription.findFirst as any).mockResolvedValue({
      status: 'ACTIVE',
      allowOverage: true,
      plan: {
        id: 'plan-1',
        name: 'pro',
        displayName: 'Pro',
        dailyMessageLimit: 100,
        monthlyMessageLimit: 1000,
        flowExecutionCap: 500,
      },
    });

    (prisma.usageLog.groupBy as any).mockResolvedValue([
      { _sum: { count: 2000 }, date: new Date() }
    ]);

    const result = await checkLimit('user-1', 'message');

    expect(result.allowed).toBe(true);
    expect(result.status.allowed).toBe(true);
  });

  it('should deny usage when limit is exceeded and allowOverage is false (checkLimit)', async () => {
    const tenantId = 'tenant-overage-off-' + Math.random();
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'user-2', tenantId });

    (prisma.subscription.findFirst as any).mockResolvedValue({
      status: 'ACTIVE',
      allowOverage: false,
      plan: {
        id: 'plan-1',
        name: 'pro',
        displayName: 'Pro',
        dailyMessageLimit: 100,
        monthlyMessageLimit: 1000,
        flowExecutionCap: 500,
      },
    });

    (prisma.usageLog.groupBy as any).mockResolvedValue([
      { _sum: { count: 2000 }, date: new Date() }
    ]);

    const result = await checkLimit('user-2', 'message');

    expect(result.allowed).toBe(false);
    expect(result.status.allowed).toBe(false);
  });

  it('should allow usage when limit is exceeded but allowOverage is true (checkTenantUsageLimits)', async () => {
    const tenantId = 'tenant-overage-on-tenant-' + Math.random();
    (prisma.subscription.findFirst as any).mockResolvedValue({
      status: 'ACTIVE',
      allowOverage: true,
      plan: {
        id: 'plan-1',
        name: 'pro',
        displayName: 'Pro',
        dailyMessageLimit: 100,
        monthlyMessageLimit: 1000,
        flowExecutionCap: 500,
      },
    });

    (prisma.usageLog.groupBy as any).mockResolvedValue([
      { _sum: { count: 2000 }, date: new Date() }
    ]);

    const result = await checkTenantUsageLimits(tenantId, 'message');

    expect(result.allowed).toBe(true);
  });
});
