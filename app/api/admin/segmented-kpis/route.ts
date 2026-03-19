import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  analyzeActivationFunnel,
  analyzeRetentionBySignupCohort,
  analyzeTemplateImpact,
  analyzeWebchatAcquisition,
  getAvailablePlans,
  getActiveChannelTypes,
  getSignupCohorts,
  type SegmentationFilters,
} from "@/lib/segmented-activation-kpis";
import { getAdminActivationKpis } from "@/lib/admin-activation-kpis";

/**
 * GET /api/admin/segmented-kpis
 *
 * Returns segmented KPI analysis including:
 * - Retention curves by signup cohort
 * - Template impact analysis
 * - Available segmentation dimensions (plans, channels, cohorts)
 *
 * Optional query parameters:
 * - includeCohorts=true: Include detailed cohort retention curves
 * - includeTemplates=true: Include template impact analysis
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Note: This endpoint returns non-sensitive aggregated data, but you may want to
    // add session check for access control (optional)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeCohorts = searchParams.get("includeCohorts") === "true";
    const includeTemplates = searchParams.get("includeTemplates") === "true";
    const planName = searchParams.get("planName") || undefined;
    const channelType = searchParams.get("channelType");
    const cohortWeekStart = searchParams.get("cohortWeekStart") || undefined;
    const filters: SegmentationFilters = {
      ...(planName ? { planName } : {}),
      ...(channelType && ["telegram", "facebook", "web"].includes(channelType)
        ? { channelType: channelType as SegmentationFilters["channelType"] }
        : {}),
      ...(cohortWeekStart ? { cohortWeekStart } : {}),
    };

    // Get baseline KPIs
    const [
      baselineKpis,
      plans,
      channelTypes,
      cohorts,
      funnel,
      acquisition,
      retentionCohorts,
      templateImpact,
    ] = await Promise.all([
      getAdminActivationKpis(),
      getAvailablePlans(),
      getActiveChannelTypes(),
      getSignupCohorts(),
      analyzeActivationFunnel(filters),
      analyzeWebchatAcquisition(filters),
      includeCohorts
        ? analyzeRetentionBySignupCohort(filters)
        : Promise.resolve([]),
      includeTemplates ? analyzeTemplateImpact(filters) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      baseline: baselineKpis,
      segment: {
        filters,
        description: funnel.description,
        totalTenants: funnel.totalTenants,
      },
      segmentationDimensions: {
        plans: plans.map((p) => ({
          name: p.name,
          displayName: p.displayName,
          price: p.price,
        })),
        channelTypes,
        cohorts: cohorts.map((c) => ({
          weekStart: c.weekStart,
          label: c.label,
          tenantCount: c.tenantCount,
        })),
      },
      funnel,
      acquisition,
      ...(includeCohorts && {
        retention: {
          curves: retentionCohorts,
          summary: {
            avgFirstChannelRate:
              retentionCohorts.length > 0
                ? Math.round(
                    (retentionCohorts.reduce(
                      (sum, c) =>
                        sum + c.milestoneStats.firstChannel.rate * 100,
                      0,
                    ) /
                      retentionCohorts.length) *
                      100,
                  ) / 100
                : 0,
            avgFirstReplyRate:
              retentionCohorts.length > 0
                ? Math.round(
                    (retentionCohorts.reduce(
                      (sum, c) => sum + c.milestoneStats.firstReply.rate * 100,
                      0,
                    ) /
                      retentionCohorts.length) *
                      100,
                  ) / 100
                : 0,
          },
        },
      }),
      ...(includeTemplates && {
        templateImpact: {
          templates: templateImpact,
          recommendation:
            templateImpact.length > 0 &&
            templateImpact.some((t) => t.usageCount >= 5)
              ? `${templateImpact[0].templateCategory} template shows ${Math.round(templateImpact[0].relativeSpeedIndex * 100)}% relative speed vs baseline`
              : "Enable template usage tracking for insights",
        },
      }),
    });
  } catch (error) {
    console.error("[Segmented KPI API] Error:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch segmented KPI data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
