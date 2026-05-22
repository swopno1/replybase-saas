import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    ping: vi.fn(),
  },
}));

describe('Health Check API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return 200 OK when all dependencies are healthy', async () => {
    (prisma.$queryRaw as any).mockResolvedValueOnce([1]);
    (redis.ping as any).mockResolvedValueOnce('PONG');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.dependencies.database).toBe('ok');
    expect(data.dependencies.redis).toBe('ok');
  });

  it('should return 503 when database is unreachable', async () => {
    (prisma.$queryRaw as any).mockRejectedValueOnce(new Error('DB Connection Failed'));
    (redis.ping as any).mockResolvedValueOnce('PONG');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('error');
    expect(data.dependencies.database).toBe('error');
    expect(data.dependencies.redis).toBe('ok');
  });

  it('should return 503 when redis is unreachable', async () => {
    (prisma.$queryRaw as any).mockResolvedValueOnce([1]);
    (redis.ping as any).mockRejectedValueOnce(new Error('Redis Connection Failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('error');
    expect(data.dependencies.database).toBe('ok');
    expect(data.dependencies.redis).toBe('error');
  });

  it('should return 503 when both dependencies are unreachable', async () => {
    (prisma.$queryRaw as any).mockRejectedValueOnce(new Error('DB Connection Failed'));
    (redis.ping as any).mockRejectedValueOnce(new Error('Redis Connection Failed'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('error');
    expect(data.dependencies.database).toBe('error');
    expect(data.dependencies.redis).toBe('error');
  });
});
