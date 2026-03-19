import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AdminActivationKpis } from "@/lib/admin-activation-kpis";

/**
 * Segmentation filters for KPI analysis.
 * All filters are optional - omit for unfiltered (baseline) analysis.
 */
export type SegmentationFilters = {
  planName?: string; // e.g., "free", "pro", "enterprise"
  channelType?: "telegram" | "facebook" | "web"; // Channel type to filter by
  cohortWeekStart?: string; // ISO date string (YYYY-MM-DD) for signup cohort
};

/**
 * Retention curve shows what % of a cohort reached each milestone by week N after signup.
 * Used to understand how quickly different segments activate.
 */
export type RetentionCurvePoint = {
  weeksSinceSignup: number;
  percentageFirstChannel: number;
  percentageFirstReply: number;
  label: string; // e.g., "Week 1", "Week 2", etc.
};

/**
 * Cohort analysis: track activation metrics for tenants who signed up in a given week.
 */
export type CohortAnalysis = {
  cohortWeekStart: string;
  cohortLabel: string; // e.g., "Mar 10–16"
  cohortSize: number;
  retentionCurve: RetentionCurvePoint[];
  milestoneStats: {
    firstChannel: {
      completedCount: number;
      rate: number;
      medianDaysToCompletion: number;
    };
    firstReply: {
      completedCount: number;
      rate: number;
      medianDaysToCompletion: number;
    };
  };
};

/**
 * Template impact analysis: how different starter templates affect activation speed.
 */
export type TemplateImpactAnalysis = {
  templateCategory: string; // e.g., "services", "agencies", "booking"
  usageCount: number;
  avgDaysFirstChannel: number;
  avgDaysFirstReply: number;
  completionRateFirstChannel: number;
  completionRateFirstReply: number;
  relativeSpeedIndex: number; // vs. baseline (1.0 = average)
};

export type ActivationFunnelStage = {
  key: "signup" | "first-channel" | "first-automated-reply";
  label: string;
  count: number;
  conversionFromPrevious: number;
  conversionFromSignup: number;
  dropoffFromPrevious: number;
};

export type ActivationFunnelAnalysis = {
  filters: SegmentationFilters;
  description: string;
  totalTenants: number;
  stages: ActivationFunnelStage[];
  avgDaysToFirstChannel: number;
  avgDaysChannelToReply: number;
  avgDaysToFirstReply: number;
  largestDropoffStage: string | null;
};

export type AttributionBreakdownItem = {
  key: string;
  label: string;
  conversations: number;
  share: number;
};

export type AcquisitionTrendPoint = {
  weekStart: string;
  label: string;
  totalConversations: number;
  attributedConversations: number;
};

export type WebchatAcquisitionAnalysis = {
  filters: SegmentationFilters;
  description: string;
  totalWebchatConversations: number;
  attributedConversations: number;
  unattributedConversations: number;
  attributionRate: number;
  uniqueSources: number;
  uniqueCampaigns: number;
  topSources: AttributionBreakdownItem[];
  topMediums: AttributionBreakdownItem[];
  topCampaigns: AttributionBreakdownItem[];
  topReferrers: AttributionBreakdownItem[];
  topLandingPages: AttributionBreakdownItem[];
  weeklyTrend: AcquisitionTrendPoint[];
};

/**
 * Segmented KPI result with breakdown by dimension.
 */
export type SegmentedActivationKpis = {
  baseline: AdminActivationKpis; // Unfiltered results
  segment: {
    filters: SegmentationFilters;
    description: string; // Human-readable filter summary
    totalTenants: number;
  };
  retention: {
    curves: CohortAnalysis[]; // Retention by signup cohort
    summary: {
      avgFirstChannelRate: number;
      avgFirstReplyRate: number;
    };
  };
  funnel: ActivationFunnelAnalysis;
  acquisition: WebchatAcquisitionAnalysis;
  templateImpact: {
    templates: TemplateImpactAnalysis[];
    recommendation: string;
  };
};

type SegmentTenant = {
  id: string;
  createdAt: Date;
};

/**
 * Get list of available plan tiers in the system.
 */
export async function getAvailablePlans() {
  const plans = await prisma.plan.findMany({
    select: {
      name: true,
      displayName: true,
      price: true,
    },
    orderBy: { price: "asc" },
  });

  return plans;
}

/**
 * Get list of active channel types.
 */
export async function getActiveChannelTypes(): Promise<
  ("telegram" | "facebook" | "web")[]
> {
  const channels = await prisma.channel.findMany({
    select: { type: true },
    distinct: ["type"],
  });

  return channels
    .map((c) => c.type as "telegram" | "facebook" | "web")
    .filter((t) => ["telegram", "facebook", "web"].includes(t));
}

/**
 * Get signup cohorts (weekly) for segmentation.
 */
export async function getSignupCohorts() {
  const tenants = await prisma.tenant.findMany({
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const cohortMap = new Map<string, number>();

  for (const tenant of tenants) {
    const weekStart = getStartOfWeek(tenant.createdAt);
    const weekKey = weekStart.toISOString().split("T")[0];

    cohortMap.set(weekKey, (cohortMap.get(weekKey) || 0) + 1);
  }

  return Array.from(cohortMap.entries())
    .map(([weekStart, count]) => ({
      weekStart,
      label: formatCohortLabel(new Date(weekStart)),
      tenantCount: count,
    }))
    .reverse(); // Most recent first
}

/**
 * Analyze retention curves for all signup cohorts.
 * Shows what % of each cohort reached milestones at different time intervals.
 */
export async function analyzeRetentionBySignupCohort(
  filters: SegmentationFilters = {},
): Promise<CohortAnalysis[]> {
  const tenants = await getFilteredTenants(filters);

  if (tenants.length === 0) {
    return [];
  }

  const milestoneEvents = await getMilestoneEventsForTenantIds(
    tenants.map((tenant) => tenant.id),
  );

  const eventsByTenant = groupMilestonesByTenant(milestoneEvents);

  const cohorts = Array.from(groupTenantsByWeek(tenants).entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 12);

  const cohortAnalyses: CohortAnalysis[] = [];

  for (const [weekStart, cohortTenants] of cohorts) {
    const cohortStart = new Date(weekStart);
    const tenantIds = cohortTenants.map((tenant) => tenant.id);

    if (tenantIds.length === 0) {
      continue;
    }

    // Build retention curve: at each week after signup, what % had reached each milestone
    const maxWeeks = 8;
    const retentionCurve: RetentionCurvePoint[] = [];

    for (let week = 1; week <= maxWeeks; week++) {
      const cutoffDate = addDays(cohortStart, week * 7);

      let firstChannelCount = 0;
      let firstReplyCount = 0;

      for (const tenant of cohortTenants) {
        const tenantEvents = eventsByTenant.get(tenant.id) || [];
        const firstChannelEvent = tenantEvents.find(
          (event) => event.milestoneId === "first-channel",
        );
        const firstReplyEvent = tenantEvents.find(
          (event) => event.milestoneId === "first-automated-reply",
        );

        if (firstChannelEvent && firstChannelEvent.createdAt < cutoffDate) {
          firstChannelCount += 1;
        }

        if (firstReplyEvent && firstReplyEvent.createdAt < cutoffDate) {
          firstReplyCount += 1;
        }
      }

      retentionCurve.push({
        weeksSinceSignup: week,
        percentageFirstChannel: round(
          (firstChannelCount / tenantIds.length) * 100,
        ),
        percentageFirstReply: round((firstReplyCount / tenantIds.length) * 100),
        label: `Week ${week}`,
      });
    }

    // Get milestone stats for cohort
    const firstChannelDays: number[] = [];
    const firstReplyDays: number[] = [];
    let firstChannelCompletedCount = 0;
    let firstReplyCompletedCount = 0;

    for (const tenant of cohortTenants) {
      const tenantEvents = eventsByTenant.get(tenant.id) || [];
      const firstChannelEvent = tenantEvents.find(
        (event) => event.milestoneId === "first-channel",
      );
      const firstReplyEvent = tenantEvents.find(
        (event) => event.milestoneId === "first-automated-reply",
      );

      if (firstChannelEvent) {
        firstChannelCompletedCount += 1;
        firstChannelDays.push(
          diffInDays(firstChannelEvent.createdAt, tenant.createdAt),
        );
      }

      if (firstReplyEvent) {
        firstReplyCompletedCount += 1;
        firstReplyDays.push(
          diffInDays(firstReplyEvent.createdAt, tenant.createdAt),
        );
      }
    }

    cohortAnalyses.push({
      cohortWeekStart: weekStart,
      cohortLabel: formatCohortLabel(cohortStart),
      cohortSize: tenantIds.length,
      retentionCurve,
      milestoneStats: {
        firstChannel: {
          completedCount: firstChannelCompletedCount,
          rate: round(firstChannelCompletedCount / tenantIds.length),
          medianDaysToCompletion:
            firstChannelDays.length > 0 ? getMedian(firstChannelDays) : 0,
        },
        firstReply: {
          completedCount: firstReplyCompletedCount,
          rate: round(firstReplyCompletedCount / tenantIds.length),
          medianDaysToCompletion:
            firstReplyDays.length > 0 ? getMedian(firstReplyDays) : 0,
        },
      },
    });
  }

  return cohortAnalyses;
}

/**
 * Analyze template impact on activation speed.
 * Compares tenants who used starter templates vs. those who didn't.
 */
export async function analyzeTemplateImpact(
  filters: SegmentationFilters = {},
): Promise<TemplateImpactAnalysis[]> {
  const tenants = await getFilteredTenants(filters);
  const tenantIds = tenants.map((tenant) => tenant.id);

  if (tenantIds.length === 0) {
    return [];
  }

  // Get flows grouped by template category (inferred from flow name patterns)
  const flows = await prisma.flow.findMany({
    select: {
      id: true,
      name: true,
      tenantId: true,
      createdAt: true,
    },
    where: {
      isGlobal: false, // Only user flows
      tenantId: { in: tenantIds },
    },
  });

  const milestones = await prisma.onboardingMilestoneEvent.findMany({
    where: {
      tenantId: { in: tenantIds },
    },
    select: {
      tenantId: true,
      milestoneId: true,
      createdAt: true,
      tenant: {
        select: {
          createdAt: true,
        },
      },
    },
  });

  // Categorize flows by template type (simple heuristic)
  const categories = new Map<string, Set<string>>();

  for (const flow of flows) {
    const flowNameLower = flow.name.toLowerCase();
    let category = "custom";

    if (
      flowNameLower.includes("service") ||
      flowNameLower.includes("consultation")
    ) {
      category = "services";
    } else if (
      flowNameLower.includes("agency") ||
      flowNameLower.includes("freelance")
    ) {
      category = "agencies";
    } else if (
      flowNameLower.includes("book") ||
      flowNameLower.includes("appointment") ||
      flowNameLower.includes("schedule")
    ) {
      category = "booking";
    }

    if (!categories.has(category)) {
      categories.set(category, new Set<string>());
    }

    categories.get(category)!.add(flow.tenantId);
  }

  const templateAnalyses: TemplateImpactAnalysis[] = [];

  const baselineFirstChannelDays = getAverageMilestoneDuration(
    milestones,
    "first-channel",
  );

  for (const [category, uniqueTenants] of categories.entries()) {
    const categoryTenantIds = uniqueTenants;

    const firstChannelDays: number[] = [];
    const firstReplyDays: number[] = [];
    const firstChannelSet = new Set<string>();
    const firstReplySet = new Set<string>();

    for (const m of milestones) {
      if (!categoryTenantIds.has(m.tenantId)) {
        continue;
      }

      const duration =
        (m.createdAt.getTime() - m.tenant.createdAt.getTime()) /
        (1000 * 60 * 60 * 24);

      if (
        m.milestoneId === "first-channel" &&
        !firstChannelSet.has(m.tenantId)
      ) {
        firstChannelSet.add(m.tenantId);
        firstChannelDays.push(duration);
      } else if (
        m.milestoneId === "first-automated-reply" &&
        !firstReplySet.has(m.tenantId)
      ) {
        firstReplySet.add(m.tenantId);
        firstReplyDays.push(duration);
      }
    }

    const avgFirstChannel =
      firstChannelDays.length > 0
        ? round(
            firstChannelDays.reduce((a, b) => a + b) / firstChannelDays.length,
          )
        : 0;
    const avgFirstReply =
      firstReplyDays.length > 0
        ? round(firstReplyDays.reduce((a, b) => a + b) / firstReplyDays.length)
        : 0;

    templateAnalyses.push({
      templateCategory: category,
      usageCount: categoryTenantIds.size,
      avgDaysFirstChannel: avgFirstChannel,
      avgDaysFirstReply: avgFirstReply,
      completionRateFirstChannel: round(
        firstChannelSet.size / categoryTenantIds.size,
      ),
      completionRateFirstReply: round(
        firstReplySet.size / categoryTenantIds.size,
      ),
      relativeSpeedIndex:
        baselineFirstChannelDays > 0 && avgFirstChannel > 0
          ? round(baselineFirstChannelDays / avgFirstChannel)
          : 1,
    });
  }

  return templateAnalyses.sort((a, b) => b.usageCount - a.usageCount);
}

export async function analyzeActivationFunnel(
  filters: SegmentationFilters = {},
): Promise<ActivationFunnelAnalysis> {
  const tenants = await getFilteredTenants(filters);
  const tenantIds = tenants.map((tenant) => tenant.id);

  if (tenantIds.length === 0) {
    return {
      filters,
      description: describeFilters(filters),
      totalTenants: 0,
      stages: [
        {
          key: "signup",
          label: "Signed up",
          count: 0,
          conversionFromPrevious: 1,
          conversionFromSignup: 1,
          dropoffFromPrevious: 0,
        },
        {
          key: "first-channel",
          label: "Connected first channel",
          count: 0,
          conversionFromPrevious: 0,
          conversionFromSignup: 0,
          dropoffFromPrevious: 0,
        },
        {
          key: "first-automated-reply",
          label: "Sent first automated reply",
          count: 0,
          conversionFromPrevious: 0,
          conversionFromSignup: 0,
          dropoffFromPrevious: 0,
        },
      ],
      avgDaysToFirstChannel: 0,
      avgDaysChannelToReply: 0,
      avgDaysToFirstReply: 0,
      largestDropoffStage: null,
    };
  }

  const milestoneEvents = await getMilestoneEventsForTenantIds(tenantIds);
  const eventsByTenant = groupMilestonesByTenant(milestoneEvents);
  const firstChannelTenantIds = new Set<string>();
  const firstReplyTenantIds = new Set<string>();
  const firstChannelDurations: number[] = [];
  const firstReplyDurations: number[] = [];
  const channelToReplyDurations: number[] = [];

  for (const tenant of tenants) {
    const tenantEvents = eventsByTenant.get(tenant.id) || [];
    const firstChannelEvent = tenantEvents.find(
      (event) => event.milestoneId === "first-channel",
    );
    const firstReplyEvent = tenantEvents.find(
      (event) => event.milestoneId === "first-automated-reply",
    );

    if (firstChannelEvent) {
      firstChannelTenantIds.add(tenant.id);
      firstChannelDurations.push(
        diffInDays(firstChannelEvent.createdAt, tenant.createdAt),
      );
    }

    if (firstReplyEvent) {
      firstReplyTenantIds.add(tenant.id);
      firstReplyDurations.push(
        diffInDays(firstReplyEvent.createdAt, tenant.createdAt),
      );
    }

    if (firstChannelEvent && firstReplyEvent) {
      channelToReplyDurations.push(
        diffInDays(firstReplyEvent.createdAt, firstChannelEvent.createdAt),
      );
    }
  }

  const signupCount = tenants.length;
  const firstChannelCount = firstChannelTenantIds.size;
  const firstReplyCount = firstReplyTenantIds.size;

  const stages: ActivationFunnelStage[] = [
    {
      key: "signup",
      label: "Signed up",
      count: signupCount,
      conversionFromPrevious: 1,
      conversionFromSignup: 1,
      dropoffFromPrevious: 0,
    },
    {
      key: "first-channel",
      label: "Connected first channel",
      count: firstChannelCount,
      conversionFromPrevious:
        signupCount > 0 ? round(firstChannelCount / signupCount) : 0,
      conversionFromSignup:
        signupCount > 0 ? round(firstChannelCount / signupCount) : 0,
      dropoffFromPrevious:
        signupCount > 0
          ? round((signupCount - firstChannelCount) / signupCount)
          : 0,
    },
    {
      key: "first-automated-reply",
      label: "Sent first automated reply",
      count: firstReplyCount,
      conversionFromPrevious:
        firstChannelCount > 0 ? round(firstReplyCount / firstChannelCount) : 0,
      conversionFromSignup:
        signupCount > 0 ? round(firstReplyCount / signupCount) : 0,
      dropoffFromPrevious:
        firstChannelCount > 0
          ? round((firstChannelCount - firstReplyCount) / firstChannelCount)
          : 0,
    },
  ];

  const largestDropoffStage =
    stages
      .slice(1)
      .sort(
        (left, right) => right.dropoffFromPrevious - left.dropoffFromPrevious,
      )[0]?.label ?? null;

  return {
    filters,
    description: describeFilters(filters),
    totalTenants: signupCount,
    stages,
    avgDaysToFirstChannel:
      firstChannelDurations.length > 0 ? getAverage(firstChannelDurations) : 0,
    avgDaysChannelToReply:
      channelToReplyDurations.length > 0
        ? getAverage(channelToReplyDurations)
        : 0,
    avgDaysToFirstReply:
      firstReplyDurations.length > 0 ? getAverage(firstReplyDurations) : 0,
    largestDropoffStage,
  };
}

export async function analyzeWebchatAcquisition(
  filters: SegmentationFilters = {},
): Promise<WebchatAcquisitionAnalysis> {
  const tenants = await getFilteredTenants(filters);
  const tenantIds = tenants.map((tenant) => tenant.id);

  if (tenantIds.length === 0) {
    return buildEmptyAcquisitionAnalysis(filters);
  }

  const conversations = await prisma.crmConversation.findMany({
    where: {
      channel: "webchat",
      contact: {
        tenantId: {
          in: tenantIds,
        },
      },
    },
    select: {
      id: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (conversations.length === 0) {
    return buildEmptyAcquisitionAnalysis(filters);
  }

  const sourceCounts = new Map<string, number>();
  const mediumCounts = new Map<string, number>();
  const campaignCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const landingPageCounts = new Map<string, number>();
  const weeklyCounts = new Map<string, { total: number; attributed: number }>();
  let attributedConversations = 0;

  for (const conversation of conversations) {
    const sourceContext = getWebchatSourceMetadata(conversation.metadata);
    const source = normalizeAcquisitionValue(sourceContext?.utmSource);
    const medium = normalizeAcquisitionValue(sourceContext?.utmMedium);
    const campaign = normalizeAcquisitionValue(sourceContext?.utmCampaign);
    const referrer = normalizeReferrerLabel(
      sourceContext?.referrer || sourceContext?.origin,
    );
    const landingPage = normalizeLandingPageLabel(sourceContext?.pageUrl);
    const hasAttribution = Boolean(source || medium || campaign || referrer);
    const weekStart = getStartOfWeek(conversation.createdAt)
      .toISOString()
      .split("T")[0];
    const trendPoint = weeklyCounts.get(weekStart) || {
      total: 0,
      attributed: 0,
    };

    trendPoint.total += 1;

    if (hasAttribution) {
      attributedConversations += 1;
      trendPoint.attributed += 1;
    }

    weeklyCounts.set(weekStart, trendPoint);

    incrementCount(sourceCounts, source || "Direct / unknown");
    incrementCount(mediumCounts, medium || "Unknown medium");
    incrementCount(campaignCounts, campaign || "No campaign");
    incrementCount(referrerCounts, referrer || "Direct / unknown");
    incrementCount(landingPageCounts, landingPage || "Unknown landing page");
  }

  const totalWebchatConversations = conversations.length;

  return {
    filters,
    description: describeFilters(filters),
    totalWebchatConversations,
    attributedConversations,
    unattributedConversations:
      totalWebchatConversations - attributedConversations,
    attributionRate:
      totalWebchatConversations > 0
        ? round(attributedConversations / totalWebchatConversations)
        : 0,
    uniqueSources: Array.from(sourceCounts.keys()).filter(
      (value) => value !== "Direct / unknown",
    ).length,
    uniqueCampaigns: Array.from(campaignCounts.keys()).filter(
      (value) => value !== "No campaign",
    ).length,
    topSources: buildBreakdown(sourceCounts, totalWebchatConversations),
    topMediums: buildBreakdown(mediumCounts, totalWebchatConversations),
    topCampaigns: buildBreakdown(campaignCounts, totalWebchatConversations),
    topReferrers: buildBreakdown(referrerCounts, totalWebchatConversations),
    topLandingPages: buildBreakdown(
      landingPageCounts,
      totalWebchatConversations,
    ),
    weeklyTrend: Array.from(weeklyCounts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-6)
      .map(([weekStart, values]) => ({
        weekStart,
        label: formatCohortLabel(new Date(weekStart)),
        totalConversations: values.total,
        attributedConversations: values.attributed,
      })),
  };
}

// Helper functions

function buildEmptyAcquisitionAnalysis(
  filters: SegmentationFilters,
): WebchatAcquisitionAnalysis {
  return {
    filters,
    description: describeFilters(filters),
    totalWebchatConversations: 0,
    attributedConversations: 0,
    unattributedConversations: 0,
    attributionRate: 0,
    uniqueSources: 0,
    uniqueCampaigns: 0,
    topSources: [],
    topMediums: [],
    topCampaigns: [],
    topReferrers: [],
    topLandingPages: [],
    weeklyTrend: [],
  };
}

function buildTenantWhere(
  filters: SegmentationFilters,
): Prisma.TenantWhereInput {
  const where: Prisma.TenantWhereInput = {};

  if (filters.planName) {
    where.subscriptions = {
      is: {
        plan: {
          name: filters.planName,
        },
      },
    };
  }

  if (filters.channelType) {
    where.bots = {
      some: {
        channels: {
          some: {
            type: filters.channelType,
          },
        },
      },
    };
  }

  if (filters.cohortWeekStart) {
    const cohortStart = new Date(filters.cohortWeekStart);
    where.createdAt = {
      gte: cohortStart,
      lt: addDays(cohortStart, 7),
    };
  }

  return where;
}

async function getFilteredTenants(
  filters: SegmentationFilters,
): Promise<SegmentTenant[]> {
  return prisma.tenant.findMany({
    where: buildTenantWhere(filters),
    select: {
      id: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function getMilestoneEventsForTenantIds(tenantIds: string[]) {
  if (tenantIds.length === 0) {
    return [];
  }

  return prisma.onboardingMilestoneEvent.findMany({
    where: {
      tenantId: { in: tenantIds },
    },
    select: {
      tenantId: true,
      milestoneId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

function groupMilestonesByTenant(
  milestoneEvents: Array<{
    tenantId: string;
    milestoneId: string;
    createdAt: Date;
  }>,
) {
  const grouped = new Map<
    string,
    Array<{ tenantId: string; milestoneId: string; createdAt: Date }>
  >();

  for (const event of milestoneEvents) {
    const tenantEvents = grouped.get(event.tenantId) || [];
    tenantEvents.push(event);
    grouped.set(event.tenantId, tenantEvents);
  }

  return grouped;
}

function groupTenantsByWeek(tenants: SegmentTenant[]) {
  const grouped = new Map<string, SegmentTenant[]>();

  for (const tenant of tenants) {
    const weekStart = getStartOfWeek(tenant.createdAt)
      .toISOString()
      .split("T")[0];
    const cohortTenants = grouped.get(weekStart) || [];
    cohortTenants.push(tenant);
    grouped.set(weekStart, cohortTenants);
  }

  return grouped;
}

function describeFilters(filters: SegmentationFilters) {
  const parts: string[] = [];

  if (filters.planName) {
    parts.push(`plan ${filters.planName}`);
  }

  if (filters.channelType) {
    parts.push(`${filters.channelType} channel`);
  }

  if (filters.cohortWeekStart) {
    parts.push(
      `cohort ${formatCohortLabel(new Date(filters.cohortWeekStart))}`,
    );
  }

  return parts.length > 0 ? parts.join(" • ") : "All tenants";
}

function getWebchatSourceMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  const source = metadataRecord.webchatSource;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  return source as Record<string, unknown>;
}

function normalizeAcquisitionValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeReferrerLabel(value: unknown) {
  const urlValue = normalizeAcquisitionValue(value);

  if (!urlValue) {
    return null;
  }

  try {
    return new URL(urlValue).hostname.replace(/^www\./, "");
  } catch {
    return urlValue;
  }
}

function normalizeLandingPageLabel(value: unknown) {
  const urlValue = normalizeAcquisitionValue(value);

  if (!urlValue) {
    return null;
  }

  try {
    const url = new URL(urlValue);
    const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
    return `${url.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return urlValue;
  }
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function buildBreakdown(map: Map<string, number>, total: number) {
  return Array.from(map.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([key, conversations]) => ({
      key,
      label: key,
      conversations,
      share: total > 0 ? round(conversations / total) : 0,
    }));
}

function getAverageMilestoneDuration(
  milestoneEvents: Array<{
    tenantId: string;
    milestoneId: string;
    createdAt: Date;
    tenant: { createdAt: Date };
  }>,
  milestoneId: string,
) {
  const seenTenantIds = new Set<string>();
  const durations: number[] = [];

  for (const event of milestoneEvents) {
    if (
      event.milestoneId !== milestoneId ||
      seenTenantIds.has(event.tenantId)
    ) {
      continue;
    }

    seenTenantIds.add(event.tenantId);
    durations.push(diffInDays(event.createdAt, event.tenant.createdAt));
  }

  return durations.length > 0 ? getAverage(durations) : 0;
}

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

function formatCohortLabel(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function getAverage(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function diffInDays(later: Date, earlier: Date) {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24);
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
