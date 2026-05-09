import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantLimits, invalidateTenantCache } from '@/lib/subscription';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

// Mock Prisma
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

// Mock Redis
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

describe('Subscription Cache Invalidation (Seamless Update & Manual Grant)', () => {
  const tenantId = 'test-tenant-123';
  
  const PLAN_FREE = { id: 'free', name: 'free', displayName: 'Free', monthlyMessageLimit: 100 };
  const PLAN_PRO = { id: 'pro', name: 'pro', displayName: 'Pro', monthlyMessageLimit: 7500 };

  beforeEach(() => {
    vi.clearAllMocks();
    invalidateTenantCache(tenantId);
  });

  it('should reflect new limits immediately after invalidation', async () => {
    // 1. Setup: Start as Free
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue(null); // No paid sub
    vi.mocked(prisma.plan.findUnique).mockResolvedValue(PLAN_FREE as any);
    vi.mocked(redis.get).mockResolvedValue(null);

    // Initial fetch - should be Free
    const limits1 = await getTenantLimits(tenantId);
    expect(limits1.name).toBe('free');
    expect(limits1.monthlyMessageLimit).toBe(100);

    // 2. Setup: Admin grants Pro in DB
    vi.mocked(prisma.subscription.findFirst).mockResolvedValue({
      tenantId,
      status: 'ACTIVE',
      plan: PLAN_PRO,
    } as any);

    // Fetch again without invalidation - should STILL be Free due to in-memory cache
    const limits2 = await getTenantLimits(tenantId);
    expect(limits2.name).toBe('free'); // Cached!

    // 3. Invalidate Cache
    await invalidateTenantCache(tenantId);
    expect(redis.del).toHaveBeenCalledWith(`limits:${tenantId}`);

    // 4. Fetch again - should now be Pro
    const limits3 = await getTenantLimits(tenantId);
    expect(limits3.name).toBe('pro');
    expect(limits3.monthlyMessageLimit).toBe(7500);
  });

  it('should handle redis failures gracefully during invalidation', async () => {
    vi.mocked(redis.del).mockRejectedValue(new Error('Redis Down'));
    
    // Invalidation should not throw
    await expect(invalidateTenantCache(tenantId)).resolves.not.toThrow();
  });
});
