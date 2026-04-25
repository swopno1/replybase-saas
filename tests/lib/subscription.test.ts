import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getTenantLimits, getMonthlyConversationCount } from '@/lib/subscription';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
    },
    crmConversation: {
      count: vi.fn(),
    },
  },
}));

describe('Subscription & Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTenantLimits', () => {
    it('should return plan limits for a specific tenant', async () => {
      const mockTenantId = 'tenant_1';
      const mockPlan = {
        id: 'plan_pro',
        name: 'pro',
        displayName: 'Pro Plan',
        dailyMessageLimit: 500,
        monthlyMessageLimit: 15000,
      };

      vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
        tenantId: mockTenantId,
        status: 'active',
        plan: mockPlan,
      } as any);

      const limits = await getTenantLimits(mockTenantId);

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: mockTenantId,
          }),
        })
      );
      expect(limits.name).toBe('pro');
      expect(limits.dailyMessageLimit).toBe(500);
    });

    it('should return suspended limits if no active subscription exists', async () => {
      vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null);

      const limits = await getTenantLimits('tenant_none');
      expect(limits.name).toBe('suspended');
    });
  });

  describe('getMonthlyConversationCount isolation', () => {
    it('should only count conversations for the specified tenant', async () => {
      const tenantId = 'tenant_A';
      await getMonthlyConversationCount(tenantId);

      expect(prisma.crmConversation.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contact: { tenantId: tenantId },
          }),
        })
      );
    });
  });
});
