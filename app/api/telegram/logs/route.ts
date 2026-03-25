import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';




/**
 * GET /api/telegram/logs?channelId=<id>&limit=<n>
 *
 * Returns recent webhook log entries for a Telegram channel.
 * Includes delivery errors and raw update records for diagnostics.
 * Tenant-scoped: only returns logs for channels owned by the caller's tenant.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 },
      );
    }

    // Verify the channel belongs to this tenant before returning logs.
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        type: "telegram",
        bot: { tenantId: user.tenantId },
      },
      select: { id: true },
    });

    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    // Fetch logs whose event key is scoped to this channel.
    const logs = await prisma.webhookLog.findMany({
      where: {
        source: "telegram",
        OR: [
          {
            event: {
              startsWith: `update:${channelId}:`,
            },
          },
          {
            event: `send_error:${channelId}`,
          },
          {
            event: `internal_error:${channelId}`,
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        type: true,
        event: true,
        createdAt: true,
        // Omit raw `data` by default to avoid leaking PII in list responses.
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[Telegram Logs] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 },
    );
  }
}
