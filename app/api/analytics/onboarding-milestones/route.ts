import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "amirhossain.limon@gmail.com";

/**
 * GET /api/analytics/onboarding-milestones
 * Returns onboarding milestone statistics across all tenants
 * Requires admin access
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Check admin access
    if (
      !session?.user?.id ||
      (!session.user.isAdmin && session.user.email !== ADMIN_EMAIL)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get total tenant count
    const totalTenants = await prisma.tenant.count();

    // Get milestone completion stats
    const [firstChannelEvents, firstReplyEvents] = await Promise.all([
      prisma.onboardingMilestoneEvent.findMany({
        where: { milestoneId: "first-channel" },
        select: { tenantId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.onboardingMilestoneEvent.findMany({
        where: { milestoneId: "first-automated-reply" },
        select: { tenantId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Calculate statistics
    const firstChannelStats = {
      completedCount: firstChannelEvents.length,
      completionRate:
        totalTenants > 0 ? firstChannelEvents.length / totalTenants : 0,
      averageDaysToCompletion:
        firstChannelEvents.length > 0
          ? firstChannelEvents.reduce((sum: number, e, i) => {
              if (i === 0) return 0;
              const prev = firstChannelEvents[i - 1].createdAt;
              const current = e.createdAt;
              return (
                sum +
                (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
              );
            }, 0) / Math.max(1, firstChannelEvents.length - 1)
          : 0,
      firstCompletionDate:
        firstChannelEvents.length > 0 ? firstChannelEvents[0].createdAt : null,
      lastCompletionDate:
        firstChannelEvents.length > 0
          ? firstChannelEvents[firstChannelEvents.length - 1].createdAt
          : null,
    };

    const firstReplyStats = {
      completedCount: firstReplyEvents.length,
      completionRate:
        totalTenants > 0 ? firstReplyEvents.length / totalTenants : 0,
      averageDaysToCompletion:
        firstReplyEvents.length > 0
          ? firstReplyEvents.reduce((sum: number, e, i) => {
              if (i === 0) return 0;
              const prev = firstReplyEvents[i - 1].createdAt;
              const current = e.createdAt;
              return (
                sum +
                (current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
              );
            }, 0) / Math.max(1, firstReplyEvents.length - 1)
          : 0,
      firstCompletionDate:
        firstReplyEvents.length > 0 ? firstReplyEvents[0].createdAt : null,
      lastCompletionDate:
        firstReplyEvents.length > 0
          ? firstReplyEvents[firstReplyEvents.length - 1].createdAt
          : null,
    };

    // Calculate time-to-completion for first-channel to first-reply
    const timeToSecondMilestone: { min: number; max: number; avg: number } = {
      min: Infinity,
      max: 0,
      avg: 0,
    };

    if (firstChannelEvents.length > 0 && firstReplyEvents.length > 0) {
      const times: number[] = [];
      for (const replyEvent of firstReplyEvents) {
        const channelEvent = firstChannelEvents.find(
          (e: (typeof firstChannelEvents)[0]) =>
            e.tenantId === replyEvent.tenantId,
        );
        if (channelEvent) {
          const days =
            (replyEvent.createdAt.getTime() -
              channelEvent.createdAt.getTime()) /
            (1000 * 60 * 60 * 24);
          times.push(days);
        }
      }

      if (times.length > 0) {
        timeToSecondMilestone.min = Math.min(...times);
        timeToSecondMilestone.max = Math.max(...times);
        timeToSecondMilestone.avg =
          times.reduce((sum, t) => sum + t, 0) / times.length;
      }
    }

    // Get daily activation trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyEvents = await prisma.onboardingMilestoneEvent.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by date
    const dailyTrendMap = new Map<string, number>();
    for (const event of dailyEvents) {
      const dateStr = event.createdAt.toISOString().split("T")[0];
      dailyTrendMap.set(dateStr, (dailyTrendMap.get(dateStr) || 0) + 1);
    }

    const dailyTrend = Array.from(dailyTrendMap.entries()).map(
      ([date, count]) => ({
        date,
        count,
      }),
    );

    return NextResponse.json({
      totalTenants,
      milestones: {
        firstChannel: firstChannelStats,
        firstAutomatedReply: firstReplyStats,
      },
      timeBetweenMilestones: timeToSecondMilestone,
      dailyTrend,
      meta: {
        timestamp: new Date().toISOString(),
        dataWindow: "all_time",
      },
    });
  } catch (error) {
    console.error("[Analytics] Error fetching onboarding statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}
