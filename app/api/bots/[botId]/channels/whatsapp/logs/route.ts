import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const channelId = searchParams.get("channelId");
    const limitParam = searchParams.get("limit");
    const limit = Math.min(parseInt(limitParam || "20", 10), 100);

    if (!channelId) {
      return NextResponse.json({ error: "channelId is required" }, { status: 400 });
    }

    const logs = await prisma.webhookLog.findMany({
      where: {
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
}
