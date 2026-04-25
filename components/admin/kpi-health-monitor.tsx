"use client";

import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { KpiHealthCheckResult } from "@/lib/kpi-health-check";

type Props = {
  data: KpiHealthCheckResult;
};

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "warning":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

function getStatusIcon(status: string) {
  if (status === "healthy") {
    return <CheckCircle2 className="h-6 w-6 text-green-600" />;
  } else if (status === "degraded") {
    return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
  } else {
    return <AlertCircle className="h-6 w-6 text-red-600" />;
  }
}

function getStatusColor(status: string) {
  if (status === "healthy") {
    return "text-green-700 bg-green-50 border-green-200";
  } else if (status === "degraded") {
    return "text-yellow-700 bg-yellow-50 border-yellow-200";
  } else {
    return "text-red-700 bg-red-50 border-red-200";
  }
}

export function KpiHealthMonitor({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          KPI Health Monitor
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Real-time monitoring of onboarding metrics, data freshness, and system
          health. Last checked: {new Date(data.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Overall Status Card */}
      <Card className={`border-2 ${getStatusColor(data.status)}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Overall KPI Health</CardTitle>
            {getStatusIcon(data.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <p className="text-2xl font-bold capitalize">{data.status}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active Alerts
              </p>
              <p className="text-2xl font-bold">{data.summary.alertsCount}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Data Freshness
              </p>
              <Badge variant="outline" className="capitalize">
                {data.dataQuality.dataFreshness}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Freshness Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Collection (Last Hour)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Milestone Events
              </p>
              <p className="text-2xl font-bold">
                {data.dataQuality.milestoneEventsLastHour}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Webhook Setup Logs
              </p>
              <p className="text-2xl font-bold">
                {data.dataQuality.webhookLogsLastHour}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Runtime Messages
              </p>
              <p className="text-2xl font-bold">
                {data.dataQuality.runtimeMessagesLastHour}
              </p>
            </div>
          </div>
          {data.dataQuality.dataFreshness !== "fresh" && (
            <div className="mt-3 rounded-md bg-yellow-50 p-3">
              <div className="text-sm text-yellow-800">
                <span>
                  ⚠️ Low data collection volume detected. This may indicate:
                </span>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>Low user activity (expected during off-hours)</li>
                  <li>Instrumentation issues (check logs)</li>
                  <li>Database connectivity problems</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts Section */}
      {data.alerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Active Alerts ({data.alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.alerts.map((alert, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-l-4 bg-white p-4"
                style={{
                  borderLeftColor:
                    alert.severity === "critical"
                      ? "#dc2626"
                      : alert.severity === "warning"
                        ? "#ca8a04"
                        : "#2563eb",
                }}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {alert.metric.replace(/_/g, " ").toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {alert.message}
                    </p>
                  </div>
                  <Badge className={getSeverityColor(alert.severity)}>
                    {alert.severity}
                  </Badge>
                </div>

                {(alert.threshold || alert.recommendation) && (
                  <div className="mt-3 space-y-2 bg-gray-50 p-3 rounded text-sm">
                    {alert.threshold && (
                      <p className="text-gray-700">
                        <span className="font-medium">Threshold:</span>{" "}
                        {alert.threshold}
                      </p>
                    )}
                    {alert.recommendation && (
                      <p className="text-gray-700">
                        <span className="font-medium">Recommendation:</span>{" "}
                        {alert.recommendation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <p>
                <span className="font-medium">All metrics healthy!</span> No
                active alerts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help & Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monitoring Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-2">
              🟢 Healthy — All KPI metrics within normal ranges
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Data is being collected regularly</li>
              <li>Completion rates and timings are on target</li>
              <li>No infrastructure issues detected</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">
              🟡 Degraded — Some metrics at risk or data freshness low
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Investigation recommended</li>
              <li>Check recommendations in alerts</li>
              <li>Monitor for escalation</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">
              🔴 Critical — Infrastructure or data collection broken
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Immediate action required</li>
              <li>Check database connectivity</li>
              <li>Verify milestone event instrumentation</li>
              <li>Review application logs</li>
            </ul>
          </div>

          <div className="mt-4 border-t pt-4">
            <p className="font-medium text-foreground mb-2">
              🔧 Configurable Thresholds
            </p>
            <p>
              Alert thresholds can be adjusted via environment variables:
              KPI_MIN_FIRST_CHANNEL_RATE, KPI_MAX_DAYS_FIRST_CHANNEL,
              KPI_MAX_WEBHOOK_FAILURE_RATE, etc.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
