"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  Globe,
  Settings,
  Code,
  Copy,
  ChevronDown,
  CheckCircle2,
  Zap,
} from "lucide-react";
import {
  ChannelFlowAssignmentCard,
  ChannelActivityLogCard,
} from "@/components/channels/channel-sections";
import { ChannelLimitWarning } from "@/components/channels/channel-ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface WebchatSite {
  id: string;
  name: string | null;
  publicKey: string;
  secretKey: string;
  allowedDomains: string[];
  themeConfig: Record<string, any>;
  channelId: string | null;
  isActive: boolean;
}

interface WebchatDiagnostics {
  lastPingAt: string | null;
  blockedOriginCount: number;
  rateLimitCount: number;
  recentErrors: Array<{
    id: string;
    reason: string;
    message: string | null;
    stage: string | null;
    createdAt: string;
  }>;
}

interface FlowOption {
  id: string;
  name: string;
}

interface WebchatConfigProps {
  botId: string;
  channelId?: string;
  channelLimitStatus?: any;
}

export function WebchatConfig({ botId, channelId: initialChannelId, channelLimitStatus: initialLimitStatus }: WebchatConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [site, setSite] = useState<WebchatSite | null>(null);
  const [diagnostics, setDiagnostics] = useState<WebchatDiagnostics | null>(
    null,
  );
  const [channelLimitStatus, setChannelLimitStatus] = useState<any>(initialLimitStatus || null);

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  const channelId = site?.channelId || initialChannelId;

  const loadFlows = async () => {
    setIsFlowsLoading(true);
    try {
      const res = await fetch("/api/flows?type=my");
      if (res.ok) {
        const data = await res.json();
        setFlows(data.flows || []);
      }
    } catch (error) {
      console.error("Failed to load flows:", error);
    } finally {
      setIsFlowsLoading(false);
    }
  };

  const loadLogs = async (cId: string) => {
    setIsLogsLoading(true);
    try {
      const res = await fetch(`/api/bots/${botId}/webchat-site/logs?channelId=${cId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const [siteRes, diagRes] = await Promise.all([
          fetch(`/api/bots/${botId}/webchat-site`),
          fetch(`/api/bots/${botId}/webchat-site/diagnostics`),
        ]);

        if (siteRes.ok) {
          const data = await siteRes.json();
          setSite(data.site);
          if (!initialLimitStatus) setChannelLimitStatus(data.limitStatus);

          if (data.site?.channelId) {
             void loadLogs(data.site.channelId);
          }
        }
        if (diagRes.ok) {
          const data = await diagRes.json();
          setDiagnostics(data.diagnostics);
        }

        void loadFlows();
      } catch (error) {
        console.error("Failed to fetch webchat config:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [botId, initialLimitStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/bots/${botId}/webchat-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedDomains: site.allowedDomains,
        }),
      });

      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch (error) {
      toast.error("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignFlow = async () => {
    if (!channelId || !selectedFlowId) return;
    setIsAssigningFlow(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/${channelId}/assign-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId: selectedFlowId }),
      });
      if (res.ok) {
        toast.success("Flow assigned");
        // Reload site to get updated assignment
        const siteRes = await fetch(`/api/bots/${botId}/webchat-site`);
        if (siteRes.ok) {
           const data = await siteRes.json();
           setSite(data.site);
        }
      } else {
        toast.error("Failed to assign flow");
      }
    } catch (error) {
      toast.error("Error assigning flow");
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    if (!channelId) return;
    setIsUnassigningFlow(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/${channelId}/unassign-flow`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Flow unassigned");
        setSelectedFlowId("");
        const siteRes = await fetch(`/api/bots/${botId}/webchat-site`);
        if (siteRes.ok) {
           const data = await siteRes.json();
           setSite(data.site);
        }
      } else {
        toast.error("Failed to unassign flow");
      }
    } catch (error) {
      toast.error("Error unassigning flow");
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!site) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Not Configured</CardTitle>
          <CardDescription>
            This bot does not have a webchat channel configured.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const embedCode = `<script
  src="${process.env.NEXT_PUBLIC_APP_URL}/embed/replybase-webchat.js"
  data-public-key="${site.publicKey}"
  async
></script>`;

  // Find currently assigned flow
  const assignedFlow = (site as any).flowAssignments?.[0]?.flow;

  return (
    <div className="space-y-6">
      <ChannelLimitWarning limitStatus={channelLimitStatus} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Embed Code
            </CardTitle>
            <CardDescription>
              Add this script to your website to enable the chat widget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                <code>{embedCode}</code>
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-2 top-2"
                onClick={() => copyToClipboard(embedCode)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Restrict which domains can host your chat widget.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domains">Allowed Domains (comma separated)</Label>
                <Input
                  id="domains"
                  placeholder="example.com, my-store.myshopify.com"
                  value={site.allowedDomains.join(", ")}
                  onChange={(e) =>
                    setSite({
                      ...site,
                      allowedDomains: e.target.value
                        .split(",")
                        .map((d) => d.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <p className="text-[0.7rem] text-muted-foreground">
                  Leave empty to allow all domains (not recommended for production).
                </p>
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>

        {diagnostics && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Diagnostics
              </CardTitle>
              <CardDescription>
                Overview of the last 30 days of widget activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Last Activity
                  </div>
                  <div className="text-2xl font-bold">
                    {diagnostics.lastPingAt
                      ? new Date(diagnostics.lastPingAt).toLocaleDateString()
                      : "No activity"}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Blocked Requests (CORS)
                  </div>
                  <div className="text-2xl font-bold text-destructive">
                    {diagnostics.blockedOriginCount}
                  </div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Rate Limited
                  </div>
                  <div className="text-2xl font-bold text-orange-500">
                    {diagnostics.rateLimitCount}
                  </div>
                </div>
              </div>

              {diagnostics.recentErrors.length > 0 && (
                <div className="mt-6">
                  <h4 className="mb-3 text-sm font-semibold">Recent Errors</h4>
                  <div className="space-y-2">
                    {diagnostics.recentErrors.map((err) => (
                      <div
                        key={err.id}
                        className="flex items-start justify-between rounded-md bg-destructive/10 p-3 text-xs"
                      >
                        <div>
                          <span className="font-bold uppercase text-destructive">
                            {err.reason}
                          </span>
                          <p className="mt-1 text-muted-foreground">
                            {err.message || "No detail provided"}
                          </p>
                        </div>
                        <span className="text-muted-foreground">
                          {new Date(err.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {channelId && (
        <>
          <ChannelFlowAssignmentCard
            title="Webchat Flow Assignment"
            description="Assign a flow to your web widget. This will run when a user starts a chat."
            selectLabel="Select Flow"
            selectId="webchatFlowSelect"
            flows={flows}
            isFlowsLoading={isFlowsLoading}
            selectedFlowId={selectedFlowId}
            onSelectFlow={setSelectedFlowId}
            assignedFlowName={assignedFlow?.name}
            unassignedDescription="No flow assigned. AI fallback will be used immediately."
            onAssign={handleAssignFlow}
            onUnassign={handleUnassignFlow}
            isAssigning={isAssigningFlow}
            isUnassigning={isUnassigningFlow}
            assignDisabled={!selectedFlowId || isAssigningFlow || assignedFlow?.id === selectedFlowId}
            unassignDisabled={!assignedFlow || isUnassigningFlow}
          />
          <ChannelActivityLogCard
            logs={logs}
            isLoading={isLogsLoading}
            onRefresh={() => loadLogs(channelId)}
            emptyText="No activity recorded yet."
          />
        </>
      )}
    </div>
  );
}
