import { prisma } from "@/lib/prisma";
import { getWebchatRolloutConfig } from "@/lib/webchat-rollout";

const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

export type WebchatMonitoringSnapshot = {
  generatedAt: string;
  windowHours: number;
  rollout: ReturnType<typeof getWebchatRolloutConfig>;
  totals: {
    totalSites: number;
    activeSites: number;
    sitesWithTraffic: number;
    idleSites: number;
    sessions24h: number;
    conversations24h: number;
    messages24h: number;
    widgetEvents24h: number;
    errorEvents24h: number;
    errorRate24h: number;
    lastActivityAt: string | null;
  };
  reasonCounts: {
    blockedOrigin: number;
    rateLimit: number;
    invalidToken: number;
    invalidInitChallenge: number;
    botMitigation: number;
    messageError: number;
    rolloutDisabled: number;
    unknown: number;
  };
  recentErrors: Array<{
    id: string;
    createdAt: string;
    tenantId: string;
    tenantName: string;
    botName: string;
    siteName: string;
    reason: string;
    stage: string | null;
    message: string | null;
  }>;
};

function getPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function asNumber(value: bigint | number | string | null | undefined): number {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function getAdminWebchatMonitoringSnapshot(): Promise<WebchatMonitoringSnapshot> {
  const since = new Date(Date.now() - WINDOW_MS);

  const [
    totalSites,
    activeSites,
    sessions24h,
    conversations24h,
    messages24h,
    widgetEvents24h,
    errorEvents24h,
    lastSession,
    lastEvent,
    trafficRows,
    reasonRows,
    recentErrors,
  ] = await Promise.all([
    prisma.webChatSite.count(),
    prisma.webChatSite.count({ where: { isActive: true } }),
    prisma.webChatSession.count({ where: { lastSeenAt: { gte: since } } }),
    prisma.crmConversation.count({
      where: {
        channel: "web",
        updatedAt: { gte: since },
      },
    }),
    prisma.crmMessage.count({
      where: {
        createdAt: { gte: since },
        conversation: {
          channel: "web",
        },
      },
    }),
    prisma.webChatEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.webChatEvent.count({
      where: {
        createdAt: { gte: since },
        type: "ERROR",
      },
    }),
    prisma.webChatSession.findFirst({
      orderBy: { lastSeenAt: "desc" },
      select: { lastSeenAt: true },
    }),
    prisma.webChatEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "siteId")::bigint AS count
      FROM "webchat_sessions"
      WHERE "lastSeenAt" >= ${since}
    `,
    prisma.$queryRaw<Array<{ reason: string | null; count: bigint }>>`
      SELECT COALESCE(payload->>'reason', 'unknown') AS reason,
             COUNT(*)::bigint AS count
      FROM "webchat_events"
      WHERE "type" = 'ERROR'
        AND "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 2 DESC
    `,
    prisma.webChatEvent.findMany({
      where: { type: "ERROR" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        createdAt: true,
        payload: true,
        site: {
          select: {
            name: true,
            bot: {
              select: { name: true },
            },
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const lastActivityAt = [
    lastSession?.lastSeenAt?.getTime(),
    lastEvent?.createdAt?.getTime(),
  ]
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => right - left)[0];

  const reasonCounts = {
    blockedOrigin: 0,
    rateLimit: 0,
    invalidToken: 0,
    invalidInitChallenge: 0,
    botMitigation: 0,
    messageError: 0,
    rolloutDisabled: 0,
    unknown: 0,
  };

  for (const row of reasonRows) {
    const count = asNumber(row.count);
    switch (row.reason) {
      case "blocked_origin":
        reasonCounts.blockedOrigin += count;
        break;
      case "rate_limit":
        reasonCounts.rateLimit += count;
        break;
      case "invalid_token":
        reasonCounts.invalidToken += count;
        break;
      case "invalid_init_challenge":
        reasonCounts.invalidInitChallenge += count;
        break;
      case "bot_mitigation":
        reasonCounts.botMitigation += count;
        break;
      case "message_error":
        reasonCounts.messageError += count;
        break;
      case "rollout_disabled":
        reasonCounts.rolloutDisabled += count;
        break;
      default:
        reasonCounts.unknown += count;
        break;
    }
  }

  const sitesWithTraffic = asNumber(trafficRows[0]?.count);
  const errorRate24h =
    widgetEvents24h === 0 ? 0 : errorEvents24h / widgetEvents24h;

  return {
    generatedAt: new Date().toISOString(),
    windowHours: WINDOW_HOURS,
    rollout: getWebchatRolloutConfig(),
    totals: {
      totalSites,
      activeSites,
      sitesWithTraffic,
      idleSites: Math.max(activeSites - sitesWithTraffic, 0),
      sessions24h,
      conversations24h,
      messages24h,
      widgetEvents24h,
      errorEvents24h,
      errorRate24h,
      lastActivityAt: lastActivityAt
        ? new Date(lastActivityAt).toISOString()
        : null,
    },
    reasonCounts,
    recentErrors: recentErrors.map((event) => ({
      id: event.id,
      createdAt: event.createdAt.toISOString(),
      tenantId: event.site.tenant.id,
      tenantName: event.site.tenant.name,
      botName: event.site.bot.name,
      siteName: event.site.name,
      reason: getPayloadString(event.payload, "reason") || "unknown",
      stage: getPayloadString(event.payload, "stage"),
      message:
        getPayloadString(event.payload, "message") ||
        getPayloadString(event.payload, "error") ||
        getPayloadString(event.payload, "origin") ||
        getPayloadString(event.payload, "rolloutReason"),
    })),
  };
}
