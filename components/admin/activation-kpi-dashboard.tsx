"use client";

import {
  CartesianGrid,
  Bar,
  BarChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Clock3,
  MessageSquareReply,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { AdminActivationKpis } from "@/lib/admin-activation-kpis";

type Props = {
  data: AdminActivationKpis;
};

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return `${value}`;
}

export function ActivationKpiDashboard({ data }: Props) {
  const activationChartConfig = {
    firstChannel: {
      label: "First channel",
      color: "#2563eb",
    },
    firstAutomatedReply: {
      label: "First automated reply",
      color: "#0f766e",
    },
    activeTenants: {
      label: "Weekly active tenants",
      color: "#d97706",
    },
  };

  const reliabilityChartConfig = {
    webhookAttempts: {
      label: "Setup attempts",
      color: "#2563eb",
    },
    webhookFailures: {
      label: "Setup failures",
      color: "#dc2626",
    },
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Activation And Reliability KPIs
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Measures onboarding speed, weekly runtime activity, and multi-channel
          setup reliability (Telegram, Facebook, Webchat).
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Time To First Channel
            </CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.milestones.firstChannel.averageDaysToCompletion.toFixed(1)}d
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Median{" "}
              {data.milestones.firstChannel.medianDaysToCompletion.toFixed(1)}d
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatPercent(data.milestones.firstChannel.completionRate)} of
              tenants completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Time To First Reply
            </CardTitle>
            <MessageSquareReply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.milestones.firstAutomatedReply.averageDaysToCompletion.toFixed(
                1,
              )}
              d
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Median{" "}
              {data.milestones.firstAutomatedReply.medianDaysToCompletion.toFixed(
                1,
              )}
              d
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Avg. {data.timeBetweenMilestones.avg.toFixed(1)}d from first
              channel to reply
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Weekly Active Tenants
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.weeklyActiveTenants.current}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatSignedDelta(data.weeklyActiveTenants.delta)} vs previous
              week
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Previous week: {data.weeklyActiveTenants.previous}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Failed Webhook Setup Rate
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatPercent(data.failedWebhookSetupRate.current)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.failedWebhookSetupRate.failures} failed /{" "}
              {data.failedWebhookSetupRate.attempts} attempts this week
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Source: {data.meta.webhookScope}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Activation Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[320px] w-full"
              config={activationChartConfig}
            >
              <LineChart data={data.weeklyTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="firstChannel"
                  stroke="var(--color-firstChannel)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="firstAutomatedReply"
                  stroke="var(--color-firstAutomatedReply)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="activeTenants"
                  stroke="var(--color-activeTenants)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook Setup Reliability</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              className="h-[320px] w-full"
              config={reliabilityChartConfig}
            >
              <BarChart data={data.weeklyTrend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="webhookAttempts"
                  fill="var(--color-webhookAttempts)"
                  radius={4}
                />
                <Bar
                  dataKey="webhookFailures"
                  fill="var(--color-webhookFailures)"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Milestone Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">First connected channel</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {data.milestones.firstChannel.completedCount} of{" "}
                {data.totalTenants} tenants have connected a channel.
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">First automated reply</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {data.milestones.firstAutomatedReply.completedCount} of{" "}
                {data.totalTenants} tenants have reached their first reply.
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Time between milestones</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Min {data.timeBetweenMilestones.min.toFixed(1)}d, avg{" "}
                {data.timeBetweenMilestones.avg.toFixed(1)}d, max{" "}
                {data.timeBetweenMilestones.max.toFixed(1)}d.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Time-to-milestone KPIs are computed from tenant creation to the
              first recorded milestone event.
            </p>
            <p>
              Weekly active tenants count unique tenants with automated outbound
              runtime traffic in the week.
            </p>
            <p>
              Webhook reliability currently tracks Telegram connect and
              reconnect attempts logged by ReplyBase from this release forward.
            </p>
            <p>
              Generated at{" "}
              {new Date(data.meta.timestamp).toLocaleString("en-US")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
