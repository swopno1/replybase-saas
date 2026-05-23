import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantLimits, invalidateTenantCache } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
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

describe('Subscription Sync Logic', () => {
  const PLAN_SCALE = { id: 'scale', name: 'scale', displayName: 'Scale', monthlyMessageLimit: 7500 };

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache('tenant_1');
  });

  it('correctly maps active subscription limits', async () => {
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      tenantId: 'tenant_1',
      status: 'ACTIVE',
      plan: PLAN_SCALE,
    } as any);

    const limits = await getTenantLimits('tenant_1');
    expect(limits.name).toBe('scale');
    expect(limits.monthlyMessageLimit).toBe(7500);
  });
});
