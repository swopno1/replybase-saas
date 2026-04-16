"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Unplug,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { isChannelVisibleInUi } from "@/lib/channel-config";
import { useConfirmation } from "@/components/ui/confirmation-provider";

export const dynamic = "force-dynamic";

type ProviderId = "meta_cloud" | "twilio" | "360dialog";

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

interface WebhookLogEntry {
  id: string;
  type: string;
  event: string;
  createdAt: string;
}

interface Bot {
  id: string;
  name: string;
}

interface WhatsAppStatus {
  connected: boolean;
  provider?: string | null;
  channel?: {
    id: string;
    name: string;
    channelId: string;
    updatedAt: string;
  };
  local?: {
    webhookUrl?: string | null;
    lastWebhookEventAt?: string | null;
    lastInboundMessageAt?: string | null;
    lastStatusEventAt?: string | null;
    metaPhoneNumberId?: string | null;
    twilioFromNumber?: string | null;
  };
  compliance?: {
    notes?: string[];
  };
}

const PROVIDER_LABELS: Record<ProviderId, string> = {
  meta_cloud: "Meta Cloud API",
  twilio: "Twilio",
  "360dialog": "360dialog",
};

export default function WhatsAppIntegrationPage() {
  const { confirm } = useConfirmation();
  const router = useRouter();
  const channelVisible = isChannelVisibleInUi("whatsapp");
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [provider, setProvider] = useState<ProviderId>("meta_cloud");
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loadingBots, setLoadingBots] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [whatsappChannel, setWhatsappChannel] = useState<BotChannel | null>(
    null,
  );
  const [assignedFlow, setAssignedFlow] = useState<FlowOption | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);

  // Logs state
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  const [channelName, setChannelName] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");

  const [twilioSid, setTwilioSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");

  const [dialogApiKey, setDialogApiKey] = useState("");
  const [dialogChannelId, setDialogChannelId] = useState("");

  useEffect(() => {
    if (!channelVisible) {
      router.replace("/");
      return;
    }

    void loadBots();
  }, [channelVisible, router]);

  useEffect(() => {
    if (!selectedBotId) {
      setStatus(null);
      setLogs([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoadingStatus(true);
      try {
        const res = await fetch(
          `/api/whatsapp/status?botId=${encodeURIComponent(selectedBotId)}`,
        );
        const data = (await res.json()) as WhatsAppStatus;
        if (cancelled) return;
        setStatus(data);
        if (data.connected && data.channel?.id) {
          const logsRes = await fetch(
            `/api/whatsapp/logs?channelId=${data.channel.id}&limit=15`,
          );
          const logsData = await logsRes.json();
          if (!cancelled) setLogs(logsData.logs || []);
        }
      } catch {
        if (!cancelled) toast.error("Failed to load WhatsApp status");
      } finally {
        if (!cancelled) setLoadingStatus(false);
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
      setWhatsappChannel(null);
      setAssignedFlow(null);
      setSelectedFlowId("");
      return;
    }

    void loadFlows();
    void loadWhatsAppChannel(selectedBotId);
  }, [selectedBotId]);

  const canConnect = useMemo(() => {
    if (!selectedBotId) {
      return false;
    }

    if (provider === "meta_cloud") {
      return Boolean(metaAccessToken.trim() && metaPhoneNumberId.trim());
    }

    if (provider === "twilio") {
      return Boolean(
        twilioSid.trim() && twilioAuthToken.trim() && twilioFrom.trim(),
      );
    }

    return Boolean(dialogApiKey.trim() && dialogChannelId.trim());
  }, [
    selectedBotId,
    provider,
    metaAccessToken,
    metaPhoneNumberId,
    twilioSid,
    twilioAuthToken,
    twilioFrom,
    dialogApiKey,
    dialogChannelId,
  ]);

  async function loadBots() {
    setLoadingBots(true);
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
      setLoadingBots(false);
    }
  }

  async function loadStatus(botId: string) {
    setLoadingStatus(true);
    try {
      const res = await fetch(
        `/api/whatsapp/status?botId=${encodeURIComponent(botId)}`,
      );
      const data = (await res.json()) as WhatsAppStatus;
      setStatus(data);
      if (data.connected && data.channel?.id) {
        void loadLogs(data.channel.id);
      }
    } catch {
      toast.error("Failed to load WhatsApp status");
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadFlows() {
    setIsFlowsLoading(true);
    try {
      const res = await fetch("/api/flows?isActive=true&type=my");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load flows");
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
  }

  async function loadWhatsAppChannel(botId: string) {
    try {
      const res = await fetch(`/api/bots/${botId}/channels`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load channels");
      const channels: BotChannel[] = Array.isArray(data.channels)
        ? data.channels
        : [];
      const channel =
        channels.find((c) => c.type?.toLowerCase() === "whatsapp") || null;
      const activeAssignment = channel?.flowAssignments?.[0];
      setWhatsappChannel(channel);
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
      setWhatsappChannel(null);
      setAssignedFlow(null);
      setSelectedFlowId("");
    }
  }

  async function loadLogs(channelId: string) {
    setIsLogsLoading(true);
    try {
      const res = await fetch(
        `/api/whatsapp/logs?channelId=${channelId}&limit=15`,
      );
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      // Non-critical
    } finally {
      setIsLogsLoading(false);
    }
  }

  async function handleAssignFlow() {
    const targetChannelId = status?.channel?.id || whatsappChannel?.id;
    if (!targetChannelId) {
      toast.error("Connect WhatsApp first to assign a flow");
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
      if (!res.ok) throw new Error(data.error || "Failed to assign flow");
      toast.success("Flow assigned to WhatsApp channel");
      await loadWhatsAppChannel(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign flow",
      );
    } finally {
      setIsAssigningFlow(false);
    }
  }

  async function handleUnassignFlow() {
    const targetChannelId = status?.channel?.id || whatsappChannel?.id;
    if (!targetChannelId || !assignedFlow?.id) {
      toast.error("No assigned flow found");
      return;
    }
    setIsUnassigningFlow(true);
    try {
      const res = await fetch(
        `/api/flows/${assignedFlow.id}/assign?channelId=${encodeURIComponent(targetChannelId)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to unassign flow");
      toast.success("Flow unassigned from WhatsApp channel");
      await loadWhatsAppChannel(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign flow",
      );
    } finally {
      setIsUnassigningFlow(false);
    }
  }

  async function handleConnect() {
    if (!canConnect) {
      toast.error("Fill all required fields");
      return;
    }

    setConnecting(true);
    try {
      const payload: Record<string, unknown> = {
        botId: selectedBotId,
        provider,
        channelName: channelName.trim() || undefined,
      };

      if (provider === "meta_cloud") {
        payload.credentials = {
          accessToken: metaAccessToken.trim(),
          phoneNumberId: metaPhoneNumberId.trim(),
          businessAccountId: metaBusinessId.trim() || undefined,
          appSecret: metaAppSecret.trim() || undefined,
        };
      }

      if (provider === "twilio") {
        payload.credentials = {
          accountSid: twilioSid.trim(),
          authToken: twilioAuthToken.trim(),
          fromNumber: twilioFrom.trim(),
        };
      }

      if (provider === "360dialog") {
        payload.credentials = {
          apiKey: dialogApiKey.trim(),
          channelId: dialogChannelId.trim(),
        };
      }

      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect WhatsApp");
      }

      toast.success("WhatsApp integration connected");
      await loadStatus(selectedBotId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!status?.channel?.id) {
      return;
    }

    const confirmed = await confirm({
      title: "Disconnect WhatsApp",
      description:
        "Disconnect this WhatsApp integration? Incoming and outgoing messages will stop until reconnected.",
      confirmText: "Disconnect",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch("/api/whatsapp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: status.channel.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to disconnect");
      }

      toast.success("WhatsApp integration disconnected");
      await loadStatus(selectedBotId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  if (!channelVisible) {
    return null;
  }

  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Business</h1>
        <p className="text-muted-foreground mt-1">
          Connect official WhatsApp Business Platform providers only.
        </p>
      </div>

      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Compliance Requirements
          </CardTitle>
          <CardDescription>
            Personal WhatsApp automation and WhatsApp Web scraping are not
            supported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Use Meta Cloud API or an official BSP provider.</p>
          <p>
            2. Respect the 24-hour customer service window for free-form
            replies.
          </p>
          <p>3. Use template messages when the service window has expired.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Bot</CardTitle>
          <CardDescription>
            Choose which ReplyBase bot this WhatsApp connection belongs to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBots ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading bots...
            </div>
          ) : (
            <Select value={selectedBotId} onValueChange={setSelectedBotId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a bot" />
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

      {selectedBotId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Provider Configuration
              </CardTitle>
              <CardDescription>
                Configure Meta Cloud API, Twilio, or 360dialog credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 max-w-sm">
                <Label>Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(value: ProviderId) => setProvider(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta_cloud">Meta Cloud API</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="360dialog">360dialog</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 max-w-sm">
                <Label>Display Name (optional)</Label>
                <Input
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  placeholder="WhatsApp Sales Inbox"
                />
              </div>

              {provider === "meta_cloud" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Access Token</Label>
                    <Input
                      type="password"
                      value={metaAccessToken}
                      onChange={(event) =>
                        setMetaAccessToken(event.target.value)
                      }
                      placeholder="EAAG..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number ID</Label>
                    <Input
                      value={metaPhoneNumberId}
                      onChange={(event) =>
                        setMetaPhoneNumberId(event.target.value)
                      }
                      placeholder="123456789012345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Account ID (optional)</Label>
                    <Input
                      value={metaBusinessId}
                      onChange={(event) =>
                        setMetaBusinessId(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>App Secret (optional)</Label>
                    <Input
                      type="password"
                      value={metaAppSecret}
                      onChange={(event) => setMetaAppSecret(event.target.value)}
                    />
                  </div>
                </div>
              )}

              {provider === "twilio" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input
                      value={twilioSid}
                      onChange={(event) => setTwilioSid(event.target.value)}
                      placeholder="AC..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input
                      type="password"
                      value={twilioAuthToken}
                      onChange={(event) =>
                        setTwilioAuthToken(event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Twilio WhatsApp Sender</Label>
                    <Input
                      value={twilioFrom}
                      onChange={(event) => setTwilioFrom(event.target.value)}
                      placeholder="+14155238886"
                    />
                  </div>
                </div>
              )}

              {provider === "360dialog" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>360dialog API Key</Label>
                    <Input
                      type="password"
                      value={dialogApiKey}
                      onChange={(event) => setDialogApiKey(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel ID</Label>
                    <Input
                      value={dialogChannelId}
                      onChange={(event) =>
                        setDialogChannelId(event.target.value)
                      }
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleConnect}
                  disabled={!canConnect || connecting}
                >
                  {connecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Connect WhatsApp
                </Button>
                {connected && status?.channel?.id && (
                  <Button
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unplug className="mr-2 h-4 w-4" />
                    )}
                    Disconnect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>
                Live connection status and webhook diagnostics.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {loadingStatus ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading status...
                </div>
              ) : !status ? (
                <p className="text-muted-foreground">No status available.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant={connected ? "secondary" : "outline"}>
                      {connected ? "Connected" : "Not Connected"}
                    </Badge>
                    <span className="text-muted-foreground">
                      Provider:{" "}
                      {status.provider
                        ? PROVIDER_LABELS[status.provider as ProviderId] ||
                          status.provider
                        : "-"}
                    </span>
                  </div>

                  <p>
                    Webhook URL: {status.local?.webhookUrl || "Not configured"}
                  </p>
                  <p>
                    Last inbound message:{" "}
                    {status.local?.lastInboundMessageAt || "No events yet"}
                  </p>
                  <p>
                    Last delivery status event:{" "}
                    {status.local?.lastStatusEventAt || "No status events yet"}
                  </p>

                  {status.compliance?.notes?.length ? (
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {status.compliance.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          {/* Flow Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                WhatsApp Flow Assignment
              </CardTitle>
              <CardDescription>
                Assign an active flow to this WhatsApp channel. Channel
                assignment takes priority over bot entry flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 max-w-lg">
                <Label htmlFor="whatsappFlowSelect">Assigned Flow</Label>
                {isFlowsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading flows...
                  </div>
                ) : flows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No active flows available. Activate a flow in Flow Builder
                    first.
                  </div>
                ) : (
                  <Select
                    value={selectedFlowId || "none"}
                    onValueChange={(value) =>
                      setSelectedFlowId(value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger id="whatsappFlowSelect">
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
                    No channel flow is assigned. Bot entry flow and AI fallback
                    are used.
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
                    !connected ||
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
                  disabled={!assignedFlow || !connected || isUnassigningFlow}
                >
                  {isUnassigningFlow ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Unassign Flow
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Webhook Activity */}
          {connected && status?.channel?.id && (
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
                </div>
              </CardHeader>
              <CardContent>
                {isLogsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading activity...
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No activity recorded yet.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {logs.map((log) => (
                      <li
                        key={log.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-muted-foreground truncate max-w-xs">
                          {log.event}
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap ml-4">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
