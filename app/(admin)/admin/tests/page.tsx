"use client";

import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TestHistory {
  id: string;
  type: string;
  name: string;
  status: string;
  duration: number;
  metrics: any;
  createdAt: string;
}

export default function AdminTestsPage() {
  const [results, setResults] = useState<TestHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    try {
      const res = await fetch("/api/admin/tests");
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error("Failed to fetch test results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const runSmokeTest = async () => {
    toast.promise(
      fetch("/api/admin/tests", {
        method: "POST",
        body: JSON.stringify({ type: "smoke", name: "Manual Smoke Test" }),
      }),
      {
        loading: "Running smoke test...",
        success: () => {
          fetchResults();
          return "Smoke test completed";
        },
        error: "Smoke test failed",
      }
    );
  };

  const loadTestData = results
    .filter((r) => r.type === "load" && r.metrics)
    .map((r) => ({
      name: new Date(r.createdAt).toLocaleTimeString(),
      p50: r.metrics.p50,
      p95: r.metrics.p95,
      throughput: r.metrics.throughput,
    }))
    .reverse();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Testing & Performance</h1>
        <div className="space-x-2">
          <Button onClick={runSmokeTest}>Run Smoke Test</Button>
          <Button variant="outline" onClick={fetchResults}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Trends (Latency p95)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadTestData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="ms" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#ef4444"
                  name="p95 Latency"
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#3b82f6"
                  name="p50 Latency"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Throughput (req/s)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadTestData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="throughput"
                  stroke="#10b981"
                  name="Req/s"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Test History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Type</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Duration</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 capitalize">{r.type}</td>
                    <td className="py-2">{r.name}</td>
                    <td className="py-2">
                      <Badge
                        variant={
                          r.status === "passed" ? "default" : "destructive"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-2">{r.duration}ms</td>
                    <td className="py-2">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
