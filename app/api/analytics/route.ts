import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";
import {
  getConversationsPerBot,
  getMessagesPerChannel,
  getAiVsHumanRatio,
  getResolutionTime,
} from "@/lib/analytics";

export const GET = withAuthAndTenant(async ({ tenantId }) => {
  try {
    const [
      conversationsPerBot,
      messagesPerChannel,
      aiVsHumanRatio,
      resolutionTime,
    ] = await Promise.all([
      getConversationsPerBot(tenantId),
      getMessagesPerChannel(tenantId),
      getAiVsHumanRatio(tenantId),
      getResolutionTime(tenantId),
    ]);

    return NextResponse.json({
      conversationsPerBot,
      messagesPerChannel,
      aiVsHumanRatio,
      resolutionTime,
    });
  } catch (error) {
    console.error("[Analytics API] Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
});
