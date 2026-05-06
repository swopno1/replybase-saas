"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useConfirmation } from "@/components/ui/confirmation-provider";
import {
  ChannelGuidanceCard,
} from "@/components/channels/channel-ui";
import {
  ChannelActivityLogCard,
  ChannelFlowAssignmentCard,
} from "@/components/channels/channel-sections";

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

interface WhatsAppConfigProps {
  botId: string;
}

export function WhatsAppConfig({ botId }: WhatsAppConfigProps) {
  const { confirm } = useConfirmation();
  const [provider, setProvider] = useState<ProviderId>("meta_cloud");
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
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
    if (!botId) return;

    let cancelled = false;

    const run = async () => {
      setLoadingStatus(true);
      try {
        const res = await fetch(
          `/api/bots/${encodeURIComponent(botId)}/channels/whatsapp/status`,
        );
        const data = (await res.json()) as WhatsAppStatus;
        if (cancelled) return;
        setStatus(data);
        if (data.connected && data.channel?.id) {
          const logsRes = await fetch(
            `/api/bots/${encodeURIComponent(botId)}/channels/whatsapp/logs?channelId=${data.channel.id}&limit=15`,
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
    void loadWhatsAppChannel(botId);

    return () => {
      cancelled = true;
    };
  }, [botId]);

  const canConnect = useMemo(() => {
    if (provider === "meta_cloud") {
      return Boolean(metaAccessToken.trim() && metaPhoneNumberId.trim());
    }
    if (provider === "twilio") {
      return Boolean(twilioSid.trim() && twilioAuthToken.trim() && twilioFrom.trim());
    }
    return Boolean(dialogApiKey.trim() && dialogChannelId.trim());
  }, [provider, metaAccessToken, metaPhoneNumberId, twilioSid, twilioAuthToken, twilioFrom, dialogApiKey, dialogChannelId]);

  async function loadStatus(id: string) {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(id)}/channels/whatsapp/status`);
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
      const flowList: FlowOption[] = Array.isArray(data.flows) ? data.flows : [];
      setFlows(flowList);
    } catch {
      toast.error("Failed to load active flows");
    } finally {
      setIsFlowsLoading(false);
    }
  }

  async function loadWhatsAppChannel(id: string) {
    try {
      const res = await fetch(`/api/bots/${id}/channels`);
      const data = await res.json();
      const channels: BotChannel[] = Array.isArray(data.channels) ? data.channels : [];
      const channel = channels.find((c) => c.type?.toLowerCase() === "whatsapp") || null;
      const activeAssignment = channel?.flowAssignments?.[0];
      setWhatsappChannel(channel);
      setAssignedFlow(activeAssignment?.flow ? { id: activeAssignment.flow.id, name: activeAssignment.flow.name, isActive: activeAssignment.flow.isActive } : null);
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
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/channels/whatsapp/logs?channelId=${channelId}&limit=15`);
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
    if (!targetChannelId) { toast.error("Connect WhatsApp first"); return; }
    if (!selectedFlowId) { toast.error("Select a flow"); return; }
    setIsAssigningFlow(true);
    try {
      const res = await fetch(`/api/flows/${selectedFlowId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: targetChannelId }) });
      if (!res.ok) throw new Error("Failed to assign flow");
      toast.success("Flow assigned");
      await loadWhatsAppChannel(botId);
    } catch (error) {
      toast.error("Failed to assign flow");
    } finally {
      setIsAssigningFlow(false);
    }
  }

  async function handleUnassignFlow() {
    const targetChannelId = status?.channel?.id || whatsappChannel?.id;
    if (!targetChannelId || !assignedFlow?.id) { toast.error("No assigned flow"); return; }
    setIsUnassigningFlow(true);
    try {
      const res = await fetch(`/api/flows/${assignedFlow.id}/assign?channelId=${encodeURIComponent(targetChannelId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unassign flow");
      toast.success("Flow unassigned");
      await loadWhatsAppChannel(botId);
    } catch (error) {
      toast.error("Failed to unassign flow");
    } finally {
      setIsUnassigningFlow(false);
    }
  }

  async function handleConnect() {
    if (!canConnect) { toast.error("Fill all required fields"); return; }
    setConnecting(true);
    try {
      const payload: any = { botId, provider, channelName: channelName.trim() || undefined };
      if (provider === "meta_cloud") payload.credentials = { accessToken: metaAccessToken.trim(), phoneNumberId: metaPhoneNumberId.trim(), businessAccountId: metaBusinessId.trim() || undefined, appSecret: metaAppSecret.trim() || undefined };
      if (provider === "twilio") payload.credentials = { accountSid: twilioSid.trim(), authToken: twilioAuthToken.trim(), fromNumber: twilioFrom.trim() };
      if (provider === "360dialog") payload.credentials = { apiKey: dialogApiKey.trim(), channelId: dialogChannelId.trim() };
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/channels/whatsapp/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Failed to connect");
      toast.success("WhatsApp connected");
      await loadStatus(botId);
    } catch (error) {
      toast.error("Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!status?.channel?.id) return;
    const confirmed = await confirm({ title: "Disconnect WhatsApp", description: "Are you sure?", confirmText: "Disconnect", variant: "destructive" });
    if (!confirmed) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/channels/whatsapp/disconnect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: status.channel.id }) });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success("WhatsApp disconnected");
      await loadStatus(botId);
    } catch (error) {
      toast.error("Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-6">
      <ChannelGuidanceCard title="Compliance" description="Official WhatsApp only." icon={ShieldAlert} bullets={["Use Meta Cloud API", "24h window", "Use templates"]} />
      <Card>
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={provider} onValueChange={(v: ProviderId) => setProvider(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="meta_cloud">Meta Cloud</SelectItem><SelectItem value="twilio">Twilio</SelectItem><SelectItem value="360dialog">360dialog</SelectItem></SelectContent></Select>
          <Input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Display Name" />
          {provider === "meta_cloud" && <div className="grid gap-3 sm:grid-cols-2"><Input type="password" value={metaAccessToken} onChange={(e) => setMetaAccessToken(e.target.value)} placeholder="Access Token" /><Input value={metaPhoneNumberId} onChange={(e) => setMetaPhoneNumberId(e.target.value)} placeholder="Phone Number ID" /></div>}
          <div className="flex gap-3"><Button onClick={handleConnect} disabled={!canConnect || connecting}>{connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Connect</Button>{connected && <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>Disconnect</Button>}</div>
        </CardContent>
      </Card>
      {status && <Card><CardHeader><CardTitle>Status</CardTitle></CardHeader><CardContent><Badge>{connected ? "Connected" : "Disconnected"}</Badge><p className="text-sm mt-2">Provider: {status.provider || "-"}</p></CardContent></Card>}
      <ChannelFlowAssignmentCard title="Flow" description="Assign flow" selectLabel="Flow" selectId="wa-flow" flows={flows} isFlowsLoading={isFlowsLoading} selectedFlowId={selectedFlowId} onSelectFlow={setSelectedFlowId} assignedFlowName={assignedFlow?.name} unassignedDescription="No flow" onAssign={handleAssignFlow} onUnassign={handleUnassignFlow} isAssigning={isAssigningFlow} isUnassigning={isUnassigningFlow} assignDisabled={!selectedFlowId || isAssigningFlow || !connected} unassignDisabled={!assignedFlow || !connected} />
      {connected && <ChannelActivityLogCard logs={logs} isLoading={isLogsLoading} onRefresh={() => status.channel?.id && loadLogs(status.channel.id)} emptyText="No logs" />}
    </div>
  );
}
