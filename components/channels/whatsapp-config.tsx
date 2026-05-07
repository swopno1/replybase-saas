"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
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
import { ChannelLimitWarning } from "@/components/channels/channel-ui";
import { toast } from "sonner";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import {
  ChannelFlowAssignmentCard,
  ChannelActivityLogCard,
} from "@/components/channels/channel-sections";

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

export function WhatsAppConfig({ botId, channelLimitStatus }: { botId: string; channelLimitStatus?: { allowed: boolean; limit: number } | null }) {
  const { confirm, alert } = useConfirmation();

  // State for integration status
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [logs, setLogs] = useState<any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Configuration state
  const [provider, setProvider] = useState<ProviderId>("meta_cloud");
  const [channelName, setChannelName] = useState("");

  // Meta specific
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaBusinessId, setMetaBusinessId] = useState("");
  const [metaAppSecret, setMetaAppSecret] = useState("");

  // Twilio specific
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");

  // 360dialog specific
  const [dialogApiKey, setDialogApiKey] = useState("");
  const [dialogChannelId, setDialogChannelId] = useState("");

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Flow assignment state
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);

  const loadStatus = async (id: string) => {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/bots/${id}/channels/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.channel?.id) {
          void loadLogs(data.channel.id);
        }
      } else {
        setStatus(null);
      }
    } catch (error) {
      console.error("Failed to load status:", error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadLogs = async (channelId: string) => {
    setIsLogsLoading(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/whatsapp/logs?channelId=${channelId}`);
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

  useEffect(() => {
    if (botId) {
      setTimeout(() => {
        void loadStatus(botId);
        void loadFlows();
      }, 0);
    }
  }, [botId]);

  const handleConnect = async () => {
    if (!botId) return;

    const effectiveLimitStatus = channelLimitStatus || (status as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ /* TODO: Fix type */)?.limitStatus;
    if (effectiveLimitStatus && !effectiveLimitStatus.allowed) {
      toast.error(`Channel limit reached (${effectiveLimitStatus.limit}). Please upgrade.`);
      return;
    }

    setConnecting(true);
    try {
      const payload = {
        provider,
        name: channelName || "WhatsApp",
        ...(provider === "meta_cloud" && {
          metaAccessToken,
          metaPhoneNumberId,
          metaBusinessId,
          metaAppSecret,
        }),
        ...(provider === "twilio" && {
          twilioSid,
          twilioAuthToken,
          twilioFrom,
        }),
        ...(provider === "360dialog" && {
          dialogApiKey,
          dialogChannelId,
        }),
      };

      const response = await fetch(`/api/bots/${botId}/channels/whatsapp/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to connect");
      }

      toast.success("WhatsApp connected successfully!");
      void loadStatus(botId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!status?.channel?.id || !botId) return;

    const confirmed = await confirm({
      title: "Disconnect WhatsApp",
      description: "Are you sure you want to disconnect? You will no longer receive or send messages through this channel.",
      confirmText: "Disconnect",
      variant: "destructive",
    });

    if (!confirmed) return;

    setDisconnecting(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/whatsapp/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: status.channel.id }),
      });

      if (!res.ok) throw new Error("Failed to disconnect");

      toast.success("WhatsApp disconnected.");
      void loadStatus(botId);
    } catch (error) {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleAssignFlow = async () => {
    if (!status?.channel?.id || !selectedFlowId) return;

    setIsAssigningFlow(true);
    try {
      const res = await fetch(`/api/channels/${status.channel.id}/flows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId: selectedFlowId }),
      });

      if (!res.ok) throw new Error("Failed to assign flow");
      toast.success("Flow assigned successfully!");
      void loadStatus(botId);
    } catch (error) {
      toast.error("Failed to assign flow");
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    if (!status?.channel?.id) return;

    setIsUnassigningFlow(true);
    try {
      const res = await fetch(`/api/channels/${status.channel.id}/flows`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to unassign flow");
      toast.success("Flow unassigned.");
      void loadStatus(botId);
    } catch (error) {
      toast.error("Failed to unassign flow");
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const connected = status?.connected ?? false;
  const canConnect = provider === "meta_cloud"
    ? metaAccessToken && metaPhoneNumberId
    : provider === "twilio"
    ? twilioSid && twilioAuthToken && twilioFrom
    : dialogApiKey && dialogChannelId;

  const assignedFlow = useMemo(() => {
    return (status as any /* eslint-disable-line @typescript-eslint/no-explicit-any */ /* TODO: Fix type */)?.channel?.flowAssignments?.[0]?.flow;
  }, [status]);

  return (
    <div className="space-y-6">
      <ChannelLimitWarning limitStatus={channelLimitStatus || (status as any)?.limitStatus} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
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
              disabled={connected}
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
              disabled={connected}
            />
          </div>

          {provider === "meta_cloud" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input
                  type="password"
                  value={metaAccessToken}
                  onChange={(event) => setMetaAccessToken(event.target.value)}
                  placeholder="EAAG..."
                  disabled={connected}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number ID</Label>
                <Input
                  value={metaPhoneNumberId}
                  onChange={(event) => setMetaPhoneNumberId(event.target.value)}
                  placeholder="123456789012345"
                  disabled={connected}
                />
              </div>
              <div className="space-y-2">
                <Label>Business Account ID (optional)</Label>
                <Input
                  value={metaBusinessId}
                  onChange={(event) => setMetaBusinessId(event.target.value)}
                  disabled={connected}
                />
              </div>
              <div className="space-y-2">
                <Label>App Secret (optional)</Label>
                <Input
                  type="password"
                  value={metaAppSecret}
                  onChange={(event) => setMetaAppSecret(event.target.value)}
                  disabled={connected}
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
                  disabled={connected}
                />
              </div>
              <div className="space-y-2">
                <Label>Auth Token</Label>
                <Input
                  type="password"
                  value={twilioAuthToken}
                  onChange={(event) => setTwilioAuthToken(event.target.value)}
                  disabled={connected}
                />
              </div>
              <div className="space-y-2">
                <Label>Twilio WhatsApp Sender</Label>
                <Input
                  value={twilioFrom}
                  onChange={(event) => setTwilioFrom(event.target.value)}
                  placeholder="+14155238886"
                  disabled={connected}
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
                  disabled={connected}
                />
              </div>
              <div className="space-y-2">
                <Label>Channel ID</Label>
                <Input
                  value={dialogChannelId}
                  onChange={(event) => setDialogChannelId(event.target.value)}
                  disabled={connected}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {!connected ? (
              <Button
                onClick={handleConnect}
                disabled={!canConnect || connecting || !(channelLimitStatus || (status as any)?.limitStatus)?.allowed}
              >
                {connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Connect WhatsApp
              </Button>
            ) : (
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

          <ChannelActivityLogCard
            logs={logs}
            isLoading={isLogsLoading}
            onRefresh={() => {
              if (status?.channel?.id) {
                void loadLogs(status.channel.id);
              }
            }}
            emptyText="No activity recorded yet."
          />
        </>
      )}
    </div>
  );
}
