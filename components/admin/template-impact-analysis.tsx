"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import type { TemplateImpactAnalysis } from "@/lib/segmented-activation-kpis";

type Props = {
  templates: TemplateImpactAnalysis[];
};

export function TemplateImpactAnalysis({ templates }: Props) {
  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No template usage data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const chartData = templates.map((t) => ({
    category: t.templateCategory,
    "Avg Days (1st Channel)": Math.round(t.avgDaysFirstChannel * 10) / 10,
    "Avg Days (1st Reply)": Math.round(t.avgDaysFirstReply * 10) / 10,
    "Speed Index": Math.round(t.relativeSpeedIndex * 100) / 100,
  }));

  // Find best and worst performing templates
  const bestTemplate = templates.reduce((best, current) =>
    current.relativeSpeedIndex > best.relativeSpeedIndex ? current : best,
  );
  const worstTemplate = templates.reduce((worst, current) =>
    current.relativeSpeedIndex < worst.relativeSpeedIndex ? current : worst,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Template Impact on Activation Speed
          </CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Comparison of activation metrics across starter templates
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Chart */}
          <div className="h-80 rounded-lg border bg-white p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis
                  label={{ value: "Days", angle: -90, position: "insideLeft" }}
                />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="Avg Days (1st Channel)"
                  fill="#2563eb"
                  name="Avg Days to First Channel"
                />
                <Bar
                  dataKey="Avg Days (1st Reply)"
                  fill="#0f766e"
                  name="Avg Days to First Reply"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Template comparison table */}
          <div className="space-y-3">
            <h4 className="font-medium">Detailed Metrics</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">
                      Template
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Usage</th>
                    <th className="px-3 py-2 text-right font-medium">
                      1st Channel Rate
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      1st Reply Rate
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Speed Index
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.templateCategory} className="border-b">
                      <td className="px-3 py-3 font-medium capitalize">
                        {template.templateCategory}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {template.usageCount} users
                      </td>
                      <td className="px-3 py-3 text-right">
                        {Math.round(template.completionRateFirstChannel * 100)}%
                      </td>
                      <td className="px-3 py-3 text-right">
                        {Math.round(template.completionRateFirstReply * 100)}%
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Badge
                          variant={
                            template.relativeSpeedIndex > 1.2
                              ? "default"
                              : template.relativeSpeedIndex < 0.8
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {Math.round(template.relativeSpeedIndex * 100)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key insights */}
          <div className="space-y-2 rounded-lg bg-blue-50 p-4">
            <h4 className="font-medium text-blue-900">📊 Key Insights</h4>
            <div className="space-y-2 text-sm text-blue-800">
              {bestTemplate.usageCount >= 5 && (
                <p>
                  <TrendingUp className="inline h-4 w-4 mr-2" />
                  <strong>Best performer:</strong>{" "}
                  <span className="font-medium capitalize">
                    {bestTemplate.templateCategory}
                  </span>{" "}
                  template users reach first channel
                  {Math.round(bestTemplate.relativeSpeedIndex * 100)}% faster
                </p>
              )}
              {worstTemplate.usageCount >= 5 && (
                <p>
                  <strong>Needs improvement:</strong>{" "}
                  <span className="font-medium capitalize">
                    {worstTemplate.templateCategory}
                  </span>{" "}
                  template has slower activation — consider UX review
                </p>
              )}
              <p>
                <strong>Recommendation:</strong> Promote{" "}
                {bestTemplate.templateCategory} template to new users for
                fastest onboarding
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
