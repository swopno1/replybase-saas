"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Unplug,
  Send,
  RefreshCw,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { BotSelector } from "@/components/bot-selector";
import {
  ChannelFlowAssignmentCard,
  ChannelActivityLogCard,
} from "@/components/channels/channel-sections";
import Link from "next/link";

interface Bot {
  id: string;
  name: string;
}

interface TelegramStatus {
  connected: boolean;
  channel?: {
    id: string;
    name: string;
    channelId: string;
    type: string;
    updatedAt: string;
  };
  local?: {
    webhookUrl?: string;
    webhookConnected?: boolean;
    lastInboundMessageAt?: string;
    lastDeliverySuccessAt?: string;
    lastWebhookError?: string;
  };
  webhook?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
}

interface BotChannel {
  id: string;
  type: string;
  name: string;
  flowAssignments?: {
    flow: {
      id: string;
      name: string;
    };
  };
}

interface FlowOption {
  id: string;
  name: string;
}

export default function TelegramIntegrationPage() {
  const { confirm } = useConfirmation();

  // State for bot selection
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [isBotsLoading, setIsBotsLoading] = useState(true);

  // State for integration status
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Connection form state
  const [botToken, setBotToken] = useState("");
  const [channelName, setChannelName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);
  const [botChannels, setBotChannels] = useState<BotChannel[]>([]);

  useEffect(() => {
    void loadBots();
    void loadFlows();
  }, []);

  useEffect(() => {
    if (selectedBotId) {
      void loadStatus(selectedBotId);
      void loadTelegramChannel(selectedBotId);
    } else {
      setStatus(null);
      setLogs([]);
      setBotChannels([]);
    }
  }, [selectedBotId]);

  // Periodic status refresh
  useEffect(() => {
    if (!selectedBotId) return;

    let cancelled = false;

    const run = async () => {
      setIsStatusLoading(true);
      try {
        const res = await fetch(\`/api/bots/\${selectedBotId}/channels/telegram/status?botId=\${selectedBotId}\`);
        const data = await res.json();
        if (cancelled) return;
        setStatus(data);
        if (data.connected && data.channel?.id) {
          const logsRes = await fetch(
            \`/api/bots/\${selectedBotId}/channels/telegram/logs?channelId=\${data.channel.id}&limit=15\`,
          );
          const logsData = await logsRes.json();
          if (!cancelled) setLogs(logsData.logs || []);
        }
      } catch (error) {
        console.error("Failed to load status:", error);
      } finally {
        if (!cancelled) setIsStatusLoading(false);
      }
    };

    const interval = setInterval(() => {
      void run();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedBotId]);

  const loadBots = async () => {
    setIsBotsLoading(true);
    try {
      const res = await fetch("/api/bots");
      const data = await res.json();
      const list: Bot[] = Array.isArray(data.bots)
        ? data.bots
        : [];
      setBots(list);
      if (list.length > 0) {
        setSelectedBotId(list[0].id);
      }
    } catch (error) {
      console.error("Failed to load bots:", error);
    } finally {
      setIsBotsLoading(false);
    }
  };

  const loadStatus = async (botId: string) => {
    setIsStatusLoading(true);
    try {
      const res = await fetch(\`/api/bots/\${botId}/channels/telegram/status?botId=\${botId}\`);
      const data = await res.json();
      setStatus(data);
      if (data.connected && data.channel?.id) {
        void loadLogs(data.channel.id);
      }
    } catch (error) {
      console.error("Failed to load status:", error);
    } finally {
      setIsStatusLoading(false);
    }
  };

  const loadFlows = async () => {
    setIsFlowsLoading(true);
    try {
      const res = await fetch("/api/flows?isActive=true&type=my");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load flows");
      }

      const flowList: FlowOption[] = Array.isArray(data.flows)
        ? data.flows.map((flow: FlowOption) => ({
            id: flow.id,
            name: flow.name,
          }))
        : [];
      setFlows(flowList);
    } catch (error) {
      console.error("Error fetching flows:", error);
    } finally {
      setIsFlowsLoading(false);
    }
  };

  const loadTelegramChannel = async (botId: string) => {
    try {
      const res = await fetch(\`/api/bots/\${botId}/channels\`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load channels");
      }

      const channels: BotChannel[] = Array.isArray(data.channels)
        ? data.channels
        : [];
      setBotChannels(channels.filter((c) => c.type === "telegram"));
    } catch (error) {
      console.error("Error loading channels:", error);
    }
  };

  const telegramChannel = useMemo(() => {
    return botChannels[0] || null;
  }, [botChannels]);

  const assignedFlow = useMemo(() => {
    return telegramChannel?.flowAssignments?.flow || null;
  }, [telegramChannel]);

  const targetChannelId = telegramChannel?.id || status?.channel?.id;

  const handleAssignFlow = async () => {
    if (!targetChannelId || !selectedFlowId) {
      toast.error("Select a flow to assign");
      return;
    }

    setIsAssigningFlow(true);
    try {
      const res = await fetch(\`/api/flows/\${selectedFlowId}/assign\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: targetChannelId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign flow");

      toast.success("Flow assigned to channel");
      if (selectedBotId) {
        void loadTelegramChannel(selectedBotId);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign flow",
      );
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    if (!targetChannelId || !assignedFlow) {
      toast.error("No assigned flow found");
      return;
    }

    setIsUnassigningFlow(true);
    try {
      const res = await fetch(
        \`/api/flows/\${assignedFlow.id}/assign?channelId=\${encodeURIComponent(targetChannelId)}\`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to unassign flow");

      toast.success("Flow unassigned from channel");
      if (selectedBotId) {
        void loadTelegramChannel(selectedBotId);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign flow",
      );
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const loadLogs = async (channelId: string) => {
    if (!selectedBotId) return;
    setIsLogsLoading(true);
    try {
      const res = await fetch(
        \`/api/bots/\${selectedBotId}/channels/telegram/logs?channelId=\${channelId}&limit=15\`,
      );
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      console.error("Failed to load logs");
    } finally {
      setIsLogsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedBotId || !botToken.trim()) {
      toast.error("Token and Bot selection are required");
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch(\`/api/bots/\${selectedBotId}/channels/telegram/connect\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botToken.trim(),
          channelName: channelName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect Telegram");
      }

      toast.success("Telegram connected successfully!");
      setBotToken("");
      void loadStatus(selectedBotId);
      void loadTelegramChannel(selectedBotId);
    } catch (error) {
      console.error("Connect error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to connect Telegram",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!status?.channel?.id || !selectedBotId) return;

    const confirmed = await confirm({
      title: "Disconnect Telegram",
      description:
        "Are you sure you want to disconnect this Telegram bot? It will stop responding to messages.",
      confirmText: "Disconnect",
      variant: "destructive",
    });
    if (!confirmed) return;

    setIsDisconnecting(true);
    try {
      const res = await fetch(\`/api/bots/\${selectedBotId}/channels/telegram/disconnect\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: status.channel.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect Telegram");
      }

      toast.success("Telegram disconnected.");
      void loadStatus(selectedBotId);
      void loadTelegramChannel(selectedBotId);
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to disconnect Telegram",
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    if (!status?.channel?.id || !selectedBotId) return;
    setIsReconnecting(true);
    try {
      const res = await fetch(\`/api/bots/\${selectedBotId}/channels/telegram/reconnect\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: status.channel.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reconnect webhook");
      }

      toast.success("Webhook re-registered successfully!");
      void loadStatus(selectedBotId);
    } catch (error) {
      console.error("Reconnect error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reconnect webhook",
      );
    } finally {
      setIsReconnecting(false);
    }
  };

  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Telegram Integration</h1>
        <p className="text-muted-foreground">
          Connect your Telegram bot to automate conversations.
        </p>
      </div>

      <BotSelector
        bots={bots}
        selectedBotId={selectedBotId}
        onSelectBot={setSelectedBotId}
      />

      {selectedBotId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Bot Configuration
              </CardTitle>
              <CardDescription>
                Enter your Telegram Bot Token from @BotFather.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="botToken">Bot Token</Label>
                <Input
                  id="botToken"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCDEF..."
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">
                  Your token is encrypted before being stored.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="channelName">Display Name (optional)</Label>
                <Input
                  id="channelName"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="My Support Bot"
                  className="max-w-md"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleConnect}
                  disabled={!botToken.trim() || isConnecting}
                >
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {connected ? "Update Connection" : "Connect Telegram"}
                </Button>

                {connected && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleReconnect}
                      disabled={isReconnecting}
                    >
                      {isReconnecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Refresh Webhook
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Unplug className="mr-2 h-4 w-4" />
                      )}
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {connected && (
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>
                  Live connection status and webhook diagnostics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {isStatusLoading && !status ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading status...
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Connected</Badge>
                      <span className="font-medium">
                        {status?.channel?.name}
                      </span>
                    </div>

                    <div className="grid gap-2 text-muted-foreground">
                      <p>
                        Webhook:{" "}
                        <span className="text-foreground">
                          {status?.local?.webhookConnected
                            ? "Connected"
                            : "Disconnected"}
                        </span>
                      </p>
                      <p>
                        Last inbound:{" "}
                        <span className="text-foreground">
                          {status?.local?.lastInboundMessageAt || "Never"}
                        </span>
                      </p>
                      {status?.webhook?.pending_update_count !== undefined && (
                        <p>
                          Pending updates:{" "}
                          <span className="text-foreground">
                            {status.webhook.pending_update_count}
                          </span>
                        </p>
                      )}
                    </div>

                    {status?.local?.lastWebhookError && (
                      <div className="rounded-md bg-destructive/10 p-3 text-destructive flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">Last Webhook Error</p>
                          <p className="text-xs">
                            {status.local.lastWebhookError}
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <ChannelFlowAssignmentCard
            title="Telegram Flow Assignment"
            description="Assign an active flow to this Telegram bot. Channel assignment takes priority over bot entry flow."
            selectLabel="Assigned Flow"
            selectId="telegramFlowSelect"
            flows={flows}
            isFlowsLoading={isFlowsLoading}
            selectedFlowId={selectedFlowId}
            onSelectFlow={setSelectedFlowId}
            assignedFlowName={assignedFlow?.name}
            unassignedDescription="No channel flow is assigned. Bot entry flow and AI fallback are used."
            onAssign={handleAssignFlow}
            onUnassign={handleUnassignFlow}
            isAssigning={isAssigningFlow}
            isUnassigning={isUnassigningFlow}
            assignDisabled={
              !selectedFlowId ||
              isAssigningFlow ||
              !connected ||
              assignedFlow?.id === selectedFlowId
            }
            unassignDisabled={!assignedFlow || !connected || isUnassigningFlow}
          />

          {connected && targetChannelId && (
            <ChannelActivityLogCard
              logs={logs}
              isLoading={isLogsLoading}
              onRefresh={() => void loadLogs(targetChannelId)}
              emptyText="No activity recorded yet."
            />
          )}
        </>
      )}
    </div>
  );
}
