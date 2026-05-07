"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Unplug,
  MessageCircle,
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

interface WhatsAppStatus {
  connected: boolean;
  channel?: {
    id: string;
    name: string;
    channelId: string;
    updatedAt: string;
  };
  provider?: string;
  local?: {
    webhookUrl?: string;
    lastInboundMessageAt?: string;
    lastStatusEventAt?: string;
  };
  compliance?: {
    notes?: string[];
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

const PROVIDER_LABELS: Record<string, string> = {
  meta_cloud: "Meta Cloud API",
  twilio: "Twilio",
  "360dialog": "360dialog",
};

type ProviderId = "meta_cloud" | "twilio" | "360dialog";

export default function WhatsAppIntegrationPage() {
  const { confirm, alert } = useConfirmation();

  // State for bot selection
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [loadingBots, setLoadingBots] = useState(true);

  // State for integration status
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Connection form state
  const [provider, setProvider] = useState<ProviderId>("meta_cloud");
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

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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
      void loadWhatsAppChannel(selectedBotId);
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
      setLoadingStatus(true);
      try {
        const res = await fetch(
          \`/api/bots/\${selectedBotId}/channels/whatsapp/status?botId=\${encodeURIComponent(selectedBotId)}\`,
        );
        const data = (await res.json()) as WhatsAppStatus;
        if (cancelled) return;
        setStatus(data);
        if (data.connected && data.channel?.id) {
          const logsRes = await fetch(
            \`/api/bots/\${selectedBotId}/channels/whatsapp/logs?channelId=\${data.channel.id}&limit=15\`,
          );
          const logsData = await logsRes.json();
          if (!cancelled) setLogs(logsData.logs || []);
        }
      } catch (error) {
        console.error("Failed to load status:", error);
      } finally {
        if (!cancelled) setLoadingStatus(false);
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

  async function loadBots() {
    setLoadingBots(true);
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
      toast.error("Failed to load bots");
    } finally {
      setLoadingBots(false);
    }
  }

  async function loadStatus(botId: string) {
    setLoadingStatus(true);
    try {
      const res = await fetch(
        \`/api/bots/\${botId}/channels/whatsapp/status?botId=\${encodeURIComponent(botId)}\`,
      );
      const data = (await res.json()) as WhatsAppStatus;
      setStatus(data);
      if (data.connected && data.channel?.id) {
        void loadLogs(data.channel.id);
      }
    } catch (error) {
      console.error("Failed to load status:", error);
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
          }))
        : [];
      setFlows(flowList);
    } catch (error) {
      console.error("Error fetching flows:", error);
    } finally {
      setIsFlowsLoading(false);
    }
  }

  async function loadWhatsAppChannel(botId: string) {
    try {
      const res = await fetch(\`/api/bots/\${botId}/channels\`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load channels");
      const channels: BotChannel[] = Array.isArray(data.channels)
        ? data.channels
        : [];
      setBotChannels(channels.filter((c) => c.type === "whatsapp"));
    } catch (error) {
      console.error("Error loading channels:", error);
    }
  }

  const whatsappChannel = useMemo(() => {
    return botChannels[0] || null;
  }, [botChannels]);

  const assignedFlow = useMemo(() => {
    return whatsappChannel?.flowAssignments?.flow || null;
  }, [whatsappChannel]);

  const targetChannelId = whatsappChannel?.id || status?.channel?.id;

  async function loadLogs(channelId: string) {
    if (!selectedBotId) return;
    setIsLogsLoading(true);
    try {
      const res = await fetch(
        \`/api/bots/\${selectedBotId}/channels/whatsapp/logs?channelId=\${channelId}&limit=15\`,
      );
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      console.error("Failed to load logs");
    } finally {
      setIsLogsLoading(false);
    }
  }

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
        void loadWhatsAppChannel(selectedBotId);
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
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to unassign flow");

      toast.success("Flow unassigned from channel");
      if (selectedBotId) {
        void loadWhatsAppChannel(selectedBotId);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign flow",
      );
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const handleSelectBot = (botId: string) => {
    setSelectedBotId(botId);
  };

  const canConnect =
    selectedBotId &&
    (provider === "meta_cloud"
      ? metaAccessToken && metaPhoneNumberId
      : provider === "twilio"
        ? twilioSid && twilioAuthToken && twilioFrom
        : dialogApiKey && dialogChannelId);

  const handleConnect = async () => {
    if (!selectedBotId) return;

    setConnecting(true);
    try {
      let payload: any = {
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
      } else if (provider === "twilio") {
        payload.credentials = {
          accountSid: twilioSid.trim(),
          authToken: twilioAuthToken.trim(),
          fromNumber: twilioFrom.trim(),
        };
      } else if (provider === "360dialog") {
        payload.credentials = {
          apiKey: dialogApiKey.trim(),
          channelId: dialogChannelId.trim(),
        };
      }

      const res = await fetch(\`/api/bots/\${selectedBotId}/channels/whatsapp/connect\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to connect WhatsApp");
      }

      toast.success("WhatsApp connected successfully!");
      void loadStatus(selectedBotId);
      void loadWhatsAppChannel(selectedBotId);
    } catch (error) {
      console.error("Connect error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to connect WhatsApp",
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!status?.channel?.id || !selectedBotId) return;

    const confirmed = await confirm({
      title: "Disconnect WhatsApp",
      description:
        "Are you sure you want to disconnect this WhatsApp integration? Incoming messages will no longer be processed by the AI.",
      confirmText: "Disconnect",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setDisconnecting(true);
    try {
      const res = await fetch(\`/api/bots/\${selectedBotId}/channels/whatsapp/disconnect\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: status.channel.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect WhatsApp");
      }

      toast.success("WhatsApp disconnected.");
      void loadStatus(selectedBotId);
      void loadWhatsAppChannel(selectedBotId);
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to disconnect WhatsApp integration",
      );
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp Integration</h1>
        <p className="text-muted-foreground">
          Connect your WhatsApp Business account to automate customer
          conversations.
        </p>
      </div>

      <BotSelector
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
