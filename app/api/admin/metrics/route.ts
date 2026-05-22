import { NextRequest, NextResponse } from "next/server";
import { logAdminActivity } from "@/lib/admin-audit";
import { messageQueue } from "@/lib/queue";
import { withAdmin } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (session, request, context, db) => {
  await logAdminActivity({
    adminId: session.user.id,
    action: "METRICS_READ",
    entityType: "METRICS",
    description: "Admin viewed system queue and AI latency performance metrics",
    ipAddress: request.headers.get("x-forwarded-for") || undefined,
    userAgent: request.headers.get("user-agent") || undefined,
  });

  // 1. Get queue metrics with safety fallback
  let queueMetrics = {
    waiting: 0,
    active: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
  };

  if (messageQueue && typeof messageQueue.getWaitingCount === "function") {
    try {
      const [waiting, active, delayed, failed, completed] = await Promise.all([
        messageQueue.getWaitingCount(),
        messageQueue.getActiveCount(),
        messageQueue.getDelayedCount(),
        messageQueue.getFailedCount(),
        messageQueue.getCompletedCount(),
      ]);
      queueMetrics = { waiting, active, delayed, failed, completed };
    } catch (err) {
      console.error("Failed to fetch queue metrics from BullMQ:", err);
    }
  }

  // 2. Get AI Latency metrics for the last 24 hours
  let latencyMetrics = {
    average: 0,
    p50: 0,
    p95: 0,
    min: 0,
    max: 0,
    count: 0,
  };

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs = await db.executionLog.findMany({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo,
        },
        executionTime: {
          not: null,
        },
      },
      select: {
        executionTime: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10000,
    });

    const executionTimes = logs
      .map((log) => log.executionTime)
      .filter((time): time is number => time !== null)
      .sort((a, b) => a - b);

    const count = executionTimes.length;
    if (count > 0) {
      const sum = executionTimes.reduce((acc, val) => acc + val, 0);
      const average = sum / count;
      const min = executionTimes[0];
      const max = executionTimes[count - 1];

      const getPercentile = (p: number) => {
        const index = Math.ceil((p / 100) * count) - 1;
        return executionTimes[index];
      };

      latencyMetrics = {
        average,
        p50: getPercentile(50),
        p95: getPercentile(95),
        min,
        max,
        count,
      };
    }
  } catch (err) {
    console.error("Failed to fetch execution logs metrics from Prisma:", err);
  }

  return NextResponse.json({
    queue: queueMetrics,
    latency: latencyMetrics,
  });
});
