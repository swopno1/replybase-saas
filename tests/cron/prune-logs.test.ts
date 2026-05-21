import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/cron/prune-logs/route';
import { prisma } from '@/lib/prisma';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookLog: {
      deleteMany: vi.fn(),
    },
    executionLog: {
      deleteMany: vi.fn(),
    },
    activityLog: {
      deleteMany: vi.fn(),
    },
    webChatEvent: {
      deleteMany: vi.fn(),
    },
  },
}));

describe('Prune Logs Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    // Clear env variables that might be set in other tests
    delete process.env.PRUNE_WEBHOOK_LOG_DAYS;
    delete process.env.PRUNE_EXECUTION_LOG_DAYS;
    delete process.env.PRUNE_ACTIVITY_LOG_DAYS;
    delete process.env.PRUNE_WEBCHAT_EVENT_DAYS;
  });

  it('should return 401 if unauthorized', async () => {
    const req = new Request('http://localhost/api/cron/prune-logs', {
      headers: {
        'authorization': 'Bearer wrong-secret',
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);

    const responsePost = await POST(req);
    expect(responsePost.status).toBe(401);
  });

  it('should prune logs with default settings (30 days for webhook/execution/webchat, 90 for activity)', async () => {
    vi.mocked(prisma.webhookLog.deleteMany).mockResolvedValue({ count: 10 });
    vi.mocked(prisma.executionLog.deleteMany).mockResolvedValue({ count: 20 });
    vi.mocked(prisma.activityLog.deleteMany).mockResolvedValue({ count: 30 });
    vi.mocked(prisma.webChatEvent.deleteMany).mockResolvedValue({ count: 40 });

    const req = new Request('http://localhost/api/cron/prune-logs', {
      headers: {
        'authorization': 'Bearer test-secret',
      },
    });

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deleted).toEqual({
      webhookLogs: 10,
      executionLogs: 20,
      activityLogs: 30,
      webchatEvents: 40,
    });

    // Check webhookLog deletion criteria: default 30 days
    expect(prisma.webhookLog.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
      },
    });
    const webhookCallArg = vi.mocked(prisma.webhookLog.deleteMany).mock.calls[0][0];
    const webhookLtDate = webhookCallArg?.where?.createdAt?.lt;
    expect(webhookLtDate).toBeInstanceOf(Date);
    const expectedWebhookCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // Allow small margin of 2 seconds for execution time differences
    expect(Math.abs(webhookLtDate.getTime() - expectedWebhookCutoff.getTime())).toBeLessThan(2000);

    // Check executionLog deletion criteria: default 30 days
    expect(prisma.executionLog.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
      },
    });

    // Check webChatEvent deletion criteria: default 30 days
    expect(prisma.webChatEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
      },
    });

    // Check activityLog deletion criteria: default 90 days and NOT trial logs or signup intent
    expect(prisma.activityLog.deleteMany).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: expect.any(Date) },
        type: {
          notIn: ['trial_reminder_sent', 'trial_expired', 'signup_intent'],
        },
      },
    });
    const activityCallArg = vi.mocked(prisma.activityLog.deleteMany).mock.calls[0][0];
    const activityLtDate = activityCallArg?.where?.createdAt?.lt;
    expect(activityLtDate).toBeInstanceOf(Date);
    const expectedActivityCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    expect(Math.abs(activityLtDate.getTime() - expectedActivityCutoff.getTime())).toBeLessThan(2000);
  });

  it('should respect custom retention periods configured in environment variables', async () => {
    process.env.PRUNE_WEBHOOK_LOG_DAYS = '15';
    process.env.PRUNE_EXECUTION_LOG_DAYS = '10';
    process.env.PRUNE_ACTIVITY_LOG_DAYS = '45';
    process.env.PRUNE_WEBCHAT_EVENT_DAYS = '5';

    vi.mocked(prisma.webhookLog.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.executionLog.deleteMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.activityLog.deleteMany).mockResolvedValue({ count: 3 });
    vi.mocked(prisma.webChatEvent.deleteMany).mockResolvedValue({ count: 4 });

    const req = new Request('http://localhost/api/cron/prune-logs', {
      headers: {
        'authorization': 'Bearer test-secret',
      },
    });

    await GET(req);

    // Verify webhook pruning configured for 15 days
    const webhookCallArg = vi.mocked(prisma.webhookLog.deleteMany).mock.calls[0][0];
    const webhookLtDate = webhookCallArg?.where?.createdAt?.lt;
    const expectedWebhookCutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(Math.abs(webhookLtDate.getTime() - expectedWebhookCutoff.getTime())).toBeLessThan(2000);

    // Verify execution pruning configured for 10 days
    const executionCallArg = vi.mocked(prisma.executionLog.deleteMany).mock.calls[0][0];
    const executionLtDate = executionCallArg?.where?.createdAt?.lt;
    const expectedExecutionCutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(Math.abs(executionLtDate.getTime() - expectedExecutionCutoff.getTime())).toBeLessThan(2000);

    // Verify activity pruning configured for 45 days
    const activityCallArg = vi.mocked(prisma.activityLog.deleteMany).mock.calls[0][0];
    const activityLtDate = activityCallArg?.where?.createdAt?.lt;
    const expectedActivityCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    expect(Math.abs(activityLtDate.getTime() - expectedActivityCutoff.getTime())).toBeLessThan(2000);

    // Verify webchat event pruning configured for 5 days
    const webchatCallArg = vi.mocked(prisma.webChatEvent.deleteMany).mock.calls[0][0];
    const webchatLtDate = webchatCallArg?.where?.createdAt?.lt;
    const expectedWebchatCutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(Math.abs(webchatLtDate.getTime() - expectedWebchatCutoff.getTime())).toBeLessThan(2000);
  });

  it('should fall back to defaults if environment variables are invalid', async () => {
    process.env.PRUNE_WEBHOOK_LOG_DAYS = 'invalid';
    process.env.PRUNE_EXECUTION_LOG_DAYS = '-10'; // Negative values should be ignored

    vi.mocked(prisma.webhookLog.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.executionLog.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.activityLog.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.webChatEvent.mockRef || prisma.webChatEvent.deleteMany).mockResolvedValue({ count: 0 });

    const req = new Request('http://localhost/api/cron/prune-logs', {
      headers: {
        'authorization': 'Bearer test-secret',
      },
    });

    await GET(req);

    // Verify webhook pruning fell back to 30 days
    const webhookCallArg = vi.mocked(prisma.webhookLog.deleteMany).mock.calls[0][0];
    const webhookLtDate = webhookCallArg?.where?.createdAt?.lt;
    const expectedWebhookCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(webhookLtDate.getTime() - expectedWebhookCutoff.getTime())).toBeLessThan(2000);

    // Verify execution pruning fell back to 30 days
    const executionCallArg = vi.mocked(prisma.executionLog.deleteMany).mock.calls[0][0];
    const executionLtDate = executionCallArg?.where?.createdAt?.lt;
    const expectedExecutionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(Math.abs(executionLtDate.getTime() - expectedExecutionCutoff.getTime())).toBeLessThan(2000);
  });
});
