import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  getAdminWebchatMonitoringSnapshot,
  type WebchatMonitoringSnapshot,
} from "@/lib/admin-webchat-monitoring";

export const dynamic = "force-dynamic";

type HealthStatus = "healthy" | "watch" | "critical";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No traffic yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelative(value: string | null) {
  if (!value) {
    return "No traffic yet";
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaMinutes = Math.max(Math.round(deltaMs / 60000), 0);

  if (deltaMinutes < 1) {
    return "just now";
  }

  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function getHealthBadge(status: HealthStatus) {
  switch (status) {
    case "healthy":
      return {
        label: "Healthy",
        className: "border-green-200 bg-green-50 text-green-700",
        icon: CheckCircle2,
      };
    case "watch":
      return {
        label: "Watch",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        icon: Clock3,
      };
    default:
      return {
        label: "Critical",
        className: "border-red-200 bg-red-50 text-red-700",
        icon: ShieldAlert,
      };
  }
}

function getFreshnessStatus(lastActivityAt: string | null): HealthStatus {
  if (!lastActivityAt) {
    return "watch";
  }

  const ageMinutes = (Date.now() - new Date(lastActivityAt).getTime()) / 60000;
  if (ageMinutes <= 15) {
    return "healthy";
  }
  if (ageMinutes <= 60) {
    return "watch";
  }
  return "critical";
}

function getErrorBudgetStatus(
  errorRate: number,
  trafficCount: number,
): HealthStatus {
  if (trafficCount === 0) {
    return "watch";
  }
  if (errorRate <= 0.03) {
    return "healthy";
  }
  if (errorRate <= 0.08) {
    return "watch";
  }
  return "critical";
}

function getBlockedOriginStatus(count: number): HealthStatus {
  if (count <= 5) {
    return "healthy";
  }
  if (count <= 20) {
    return "watch";
  }
  return "critical";
}

function getRateLimitStatus(count: number): HealthStatus {
  if (count <= 10) {
    return "healthy";
  }
  if (count <= 25) {
    return "watch";
  }
  return "critical";
}

function getRolloutStatus(snapshot: WebchatMonitoringSnapshot): HealthStatus {
  if (
    snapshot.rollout.mode === "ga" &&
    snapshot.reasonCounts.rolloutDisabled > 0
  ) {
    return "critical";
  }
  if (
    (snapshot.rollout.mode === "pilot" || snapshot.rollout.mode === "tiered") &&
    snapshot.reasonCounts.rolloutDisabled > 10
  ) {
    return "watch";
  }
  return "healthy";
}

function HealthRow({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail: string;
  status: HealthStatus;
}) {
  const badge = getHealthBadge(status);
  const Icon = badge.icon;

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <Badge variant="outline" className={badge.className}>
        <Icon className="h-3.5 w-3.5" />
        {badge.label}
      </Badge>
    </div>
  );
}

export default async function AdminWebchatMonitoringPage() {
  const snapshot = await getAdminWebchatMonitoringSnapshot();

  const freshnessStatus = getFreshnessStatus(snapshot.totals.lastActivityAt);
  const errorBudgetStatus = getErrorBudgetStatus(
    snapshot.totals.errorRate24h,
    snapshot.totals.widgetEvents24h,
  );
  const blockedOriginStatus = getBlockedOriginStatus(
    snapshot.reasonCounts.blockedOrigin,
  );
  const rateLimitStatus = getRateLimitStatus(snapshot.reasonCounts.rateLimit);
  const rolloutStatus = getRolloutStatus(snapshot);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900">
            Webchat Monitoring
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Live operational view for the Phase 8 rollout window. Metrics below
            summarize the last {snapshot.windowHours} hours of widget traffic,
            incident reasons, and rollout posture.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700"
          >
            <Radio className="h-3.5 w-3.5" />
            Mode: {snapshot.rollout.mode}
          </Badge>
          <Badge
            variant="outline"
            className="border-gray-200 bg-gray-50 text-gray-700"
          >
            Generated: {formatTimestamp(snapshot.generatedAt)}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Sites
            </CardTitle>
            <CardDescription>
              Configured webchat sites currently enabled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatNumber(snapshot.totals.activeSites)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(snapshot.totals.sitesWithTraffic)} with traffic in
              the last {snapshot.windowHours}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Sessions
            </CardTitle>
            <CardDescription>
              Webchat sessions seen in the current window
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatNumber(snapshot.totals.sessions24h)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(snapshot.totals.conversations24h)} web conversations
              updated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Messages
            </CardTitle>
            <CardDescription>
              CRM transcript entries written from webchat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatNumber(snapshot.totals.messages24h)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(snapshot.totals.widgetEvents24h)} widget events
              tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Last Activity
            </CardTitle>
            <CardDescription>
              Most recent session or widget event across all sites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatRelative(snapshot.totals.lastActivityAt)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatTimestamp(snapshot.totals.lastActivityAt)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Operational SLA Checks</CardTitle>
            <CardDescription>
              Fast-read thresholds for pilot and tiered rollout phases. These
              are intentionally simple operator checks, not contractual uptime
              math.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <HealthRow
              label="Traffic Freshness"
              value={formatRelative(snapshot.totals.lastActivityAt)}
              detail="Target: fresh activity within 15 minutes while rollout is active."
              status={freshnessStatus}
            />
            <HealthRow
              label="Widget Error Budget"
              value={formatPercent(snapshot.totals.errorRate24h)}
              detail="Target: error events remain below 3% of widget events over the last 24 hours."
              status={errorBudgetStatus}
            />
            <HealthRow
              label="Blocked Origins"
              value={formatNumber(snapshot.reasonCounts.blockedOrigin)}
              detail="Target: sustained blocked-origin spikes stay under 5 per 24 hours."
              status={blockedOriginStatus}
            />
            <HealthRow
              label="Rate-Limit Pressure"
              value={formatNumber(snapshot.reasonCounts.rateLimit)}
              detail="Target: keep rate-limit incidents below 10 per 24 hours during pilot."
              status={rateLimitStatus}
            />
            <HealthRow
              label="Rollout Denials"
              value={formatNumber(snapshot.reasonCounts.rolloutDisabled)}
              detail="Expected only for non-allowlisted tenants in pilot or tiered mode. Any GA denials need investigation."
              status={rolloutStatus}
            />
            <HealthRow
              label="Idle Active Sites"
              value={formatNumber(snapshot.totals.idleSites)}
              detail="Active sites without traffic in the last 24 hours. Use this to catch silent pilot tenants."
              status={
                snapshot.totals.idleSites === 0
                  ? "healthy"
                  : snapshot.totals.sitesWithTraffic > 0
                    ? "watch"
                    : "critical"
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rollout Controls Snapshot</CardTitle>
            <CardDescription>
              Current runtime rollout configuration used by the public webchat
              endpoints.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="font-medium text-gray-900">Current mode</span>
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700"
              >
                {snapshot.rollout.mode}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Pilot tenants
                </p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(snapshot.rollout.pilotTenantIds.length)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Allowed plans
                </p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(snapshot.rollout.allowedPlanNames.length)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Force enabled
                </p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(snapshot.rollout.enabledTenantIds.length)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Force disabled
                </p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(snapshot.rollout.disabledTenantIds.length)}
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="font-medium text-gray-900">Promotion checklist</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  Keep widget error budget under 3% for 48 consecutive hours.
                </li>
                <li>
                  Resolve blocked-origin spikes before adding new pilot tenants.
                </li>
                <li>
                  Review force-disabled tenants before moving from tiered to GA.
                </li>
                <li>
                  Only promote to GA when recent incidents are understood and
                  stable.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Incident Reasons Last 24 Hours</CardTitle>
            <CardDescription>
              Error-event breakdown recorded by webchat diagnostics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Blocked origin", snapshot.reasonCounts.blockedOrigin],
              ["Rate limit", snapshot.reasonCounts.rateLimit],
              ["Rollout disabled", snapshot.reasonCounts.rolloutDisabled],
              ["Invalid token", snapshot.reasonCounts.invalidToken],
              [
                "Invalid init challenge",
                snapshot.reasonCounts.invalidInitChallenge,
              ],
              ["Bot mitigation", snapshot.reasonCounts.botMitigation],
              ["Message error", snapshot.reasonCounts.messageError],
              ["Unknown", snapshot.reasonCounts.unknown],
            ].map(([label, count]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-900">
                  {label}
                </span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatNumber(Number(count))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Incidents</CardTitle>
            <CardDescription>
              Latest recorded webchat errors across all tenants and sites.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {snapshot.recentErrors.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No webchat incidents have been recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {snapshot.recentErrors.map((incident) => (
                  <div key={incident.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-red-700"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {incident.reason}
                          </Badge>
                          {incident.stage ? (
                            <Badge variant="secondary">{incident.stage}</Badge>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {incident.tenantName} / {incident.botName} /{" "}
                          {incident.siteName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {incident.message ||
                            "No extra context stored for this event."}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(incident.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
