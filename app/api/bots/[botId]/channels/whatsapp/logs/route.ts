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

    const logs = await db.webhookLog.findMany({
      where: {
        tenantId: tenantId,
        source: "whatsapp",
        OR: [
          { event: { startsWith: `meta_message:` }, data: { path: ["channelId"], equals: channelId } },
          { event: { startsWith: `twilio_status:` }, data: { path: ["channelId"], equals: channelId } },
          { event: `send_error:${channelId}` },
          { event: `meta_status_event:${channelId}` },
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
    console.error("[WhatsApp Logs] Error:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
});
