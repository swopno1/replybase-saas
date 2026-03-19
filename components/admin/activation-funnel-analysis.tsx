"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActivationFunnelAnalysis } from "@/lib/segmented-activation-kpis";

type Props = {
  funnel: ActivationFunnelAnalysis;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDays(value: number) {
  return `${value.toFixed(1)}d`;
}

export function ActivationFunnelAnalysisCard({ funnel }: Props) {
  const chartData = funnel.stages.map((stage) => ({
    label: stage.label,
    tenants: stage.count,
    conversion: Math.round(stage.conversionFromSignup * 100),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activation Funnel</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Segment scope: {funnel.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Segment Size
              </p>
              <p className="mt-1 text-3xl font-bold">{funnel.totalTenants}</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Avg Time To First Channel
              </p>
              <p className="mt-1 text-3xl font-bold text-blue-700">
                {formatDays(funnel.avgDaysToFirstChannel)}
              </p>
            </div>
            <div className="rounded-lg bg-teal-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Avg Time To First Reply
              </p>
              <p className="mt-1 text-3xl font-bold text-teal-700">
                {formatDays(funnel.avgDaysToFirstReply)}
              </p>
            </div>
          </div>

          <div className="h-72 rounded-lg border bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="tenants" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {funnel.stages.map((stage) => (
              <div key={stage.key} className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {stage.label}
                </p>
                <p className="mt-2 text-2xl font-bold">{stage.count}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatPercent(stage.conversionFromSignup)} from signup
                </p>
                {stage.key !== "signup" && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPercent(stage.conversionFromPrevious)} from previous
                    step
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Largest dropoff:</strong>{" "}
            {funnel.largestDropoffStage || "None yet"}
            {funnel.largestDropoffStage ? " stage" : ""}. Average
            channel-to-reply time is {formatDays(funnel.avgDaysChannelToReply)}.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
