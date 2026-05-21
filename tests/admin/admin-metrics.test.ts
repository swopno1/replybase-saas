import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getMetrics } from "@/app/api/admin/metrics/route";
import { getServerSession } from "next-auth";
import { logAdminActivity } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { messageQueue } from "@/lib/queue";
import { NextRequest } from "next/server";

vi.mock("next-auth");
vi.mock("next-auth/next");
vi.mock("@/lib/prisma", () => ({
  prisma: {
    executionLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin-audit", () => ({
  logAdminActivity: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isPlatformAdmin: vi.fn((session) => session?.user?.role === "ADMIN"),
}));

vi.mock("@/lib/queue", () => ({
  messageQueue: {
    getWaitingCount: vi.fn(),
    getActiveCount: vi.fn(),
    getDelayedCount: vi.fn(),
    getFailedCount: vi.fn(),
    getCompletedCount: vi.fn(),
  },
}));

describe("Admin Metrics API Endpoint GET Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin_123", role: "ADMIN" },
    } as any);
  });

  it("should return 403 Forbidden for non-admin users", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/admin/metrics");
    const res = await getMetrics(req);
    expect(res.status).toBe(403);
    
    const body = await res.json();
    expect(body).toEqual({ error: "Forbidden" });
  });

  it("should retrieve queue stats and calculate latency percentiles correctly when data exists", async () => {
    // Mock queue counts
    vi.mocked(messageQueue.getWaitingCount).mockResolvedValue(10);
    vi.mocked(messageQueue.getActiveCount).mockResolvedValue(2);
    vi.mocked(messageQueue.getDelayedCount).mockResolvedValue(1);
    vi.mocked(messageQueue.getFailedCount).mockResolvedValue(5);
    vi.mocked(messageQueue.getCompletedCount).mockResolvedValue(100);

    // Mock Prisma execution logs with 10 values: 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000
    // Total sum = 5500, average = 550
    // Sorted array: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    // p50 index = ceil(0.5 * 10) - 1 = 5 - 1 = 4. Sorted[4] = 500
    // p95 index = ceil(0.95 * 10) - 1 = 10 - 1 = 9. Sorted[9] = 1000
    const mockLogs = Array.from({ length: 10 }, (_, i) => ({
      executionTime: (i + 1) * 100,
    }));
    vi.mocked(prisma.executionLog.findMany).mockResolvedValue(mockLogs as any);

    const req = new NextRequest("http://localhost/api/admin/metrics", {
      headers: {
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "test-agent",
      },
    });

    const res = await getMetrics(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.queue).toEqual({
      waiting: 10,
      active: 2,
      delayed: 1,
      failed: 5,
      completed: 100,
    });

    expect(body.latency).toEqual({
      average: 550,
      p50: 500,
      p95: 1000,
      min: 100,
      max: 1000,
      count: 10,
    });

    expect(logAdminActivity).toHaveBeenCalledWith({
      adminId: "admin_123",
      action: "METRICS_READ",
      entityType: "METRICS",
      description: "Admin viewed system queue and AI latency performance metrics",
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
    });
  });

  it("should handle empty database records and failed queue calls gracefully", async () => {
    vi.mocked(messageQueue.getWaitingCount).mockRejectedValue(new Error("Redis down"));
    vi.mocked(prisma.executionLog.findMany).mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/admin/metrics");
    const res = await getMetrics(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.queue).toEqual({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
    });

    expect(body.latency).toEqual({
      average: 0,
      p50: 0,
      p95: 0,
      min: 0,
      max: 0,
      count: 0,
    });
  });
});
