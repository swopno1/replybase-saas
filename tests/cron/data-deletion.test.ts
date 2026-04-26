import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/cron/process-data-deletions/route';
import { prisma } from '@/lib/prisma';
import { DataDeletionStatus } from '@prisma/client';
import { recordActivity } from '@/lib/activity-log';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    dataDeletionRequest: {
      findMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    facebookPage: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    flowAssignment: {
      deleteMany: vi.fn(),
    },
    flowSession: {
      deleteMany: vi.fn(),
    },
    onboardingSession: {
      deleteMany: vi.fn(),
    },
    lead: {
      deleteMany: vi.fn(),
    },
    crmConversation: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    crmMessage: {
      deleteMany: vi.fn(),
    },
    internalNote: {
      deleteMany: vi.fn(),
    },
    contactIdentity: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    contact: {
      delete: vi.fn(),
    },
    channel: {
      deleteMany: vi.fn(),
    },
    tenantChannelStatus: {
      updateMany: vi.fn(),
    },
    account: {
      deleteMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

// Mock activity-log
vi.mock('@/lib/activity-log', () => ({
  recordActivity: vi.fn(),
  activityLogTypes: [],
}));

describe('Data Deletion Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('should return 401 if unauthorized', async () => {
    const req = new Request('http://localhost/api/cron/process-data-deletions', {
      headers: {
        'authorization': 'Bearer wrong-secret',
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should process pending requests and update status', async () => {
    const mockRequest = {
      id: 'req_123',
      email: 'user@example.com',
      status: DataDeletionStatus.PENDING,
      confirmationCode: 'code_123',
      tenantId: 'tenant_123',
      userId: 'user_123',
    };

    vi.mocked(prisma.dataDeletionRequest.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([mockRequest]);
    vi.mocked(prisma.facebookPage.findMany).mockResolvedValue([]);

    const req = new Request('http://localhost/api/cron/process-data-deletions', {
      headers: {
        'authorization': 'Bearer test-secret',
      },
    });

    const response = await GET(req);
    const data = await response.json();

    expect(data.processed).toBe(1);
    expect(prisma.dataDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_123' },
      data: { status: DataDeletionStatus.IN_PROGRESS },
    });
    expect(prisma.dataDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: 'req_123' },
      data: {
        status: DataDeletionStatus.COMPLETED,
        processedAt: expect.any(Date),
      },
    });
    expect(recordActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'settings_updated',
      tenantId: 'tenant_123',
    }));
  });

  it('should handle Facebook user deletion requests', async () => {
    const mockRequest = {
      id: 'req_fb',
      email: 'psid_123@facebook-user',
      status: DataDeletionStatus.PENDING,
      confirmationCode: 'code_fb',
      tenantId: null,
      userId: null,
    };

    vi.mocked(prisma.dataDeletionRequest.findMany).mockResolvedValueOnce([]).mockResolvedValueOnce([mockRequest]);
    vi.mocked(prisma.contactIdentity.findMany).mockResolvedValue([
      { contactId: 'contact_123', type: 'facebook_psid', value: 'psid_123' }
    ]);
    vi.mocked(prisma.crmConversation.findMany).mockResolvedValue([]);

    const req = new Request('http://localhost/api/cron/process-data-deletions', {
      headers: {
        'authorization': 'Bearer test-secret',
      },
    });

    await GET(req);

    expect(prisma.contactIdentity.findMany).toHaveBeenCalledWith({
      where: { type: 'facebook_psid', value: 'psid_123' },
    });
    expect(prisma.flowSession.deleteMany).toHaveBeenCalled();
  });

  it('should alert for stuck requests', async () => {
    const stuckRequest = {
      id: 'req_stuck',
      email: 'stuck@example.com',
      status: DataDeletionStatus.PENDING,
      confirmationCode: 'code_stuck',
      requestedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      tenantId: 'tenant_stuck',
    };

    vi.mocked(prisma.dataDeletionRequest.findMany).mockResolvedValueOnce([stuckRequest]).mockResolvedValueOnce([]);

    const req = new Request('http://localhost/api/cron/process-data-deletions', {
      headers: {
        'authorization': 'Bearer test-secret',
      },
    });

    await GET(req);

    expect(recordActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'system_event',
      title: 'Data Deletion Alert',
    }));
  });
});
