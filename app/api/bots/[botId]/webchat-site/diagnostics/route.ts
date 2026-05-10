import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getOrCreateWebChatSite } from "@/lib/webchat";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

function getPayloadField(
  payload: Prisma.JsonValue | null,
  key: string,
): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export const GET = withAuthAndTenant(async ({ tenantId }, req, context, db) => {
  try {
    const { botId } = (await context.params) as { botId: string };

    const bot = await db.bot.findFirst({
      where: { id: botId, tenantId: tenantId },
      select: { id: true, tenantId: true },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const channelId = req.nextUrl.searchParams.get("channelId");
    if (!channelId) {
      return NextResponse.json(
        { error: "channelId is required" },
        { status: 400 },
      );
    }

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        botId,
        type: "web",
      },
      select: {
        id: true,
        name: true,
        botId: true,
        bot: {
          select: {
            tenantId: true,
          },
        },
        config: true,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Web channel not found" },
        { status: 404 },
      );
    }

    const site = await getOrCreateWebChatSite({
      channelId: channel.id,
      botId: channel.botId,
      tenantId: tenantId,
      name: channel.name,
      themeConfig: (channel.config as Prisma.JsonObject | null) || {},
    });

    const [latestSession, latestEvent, errorCounts, recentErrors] =
      await Promise.all([
        db.webChatSession.findFirst({
          where: { siteId: site.id },
          orderBy: { lastSeenAt: "desc" },
          select: { lastSeenAt: true },
        }),
        db.webChatEvent.findFirst({
          where: { siteId: site.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        db.$queryRaw<
          Array<{ blockedCount: bigint; rateLimitCount: bigint }>
        >`
        SELECT
          COUNT(*) FILTER (WHERE payload->>'reason' = 'blocked_origin') AS "blockedCount",
          COUNT(*) FILTER (WHERE payload->>'reason' = 'rate_limit') AS "rateLimitCount"
        FROM "webchat_events"
        WHERE "siteId" = ${site.id} AND "type" = 'ERROR'
      `,
        db.webChatEvent.findMany({
          where: {
            siteId: site.id,
            type: "ERROR",
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            createdAt: true,
            payload: true,
          },
        }),
      ]);

    const lastPingAt = [
      latestSession?.lastSeenAt?.getTime(),
      latestEvent?.createdAt?.getTime(),
    ]
      .filter((value): value is number => typeof value === "number")
      .sort((left, right) => right - left)[0];

    const counts = errorCounts[0] || {
      blockedCount: BigInt(0),
      rateLimitCount: BigInt(0),
    };

    return NextResponse.json({
      diagnostics: {
        lastPingAt: lastPingAt ? new Date(lastPingAt).toISOString() : null,
        blockedOriginCount: Number(counts.blockedCount),
        rateLimitCount: Number(counts.rateLimitCount),
        recentErrors: recentErrors.map((event) => ({
          id: event.id,
          createdAt: event.createdAt.toISOString(),
          reason: getPayloadField(event.payload, "reason") || "unknown",
          stage: getPayloadField(event.payload, "stage"),
          message:
            getPayloadField(event.payload, "message") ||
            getPayloadField(event.payload, "error") ||
            getPayloadField(event.payload, "origin") ||
            null,
        })),
      },
    });
  } catch (error) {
    console.error(
      "[Webchat Diagnostics API] Failed to load diagnostics:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to load diagnostics" },
      { status: 500 },
    );
  }
});
