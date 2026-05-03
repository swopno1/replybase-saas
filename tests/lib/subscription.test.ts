import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkLimit, incrementUsage, getTenantLimits, usageBuffer } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    usageLog: {
      aggregate: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    activityLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    bot: {
      count: vi.fn(),
    },
    crmConversation: {
      count: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    }
  },
}));

describe('Subscription Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTenantLimits', () => {
    it('should return suspended defaults if no subscription exists', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);
      const limits = await getTenantLimits('tenant_1');
      expect(limits.name).toBe('suspended');
      expect(limits.dailyMessageLimit).toBe(0);
    });

    it('should return plan details if subscription exists', async () => {
      const mockSub = {
        tenantId: 'tenant_1',
        status: 'active',
        plan: {
          name: 'pro',
          dailyMessageLimit: 100,
          monthlyMessageLimit: 3000,
          flowExecutionCap: 500,
        }
      };
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(mockSub as unknown as NonNullable<Awaited<ReturnType<typeof prisma.subscription.findFirst>>>);
      const limits = await getTenantLimits('tenant_1');
      expect(limits.name).toBe('pro');
      expect(limits.dailyMessageLimit).toBe(100);
    });
  });

  describe('checkLimit', () => {
    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ tenantId: 'tenant_1' } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        status: 'active',
        plan: { dailyMessageLimit: 100, monthlyMessageLimit: 3000, flowExecutionCap: 10 }
      } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.subscription.findFirst>>>);
    });

    it('should allow if under daily limit', async () => {
      vi.mocked(prisma.usageLog.aggregate).mockResolvedValue({ _sum: { count: 50 } } as unknown as Awaited<ReturnType<typeof prisma.usageLog.aggregate>>);
      const result = await checkLimit('user_1', 'message');
      expect(result.allowed).toBe(true);
      // HARD_LIMIT_THRESHOLD is 1.10 (10%), so limit is effectively 110
      expect(result.remaining).toBe(60);
    });

    it('should block if over daily limit', async () => {
      vi.mocked(prisma.usageLog.aggregate).mockResolvedValue({ _sum: { count: 110 } } as unknown as Awaited<ReturnType<typeof prisma.usageLog.aggregate>>);
      const result = await checkLimit('user_1', 'message');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('incrementUsage', () => {
    it('should buffer usage and flush to DB', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ tenantId: 'tenant_1' } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>);
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        status: 'active',
        plan: { dailyMessageLimit: 100, flowExecutionCap: 100 }
      } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.subscription.findFirst>>>);
      vi.mocked(prisma.usageLog.aggregate).mockResolvedValue({ _sum: { count: 10 } } as unknown as Awaited<ReturnType<typeof prisma.usageLog.aggregate>>);

      await incrementUsage('user_1', 'message', 5);

      // Should NOT have called upsert immediately
      expect(prisma.usageLog.upsert).not.toHaveBeenCalled();

      // Manually flush the buffer
      await usageBuffer.flush();

      expect(prisma.usageLog.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({
          count: 5,
          tenantId: 'tenant_1'
        })
      }));
    });
  });
});
