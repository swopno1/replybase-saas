"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CohortAnalysis } from "@/lib/segmented-activation-kpis";

type Props = {
  cohortAnalyses: CohortAnalysis[];
};

export function RetentionCurveVisualization({ cohortAnalyses }: Props) {
  if (cohortAnalyses.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No cohort data available. Enable retention analysis to view curves.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show only the most recent 4 cohorts for clarity
  const recentCohorts = cohortAnalyses.slice(0, 4);

  // Combine all retention curves for visualization
  // Create a dataset where each row contains data for all cohorts at a given week
  const maxWeeks = Math.max(
    ...recentCohorts.map((c) => c.retentionCurve.length),
  );
  const combinedData = [];

  for (let week = 0; week < maxWeeks; week++) {
    const weekData: Record<string, unknown> = {
      week: week + 1,
      label: `Week ${week + 1}`,
    };

    for (const cohort of recentCohorts) {
      const point = cohort.retentionCurve[week];
      if (point) {
        weekData[`${cohort.cohortLabel}_channel`] =
          point.percentageFirstChannel;
        weekData[`${cohort.cohortLabel}_reply`] = point.percentageFirstReply;
      }
    }

    combinedData.push(weekData);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Retention Curves by Signup Cohort
        </CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Percentage of each cohort reaching milestones over time
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Combined chart */}
          <div className="h-80 rounded-lg border bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis
                  label={{
                    value: "% of Cohort",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? `${value.toFixed(1)}%` : value
                  }
                />
                <Legend />
                {recentCohorts.map((cohort, idx) => {
                  const colors = ["#2563eb", "#059669", "#d97706", "#dc2626"];
                  return (
                    <Line
                      key={`${cohort.cohortLabel}_channel`}
                      type="monotone"
                      dataKey={`${cohort.cohortLabel}_channel`}
                      stroke={colors[idx % colors.length]}
                      name={`${cohort.cohortLabel} (1st channel)`}
                      dot={false}
                      strokeWidth={2}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cohort summary table */}
          <div className="space-y-3">
            <h4 className="font-medium">Cohort Summary</h4>
            <div className="space-y-2">
              {recentCohorts.map((cohort) => (
                <div
                  key={cohort.cohortWeekStart}
                  className="flex items-center justify-between rounded-lg border border-l-4 p-3"
                  style={{
                    borderLeftColor:
                      cohort.cohortLabel === recentCohorts[0]?.cohortLabel
                        ? "#2563eb"
                        : "#d1d5db",
                  }}
                >
                  <div>
                    <p className="font-medium">{cohort.cohortLabel}</p>
                    <p className="text-sm text-muted-foreground">
                      {cohort.cohortSize} users
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      <span className="font-medium">First Channel:</span>{" "}
                      {Math.round(
                        cohort.milestoneStats.firstChannel.rate * 100,
                      )}
                      %
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">First Reply:</span>{" "}
                      {Math.round(cohort.milestoneStats.firstReply.rate * 100)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
