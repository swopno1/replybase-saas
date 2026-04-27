"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function AnalyticsCharts({ data }: { data: any[] }) {
  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return `${d.getHours()}:00`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic & Error Trends (Last 24h)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#ef4444"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={(label) => new Date(label).toLocaleString()}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sessions"
                name="New Sessions"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="errors"
                name="Errors"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
