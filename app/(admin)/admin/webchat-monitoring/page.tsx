import { getAdminWebchatMonitoringSnapshot, getLiveWebchatSessions, getWebchatAnalytics } from "@/lib/admin-webchat-monitoring";
import { MonitoringDashboard } from "@/components/admin/webchat/MonitoringDashboard";

export const dynamic = "force-dynamic";

export default async function AdminWebchatMonitoringPage() {
  const [snapshot, liveSessions, analytics] = await Promise.all([
    getAdminWebchatMonitoringSnapshot(),
    getLiveWebchatSessions(),
    getWebchatAnalytics()
  ]);

  return (
    <MonitoringDashboard
      initialSnapshot={snapshot}
      initialLiveSessions={liveSessions}
      initialAnalytics={analytics}
    />
  );
}
