"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
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
import {
  ChannelBotSelectorCard,
  ChannelGuidanceCard,
  ChannelPageHeader,
} from "@/components/channels/channel-ui";
import {
  ChannelActivityLogCard,
  ChannelFlowAssignmentCard,
} from "@/components/channels/channel-sections";

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

  const handleSelectBot = (id: string) => {
    setSelectedBotId(id);
    if (!id) {
      setStatus(null);
      setLogs([]);
      setFlows([]);
      setWhatsappChannel(null);
      setAssignedFlow(null);
      setSelectedFlowId("");
    }
  };

  useEffect(() => {
    if (!channelVisible) {
      router.replace("/");
      return;
    }

    void loadBots();
  }, [channelVisible, router]);

  useEffect(() => {
    if (!selectedBotId) return;

    let cancelled = false;

    const run = async () => {
      setLoadingStatus(true);
      try {
        const res = await fetch(
          `/api/bots/${encodeURIComponent(selectedBotId)}/channels/whatsapp/status`,
        );
        const data = (await res.json()) as WhatsAppStatus;
        if (cancelled) return;
        setStatus(data);
        if (data.connected && data.channel?.id) {
          const logsRes = await fetch(
            `/api/bots/${encodeURIComponent(selectedBotId)}/channels/whatsapp/logs?channelId=${data.channel.id}&limit=15`,
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
    void loadFlows();
    void loadWhatsAppChannel(selectedBotId);

    return () => {
      cancelled = true;
    };
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
        handleSelectBot(list[0].id);
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
        `/api/bots/${encodeURIComponent(botId)}/channels/whatsapp/status`,
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
        `/api/bots/${encodeURIComponent(selectedBotId)}/channels/whatsapp/logs?channelId=${channelId}&limit=15`,
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

      const res = await fetch(
        `/api/bots/${encodeURIComponent(selectedBotId)}/channels/whatsapp/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

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
      const res = await fetch(
        `/api/bots/${encodeURIComponent(selectedBotId)}/channels/whatsapp/disconnect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: status.channel.id }),
        },
      );

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
      <ChannelPageHeader
        title="WhatsApp Business"
        description="Connect official WhatsApp Business Platform providers only."
      />

      <ChannelGuidanceCard
        title="Compliance Requirements"
        description="Personal WhatsApp automation and WhatsApp Web scraping are not supported."
        icon={ShieldAlert}
        bullets={[
          "1. Use Meta Cloud API or an official BSP provider.",
          "2. Respect the 24-hour customer service window for free-form replies.",
          "3. Use template messages when the service window has expired.",
        ]}
      />

      <ChannelBotSelectorCard
        title="Select Bot"
        description="Choose which ReplyBase bot this WhatsApp connection belongs to."
        loading={loadingBots}
        bots={bots}
        selectedBotId={selectedBotId}
        onSelectBot={handleSelectBot}
      />

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

          <ChannelFlowAssignmentCard
            title="WhatsApp Flow Assignment"
            description="Assign an active flow to this WhatsApp channel. Channel assignment takes priority over bot entry flow."
            selectLabel="Assigned Flow"
            selectId="whatsappFlowSelect"
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

          {/* Recent Webhook Activity */}
          {connected && status?.channel?.id ? (
            <ChannelActivityLogCard
              logs={logs}
              isLoading={isLogsLoading}
              onRefresh={() => {
                if (status.channel?.id) {
                  void loadLogs(status.channel.id);
                }
              }}
              emptyText="No activity recorded yet."
            />
          ) : null}
        </>
      )}
    </div>
  );
}
