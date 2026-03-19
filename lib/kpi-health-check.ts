import { prisma } from "@/lib/prisma";
import { getAdminActivationKpis } from "@/lib/admin-activation-kpis";

/**
 * Alert severity levels for KPI health monitoring.
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Single KPI health alert.
 */
export interface KpiHealthAlert {
  metric: string;
  severity: AlertSeverity;
  message: string;
  value: number | string;
  threshold?: number | string;
  recommendation?: string;
}

/**
 * Complete KPI health check result.
 */
export interface KpiHealthCheckResult {
  timestamp: string;
  status: "healthy" | "degraded" | "critical";
  alerts: KpiHealthAlert[];
  summary: {
    totalMetricsChecked: number;
    alertsCount: number;
    warningsCount: number;
    criticalCount: number;
  };
  dataQuality: {
    milestoneEventsLastHour: number;
    webhookLogsLastHour: number;
    runtimeMessagesLastHour: number;
    dataFreshness: "fresh" | "stale" | "missing";
  };
}

/**
 * Validation thresholds for KPI health checks.
 * Adjustable via environment variables.
 */
const THRESHOLDS = {
  // Alert if no milestone events in the last N hours
  minEventDataAgeHours:
    parseFloat(process.env.KPI_MIN_EVENT_AGE_HOURS || "2") || 2,

  // Alert if completion rates fall below these thresholds
  minFirstChannelCompletionRate:
    parseFloat(process.env.KPI_MIN_FIRST_CHANNEL_RATE || "0.05") || 0.05, // 5%
  minFirstReplyCompletionRate:
    parseFloat(process.env.KPI_MIN_FIRST_REPLY_RATE || "0.02") || 0.02, // 2%

  // Alert if average days to milestone exceed these limits
  maxDaysFirstChannel:
    parseFloat(process.env.KPI_MAX_DAYS_FIRST_CHANNEL || "7") || 7,
  maxDaysFirstReply:
    parseFloat(process.env.KPI_MAX_DAYS_FIRST_REPLY || "30") || 30,

  // Alert if webhook setup reliability falls below threshold
  maxFailedWebhookSetupRate:
    parseFloat(process.env.KPI_MAX_WEBHOOK_FAILURE_RATE || "0.2") || 0.2, // 20% failure rate

  // Alert if too few webhook attempts (no data collecting)
  minWeeklyWebhookAttempts:
    parseFloat(process.env.KPI_MIN_WEBHOOK_ATTEMPTS || "5") || 5,
};

/**
 * Check data freshness: ensure KPI data is recent and flowing.
 */
async function checkDataFreshness(): Promise<{
  dataFreshness: "fresh" | "stale" | "missing";
  milestoneEventsLastHour: number;
  webhookLogsLastHour: number;
  runtimeMessagesLastHour: number;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [milestoneEventCount, webhookLogCount, runtimeMessageCount] =
    await Promise.all([
      prisma.onboardingMilestoneEvent.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      prisma.webhookLog.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),
      prisma.crmMessage.count({
        where: {
          createdAt: { gte: oneHourAgo },
          direction: "outbound",
          source: { in: ["ai", "flow", "system"] },
        },
      }),
    ]);

  const totalActivity =
    milestoneEventCount + webhookLogCount + runtimeMessageCount;

  let dataFreshness: "fresh" | "stale" | "missing";
  if (totalActivity === 0) {
    dataFreshness = "missing";
  } else if (totalActivity < 5) {
    dataFreshness = "stale";
  } else {
    dataFreshness = "fresh";
  }

  return {
    dataFreshness,
    milestoneEventsLastHour: milestoneEventCount,
    webhookLogsLastHour: webhookLogCount,
    runtimeMessagesLastHour: runtimeMessageCount,
  };
}

/**
 * Main KPI health check: validates KPI metrics against thresholds
 * and surfaces alerts for production monitoring.
 */
export async function checkKpiHealth(): Promise<KpiHealthCheckResult> {
  const alerts: KpiHealthAlert[] = [];

  try {
    // Get current KPI data
    const kpis = await getAdminActivationKpis();
    const dataQuality = await checkDataFreshness();

    // Check 1: Data freshness
    if (dataQuality.dataFreshness === "missing") {
      alerts.push({
        metric: "data_collection",
        severity: "critical",
        message:
          "No KPI data collected in the last hour. Check if milestone events are being instrumented.",
        value: 0,
        recommendation:
          "Verify that onboarding milestones are firing. Check Phase B instrumentation.",
      });
    } else if (dataQuality.dataFreshness === "stale") {
      alerts.push({
        metric: "data_collection",
        severity: "warning",
        message: "Very low KPI data collection volume in the last hour.",
        value: dataQuality.milestoneEventsLastHour,
        recommendation:
          "Monitor if this is expected (low user activity) or if instrumentation is broken.",
      });
    }

    // Check 2: First Channel Completion Rate
    if (
      kpis.milestones.firstChannel.completionRate <
      THRESHOLDS.minFirstChannelCompletionRate
    ) {
      alerts.push({
        metric: "first_channel_completion_rate",
        severity:
          kpis.milestones.firstChannel.completionRate === 0
            ? "critical"
            : "warning",
        message: `First channel completion rate is ${(kpis.milestones.firstChannel.completionRate * 100).toFixed(1)}%`,
        value:
          (kpis.milestones.firstChannel.completionRate * 100).toFixed(1) + "%",
        threshold:
          (THRESHOLDS.minFirstChannelCompletionRate * 100).toFixed(1) + "%",
        recommendation:
          "Check if tenants are successfully activating their first channel. Review channel UX/onboarding flow.",
      });
    }

    // Check 3: First Reply Completion Rate
    if (
      kpis.milestones.firstAutomatedReply.completionRate <
      THRESHOLDS.minFirstReplyCompletionRate
    ) {
      alerts.push({
        metric: "first_reply_completion_rate",
        severity:
          kpis.milestones.firstAutomatedReply.completionRate === 0
            ? "critical"
            : "warning",
        message: `First automated reply completion rate is ${(kpis.milestones.firstAutomatedReply.completionRate * 100).toFixed(1)}%`,
        value:
          (kpis.milestones.firstAutomatedReply.completionRate * 100).toFixed(
            1,
          ) + "%",
        threshold:
          (THRESHOLDS.minFirstReplyCompletionRate * 100).toFixed(1) + "%",
        recommendation:
          "Low reply automation rate may indicate UX friction or issues with flow/bot setup. Check default bot activation.",
      });
    }

    // Check 4: Time to First Channel (increasing duration may indicate UX friction)
    if (
      kpis.milestones.firstChannel.averageDaysToCompletion >
      THRESHOLDS.maxDaysFirstChannel
    ) {
      alerts.push({
        metric: "time_to_first_channel",
        severity: "warning",
        message: `Average time to first channel is ${kpis.milestones.firstChannel.averageDaysToCompletion.toFixed(1)} days`,
        value:
          kpis.milestones.firstChannel.averageDaysToCompletion.toFixed(1) +
          " days",
        threshold: THRESHOLDS.maxDaysFirstChannel + " days",
        recommendation:
          "Tenants are taking longer to connect their first channel. Review onboarding UX and messaging.",
      });
    }

    // Check 5: Time to First Reply (automation adoption friction)
    if (
      kpis.milestones.firstAutomatedReply.averageDaysToCompletion >
      THRESHOLDS.maxDaysFirstReply
    ) {
      alerts.push({
        metric: "time_to_first_reply",
        severity: "warning",
        message: `Average time to first reply is ${kpis.milestones.firstAutomatedReply.averageDaysToCompletion.toFixed(1)} days`,
        value:
          kpis.milestones.firstAutomatedReply.averageDaysToCompletion.toFixed(
            1,
          ) + " days",
        threshold: THRESHOLDS.maxDaysFirstReply + " days",
        recommendation:
          "Long automation adoption times suggest friction in flow builder or default bot UX.",
      });
    }

    // Check 6: Webhook Setup Reliability
    if (
      kpis.failedWebhookSetupRate.current > THRESHOLDS.maxFailedWebhookSetupRate
    ) {
      alerts.push({
        metric: "webhook_setup_reliability",
        severity: "warning",
        message: `Webhook setup failure rate is ${(kpis.failedWebhookSetupRate.current * 100).toFixed(1)}%`,
        value: (kpis.failedWebhookSetupRate.current * 100).toFixed(1) + "%",
        threshold:
          (THRESHOLDS.maxFailedWebhookSetupRate * 100).toFixed(1) + "%",
        recommendation:
          "High webhook setup failures affecting channel reliability. Check channel API integrations and logs.",
      });
    }

    // Check 7: Webhook telemetry collection
    if (
      kpis.weeklyTrend.length > 0 &&
      kpis.weeklyTrend[kpis.weeklyTrend.length - 1].webhookAttempts <
        THRESHOLDS.minWeeklyWebhookAttempts
    ) {
      alerts.push({
        metric: "webhook_telemetry_collection",
        severity: "info",
        message: `Low webhook setup attempt volume in current week (${kpis.weeklyTrend[kpis.weeklyTrend.length - 1].webhookAttempts} attempts)`,
        value: kpis.weeklyTrend[kpis.weeklyTrend.length - 1].webhookAttempts,
        recommendation:
          "Low channel setup volume is normal in low-activity periods. Verify telemetry is logged during actual setups.",
      });
    }

    // Check 8: Weekly active tenants trend (declining activity)
    const currentWeekActive = kpis.weeklyActiveTenants.current;
    const previousWeekActive = kpis.weeklyActiveTenants.previous;
    if (
      previousWeekActive > 0 &&
      currentWeekActive < previousWeekActive * 0.5
    ) {
      alerts.push({
        metric: "weekly_active_tenants",
        severity: "warning",
        message: `Weekly active tenants dropped from ${previousWeekActive} to ${currentWeekActive} (down ${((1 - currentWeekActive / previousWeekActive) * 100).toFixed(0)}%)`,
        value: currentWeekActive,
        threshold: previousWeekActive,
        recommendation:
          "Significant drop in weekly active tenants. Check for issues with bot runtime or message delivery.",
      });
    }

    // Determine overall health status
    const criticalCount = alerts.filter(
      (a) => a.severity === "critical",
    ).length;
    const warningCount = alerts.filter((a) => a.severity === "warning").length;

    let status: "healthy" | "degraded" | "critical";
    if (criticalCount > 0) {
      status = "critical";
    } else if (warningCount > 0 || alerts.length > 2) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return {
      timestamp: new Date().toISOString(),
      status,
      alerts,
      summary: {
        totalMetricsChecked: 8,
        alertsCount: alerts.length,
        warningsCount: warningCount,
        criticalCount,
      },
      dataQuality,
    };
  } catch (error) {
    console.error("[KPI Health Check] Error:", error);

    return {
      timestamp: new Date().toISOString(),
      status: "critical",
      alerts: [
        {
          metric: "health_check_execution",
          severity: "critical",
          message:
            "Failed to execute KPI health check. See server logs for details.",
          value: error instanceof Error ? error.message : "Unknown error",
          recommendation:
            "Verify database connectivity and that all required tables exist (OnboardingMilestoneEvent, WebhookLog, etc.)",
        },
      ],
      summary: {
        totalMetricsChecked: 0,
        alertsCount: 1,
        warningsCount: 0,
        criticalCount: 1,
      },
      dataQuality: {
        milestoneEventsLastHour: 0,
        webhookLogsLastHour: 0,
        runtimeMessagesLastHour: 0,
        dataFreshness: "missing",
      },
    };
  }
}
