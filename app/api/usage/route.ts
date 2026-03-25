import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { getTenantUsage, getTenantLimits } from "@/lib/subscription";
import { authOptions } from "@/lib/auth";
import {
  getConversationsPerBot,
  getMessagesPerChannel,
  getAiVsHumanRatio,
  getResolutionTime,
} from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';




// GET: Get usage statistics
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: "User not associated with a tenant" },
        { status: 400 }
      );
    }
    const tenantId = user.tenantId;

    const [
      usage,
      limits,
      conversationsPerBot,
      messagesPerChannel,
      aiVsHumanRatio,
      resolutionTime,
    ] = await Promise.all([
      getTenantUsage(tenantId),
      getTenantLimits(tenantId),
      getConversationsPerBot(tenantId),
      getMessagesPerChannel(tenantId),
      getAiVsHumanRatio(tenantId),
      getResolutionTime(tenantId),
    ]);

    return NextResponse.json({
      usage,
      limits,
      analytics: {
        conversationsPerBot,
        messagesPerChannel,
        aiVsHumanRatio,
        resolutionTime,
      },
      percentages: {
        dailyMessages: Math.min(
          100,
          (usage.dailyMessages / limits.dailyMessageLimit) * 100
        ),
        monthlyMessages: Math.min(
          100,
          (usage.monthlyMessages / limits.monthlyMessageLimit) * 100
        ),
        dailyFlowExecutions: Math.min(
          100,
          (usage.dailyFlowExecutions / limits.flowExecutionCap) * 100
        ),
      },
    });
  } catch (error) {
    console.error("[Usage API] Error fetching usage:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage statistics" },
      { status: 500 }
    );
  }
}
