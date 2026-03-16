import { prisma } from "@/lib/prisma";
import { getWebchatRolloutConfig } from "@/lib/webchat-rollout";

const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

export type WebchatMonitoringSnapshot = {
  generatedAt: string;
  windowHours: number;
  rollout: ReturnType<typeof getWebchatRolloutConfig>;
  promotion: {
    currentStage: "off" | "pilot" | "tiered" | "ga";
    recommendedStage: "pilot" | "tiered" | "ga" | null;
    status: "hold" | "ready" | "stable";
    summary: string;
    blockers: string[];
  };
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
  trackedTenants: Array<{
    tenantId: string;
    tenantName: string;
    planName: string | null;
    siteCount: number;
    activeSiteCount: number;
    sessions24h: number;
    widgetEvents24h: number;
    errorEvents24h: number;
    errorRate24h: number;
    lastActivityAt: string | null;
    rolloutRole: "pilot" | "force-enabled" | "force-disabled";
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
  const rollout = getWebchatRolloutConfig();
  const trackedTenantIds = Array.from(
    new Set([
      ...rollout.pilotTenantIds,
      ...rollout.enabledTenantIds,
      ...rollout.disabledTenantIds,
    ]),
  );

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
    trackedTenants,
    siteRows,
    tenantSessionRows,
    tenantEventRows,
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
    trackedTenantIds.length === 0
      ? Promise.resolve([])
      : prisma.tenant.findMany({
          where: { id: { in: trackedTenantIds } },
          select: {
            id: true,
            name: true,
            subscriptions: {
              select: {
                status: true,
                plan: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        }),
    trackedTenantIds.length === 0
      ? Promise.resolve([])
      : prisma.webChatSite.findMany({
          where: { tenantId: { in: trackedTenantIds } },
          select: {
            id: true,
            tenantId: true,
            isActive: true,
          },
        }),
    trackedTenantIds.length === 0
      ? Promise.resolve([])
      : prisma.$queryRaw<
          Array<{
            tenantId: string;
            sessionsCount: bigint;
            lastActivityAt: Date | null;
          }>
        >`
          SELECT ws."tenantId" AS "tenantId",
                 COUNT(*)::bigint AS "sessionsCount",
                 MAX(s."lastSeenAt") AS "lastActivityAt"
          FROM "webchat_sessions" s
          INNER JOIN "webchat_sites" ws ON ws.id = s."siteId"
          WHERE ws."tenantId" IN (${prisma.$join(trackedTenantIds)})
            AND s."lastSeenAt" >= ${since}
          GROUP BY ws."tenantId"
        `,
    trackedTenantIds.length === 0
      ? Promise.resolve([])
      : prisma.$queryRaw<
          Array<{
            tenantId: string;
            widgetEventsCount: bigint;
            errorEventsCount: bigint;
            lastEventAt: Date | null;
          }>
        >`
          SELECT ws."tenantId" AS "tenantId",
                 COUNT(*)::bigint AS "widgetEventsCount",
                 COUNT(*) FILTER (WHERE e."type" = 'ERROR')::bigint AS "errorEventsCount",
                 MAX(e."createdAt") AS "lastEventAt"
          FROM "webchat_events" e
          INNER JOIN "webchat_sites" ws ON ws.id = e."siteId"
          WHERE ws."tenantId" IN (${prisma.$join(trackedTenantIds)})
            AND e."createdAt" >= ${since}
          GROUP BY ws."tenantId"
        `,
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

  const siteStatsByTenant = new Map<
    string,
    { siteCount: number; activeSiteCount: number }
  >();
  for (const site of siteRows) {
    const stats = siteStatsByTenant.get(site.tenantId) || {
      siteCount: 0,
      activeSiteCount: 0,
    };
    stats.siteCount += 1;
    if (site.isActive) {
      stats.activeSiteCount += 1;
    }
    siteStatsByTenant.set(site.tenantId, stats);
  }

  const sessionStatsByTenant = new Map(
    tenantSessionRows.map((row) => [
      row.tenantId,
      {
        sessions24h: asNumber(row.sessionsCount),
        lastActivityAt: row.lastActivityAt,
      },
    ]),
  );

  const eventStatsByTenant = new Map(
    tenantEventRows.map((row) => [
      row.tenantId,
      {
        widgetEvents24h: asNumber(row.widgetEventsCount),
        errorEvents24h: asNumber(row.errorEventsCount),
        lastEventAt: row.lastEventAt,
      },
    ]),
  );

  const trackedTenantSummaries = trackedTenants
    .map((tenant) => {
      const siteStats = siteStatsByTenant.get(tenant.id) || {
        siteCount: 0,
        activeSiteCount: 0,
      };
      const sessionStats = sessionStatsByTenant.get(tenant.id) || {
        sessions24h: 0,
        lastActivityAt: null,
      };
      const eventStats = eventStatsByTenant.get(tenant.id) || {
        widgetEvents24h: 0,
        errorEvents24h: 0,
        lastEventAt: null,
      };

      const lastActivityAt = [
        sessionStats.lastActivityAt?.getTime(),
        eventStats.lastEventAt?.getTime(),
      ]
        .filter((value): value is number => typeof value === "number")
        .sort((left, right) => right - left)[0];

      const widgetEventsForTenant = eventStats.widgetEvents24h;
      const errorRateForTenant =
        widgetEventsForTenant === 0
          ? 0
          : eventStats.errorEvents24h / widgetEventsForTenant;

      let rolloutRole: "pilot" | "force-enabled" | "force-disabled" = "pilot";
      if (rollout.disabledTenantIds.includes(tenant.id)) {
        rolloutRole = "force-disabled";
      } else if (rollout.enabledTenantIds.includes(tenant.id)) {
        rolloutRole = "force-enabled";
      }

      const activeSubscription = tenant.subscriptions.find((subscription) =>
        ["active", "trialing"].includes(subscription.status),
      );

      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        planName: activeSubscription?.plan.name || null,
        siteCount: siteStats.siteCount,
        activeSiteCount: siteStats.activeSiteCount,
        sessions24h: sessionStats.sessions24h,
        widgetEvents24h: widgetEventsForTenant,
        errorEvents24h: eventStats.errorEvents24h,
        errorRate24h: errorRateForTenant,
        lastActivityAt: lastActivityAt
          ? new Date(lastActivityAt).toISOString()
          : null,
        rolloutRole,
      };
    })
    .sort((left, right) => left.tenantName.localeCompare(right.tenantName));

  const promotionBlockers: string[] = [];
  let recommendedStage: "pilot" | "tiered" | "ga" | null = null;
  let promotionStatus: "hold" | "ready" | "stable" = "hold";
  let promotionSummary =
    "Collect stable pilot telemetry before widening rollout.";

  const hasPilotCandidates = trackedTenantSummaries.some(
    (tenant) => tenant.rolloutRole !== "force-disabled",
  );
  const hasTrackedTraffic = trackedTenantSummaries.some(
    (tenant) => tenant.widgetEvents24h > 0 || tenant.sessions24h > 0,
  );

  if (
    !hasPilotCandidates &&
    (rollout.mode === "pilot" || rollout.mode === "tiered")
  ) {
    promotionBlockers.push(
      "No pilot tenants or force-enabled tenants are configured.",
    );
  }

  if (
    (rollout.mode === "pilot" || rollout.mode === "tiered") &&
    !hasTrackedTraffic
  ) {
    promotionBlockers.push(
      "Tracked pilot tenants have no traffic in the last 24 hours.",
    );
  }

  if (errorRate24h > 0.03) {
    promotionBlockers.push(
      "Widget error budget is above the 3% rollout threshold.",
    );
  }

  if (reasonCounts.blockedOrigin > 5) {
    promotionBlockers.push(
      "Blocked-origin incidents are above the daily rollout threshold.",
    );
  }

  if (reasonCounts.rateLimit > 10) {
    promotionBlockers.push(
      "Rate-limit incidents are above the daily pilot threshold.",
    );
  }

  if (reasonCounts.messageError > 0 || reasonCounts.invalidToken > 0) {
    promotionBlockers.push(
      "Recent message_error or invalid_token incidents still need review.",
    );
  }

  if (rollout.mode === "off") {
    recommendedStage = hasPilotCandidates ? "pilot" : null;
    promotionStatus = hasPilotCandidates ? "ready" : "hold";
    promotionSummary = hasPilotCandidates
      ? "Internal checks are done; the next operational step is enabling pilot mode."
      : "Configure at least one pilot tenant before enabling the rollout.";
  } else if (rollout.mode === "pilot") {
    if (promotionBlockers.length === 0) {
      recommendedStage = "tiered";
      promotionStatus = "ready";
      promotionSummary =
        "Pilot telemetry is within thresholds; the next operational step is promoting to tiered rollout.";
    } else {
      recommendedStage = null;
      promotionStatus = "hold";
      promotionSummary =
        "Stay in pilot mode until the blocking rollout signals are resolved.";
    }
  } else if (rollout.mode === "tiered") {
    if (promotionBlockers.length === 0 && reasonCounts.rolloutDisabled === 0) {
      recommendedStage = "ga";
      promotionStatus = "ready";
      promotionSummary =
        "Tiered rollout looks stable; the next operational step is preparing GA promotion.";
    } else {
      recommendedStage = null;
      promotionStatus = "hold";
      promotionSummary =
        "Stay in tiered mode until rollout denials and blocking signals are resolved.";
      if (reasonCounts.rolloutDisabled > 0) {
        promotionBlockers.push(
          "Rollout-disabled incidents are still occurring during tiered rollout.",
        );
      }
    }
  } else {
    recommendedStage = null;
    promotionStatus = promotionBlockers.length === 0 ? "stable" : "hold";
    promotionSummary =
      promotionBlockers.length === 0
        ? "GA mode is active and current telemetry looks stable."
        : "GA mode is active, but rollout health needs attention.";
  }

  return {
    generatedAt: new Date().toISOString(),
    windowHours: WINDOW_HOURS,
    rollout,
    promotion: {
      currentStage: rollout.mode,
      recommendedStage,
      status: promotionStatus,
      summary: promotionSummary,
      blockers: Array.from(new Set(promotionBlockers)),
    },
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
    trackedTenants: trackedTenantSummaries,
  };
}
