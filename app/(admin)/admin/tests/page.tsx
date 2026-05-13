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
import { Download, Play, Activity } from "lucide-react";

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
        body: JSON.stringify({ type: "smoke", name: "System Health Check" }),
      }),
      {
        loading: "Running health checks...",
        success: () => {
          fetchResults();
          return "Health checks passed";
        },
        error: "Health check failed",
      }
    );
  };

  const triggerLoadTest = async () => {
    toast.promise(
      fetch("/api/admin/tests", {
        method: "POST",
        body: JSON.stringify({ type: "load" }),
      }),
      {
        loading: "Triggering load test...",
        success: "Load test started in background",
        error: (err) => `Failed to trigger: ${err.message}`,
      }
    );
  };

  const runAiDiagnostic = async () => {
    toast.promise(
      fetch("/api/admin/tests", {
        method: "POST",
        body: JSON.stringify({ 
          type: "ai", 
          provider: "digitalocean", 
          task: "chat",
          name: "AI Connectivity Diagnostic" 
        }),
      }),
      {
        loading: "Testing AI connectivity (DigitalOcean)...",
        success: (res) => {
          fetchResults();
          return "AI connectivity verified";
        },
        error: "AI diagnostic failed",
      }
    );
  };

  const exportCSV = () => {
    window.open("/api/admin/tests?format=csv", "_blank");
  };

  const loadTestData = results
    .filter((r) => r.type === "load" && r.metrics)
    .map((r) => ({
      name: new Date(r.createdAt).toLocaleTimeString(),
      p50: r.metrics.p50,
      p95: r.metrics.p95,
      throughput: r.metrics.throughput,
      errorRate: r.metrics.errorRate * 100,
    }))
    .reverse();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Testing & Performance</h1>
          <p className="text-muted-foreground">Monitor system health, AI connectivity, and load test metrics.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runAiDiagnostic} variant="outline" className="flex gap-2">
            <Activity className="h-4 w-4" /> AI Diagnostic
          </Button>
          <Button onClick={runSmokeTest} className="flex gap-2">
            <Activity className="h-4 w-4" /> Run Health Checks
          </Button>
          <Button onClick={triggerLoadTest} variant="secondary" className="flex gap-2">
            <Play className="h-4 w-4" /> Trigger Load Test
          </Button>
          <Button onClick={exportCSV} variant="outline" className="flex gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Latency Trends (ms)</CardTitle>
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
                  strokeWidth={2}
                  name="p95"
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#3b82f6"
                  name="p50"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Throughput & Error Rate</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={loadTestData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#10b981" />
                <YAxis yAxisId="right" orientation="right" unit="%" stroke="#f59e0b" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="throughput"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Req/s"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errorRate"
                  stroke="#f59e0b"
                  name="Error %"
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
                    <td className="py-2 capitalize font-medium">{r.type}</td>
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
                    <td className="py-2 text-muted-foreground text-sm">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No test history found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
