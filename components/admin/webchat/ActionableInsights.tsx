"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lightbulb, AlertTriangle, CheckCircle } from "lucide-react";

export function ActionableInsights({ snapshot, analytics }: { snapshot: any; analytics: any[] }) {
  const insights = [];

  const errorRate = snapshot.totals.errorRate24h;
  if (errorRate > 0.05) {
    insights.push({
      type: "critical",
      title: "High Widget Error Rate",
      description: `Current error rate is ${(errorRate * 100).toFixed(1)}%. Investigate recent incidents for invalid tokens or blocked origins.`,
      icon: AlertTriangle,
      color: "text-red-500",
      bg: "bg-red-50",
      border: "border-red-200"
    });
  }

  if (snapshot.reasonCounts.blockedOrigin > 10) {
    insights.push({
      type: "warning",
      title: "Spike in Blocked Origins",
      description: "Multiple widgets are being blocked due to origin mismatch. Ensure tenants have configured allowed domains correctly.",
      icon: AlertTriangle,
      color: "text-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-200"
    });
  }

  if (snapshot.totals.idleSites > snapshot.totals.sitesWithTraffic) {
     insights.push({
      type: "info",
      title: "Low Adoption / Idle Sites",
      description: "More than half of active sites have no traffic. Consider sending a proactive engagement campaign to these tenants.",
      icon: Lightbulb,
      color: "text-blue-500",
      bg: "bg-blue-50",
      border: "border-blue-200"
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: "success",
      title: "System Healthy",
      description: "No immediate actionable insights. Traffic and errors are within acceptable bounds.",
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-50",
      border: "border-green-200"
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actionable Recommendations</CardTitle>
        <CardDescription>System-generated insights based on the last 24 hours of traffic.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <div key={i} className={`flex items-start gap-4 p-4 rounded-lg border ${insight.bg} ${insight.border}`}>
              <Icon className={`h-5 w-5 mt-0.5 ${insight.color}`} />
              <div>
                <h4 className={`text-sm font-semibold ${insight.color.replace('text-', 'text-')}`}>{insight.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
