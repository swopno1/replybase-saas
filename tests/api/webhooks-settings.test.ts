import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as route from '@/app/api/settings/webhooks/route';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookSubscription: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/route-helpers', () => ({
  withAuthAndTenant: (handler: any) => {
    return async (req: any, context: any) => {
      return handler({ tenantId: 'test-tenant-id' }, req, context, prisma);
    };
  },
}));

vi.mock('@/lib/subscription', () => ({
  getTenantLimits: vi.fn().mockResolvedValue({ name: 'business' }),
}));

vi.mock('@/lib/plans', () => ({
  getPlanConfig: vi.fn().mockReturnValue({ apiAccess: true, displayName: 'Business' }),
}));

describe('Webhooks Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET should return tenant webhooks', async () => {
    const mockWebhooks = [{ id: '1', name: 'Test' }];
    (prisma.webhookSubscription.findMany as any).mockResolvedValue(mockWebhooks);

    const req = new NextRequest('http://localhost/api/settings/webhooks');
    const res = await route.GET(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(data).toEqual(mockWebhooks);
    expect(prisma.webhookSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'test-tenant-id' }
    }));
  });

  it('POST should create a new webhook for eligible plan', async () => {
    const { getTenantLimits } = await import('@/lib/subscription');
    const { getPlanConfig } = await import('@/lib/plans');
    (getTenantLimits as any).mockResolvedValue({ name: 'business' });
    (getPlanConfig as any).mockReturnValue({ apiAccess: true, displayName: 'Business' });

    const payload = {
      name: 'New Webhook',
      url: 'https://example.com/hook',
      eventTypes: ['lead.created'],
      isActive: true
    };
    (prisma.webhookSubscription.create as any).mockResolvedValue({ id: '2', ...payload });

    const req = new NextRequest('http://localhost/api/settings/webhooks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const res = await route.POST(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe('2');
    expect(prisma.webhookSubscription.create).toHaveBeenCalled();
  });

  it('POST should block creation on ineligible plan', async () => {
    const { getTenantLimits } = await import('@/lib/subscription');
    const { getPlanConfig } = await import('@/lib/plans');
    (getTenantLimits as any).mockResolvedValue({ name: 'free' });
    (getPlanConfig as any).mockReturnValue({ apiAccess: false, displayName: 'Free' });

    const req = new NextRequest('http://localhost/api/settings/webhooks', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', url: 'https://example.com', eventTypes: ['lead.created'] })
    });
    const res = await route.POST(req, { params: Promise.resolve({}) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('Scale or Business');
  });

  it('POST should reject unsupported event types', async () => {
    const { getTenantLimits } = await import('@/lib/subscription');
    const { getPlanConfig } = await import('@/lib/plans');
    (getTenantLimits as any).mockResolvedValue({ name: 'business' });
    (getPlanConfig as any).mockReturnValue({ apiAccess: true, displayName: 'Business' });

    const req = new NextRequest('http://localhost/api/settings/webhooks', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', url: 'https://example.com', eventTypes: ['fake.event'] })
    });
    const res = await route.POST(req, { params: Promise.resolve({}) });

    expect(res.status).toBe(400);
  });
});
