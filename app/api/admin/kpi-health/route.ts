import { NextResponse } from "next/server";
import { checkKpiHealth } from "@/lib/kpi-health-check";

/**
 * GET /api/admin/kpi-health
 *
 * KPI health check endpoint for monitoring and uptime services.
 * Returns KPI status, data freshness, and any active alerts.
 *
 * Can be monitored by:
 * - UptimeRobot or similar services (check for 200 status + "healthy" or "degraded" status)
 * - Internal dashboards
 * - Alerting services (via webhook integration)
 *
 * Authentication: Public endpoint (provides non-sensitive aggregated health data)
 */
export async function GET() {
  try {
    const health = await checkKpiHealth();

    // Return appropriate HTTP status for external monitors
    const httpStatus =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
          ? 200
          : 503;

    return NextResponse.json(health, { status: httpStatus });
  } catch (error) {
    console.error("[KPI Health Endpoint] Error:", error);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: "critical",
        error:
          error instanceof Error ? error.message : "Failed to check KPI health",
      },
      { status: 503 },
    );
  }
}
