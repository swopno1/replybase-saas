import { NextResponse } from "next/server";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };
    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(parseInt(limitParam || "20", 10), 100);

    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        botId,
        type: "telegram",
        bot: { tenantId: tenantId },
      },
      select: { id: true },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const logs = await db.webhookLog.findMany({
      where: {
        tenantId: tenantId,
        source: "telegram",
        OR: [
          { event: `inbound:${channelId}` },
          { event: `outbound:${channelId}` },
          { event: `outbound_error:${channelId}` },
          { event: `webhook_setup:${channelId}` },
          { event: `webhook_setup_error:${channelId}` },
          { event: `webhook_reconnect:${channelId}` },
          { event: `webhook_reconnect_error:${channelId}` },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        event: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[Telegram Logs] Error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
});
