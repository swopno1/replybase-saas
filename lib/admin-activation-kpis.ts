import { prisma } from "@/lib/prisma";

type WeekPoint = {
  weekStart: string;
  label: string;
};

type WeeklyTrendPoint = WeekPoint & {
  firstChannel: number;
  firstAutomatedReply: number;
  activeTenants: number;
  webhookAttempts: number;
  webhookFailures: number;
  failedWebhookSetupRate: number;
};

type MilestoneStat = {
  completedCount: number;
  completionRate: number;
  averageDaysToCompletion: number;
  medianDaysToCompletion: number;
  firstCompletionDate: string | null;
  lastCompletionDate: string | null;
};

export type AdminActivationKpis = {
  totalTenants: number;
  milestones: {
    firstChannel: MilestoneStat;
    firstAutomatedReply: MilestoneStat;
  };
  weeklyActiveTenants: {
    current: number;
    previous: number;
    delta: number;
  };
  failedWebhookSetupRate: {
    current: number;
    attempts: number;
    failures: number;
  };
  timeBetweenMilestones: {
    min: number;
    max: number;
    avg: number;
  };
  weeklyTrend: WeeklyTrendPoint[];
  meta: {
    timestamp: string;
    dataWindow: string;
    webhookScope: string;
  };
};

function getStartOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatWeekLabel(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  return round(sorted[middle]);
}

function buildWeeks(weekCount: number) {
  const currentWeekStart = getStartOfWeek(new Date());
  const firstWeekStart = addDays(currentWeekStart, -7 * (weekCount - 1));
  const weeks: WeekPoint[] = [];

  for (let index = 0; index < weekCount; index += 1) {
    const weekStart = addDays(firstWeekStart, index * 7);
    weeks.push({
      weekStart: weekStart.toISOString(),
      label: formatWeekLabel(weekStart),
    });
  }

  return weeks;
}

function getWeekKey(value: Date) {
  return getStartOfWeek(value).toISOString();
}

function buildMilestoneStat(
  totalTenants: number,
  events: Array<{ createdAt: Date; tenant: { createdAt: Date } }>,
): MilestoneStat {
  const durations = events
    .map((event) => {
      const diff = event.createdAt.getTime() - event.tenant.createdAt.getTime();
      return diff >= 0 ? diff / (1000 * 60 * 60 * 24) : null;
    })
    .filter((value): value is number => value !== null);

  const averageDaysToCompletion =
    durations.length > 0
      ? round(
          durations.reduce((sum, value) => sum + value, 0) / durations.length,
        )
      : 0;

  return {
    completedCount: events.length,
    completionRate: totalTenants > 0 ? round(events.length / totalTenants) : 0,
    averageDaysToCompletion,
    medianDaysToCompletion: getMedian(durations),
    firstCompletionDate: events[0]?.createdAt.toISOString() || null,
    lastCompletionDate:
      events[events.length - 1]?.createdAt.toISOString() || null,
  };
}

export async function getAdminActivationKpis(): Promise<AdminActivationKpis> {
  const weekCount = 8;
  const weeks = buildWeeks(weekCount);
  const earliestWeekStart = new Date(weeks[0].weekStart);

  const [
    totalTenants,
    firstChannelEvents,
    firstReplyEvents,
    activeRuntimeMessages,
    webhookSetupLogs,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.onboardingMilestoneEvent.findMany({
      where: { milestoneId: "first-channel" },
      select: {
        tenantId: true,
        createdAt: true,
        tenant: {
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.onboardingMilestoneEvent.findMany({
      where: { milestoneId: "first-automated-reply" },
      select: {
        tenantId: true,
        createdAt: true,
        tenant: {
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.crmMessage.findMany({
      where: {
        direction: "outbound",
        source: { in: ["ai", "flow", "system"] },
        createdAt: { gte: earliestWeekStart },
      },
      select: {
        createdAt: true,
        conversation: {
          select: {
            contact: {
              select: {
                tenantId: true,
              },
            },
          },
        },
      },
    }),
    prisma.webhookLog.findMany({
      where: {
        source: { in: ["telegram", "facebook", "webchat"] },
        type: { in: ["setup_success", "setup_error"] },
        createdAt: { gte: earliestWeekStart },
      },
      select: {
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const weeklyTrendMap = new Map<string, WeeklyTrendPoint>();

  for (const week of weeks) {
    weeklyTrendMap.set(week.weekStart, {
      weekStart: week.weekStart,
      label: week.label,
      firstChannel: 0,
      firstAutomatedReply: 0,
      activeTenants: 0,
      webhookAttempts: 0,
      webhookFailures: 0,
      failedWebhookSetupRate: 0,
    });
  }

  for (const event of firstChannelEvents) {
    const bucket = weeklyTrendMap.get(getWeekKey(event.createdAt));
    if (bucket) {
      bucket.firstChannel += 1;
    }
  }

  for (const event of firstReplyEvents) {
    const bucket = weeklyTrendMap.get(getWeekKey(event.createdAt));
    if (bucket) {
      bucket.firstAutomatedReply += 1;
    }
  }

  const activeTenantsByWeek = new Map<string, Set<string>>();
  for (const message of activeRuntimeMessages) {
    const tenantId = message.conversation.contact.tenantId;
    const weekKey = getWeekKey(message.createdAt);
    if (!weeklyTrendMap.has(weekKey)) {
      continue;
    }

    if (!activeTenantsByWeek.has(weekKey)) {
      activeTenantsByWeek.set(weekKey, new Set<string>());
    }

    activeTenantsByWeek.get(weekKey)?.add(tenantId);
  }

  for (const [weekKey, tenants] of activeTenantsByWeek.entries()) {
    const bucket = weeklyTrendMap.get(weekKey);
    if (bucket) {
      bucket.activeTenants = tenants.size;
    }
  }

  for (const log of webhookSetupLogs) {
    const bucket = weeklyTrendMap.get(getWeekKey(log.createdAt));
    if (!bucket) {
      continue;
    }

    bucket.webhookAttempts += 1;
    if (log.type === "setup_error") {
      bucket.webhookFailures += 1;
    }
  }

  const weeklyTrend = Array.from(weeklyTrendMap.values()).map((week) => ({
    ...week,
    failedWebhookSetupRate:
      week.webhookAttempts > 0
        ? round(week.webhookFailures / week.webhookAttempts)
        : 0,
  }));

  const currentWeek = weeklyTrend[weeklyTrend.length - 1];
  const previousWeek = weeklyTrend[weeklyTrend.length - 2] || currentWeek;

  const firstChannelByTenant = new Map(
    firstChannelEvents.map((event) => [event.tenantId, event.createdAt]),
  );
  const milestoneDurations = firstReplyEvents
    .map((event) => {
      const firstChannel = firstChannelByTenant.get(event.tenantId);
      if (!firstChannel) {
        return null;
      }

      return (
        (event.createdAt.getTime() - firstChannel.getTime()) /
        (1000 * 60 * 60 * 24)
      );
    })
    .filter((value): value is number => value !== null && value >= 0);

  return {
    totalTenants,
    milestones: {
      firstChannel: buildMilestoneStat(totalTenants, firstChannelEvents),
      firstAutomatedReply: buildMilestoneStat(totalTenants, firstReplyEvents),
    },
    weeklyActiveTenants: {
      current: currentWeek?.activeTenants || 0,
      previous: previousWeek?.activeTenants || 0,
      delta:
        (currentWeek?.activeTenants || 0) - (previousWeek?.activeTenants || 0),
    },
    failedWebhookSetupRate: {
      current: currentWeek?.failedWebhookSetupRate || 0,
      attempts: currentWeek?.webhookAttempts || 0,
      failures: currentWeek?.webhookFailures || 0,
    },
    timeBetweenMilestones: {
      min:
        milestoneDurations.length > 0
          ? round(Math.min(...milestoneDurations))
          : 0,
      max:
        milestoneDurations.length > 0
          ? round(Math.max(...milestoneDurations))
          : 0,
      avg:
        milestoneDurations.length > 0
          ? round(
              milestoneDurations.reduce((sum, value) => sum + value, 0) /
                milestoneDurations.length,
            )
          : 0,
    },
    weeklyTrend,
    meta: {
      timestamp: new Date().toISOString(),
      dataWindow: `${weekCount} weeks`,
      webhookScope:
        "Channel setup attempts (Telegram, Facebook, Webchat) logged by ReplyBase",
    },
  };
}
