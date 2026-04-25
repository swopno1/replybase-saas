"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

interface WebhookLog {
  id: string;
  type: string;
  source: string;
  event: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export default function WebhookLogsPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/admin/webhook-logs");
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Failed to fetch webhook logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 3000); // Refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const clearLogs = async () => {
    try {
      const response = await fetch("/api/admin/webhook-logs", {
        method: "DELETE",
      });
      if (response.ok) {
        setLogs([]);
      }
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Logs</h1>
          <p className="text-gray-600">
            Real-time webhook event monitoring for connected channels and lead
            capture endpoints
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button onClick={fetchLogs} variant="outline">
            Refresh
          </Button>
          <Button onClick={clearLogs} variant="destructive">
            Clear Logs
          </Button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              No webhook events logged yet. Trigger a webchat, Telegram, or
              public lead submission event to test logging.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">
                      {log.event || log.type}
                    </CardTitle>
                    <Badge variant="secondary">{log.source}</Badge>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <CardDescription>Type: {log.type}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-sm text-gray-500 text-center">
        Showing {logs.length} webhook events (last 50)
      </div>
    </div>
  );
}
