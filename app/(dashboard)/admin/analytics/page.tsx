import { ActivationKpiDashboard } from "@/components/admin/activation-kpi-dashboard";
import { getAdminActivationKpis } from "@/lib/admin-activation-kpis";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const data = await getAdminActivationKpis();

  return <ActivationKpiDashboard data={data} />;
}
