"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  Unplug,
  ChevronDown,
  ChevronRight,
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

// Brand colours
const WA_GREEN = "#25D366";
const WA_DARK = "#128C7E";
const RB_INDIGO = "#4F46E5";

interface WhatsAppStatus {
  connected: boolean;
  limitStatus?: {
    allowed: boolean;
    limit: number;
  };
  channel?: {
    id: string;
    name: string;
    channelId: string;
    updatedAt: string;
    flowAssignments?: {
      flow: { id: string; name: string };
    } | null;
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

interface PhoneNumber {
  id: string;
  display_phone_number: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  meta_cloud: "Meta Cloud API",
  twilio: "Twilio",
  "360dialog": "360dialog",
};

type ProviderId = "meta_cloud" | "twilio" | "360dialog";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export function WhatsAppConfig({
  botId,
  channelLimitStatus,
}: {
  botId: string;
  channelLimitStatus?: { allowed: boolean; limit: number } | null;
}) {
  const { confirm } = useConfirmation();

  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [logs, setLogs] = useState<any[] /* eslint-disable-line @typescript-eslint/no-explicit-any */>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Shared field
  const [channelName, setChannelName] = useState("");

  // QuickStart state
  const [isQuickStarting, setIsQuickStarting] = useState(false);
  const [availablePhones, setAvailablePhones] = useState<PhoneNumber[]>([]);
  const [selectedPhoneId, setSelectedPhoneId] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [pendingWabaId, setPendingWabaId] = useState("");

  // Advanced / manual
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("meta_cloud");
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

  // Flow assignment
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);

  // Load Meta SDK for QuickStart
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "3851740095132954";
    if (typeof window !== "undefined" && !document.getElementById("facebook-jssdk") && appId) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if ((window as any).FB) {
          (window as any).FB.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  const connectWithValues = async (payload: {
    provider: string;
    name: string;
    metaAccessToken?: string;
    metaPhoneNumberId?: string;
    metaBusinessId?: string;
    metaAppSecret?: string;
    twilioSid?: string;
    twilioAuthToken?: string;
    twilioFrom?: string;
    dialogApiKey?: string;
    dialogChannelId?: string;
  }) => {
    setConnecting(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels/whatsapp/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to connect");
      }
      toast.success("WhatsApp connected successfully!");
      setAvailablePhones([]);
      setPendingToken("");
      setPendingWabaId("");
      setSelectedPhoneId("");
      void loadStatus(botId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setConnecting(false);
      setIsQuickStarting(false);
    }
  };

  const handleQuickStart = () => {
    if (!(window as any).FB) {
      toast.error("Meta SDK not loaded. Please check your connection or browser settings.");
      return;
    }
    setIsQuickStarting(true);
    setAvailablePhones([]);
    setPendingToken("");
    setPendingWabaId("");

    (window as any).FB.login(
      (response: any) => {
        if (response.authResponse) {
          void fetchMetaPhoneNumbers(response.authResponse.accessToken);
        } else {
          toast.error("Meta login cancelled or failed.");
          setIsQuickStarting(false);
        }
      },
      {
        scope: "whatsapp_business_management,whatsapp_business_messaging,business_management",
        extras: { feature: "whatsapp_embedded_signup", setup: {} },
      }
    );
  };

  const fetchMetaPhoneNumbers = async (token: string) => {
    try {
      const wabaRes = await fetch(
        `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?access_token=${token}`
      );
      const wabaData = await wabaRes.json();

      if (!wabaData.data?.length) {
        toast.warning("No WhatsApp Business Accounts found. Make sure your Meta account has a WhatsApp Business Account set up.");
        setIsQuickStarting(false);
        return;
      }

      const wabaId = wabaData.data[0].id;
      const phoneRes = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${token}`
      );
      const phoneData = await phoneRes.json();

      if (!phoneData.data?.length) {
        toast.warning("No WhatsApp phone numbers found. Please add a phone number to your WhatsApp Business Account first.");
        setIsQuickStarting(false);
        return;
      }

      if (phoneData.data.length === 1) {
        const phone = phoneData.data[0];
        toast.success(`Found ${phone.display_phone_number} — connecting now…`);
        await connectWithValues({
          provider: "meta_cloud",
          name: channelName || phone.display_phone_number,
          metaAccessToken: token,
          metaPhoneNumberId: phone.id,
          metaBusinessId: wabaId,
        });
      } else {
        setAvailablePhones(phoneData.data as PhoneNumber[]);
        setPendingToken(token);
        setPendingWabaId(wabaId);
        setSelectedPhoneId(phoneData.data[0].id);
        toast.success(`Found ${phoneData.data.length} numbers — please pick one below.`);
        setIsQuickStarting(false);
      }
    } catch {
      toast.error("Connected to Meta but failed to fetch WhatsApp details automatically.");
      setIsQuickStarting(false);
    }
  };

  const handleCompleteQuickStart = () => {
    if (!selectedPhoneId || !pendingToken) return;
    const phone = availablePhones.find((p) => p.id === selectedPhoneId);
    void connectWithValues({
      provider: "meta_cloud",
      name: channelName || phone?.display_phone_number || "WhatsApp",
      metaAccessToken: pendingToken,
      metaPhoneNumberId: selectedPhoneId,
      metaBusinessId: pendingWabaId,
    });
  };

  const handleConnect = () => {
    void connectWithValues({
      provider,
      name: channelName || "WhatsApp",
      ...(provider === "meta_cloud" && { metaAccessToken, metaPhoneNumberId, metaBusinessId, metaAppSecret }),
      ...(provider === "twilio" && { twilioSid, twilioAuthToken, twilioFrom }),
      ...(provider === "360dialog" && { dialogApiKey, dialogChannelId }),
    });
  };

  const loadStatus = async (id: string) => {
    setLoadingStatus(true);
    try {
      const res = await fetch(`/api/bots/${id}/channels/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.channel?.id) void loadLogs(data.channel.id);
      } else {
        setStatus(null);
      }
    } catch {
      // ignore
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
    } catch {
      // ignore
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
    } catch {
      // ignore
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

  const handleDisconnect = async () => {
    if (!status?.channel?.id) return;
    const confirmed = await confirm({
      title: "Disconnect WhatsApp",
      description:
        "This will stop your bot from receiving or sending WhatsApp messages. You can reconnect at any time.",
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
    } catch {
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
    } catch {
      toast.error("Failed to assign flow");
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    if (!status?.channel?.id) return;
    setIsUnassigningFlow(true);
    try {
      const res = await fetch(`/api/channels/${status.channel.id}/flows`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to unassign flow");
      toast.success("Flow unassigned.");
      void loadStatus(botId);
    } catch {
      toast.error("Failed to unassign flow");
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  const connected = status?.connected ?? false;
  const limitAllowed = (channelLimitStatus || status?.limitStatus)?.allowed ?? true;
  const canConnectManual =
    provider === "meta_cloud"
      ? metaAccessToken && metaPhoneNumberId
      : provider === "twilio"
        ? twilioSid && twilioAuthToken && twilioFrom
        : dialogApiKey && dialogChannelId;

  const assignedFlow = useMemo(() => status?.channel?.flowAssignments?.flow, [status]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loadingStatus && status === null) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading WhatsApp status…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ChannelLimitWarning limitStatus={channelLimitStatus || status?.limitStatus} />

      {/* ── CONNECTED STATE ──────────────────────────────────────────────────── */}
      {connected ? (
        <>
          {/* Connected banner */}
          <div
            className="rounded-xl p-5 border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{ borderColor: `${WA_GREEN}60`, backgroundColor: "#f0fdf4" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: WA_GREEN }}
              >
                <WhatsAppIcon className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-800 text-base">
                    {status?.channel?.name || "WhatsApp"}
                  </h3>
                  <Badge
                    className="text-white text-[10px] uppercase tracking-wide font-bold border-0"
                    style={{ backgroundColor: WA_GREEN }}
                  >
                    ● Connected
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  via{" "}
                  {status?.provider
                    ? PROVIDER_LABELS[status.provider] || status.provider
                    : "Meta Cloud API"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 shrink-0"
            >
              {disconnecting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-3.5 w-3.5" />
              )}
              Disconnect
            </Button>
          </div>

          {/* Connection details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">Connection Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-0.5">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Last Inbound Message
                </p>
                <p className="text-slate-700 font-medium">
                  {status?.local?.lastInboundMessageAt || "No messages yet"}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Last Delivery Event
                </p>
                <p className="text-slate-700 font-medium">
                  {status?.local?.lastStatusEventAt || "No events yet"}
                </p>
              </div>
              {status?.local?.webhookUrl && (
                <div className="col-span-full space-y-0.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Webhook URL
                  </p>
                  <p className="text-slate-600 font-mono text-xs break-all bg-slate-50 border rounded px-2 py-1">
                    {status.local.webhookUrl}
                  </p>
                </div>
              )}
              {status?.compliance?.notes?.length ? (
                <div className="col-span-full space-y-1">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    Compliance Notes
                  </p>
                  {status.compliance.notes.map((note) => (
                    <p
                      key={note}
                      className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-100"
                    >
                      {note}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <ChannelFlowAssignmentCard
            title="Conversation Flow"
            description="Assign a flow to this WhatsApp channel. This takes priority over the bot's default entry flow."
            selectLabel="Assigned Flow"
            selectId="whatsappFlowSelect"
            flows={flows}
            isFlowsLoading={isFlowsLoading}
            selectedFlowId={selectedFlowId}
            onSelectFlow={setSelectedFlowId}
            assignedFlowName={assignedFlow?.name}
            unassignedDescription="No flow assigned — bot uses its default entry flow and AI fallback."
            onAssign={handleAssignFlow}
            onUnassign={handleUnassignFlow}
            isAssigning={isAssigningFlow}
            isUnassigning={isUnassigningFlow}
            assignDisabled={
              !selectedFlowId ||
              isAssigningFlow ||
              assignedFlow?.id === selectedFlowId
            }
            unassignDisabled={!assignedFlow || isUnassigningFlow}
          />

          <ChannelActivityLogCard
            logs={logs}
            isLoading={isLogsLoading}
            onRefresh={() => {
              if (status?.channel?.id) void loadLogs(status.channel.id);
            }}
            emptyText="No activity recorded yet. Messages will appear here once your WhatsApp number starts receiving them."
          />
        </>
      ) : (
        /* ── NOT CONNECTED STATE ───────────────────────────────────────────── */
        <>
          {/* Brand header */}
          <div
            className="rounded-xl p-5 flex items-center gap-4 text-white"
            style={{
              background: `linear-gradient(135deg, ${WA_GREEN} 0%, ${WA_DARK} 45%, ${RB_INDIGO} 100%)`,
            }}
          >
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <WhatsAppIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">WhatsApp Integration</h2>
              <p className="text-white/80 text-sm mt-0.5">
                Connect your WhatsApp Business number to start automating conversations
              </p>
            </div>
          </div>

          {/* Channel name — shared across all methods */}
          <div className="max-w-sm space-y-1.5">
            <Label className="font-medium text-slate-700 text-sm">
              Channel Name{" "}
              <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="e.g. Sales WhatsApp, Customer Support"
            />
          </div>

          {/* Phone picker — shown after QuickStart finds multiple numbers */}
          {availablePhones.length > 0 && (
            <Card className="border-2" style={{ borderColor: WA_GREEN }}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: WA_GREEN }} />
                  <p className="font-semibold text-slate-800 text-sm">
                    Meta account linked! Select the WhatsApp number to connect:
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 max-w-sm">
                  <Select value={selectedPhoneId} onValueChange={setSelectedPhoneId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a number" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePhones.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.display_phone_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleCompleteQuickStart}
                    disabled={!selectedPhoneId || connecting}
                    className="text-white shrink-0"
                    style={{ backgroundColor: WA_GREEN }}
                  >
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {connecting ? "Connecting…" : "Connect Number"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── PRIMARY: QuickStart with Meta ─────────────────────────────── */}
          {availablePhones.length === 0 && (
            <Card className="border-2 overflow-hidden" style={{ borderColor: `${WA_GREEN}50` }}>
              {/* Top gradient stripe */}
              <div
                className="h-1.5"
                style={{ background: `linear-gradient(90deg, ${WA_GREEN}, ${WA_DARK} 50%, ${RB_INDIGO})` }}
              />
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-5">
                  {/* Icon */}
                  <div
                    className="hidden sm:flex items-center justify-center h-14 w-14 rounded-2xl text-white shrink-0 self-start"
                    style={{ backgroundColor: WA_GREEN }}
                  >
                    <WhatsAppIcon className="h-8 w-8" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title + badge */}
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <h3 className="text-lg font-bold text-slate-800">QuickStart with Meta</h3>
                      <Badge
                        className="text-white text-[10px] uppercase tracking-wider font-bold border-0"
                        style={{ backgroundColor: WA_GREEN }}
                      >
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-slate-500 text-sm mb-5">
                      The easiest way to connect — takes under 60 seconds, no technical knowledge needed.
                    </p>

                    {/* Step guide */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
                      {[
                        {
                          n: "1",
                          title: "Log in with Meta",
                          desc: "Use your Facebook or Meta Business account",
                        },
                        {
                          n: "2",
                          title: "Pick your number",
                          desc: "Select your WhatsApp Business phone number",
                        },
                        {
                          n: "3",
                          title: "All done!",
                          desc: "We configure the webhook & API automatically",
                        },
                      ].map((step) => (
                        <div
                          key={step.n}
                          className="flex flex-col gap-1.5 bg-slate-50 rounded-xl p-3 border border-slate-100"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="flex items-center justify-center h-5 w-5 rounded-full text-white text-[11px] font-bold shrink-0"
                              style={{ backgroundColor: WA_GREEN }}
                            >
                              {step.n}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">{step.title}</span>
                          </div>
                          <p className="text-xs text-slate-500 pl-7 leading-relaxed">{step.desc}</p>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        size="lg"
                        className="text-white font-semibold shadow-md hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: WA_GREEN }}
                        onClick={handleQuickStart}
                        disabled={isQuickStarting || connecting || !limitAllowed}
                      >
                        {isQuickStarting || connecting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <WhatsAppIcon className="mr-2 h-4 w-4" />
                        )}
                        {isQuickStarting
                          ? "Opening Meta…"
                          : connecting
                            ? "Connecting…"
                            : "QuickStart with Meta"}
                      </Button>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-slate-400">
                          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                        </svg>
                        Secure OAuth · Credentials are encrypted at rest
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── SECONDARY: Advanced / manual providers ────────────────────── */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <div className="flex-1 h-px bg-slate-200 group-hover:bg-slate-300 transition-colors" />
              <span className="flex items-center gap-1.5 text-xs text-slate-500 group-hover:text-slate-700 transition-colors bg-white px-3 py-1.5 border border-slate-200 rounded-full group-hover:border-slate-300 whitespace-nowrap">
                {showAdvanced ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                Advanced: connect with another provider
              </span>
              <div className="flex-1 h-px bg-slate-200 group-hover:bg-slate-300 transition-colors" />
            </button>

            {showAdvanced && (
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    Manual Connection
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      For developers
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Already have API credentials? Connect directly via Meta Cloud API, Twilio, or 360dialog.{" "}
                    <a
                      href="https://replybase.co.uk/docs/channels/whatsapp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline inline-flex items-center gap-0.5 font-medium"
                    >
                      Setup guide <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5 max-w-xs">
                    <Label className="text-sm font-medium">Provider</Label>
                    <Select
                      value={provider}
                      onValueChange={(v: ProviderId) => setProvider(v)}
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

                  {provider === "meta_cloud" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Access Token</Label>
                        <Input
                          type="password"
                          value={metaAccessToken}
                          onChange={(e) => setMetaAccessToken(e.target.value)}
                          placeholder="EAAG…"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Phone Number ID</Label>
                        <Input
                          value={metaPhoneNumberId}
                          onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                          placeholder="123456789012345"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">
                          Business Account ID{" "}
                          <span className="text-slate-400 font-normal">(optional)</span>
                        </Label>
                        <Input
                          value={metaBusinessId}
                          onChange={(e) => setMetaBusinessId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">
                          App Secret{" "}
                          <span className="text-slate-400 font-normal">(optional)</span>
                        </Label>
                        <Input
                          type="password"
                          value={metaAppSecret}
                          onChange={(e) => setMetaAppSecret(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {provider === "twilio" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">Account SID</Label>
                        <Input
                          value={twilioSid}
                          onChange={(e) => setTwilioSid(e.target.value)}
                          placeholder="AC…"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Auth Token</Label>
                        <Input
                          type="password"
                          value={twilioAuthToken}
                          onChange={(e) => setTwilioAuthToken(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Twilio WhatsApp Number</Label>
                        <Input
                          value={twilioFrom}
                          onChange={(e) => setTwilioFrom(e.target.value)}
                          placeholder="+14155238886"
                        />
                      </div>
                    </div>
                  )}

                  {provider === "360dialog" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-sm">360dialog API Key</Label>
                        <Input
                          type="password"
                          value={dialogApiKey}
                          onChange={(e) => setDialogApiKey(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm">Channel ID</Label>
                        <Input
                          value={dialogChannelId}
                          onChange={(e) => setDialogChannelId(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleConnect}
                    disabled={!canConnectManual || connecting || !limitAllowed}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {connecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {connecting ? "Connecting…" : "Connect WhatsApp"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
