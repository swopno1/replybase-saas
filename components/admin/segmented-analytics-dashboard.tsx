"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ActivationFunnelAnalysisCard } from "@/components/admin/activation-funnel-analysis";
import { SegmentationFilters } from "@/components/admin/segmentation-filters";
import { RetentionCurveVisualization } from "@/components/admin/retention-curve-visualization";
import { TemplateImpactAnalysis } from "@/components/admin/template-impact-analysis";
import { WebchatAcquisitionAnalysisCard } from "@/components/admin/webchat-acquisition-analysis";
import type {
  ActivationFunnelAnalysis,
  CohortAnalysis,
  TemplateImpactAnalysis as TemplateType,
  WebchatAcquisitionAnalysis,
} from "@/lib/segmented-activation-kpis";

type SegmentationFilterValues = {
  planName?: string;
  channelType?: "telegram" | "facebook" | "web";
  cohortWeekStart?: string;
};

type SegmentedKpisResponse = {
  timestamp: string;
  segment: {
    filters: SegmentationFilterValues;
    description: string;
    totalTenants: number;
  };
  segmentationDimensions: {
    plans: Array<{ name: string; displayName: string; price: number }>;
    channelTypes: ("telegram" | "facebook" | "web")[];
    cohorts: Array<{ weekStart: string; label: string; tenantCount: number }>;
  };
  funnel: ActivationFunnelAnalysis;
  acquisition: WebchatAcquisitionAnalysis;
  retention: {
    curves: CohortAnalysis[];
    summary: {
      avgFirstChannelRate: number;
      avgFirstReplyRate: number;
    };
  };
  templateImpact: {
    templates: TemplateType[];
    recommendation: string;
  };
};

export function SegmentedAnalyticsDashboard() {
  const [filters, setFilters] = useState<SegmentationFilterValues>({});
  const [data, setData] = useState<SegmentedKpisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          includeCohorts: "true",
          includeTemplates: "true",
        });

        if (filters.planName) {
          params.set("planName", filters.planName);
        }

        if (filters.channelType) {
          params.set("channelType", filters.channelType);
        }

        if (filters.cohortWeekStart) {
          params.set("cohortWeekStart", filters.cohortWeekStart);
        }

        const response = await fetch(
          `/api/admin/segmented-kpis?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch segmented KPI data");
        }

        const json = (await response.json()) as SegmentedKpisResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Segmented Activation Analytics
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Analyze retention curves, cohorts, and template performance
          </p>
        </div>

        <Card>
          <CardContent className="flex items-center justify-center pt-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="ml-3 text-muted-foreground">
              Loading analytics data...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Segmented Activation Analytics
          </h1>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">
              <strong>Error:</strong> {error || "Failed to load analytics data"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    segment,
    segmentationDimensions,
    funnel,
    acquisition,
    retention,
    templateImpact,
  } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Segmented Activation Analytics
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Understand which customer segments and templates drive fastest
          activation. Break down KPIs by plan, channel, and signup cohort.
        </p>
      </div>

      {/* Filters */}
      <SegmentationFilters
        plans={segmentationDimensions.plans}
        channelTypes={segmentationDimensions.channelTypes}
        cohorts={segmentationDimensions.cohorts}
        filters={filters}
        onFilterChange={setFilters}
      />

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Current segment</p>
          <p className="mt-1 text-xl font-semibold">{segment.description}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {segment.totalTenants} tenant{segment.totalTenants === 1 ? "" : "s"}{" "}
            in scope
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-4 text-2xl font-bold">Activation Funnel</h2>
        <ActivationFunnelAnalysisCard funnel={funnel} />
      </div>

      <div>
        <h2 className="mb-4 text-2xl font-bold">Acquisition Attribution</h2>
        <WebchatAcquisitionAnalysisCard acquisition={acquisition} />
      </div>

      {/* Retention Curves */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">Retention by Signup Cohort</h2>
        <RetentionCurveVisualization cohortAnalyses={retention.curves} />
      </div>

      {/* Cohort Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Avg 1st Channel Rate
              </p>
              <p className="mt-1 text-3xl font-bold text-blue-600">
                {Math.round(retention.summary.avgFirstChannelRate * 100)}%
              </p>
            </div>
            <div className="rounded-lg bg-teal-50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Avg 1st Reply Rate
              </p>
              <p className="mt-1 text-3xl font-bold text-teal-600">
                {Math.round(retention.summary.avgFirstReplyRate * 100)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Impact */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">Template Performance</h2>
        <TemplateImpactAnalysis templates={templateImpact.templates} />
      </div>

      {/* Recommendations */}
      <Card className="bg-purple-50">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-purple-900">
            💡 Growth Recommendations
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-purple-800">
            <li>
              • <strong>Focus high-potential cohorts:</strong> Compare retention
              curves to identify which signup periods show strongest activation
              patterns
            </li>
            <li>
              • <strong>Optimize underperforming templates:</strong> Review
              template UX if completion rates are below 20%
            </li>
            <li>
              • <strong>Plan-specific strategies:</strong> Use plan filters to
              identify if free vs. paid tiers have different activation patterns
            </li>
            <li>
              • <strong>Channel optimization:</strong> Compare channel types to
              see which drives fastest first-reply activation
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
