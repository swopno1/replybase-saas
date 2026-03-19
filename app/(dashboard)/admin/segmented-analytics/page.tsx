import { SegmentedAnalyticsDashboard } from "@/components/admin/segmented-analytics-dashboard";

export const dynamic = "force-dynamic";

/**
 * Segmented analytics page for analyzing activation KPIs by plan, channel, and cohort.
 * Shows retention curves and template impact analysis.
 */
export default function SegmentedAnalyticsPage() {
  return <SegmentedAnalyticsDashboard />;
}
