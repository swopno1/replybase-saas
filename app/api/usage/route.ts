import { NextResponse } from "next/server";
import { getTenantUsage, getTenantLimits } from "@/lib/subscription";
import {
  getConversationsPerBot,
  getMessagesPerChannel,
  getAiVsHumanRatio,
  getResolutionTime,
} from "@/lib/analytics";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

// GET: Get usage statistics
export const GET = withAuthAndTenant(async (user) => {
  try {
    const { tenantId } = user;

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
        monthlyFlowExecutions: Math.min(
          100,
          (usage.monthlyFlowExecutions / limits.flowExecutionCap) * 100
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
});
