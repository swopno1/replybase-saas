"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Unplug,
  RefreshCw,
  Send,
  ExternalLink,
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
import { ChannelLimitWarning } from "@/components/channels/channel-ui";
import { toast } from "sonner";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import {
  ChannelFlowAssignmentCard,
  ChannelActivityLogCard,
} from "@/components/channels/channel-sections";

interface TelegramStatus {
  connected: boolean;
  channel?: {
    id: string;
    name: string;
    channelId: string;
    updatedAt: string;
    flowAssignments?: {
      flow: { id: string; name: string };
    } | null;
  };
  webhook?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
  local?: {
    webhookConnected: boolean;
    lastInboundMessageAt?: string;
    lastWebhookError?: string;
  };
}

interface FlowOption {
  id: string;
  name: string;
}

interface ChannelLog {
  id: string;
  type: string;
  event: string;
  createdAt: string;
}

export function TelegramConfig({ botId, channelLimitStatus }: { botId: string; channelLimitStatus?: { allowed: boolean; limit: number } | null }) {
  const { confirm } = useConfirmation();

  // State
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [channelName, setChannelName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [targetChannelId, setTargetChannelId] = useState<string | null>(null);

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<ChannelLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  const loadStatus = async (id: string) => {
    setIsStatusLoading(true);
    try {
      const res = await fetch(`/api/bots/${id}/channels/telegram/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setStatus(null);
      }
    } catch (error) {
      console.error("Failed to load status:", error);
    } finally {
      setIsStatusLoading(true);
      setTimeout(() => setIsStatusLoading(false), 500);
    }
  };

  const loadTelegramChannel = async (id: string) => {
    try {
      const res = await fetch(`/api/bots/${id}/channels`);
      if (res.ok) {
        const data = await res.json();
        const telegramChannel = data.channels.find(
          (c: any) => c.type === "telegram",
        );
        if (telegramChannel) {
          setTargetChannelId(telegramChannel.id);
          if (telegramChannel.flowAssignments?.[0]?.flow) {
            // No-op, handled by loadStatus normally
          }
        } else {
          setTargetChannelId(null);
        }
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

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

  const loadLogs = async (channelId: string) => {
    setIsLogsLoading(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/telegram/logs?channelId=${channelId}`);
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
    if (botId) {
      setTimeout(() => {
        void loadStatus(botId);
        void loadTelegramChannel(botId);
        void loadFlows();
      }, 0);
    }
  }, [botId]);

  useEffect(() => {
    if (targetChannelId) {
      void loadLogs(targetChannelId);
    }
  }, [targetChannelId]);

  const handleConnect = async () => {
    if (!botId) return;

    const effectiveLimitStatus = channelLimitStatus || (status as any)?.limitStatus;
    if (effectiveLimitStatus && !effectiveLimitStatus.allowed) {
      toast.error(`Channel limit reached (${effectiveLimitStatus.limit}). Please upgrade.`);
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/telegram/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: botToken.trim(),
          name: channelName.trim() || "Telegram Bot",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect Telegram");
      }

      toast.success("Telegram connected successfully!");
      setBotToken("");
      void loadStatus(botId);
      void loadTelegramChannel(botId);
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
    if (!targetChannelId || !botId) return;

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
      const res = await fetch(`/api/bots/${botId}/channels/telegram/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: targetChannelId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect Telegram");
      }

      toast.success("Telegram disconnected.");
      void loadStatus(botId);
      void loadTelegramChannel(botId);
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
    if (!targetChannelId || !botId) return;
    setIsReconnecting(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/telegram/reconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: targetChannelId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reconnect webhook");
      }

      toast.success("Webhook re-registered successfully!");
      void loadStatus(botId);
    } catch (error) {
      console.error("Reconnect error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reconnect webhook",
      );
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleAssignFlow = async () => {
    if (!targetChannelId || !selectedFlowId) return;

    setIsAssigningFlow(true);
    try {
      const res = await fetch(`/api/channels/${targetChannelId}/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId: selectedFlowId }),
      });

      if (!res.ok) throw new Error("Failed to assign flow");
      toast.success("Flow assigned successfully!");
      void loadTelegramChannel(botId);
    } catch (error) {
      toast.error("Failed to assign flow");
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    if (!targetChannelId) return;

    setIsUnassigningFlow(true);
    try {
      const res = await fetch(`/api/channels/${targetChannelId}/flows`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to unassign flow");
      toast.success("Flow unassigned.");
      void loadTelegramChannel(botId);
    } catch (error) {
      toast.error("Failed to unassign flow");
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const connected = Boolean(status?.connected);

  const assignedFlow = useMemo(() => {
    return status?.channel?.flowAssignments?.flow;
  }, [status]);

  return (
    <div className="space-y-6">
      <ChannelLimitWarning limitStatus={channelLimitStatus || (status as any)?.limitStatus} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-5 w-5" />
            Bot Configuration
          </CardTitle>
          <CardDescription>
            Enter your Telegram Bot Token from @BotFather.
            <a 
              href="https://replybase.co.uk/docs/channels/telegram" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-2 text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
            >
              Guide: How to complete this step <ExternalLink className="h-2 w-2" />
            </a>
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
              disabled={connected}
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
              disabled={connected}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {!connected ? (
              <Button
                onClick={handleConnect}
                disabled={!botToken.trim() || isConnecting || !(channelLimitStatus || (status as any)?.limitStatus)?.allowed}
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Connect Telegram
              </Button>
            ) : (
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
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status</CardTitle>
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

          {targetChannelId && (
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
