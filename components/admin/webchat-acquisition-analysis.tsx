"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AttributionBreakdownItem,
  WebchatAcquisitionAnalysis,
} from "@/lib/segmented-activation-kpis";

type Props = {
  acquisition: WebchatAcquisitionAnalysis;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function BreakdownList({
  title,
  items,
}: {
  title: string;
  items: AttributionBreakdownItem[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <h4 className="font-medium">{title}</h4>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No data available yet.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={`${title}-${item.key}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPercent(item.share)} of conversations
                </p>
              </div>
              <p className="text-sm font-semibold">{item.conversations}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function WebchatAcquisitionAnalysisCard({ acquisition }: Props) {
  if (acquisition.totalWebchatConversations === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No webchat acquisition data is available for this segment yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = acquisition.topSources.map((item) => ({
    label: item.label,
    conversations: item.conversations,
  }));
  const trendData = acquisition.weeklyTrend.map((point) => ({
    label: point.label,
    total: point.totalConversations,
    attributed: point.attributedConversations,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Webchat Acquisition Attribution
        </CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Webchat-only attribution derived from conversation source metadata for
          the current segment.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Webchat Conversations
            </p>
            <p className="mt-1 text-3xl font-bold">
              {acquisition.totalWebchatConversations}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Attributed Rate
            </p>
            <p className="mt-1 text-3xl font-bold text-blue-700">
              {formatPercent(acquisition.attributionRate)}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Unique Sources
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">
              {acquisition.uniqueSources}
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Unique Campaigns
            </p>
            <p className="mt-1 text-3xl font-bold text-amber-700">
              {acquisition.uniqueCampaigns}
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
              <Bar
                dataKey="conversations"
                fill="#0f766e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-72 rounded-lg border bg-white p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name="Total webchat conversations"
              />
              <Line
                type="monotone"
                dataKey="attributed"
                stroke="#0f766e"
                strokeWidth={2}
                dot={false}
                name="Attributed conversations"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <BreakdownList title="Top Sources" items={acquisition.topSources} />
          <BreakdownList title="Top Mediums" items={acquisition.topMediums} />
          <BreakdownList
            title="Top Campaigns"
            items={acquisition.topCampaigns}
          />
          <BreakdownList
            title="Top Referrers"
            items={acquisition.topReferrers}
          />
          <BreakdownList
            title="Top Landing Pages"
            items={acquisition.topLandingPages}
          />
        </div>

        <div className="rounded-lg bg-cyan-50 p-4 text-sm text-cyan-950">
          <strong>Coverage:</strong> {acquisition.attributedConversations} of{" "}
          {acquisition.totalWebchatConversations} conversations have at least
          one source signal. The remaining{" "}
          {acquisition.unattributedConversations} are direct or missing
          metadata. Weekly trend compares total webchat volume against captured
          attribution.
        </div>
      </CardContent>
    </Card>
  );
}
