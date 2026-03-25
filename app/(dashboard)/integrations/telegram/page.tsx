"use client";

import { useEffect, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  RefreshCw,
  Trash2,
  AlertCircle,
  PlugZap,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export const dynamic = 'force-dynamic';

interface Bot {
  id: string;
  name: string;
}

interface FlowOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface ChannelFlowAssignment {
  id: string;
  flowId: string;
  flow?: {
    id: string;
    name: string;
    isActive: boolean;
  };
}

interface BotChannel {
  id: string;
  name: string;
  type: string;
  flowAssignments?: ChannelFlowAssignment[];
}

interface TelegramStatus {
  connected: boolean;
  channel?: {
    id: string;
    name: string;
    channelId: string;
    updatedAt: string;
  };
  bot?: {
    id: string;
    name: string;
  };
  local?: {
    webhookConnected: boolean;
    webhookUrl?: string | null;
    lastWebhookSetAt?: string | null;
    lastWebhookEventAt?: string | null;
    lastInboundMessageAt?: string | null;
    lastDeliverySuccessAt?: string | null;
    lastDeliveryError?: string | null;
    lastDeliveryErrorAt?: string | null;
    lastWebhookError?: string | null;
    lastWebhookErrorAt?: string | null;
    lastProcessedUpdateId?: number | null;
  };
  webhook?: {
    url: string;
    pending_update_count: number;
    last_error_message?: string;
    last_error_date?: number;
  };
  webhookError?: string;
}

interface WebhookLogEntry {
  id: string;
  type: string;
  event: string;
  createdAt: string;
}

export default function TelegramIntegrationPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [channelName, setChannelName] = useState("");
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [isBotsLoading, setIsBotsLoading] = useState(true);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [telegramChannel, setTelegramChannel] = useState<BotChannel | null>(
    null,
  );
  const [assignedFlow, setAssignedFlow] = useState<FlowOption | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  useEffect(() => {
    loadBots();
  }, []);

  useEffect(() => {
    if (!selectedBotId) {
      setStatus(null);
      setLogs([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsStatusLoading(true);
      try {
        const res = await fetch(`/api/telegram/status?botId=${selectedBotId}`);
        const data = await res.json();
        if (cancelled) return;
        setStatus(data);
        if (data.connected && data.channel?.id) {
          const logsRes = await fetch(
            `/api/telegram/logs?channelId=${data.channel.id}&limit=15`,
          );
          const logsData = await logsRes.json();
          if (!cancelled) setLogs(logsData.logs || []);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load Telegram status");
      } finally {
        if (!cancelled) setIsStatusLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedBotId]);

  useEffect(() => {
    if (!selectedBotId) {
      setFlows([]);
      setTelegramChannel(null);
      setAssignedFlow(null);
      setSelectedFlowId("");
      return;
    }

    void loadFlows();
    void loadTelegramChannel(selectedBotId);
  }, [selectedBotId]);

  const loadBots = async () => {
    setIsBotsLoading(true);
    try {
      const res = await fetch("/api/bots");
      const data = await res.json();
      const list: Bot[] = Array.isArray(data.bots)
        ? data.bots
        : Array.isArray(data.projects)
          ? data.projects.flatMap((project: { bots?: Bot[] }) =>
              Array.isArray(project?.bots) ? project.bots : [],
            )
          : [];
      setBots(list);
      if (list.length === 1) {
        setSelectedBotId(list[0].id);
      }
    } catch {
      toast.error("Failed to load bots");
    } finally {
      setIsBotsLoading(false);
    }
  };

  const loadStatus = async (botId: string) => {
    setIsStatusLoading(true);
    try {
      const res = await fetch(`/api/telegram/status?botId=${botId}`);
      const data = await res.json();
      setStatus(data);
      if (data.connected && data.channel?.id) {
        loadLogs(data.channel.id);
      }
    } catch {
      toast.error("Failed to load Telegram status");
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
            isActive: flow.isActive,
          }))
        : [];

      setFlows(flowList);
    } catch {
      toast.error("Failed to load active flows");
    } finally {
      setIsFlowsLoading(false);
    }
  };

  const loadTelegramChannel = async (botId: string) => {
    try {
      const res = await fetch(`/api/bots/${botId}/channels`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load channels");
      }

      const channels: BotChannel[] = Array.isArray(data.channels)
        ? data.channels
        : [];
      const channel =
        channels.find((item) => item.type?.toLowerCase() === "telegram") ||
        null;

      const activeAssignment = channel?.flowAssignments?.[0];

      setTelegramChannel(channel);
      setAssignedFlow(
        activeAssignment?.flow
          ? {
              id: activeAssignment.flow.id,
              name: activeAssignment.flow.name,
              isActive: activeAssignment.flow.isActive,
            }
          : null,
      );
      setSelectedFlowId(activeAssignment?.flowId || "");
    } catch {
      setTelegramChannel(null);
      setAssignedFlow(null);
      setSelectedFlowId("");
    }
  };

  const handleAssignFlow = async () => {
    const targetChannelId = status?.channel?.id || telegramChannel?.id;
    if (!targetChannelId) {
      toast.error("Connect Telegram first to assign a flow");
      return;
    }

    if (!selectedFlowId) {
      toast.error("Select a flow to assign");
      return;
    }

    setIsAssigningFlow(true);
    try {
      const res = await fetch(`/api/flows/${selectedFlowId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: targetChannelId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to assign flow");
      }

      toast.success("Flow assigned to Telegram channel");
      await loadTelegramChannel(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign flow",
      );
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    const targetChannelId = status?.channel?.id || telegramChannel?.id;
    if (!targetChannelId || !assignedFlow?.id) {
      toast.error("No assigned flow found");
      return;
    }

    setIsUnassigningFlow(true);
    try {
      const res = await fetch(
        `/api/flows/${assignedFlow.id}/assign?channelId=${encodeURIComponent(targetChannelId)}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to unassign flow");
      }

      toast.success("Flow unassigned from Telegram channel");
      await loadTelegramChannel(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign flow",
      );
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const loadLogs = async (channelId: string) => {
    setIsLogsLoading(true);
    try {
      const res = await fetch(
        `/api/telegram/logs?channelId=${channelId}&limit=15`,
      );
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      // Non-critical — silently fail
    } finally {
      setIsLogsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedBotId || !botToken.trim()) {
      toast.error("Please select a bot and enter a bot token");
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: selectedBotId,
          botToken: botToken.trim(),
          channelName: channelName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const validationDetail = Array.isArray(data.details)
          ? data.details[0]?.message
          : null;
        throw new Error(
          validationDetail || data.error || "Failed to connect Telegram bot",
        );
      }

      toast.success(`Connected @${data.bot?.username || "bot"} successfully`);
      setBotToken("");
      setChannelName("");
      await loadStatus(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to connect Telegram",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!status?.channel?.id) return;
    if (
      !confirm(
        "Are you sure you want to disconnect this Telegram bot? The webhook will be removed.",
      )
    )
      return;

    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/telegram/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: status.channel.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to disconnect");
      }

      toast.success("Telegram bot disconnected");
      setLogs([]);
      await loadStatus(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disconnect",
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReconnect = async () => {
    if (!status?.channel?.id) return;
    setIsReconnecting(true);
    try {
      const res = await fetch("/api/telegram/reconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: status.channel.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reconnect webhook");
      }

      toast.success("Webhook reconnected successfully");
      await loadStatus(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reconnect webhook",
      );
    } finally {
      setIsReconnecting(false);
    }
  };

  const isConnected = status?.connected === true;
  const hasWebhookError = Boolean(
    status?.webhook?.last_error_message ||
    status?.webhookError ||
    status?.local?.lastWebhookError ||
    status?.local?.lastDeliveryError,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Telegram Bot</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Telegram bot to enable AI auto-replies
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Effective Response Mode</CardTitle>
          <CardDescription>
            How ReplyBase responds to Telegram messages for the selected bot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            1. Telegram commands such as /start, /help, and /settings use
            built-in replies.
          </p>
          <p>
            2. For other messages, an active channel-assigned flow runs first.
          </p>
          <p>
            3. If no channel flow is assigned, the bot entry flow is used when
            configured.
          </p>
          <p>4. If no flow handles the message, AI generates the reply.</p>
          <p>
            5. If AI is unavailable, users receive a safe fallback message and
            the error is logged in Webhook Activity.
          </p>
        </CardContent>
      </Card>

      {/* Bot Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Select Bot
          </CardTitle>
          <CardDescription>
            Choose which ReplyBase bot will handle Telegram replies. If you do
            not have one yet, create it in Bots first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isBotsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading bots...
            </div>
          ) : bots.length === 0 ? (
            <div className="flex flex-col gap-3 items-start">
              <p className="text-sm text-muted-foreground">
                No bots found. Create a bot first.
              </p>
              <Link href="/bots/new">
                <Button variant="outline" size="sm">
                  Create Bot
                </Button>
              </Link>
            </div>
          ) : (
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a bot..." />
              </SelectTrigger>
              <SelectContent>
                {bots.map((bot) => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Status / Connect area */}
      {selectedBotId && (
        <>
          {isStatusLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : isConnected ? (
            /* Connected State */
            <div className="space-y-4">
              <Card className="border-green-500/40 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Telegram Bot Connected
                  </CardTitle>
                  <CardDescription>
                    Your bot is active and receiving messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        Channel
                      </div>
                      <div className="text-sm font-medium">
                        {status.channel?.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        Telegram Bot ID
                      </div>
                      <div className="text-sm font-mono">
                        {status.channel?.channelId}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        ReplyBase Bot
                      </div>
                      <div className="text-sm">{status.bot?.name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        Webhook
                      </div>
                      <Badge
                        variant={hasWebhookError ? "destructive" : "secondary"}
                        className={
                          hasWebhookError
                            ? ""
                            : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        }
                      >
                        {hasWebhookError ? (
                          <>
                            <XCircle className="mr-1 h-3 w-3" />
                            Error
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Active
                          </>
                        )}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        Last Updated
                      </div>
                      <div className="text-sm">
                        {new Date(
                          status.channel?.updatedAt ?? "",
                        ).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        Last Webhook Event
                      </div>
                      <div className="text-sm">
                        {status.local?.lastWebhookEventAt
                          ? new Date(
                              status.local.lastWebhookEventAt,
                            ).toLocaleString()
                          : "No events yet"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                        Last Delivery Success
                      </div>
                      <div className="text-sm">
                        {status.local?.lastDeliverySuccessAt
                          ? new Date(
                              status.local.lastDeliverySuccessAt,
                            ).toLocaleString()
                          : "No successful delivery yet"}
                      </div>
                    </div>
                  </div>

                  {/* Webhook details */}
                  {status.webhook && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          Webhook URL
                        </div>
                        <div className="text-xs font-mono bg-muted rounded px-3 py-2 break-all">
                          {status.webhook.url}
                        </div>
                        {status.webhook.pending_update_count > 0 && (
                          <div className="flex items-center gap-2 text-xs text-amber-600">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {status.webhook.pending_update_count} pending
                            update(s) in queue. This is usually temporary; if it
                            remains stuck, use Reconnect Webhook.
                          </div>
                        )}
                        {status.webhook.last_error_message && (
                          <div className="flex items-start gap-2 text-xs text-destructive">
                            <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            Last error: {status.webhook.last_error_message}
                          </div>
                        )}
                        {status.local?.lastProcessedUpdateId !== null &&
                          status.local?.lastProcessedUpdateId !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              Last processed update ID:{" "}
                              {status.local.lastProcessedUpdateId}
                            </div>
                          )}
                      </div>
                    </>
                  )}

                  {status.webhookError && !status.webhook && (
                    <div className="flex items-start gap-2 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Webhook check failed: {status.webhookError}
                    </div>
                  )}

                  {status.local?.lastWebhookError && (
                    <div className="flex items-start gap-2 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Last webhook setup error: {status.local.lastWebhookError}
                    </div>
                  )}

                  {status.local?.lastDeliveryError && (
                    <div className="flex items-start gap-2 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Last delivery error: {status.local.lastDeliveryError}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Last Webhook Event shows when Telegram last sent an update
                    to ReplyBase. Last Delivery Success shows when ReplyBase
                    last sent a reply back to Telegram.
                  </p>

                  <Separator />

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadStatus(selectedBotId)}
                      disabled={isStatusLoading}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Refresh Status
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      title="Re-register webhook if delivery is failing, the token rotated, or pending updates remain stuck"
                      onClick={handleReconnect}
                      disabled={isReconnecting}
                    >
                      {isReconnecting ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PlugZap className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Reconnect Webhook
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                    >
                      {isDisconnecting ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Disconnect Bot
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reconnect with a different token */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Update Bot Token</CardTitle>
                  <CardDescription>
                    Re-connect with a new or rotated bot token
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="newBotToken">New Bot Token</Label>
                    <Input
                      id="newBotToken"
                      type="password"
                      aria-label="Telegram bot token from BotFather"
                      placeholder="123456789:ABCDEFghIjkLMNO-pQRSTUVWxYZ123456"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      className="font-mono max-w-lg"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the full token from BotFather. Keep this secret.
                    </p>
                  </div>
                  <Button
                    onClick={handleConnect}
                    disabled={isConnecting || !botToken.trim()}
                    size="sm"
                  >
                    {isConnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Update Token
                  </Button>
                </CardContent>
              </Card>

              {/* How to test */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Telegram Flow Assignment
                  </CardTitle>
                  <CardDescription>
                    Assign an active flow to this Telegram channel. Channel
                    assignment takes priority over bot entry flow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 max-w-lg">
                    <Label htmlFor="telegramFlowSelect">Assigned Flow</Label>
                    {isFlowsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading flows...
                      </div>
                    ) : flows.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No active flows available. Activate a flow in Flow
                        Builder first.
                      </div>
                    ) : (
                      <Select
                        value={selectedFlowId || "none"}
                        onValueChange={(value) =>
                          setSelectedFlowId(value === "none" ? "" : value)
                        }
                      >
                        <SelectTrigger id="telegramFlowSelect">
                          <SelectValue placeholder="Select a flow" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No flow selected</SelectItem>
                          {flows.map((flow) => (
                            <SelectItem key={flow.id} value={flow.id}>
                              {flow.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {assignedFlow ? (
                      <span>
                        Currently assigned: <strong>{assignedFlow.name}</strong>
                      </span>
                    ) : (
                      <span>
                        No channel flow is assigned. Bot entry flow and AI
                        fallback are used.
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={handleAssignFlow}
                      disabled={
                        !selectedFlowId ||
                        isAssigningFlow ||
                        !status?.connected ||
                        assignedFlow?.id === selectedFlowId
                      }
                    >
                      {isAssigningFlow ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Assign Flow
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUnassignFlow}
                      disabled={
                        !assignedFlow || !status?.connected || isUnassigningFlow
                      }
                    >
                      {isUnassigningFlow ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Unassign Flow
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">How to Test</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                  <p>1. Open Telegram and search for your bot by username.</p>
                  <p>
                    2. Tap <strong className="text-foreground">Start</strong> or
                    send <code className="bg-muted px-1 rounded">/start</code>.
                  </p>
                  <p>
                    3. Send any message. ReplyBase should respond in a few
                    seconds.
                  </p>
                  <p>
                    4. Open Conversations to confirm inbound and outbound
                    messages were saved.
                  </p>
                  <p>
                    5. Open Contacts to confirm the Telegram profile was
                    created.
                  </p>
                  <p>
                    6. If your flow captures lead fields, check Leads for the
                    new record.
                  </p>
                  <p>
                    Current mode is command replies plus flow-first runtime
                    (channel assignment, then entry flow), with AI fallback.
                  </p>
                  <p>
                    If no reply appears, check Recent Webhook Activity below and
                    use Reconnect Webhook.
                  </p>
                </CardContent>
              </Card>

              {/* Recent webhook activity logs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Recent Webhook Activity
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Last 15 events logged for this channel
                      </CardDescription>
                    </div>
                    {status.channel?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadLogs(status.channel!.id)}
                        disabled={isLogsLoading}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isLogsLoading ? "animate-spin" : ""}`}
                        />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLogsLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading logs...
                    </div>
                  ) : logs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No events recorded yet. Send your bot a message to see
                      activity here.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between text-xs py-1.5 border-b last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                log.type === "delivery_error"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-[10px] px-1.5 py-0"
                            >
                              {log.type}
                            </Badge>
                            <span className="font-mono text-muted-foreground truncate max-w-xs">
                              {log.event}
                            </span>
                          </div>
                          <span className="text-muted-foreground shrink-0 ml-4">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Not Connected State */
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Connect Your Telegram Bot
                </CardTitle>
                <CardDescription>
                  Create a bot with @BotFather, then paste its token below to
                  connect one Telegram bot per ReplyBase bot.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="botToken">Bot Token</Label>
                    <Input
                      id="botToken"
                      type="password"
                      aria-label="Telegram bot token from BotFather"
                      placeholder="123456789:ABCDEFghIjkLMNO-pQRSTUVWxYZ123456"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Token format is usually number:secret (for example,
                      123456789:ABC...). Get this from{" "}
                      <a
                        href="https://t.me/botfather"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        @BotFather
                      </a>{" "}
                      after creating a new bot. Never share this token.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="channelName">
                      Channel Name{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="channelName"
                      placeholder="My Telegram Bot"
                      value={channelName}
                      onChange={(e) => setChannelName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional dashboard label. If left blank, ReplyBase uses
                      your Telegram bot username from the API.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleConnect}
                  size="lg"
                  disabled={isConnecting || !botToken.trim()}
                  className="w-full sm:w-auto"
                >
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Connect Bot
                </Button>

                <Separator />

                <div className="space-y-2">
                  <div className="text-sm font-medium">Setup Instructions</div>
                  <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
                    <li>
                      Open Telegram and message{" "}
                      <strong className="text-foreground">@BotFather</strong>
                    </li>
                    <li>
                      Send{" "}
                      <code className="bg-muted px-1 rounded">/newbot</code> and
                      follow the prompts
                    </li>
                    <li>Copy the bot token BotFather gives you</li>
                    <li>
                      Paste the token above and click{" "}
                      <strong className="text-foreground">Connect Bot</strong>
                    </li>
                    <li>ReplyBase sets up the webhook automatically</li>
                  </ol>
                </div>

                <p className="text-xs text-muted-foreground pt-2">
                  Your bot token is encrypted at rest and never logged in
                  plaintext.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
