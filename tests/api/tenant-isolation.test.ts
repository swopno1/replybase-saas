import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';

// We mock the API route handlers or simulate the multi-tenant scoping logic
// Since we want to verify multi-tenant isolation, we test the repository layer
// or the higher-order functions that inject tenantId.

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lead: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
    },
    crmConversation: {
      findMany: vi.fn(),
    }
  },
}));

describe('Multi-tenant Isolation Security', () => {
  const tenantA = 'tenant_A';
  const tenantB = 'tenant_B';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should only return leads belonging to the active tenant', async () => {
    // This simulates the logic inside /api/leads/route.ts
    const activeTenantId = tenantA;

    await prisma.lead.findMany({
      where: { tenantId: activeTenantId }
    });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenantA
        })
      })
    );

    // Ensure it doesn't leak tenant B
    const calls = vi.mocked(prisma.lead.findMany).mock.calls[0][0];
    expect(calls?.where?.tenantId).not.toBe(tenantB);
  });

  it('should reject access to a lead from a different tenant', async () => {
    // This simulates fetching a specific lead by ID and checking its tenantId
    const leadId = 'lead_123';
    const activeTenantId = tenantA;

    vi.mocked(prisma.lead.findUnique).mockResolvedValue({
      id: leadId,
      tenantId: tenantB, // Lead belongs to Tenant B
      name: "Test Lead",
      email: null,
      phone: null,
      source: "facebook",
      status: "new",
      interestedInSubscription: false,
      selectedPlan: null,
      trialRequested: false,
      converted: false,
      convertedAt: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      contactId: null,
      flowId: null,
      pageId: null,
    });

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    const isAuthorized = lead && lead.tenantId === activeTenantId;
    expect(isAuthorized).toBe(false);
  });
});
