import { KpiHealthMonitor } from "@/components/admin/kpi-health-monitor";
import { checkKpiHealth } from "@/lib/kpi-health-check";

export const dynamic = "force-dynamic";

/**
 * Admin page for monitoring KPI health and data quality.
 * Provides real-time visibility into:
 * - Overall KPI system status
 * - Data freshness and collection metrics
 * - Active alerts with recommendations
 * - Configuration thresholds
 */
export default async function AdminKpiHealthPage() {
  const health = await checkKpiHealth();

  return <KpiHealthMonitor data={health} />;
}
