import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/cron/prune-sessions/route';
import { prisma } from '@/lib/prisma';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: {
      deleteMany: vi.fn(),
    },
  },
}));

describe('Prune Sessions Cron Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });

  it('should return 401 if unauthorized', async () => {
    const req = new Request('http://localhost/api/cron/prune-sessions', {
      headers: {
        'authorization': 'Bearer wrong-secret',
      },
    });

    const response = await GET(req);
    expect(response.status).toBe(401);

    const responsePost = await POST(req);
    expect(responsePost.status).toBe(401);
  });

  it('should call deleteMany and return count', async () => {
    vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 5 });

    const req = new Request('http://localhost/api/cron/prune-sessions', {
      headers: {
        'authorization': 'Bearer test-secret',
      },
    });

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe(5);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { expires: { lt: expect.any(Date) } },
    });
  });
});
