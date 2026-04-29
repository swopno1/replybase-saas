"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAdminWebchatMonitoringSnapshot, fetchLiveWebchatSessions, fetchWebchatAnalytics } from "@/app/(admin)/admin/webchat-monitoring/actions";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { SessionInspector } from "./SessionInspector";
import { ActionableInsights } from "./ActionableInsights";
import { Activity, Clock, Globe, Laptop, RefreshCw, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MonitoringDashboard({
  initialSnapshot,
  initialLiveSessions,
  initialAnalytics
}: {
  initialSnapshot: any;
  initialLiveSessions: any[];
  initialAnalytics: any[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [liveSessions, setLiveSessions] = useState(initialLiveSessions);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const fetchLive = async () => {
    setIsRefreshing(true);
    try {
      const [newSnap, newLive, newAnalytics] = await Promise.all([
        fetchAdminWebchatMonitoringSnapshot(),
        fetchLiveWebchatSessions(),
        fetchWebchatAnalytics()
      ]);
      setSnapshot(newSnap);
      setLiveSessions(newLive);
      setAnalytics(newAnalytics);
    } catch (e) {
      console.error(e);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    const interval = setInterval(fetchLive, 10000); // 10s poll
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Real-Time Webchat Monitoring</h2>
          <p className="text-muted-foreground">Monitor live webchat traffic, errors, and rollout health.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLive} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="live" className="space-y-4">
        <TabsList>
          <TabsTrigger value="live">Live Feed & Analytics</TabsTrigger>
          <TabsTrigger value="health">Rollout Health</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="space-y-6">
          <AnalyticsCharts data={analytics} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                Live Sessions
              </CardTitle>
              <CardDescription>Recent webchat sessions active in the last hour</CardDescription>
            </CardHeader>
            <CardContent>
              {liveSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No active sessions recently.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Visitor</th>
                        <th className="px-4 py-3">Site / Tenant</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Environment</th>
                        <th className="px-4 py-3">Last Seen</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {liveSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {session.visitorId.substring(0, 8)}...
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{session.siteName}</div>
                            <div className="text-xs text-muted-foreground">{session.tenantName}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={session.status === 'OPEN' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                            {session.botPaused && (
                              <Badge variant="destructive" className="ml-1">Bot Paused</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="flex items-center gap-1"><Globe className="h-3 w-3"/> {session.location}</div>
                            <div className="flex items-center gap-1"><Laptop className="h-3 w-3"/> {session.device}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3"/> {new Date(session.lastSeenAt).toLocaleTimeString()}
                            </div>
                            <div className="text-xs truncate max-w-[200px]">
                              {session.lastMessage || "No messages yet"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSessionId(session.id)}>
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Active Sites</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{snapshot.totals.activeSites}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {snapshot.totals.sitesWithTraffic} with traffic (24h)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Error Events</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{snapshot.totals.errorEvents24h}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {snapshot.totals.widgetEvents24h} total events (24h)
                  </p>
                </CardContent>
              </Card>
               <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Blocked Origins</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{snapshot.reasonCounts.blockedOrigin}</div>
                </CardContent>
              </Card>
               <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Rate Limits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{snapshot.reasonCounts.rateLimit}</div>
                </CardContent>
              </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-3">
                {snapshot.recentErrors.map((incident: any) => (
                  <div key={incident.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                            {incident.reason}
                          </Badge>
                          {incident.stage ? <Badge variant="secondary">{incident.stage}</Badge> : null}
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {incident.tenantName} / {incident.botName} / {incident.siteName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {incident.message || "No extra context stored for this event."}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {snapshot.recentErrors.length === 0 && (
                  <div className="text-center text-muted-foreground">No recent incidents.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
           <ActionableInsights snapshot={snapshot} analytics={analytics} />
        </TabsContent>
      </Tabs>

      {selectedSessionId && (
        <SessionInspector
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}
