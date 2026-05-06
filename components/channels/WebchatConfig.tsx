"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { ChannelFlowAssignmentCard } from "@/components/channels/channel-sections";

type FlowOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type ChannelFlowAssignment = {
  id: string;
  flowId: string;
  flow?: {
    id: string;
    name: string;
    isActive: boolean;
  };
};

type Channel = {
  id: string;
  name: string;
  type: string;
  channelId?: string | null;
  config?: {
    title?: string;
    primaryColor?: string;
    welcomeMessage?: string;
    position?: "left" | "right";
    [key: string]: unknown;
  };
  flowAssignments?: ChannelFlowAssignment[];
};

type PreviewMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
};

type WebchatSite = {
  id: string;
  name: string;
  publicKey: string;
  secretKey: string;
  allowedDomains: string[];
  themeConfig?: {
    title?: string;
    primaryColor?: string;
    welcomeMessage?: string;
    position?: "left" | "right";
    [key: string]: unknown;
  };
  channelId?: string | null;
  isActive: boolean;
};

type WebchatDiagnostics = {
  lastPingAt: string | null;
  blockedOriginCount: number;
  rateLimitCount: number;
  recentErrors: Array<{
    id: string;
    createdAt: string;
    reason: string;
    stage: string | null;
    message: string | null;
  }>;
};

const PREVIEW_DEFAULT_DRAFT = "Can you help me choose the right plan?";
const PREVIEW_SEED_MESSAGES: PreviewMessage[] = [
  {
    id: "seed-user",
    role: "user",
    text: "I want to learn more about your plans.",
  },
  {
    id: "seed-bot",
    role: "bot",
    text: "Great. I can help you choose the right one.",
  },
];

function buildPreviewReply(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("price") || normalized.includes("plan")) {
    return "We offer multiple plans depending on message volume and channel needs.";
  }
  if (normalized.includes("demo") || normalized.includes("trial")) {
    return "Yes. You can start with a guided setup flow and test the widget before rollout.";
  }
  if (normalized.includes("integrat") || normalized.includes("website")) {
    return "Integration is done with a single embed script plus your webchat public key.";
  }
  return "That is the kind of reply your live widget will show after your AI flow is configured.";
}

function parseAllowedDomains(value: string) {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function normalizeAllowedDomains(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

interface WebchatConfigProps {
  botId: string;
}

export function WebchatConfig({ botId }: WebchatConfigProps) {
  const { confirm } = useConfirmation();
  const [selectedBotEntryFlow, setSelectedBotEntryFlow] = useState<
    string | null | undefined
  >(undefined);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [isChannelsLoading, setIsChannelsLoading] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [flows, setFlows] = useState<FlowOption[]>([]);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [isAssigningFlow, setIsAssigningFlow] = useState(false);
  const [isUnassigningFlow, setIsUnassigningFlow] = useState(false);

  const [channelName, setChannelName] = useState("Website Chat");
  const [title, setTitle] = useState("Chat with us");
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Hi. How can I help you today?",
  );
  const [position, setPosition] = useState<"left" | "right">("right");
  const [site, setSite] = useState<WebchatSite | null>(null);
  const [allowedDomainsDraft, setAllowedDomainsDraft] = useState("");
  const [isSiteLoading, setIsSiteLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<WebchatDiagnostics | null>(
    null,
  );
  const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);
  const [isSecretVisible, setIsSecretVisible] = useState(false);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isRotatingPublicKey, setIsRotatingPublicKey] = useState(false);
  const [isRotatingSecretKey, setIsRotatingSecretKey] = useState(false);
  const [isLaunchingTestWidget, setIsLaunchingTestWidget] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [previewDraft, setPreviewDraft] = useState(PREVIEW_DEFAULT_DRAFT);
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>(
    PREVIEW_SEED_MESSAGES,
  );
  const [origin, setOrigin] = useState("");
  const previewReplyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewReplyTimeoutRef.current !== null) {
        window.clearTimeout(previewReplyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!botId) return;
    void loadChannels(botId);
    void loadFlows();
    void fetch(`/api/bots/${botId}`)
      .then((r) => r.json())
      .then((d: { bot?: { entryFlow?: string | null } }) => {
        setSelectedBotEntryFlow(
          typeof d.bot?.entryFlow === "string" ? d.bot.entryFlow : null,
        );
      })
      .catch(() => setSelectedBotEntryFlow(null));
  }, [botId]);

  const loadChannels = async (id: string) => {
    setIsChannelsLoading(true);
    try {
      const res = await fetch(`/api/bots/${id}/channels`);
      const data = await res.json();
      const list = Array.isArray(data.channels) ? data.channels : [];
      setChannels(list);
      const webChannel = list.find((c: Channel) => c.type === "web");
      if (webChannel && !selectedChannelId) {
        handleSelectChannel(webChannel.id, list);
      }
    } catch {
      toast.error("Failed to load bot channels");
    } finally {
      setIsChannelsLoading(false);
    }
  };

  const handleSelectChannel = (id: string, currentChannels: Channel[] = channels) => {
    setSelectedChannelId(id);
    const channel = currentChannels.find((c) => c.id === id);
    if (channel) {
      setChannelName(channel.name || "Website Chat");
      setTitle(
        typeof channel.config?.title === "string"
          ? channel.config.title
          : "Chat with us",
      );
      setPrimaryColor(
        typeof channel.config?.primaryColor === "string"
          ? channel.config.primaryColor
          : "#0f766e",
      );
      setWelcomeMessage(
        typeof channel.config?.welcomeMessage === "string"
          ? channel.config.welcomeMessage
          : "Hi. How can I help you today?",
      );
      setPosition(channel.config?.position === "left" ? "left" : "right");

      const assignment = channel.flowAssignments?.[0];
      setSelectedFlowId(assignment?.flowId || "");

      void loadWebchatSite(botId, id);
      void loadWebchatDiagnostics(botId, id);
    } else {
      setSite(null);
      setDiagnostics(null);
      setAllowedDomainsDraft("");
    }
  };

  const loadWebchatSite = async (bId: string, cId: string) => {
    setIsSiteLoading(true);
    try {
      const res = await fetch(
        `/api/bots/${bId}/webchat-site?channelId=${cId}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSite(data.site || null);
      setAllowedDomainsDraft((data.site?.allowedDomains || []).join("\n"));
    } catch {
      setSite(null);
      setAllowedDomainsDraft("");
    } finally {
      setIsSiteLoading(false);
    }
  };

  const loadWebchatDiagnostics = async (bId: string, cId: string) => {
    setIsDiagnosticsLoading(true);
    try {
      const res = await fetch(
        `/api/bots/${bId}/webchat-site/diagnostics?channelId=${cId}`,
      );
      const data = await res.json();
      setDiagnostics(data.diagnostics || null);
    } catch {
      setDiagnostics(null);
    } finally {
      setIsDiagnosticsLoading(false);
    }
  };

  const loadFlows = async () => {
    setIsFlowsLoading(true);
    try {
      const res = await fetch("/api/flows?isActive=true&type=my");
      const data = await res.json();
      setFlows(Array.isArray(data.flows) ? data.flows : []);
    } catch {
      toast.error("Failed to load active flows");
    } finally {
      setIsFlowsLoading(false);
    }
  };

  const handleCreateChannel = async () => {
    setIsCreatingChannel(true);
    try {
      const res = await fetch(`/api/bots/${botId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "web", name: "Website Chat" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create channel");
      toast.success("Webchat channel created");
      await loadChannels(botId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create channel",
      );
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedChannelId) return;
    setIsSavingConfig(true);
    try {
      const normalizedDomains = normalizeAllowedDomains(
        parseAllowedDomains(allowedDomainsDraft),
      );

      const res = await fetch(`/api/bots/${botId}/webchat-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: selectedChannelId,
          name: channelName,
          allowedDomains: normalizedDomains,
          themeConfig: {
            title,
            primaryColor,
            welcomeMessage,
            position,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save configuration");
      }

      toast.success("Configuration saved");
      setSite(data.site);
      setAllowedDomainsDraft((data.site?.allowedDomains || []).join("\n"));
      await loadChannels(botId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save configuration",
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRotateKey = async (type: "public" | "secret") => {
    if (!selectedChannelId) return;
    const confirmed = await confirm({
      title: `Rotate ${type === "public" ? "Public" : "Secret"} Key`,
      description: `Warning: This will immediately invalidate the current ${type} key. Any existing widget installations using this key will stop working until they are updated.`,
      confirmText: "Rotate Key",
      variant: "destructive",
    });

    if (!confirmed) return;

    if (type === "public") setIsRotatingPublicKey(true);
    else setIsRotatingSecretKey(true);

    try {
      const res = await fetch(`/api/bots/${botId}/webchat-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: selectedChannelId,
          rotatePublicKey: type === "public",
          rotateSecretKey: type === "secret"
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to rotate key");
      }

      setSite(data.site);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} key rotated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rotate key");
    } finally {
      if (type === "public") setIsRotatingPublicKey(false);
      else setIsRotatingSecretKey(false);
    }
  };

  const handleAssignFlow = async () => {
    if (!selectedChannelId || !selectedFlowId) return;
    setIsAssigningFlow(true);
    try {
      const res = await fetch(`/api/flows/${selectedFlowId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign flow");
      }
      toast.success("Flow assigned to webchat");
      await loadChannels(botId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assignment failed");
    } finally {
      setIsAssigningFlow(false);
    }
  };

  const handleUnassignFlow = async () => {
    if (!selectedChannelId) return;
    const channel = channels.find((c) => c.id === selectedChannelId);
    const flowId = channel?.flowAssignments?.[0]?.flowId;
    if (!flowId) return;

    setIsUnassigningFlow(true);
    try {
      const res = await fetch(
        `/api/flows/${flowId}/assign?channelId=${encodeURIComponent(
          selectedChannelId,
        )}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unassign flow");
      }
      toast.success("Flow unassigned");
      setSelectedFlowId("");
      await loadChannels(botId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unassignment failed");
    } finally {
      setIsUnassigningFlow(false);
    }
  };

  async function handleLaunchTestWidget() {
    if (!botId || !selectedChannelId || !site?.publicKey) {
      toast.error("Save or load a webchat site first");
      return;
    }

    setIsLaunchingTestWidget(true);
    try {
      const currentAllowedDomains = site.allowedDomains || [];
      const normalizedDashboardOrigin = origin ? normalizeOrigin(origin) : null;

      if (
        currentAllowedDomains.length > 0 &&
        normalizedDashboardOrigin &&
        !currentAllowedDomains.includes(normalizedDashboardOrigin)
      ) {
        const nextAllowedDomains = normalizeAllowedDomains([
          ...currentAllowedDomains,
          normalizedDashboardOrigin,
        ]);

        const patchResponse = await fetch(
          `/api/bots/${botId}/webchat-site`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              channelId: selectedChannelId,
              allowedDomains: nextAllowedDomains,
            }),
          },
        );

        const patchData = await patchResponse.json();
        if (!patchResponse.ok) {
          throw new Error(
            patchData.error || "Failed to update allowlist for test launch",
          );
        }
        setSite(patchData.site);
        toast.success("Current origin added to allowlist for test launch");
      }

      window.open(
        `/integrations/webchat/test?botId=${botId}&channelId=${selectedChannelId}&publicKey=${site.publicKey}`,
        "_blank",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to launch test widget",
      );
    } finally {
      setIsLaunchingTestWidget(false);
    }
  }

  const handlePreviewSend = () => {
    if (!previewDraft.trim()) return;
    const userMsg: PreviewMessage = {
      id: Date.now().toString(),
      role: "user",
      text: previewDraft.trim(),
    };
    setPreviewMessages((prev) => [...prev, userMsg]);
    setPreviewDraft("");
    if (previewReplyTimeoutRef.current !== null) {
      window.clearTimeout(previewReplyTimeoutRef.current);
    }
    previewReplyTimeoutRef.current = window.setTimeout(() => {
      const botMsg: PreviewMessage = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: buildPreviewReply(userMsg.text),
      };
      setPreviewMessages((prev) => [...prev, botMsg]);
      previewReplyTimeoutRef.current = null;
    }, 800);
  };

  const webChannels = channels.filter((c) => c.type === "web");
  const assignedFlow = channels.find((c) => c.id === selectedChannelId)
    ?.flowAssignments?.[0]?.flow;

  const embedSnippet = site?.publicKey
    ? `<script src="${origin}/embed/replybase-webchat.js" data-public-key="${site.publicKey}" async></script>`
    : "";

  const leadFormSnippet = site?.publicKey
    ? `<script src="${origin}/embed/replybase-leads.js" data-public-key="${site.publicKey}" async></script>\n<div id="replybase-lead-form"></div>`
    : "";

  const getReactEmbedSnippet = () => {
    if (!site?.publicKey) return "";
    return `import { useEffect } from 'react';\n\nexport function Webchat() {\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = '${origin}/embed/replybase-webchat.js';\n    script.dataset.publicKey = '${site.publicKey}';\n    script.async = true;\n    document.body.appendChild(script);\n    return () => { document.body.removeChild(script); };\n  }, []);\n  return null;\n}`;
  };

  const getNextJsEmbedSnippet = () => {
    if (!site?.publicKey) return "";
    return `import Script from 'next/script';\n\n<Script\n  src="${origin}/embed/replybase-webchat.js"\n  data-public-key="${site.publicKey}"\n  strategy="afterInteractive"\n/>`;
  };

  const getReactLeadFormSnippet = () => {
    if (!site?.publicKey) return "";
    return `import { useEffect } from 'react';\n\nexport function LeadForm() {\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = '${origin}/embed/replybase-leads.js';\n    script.dataset.publicKey = '${site.publicKey}';\n    script.async = true;\n    document.body.appendChild(script);\n    return () => { document.body.removeChild(script); };\n  }, []);\n  return <div id="replybase-lead-form" />;\n}`;
  };

  const getNextJsLeadFormSnippet = () => {
    if (!site?.publicKey) return "";
    return `import Script from 'next/script';\n\n<>\n  <Script\n    src="${origin}/embed/replybase-leads.js"\n    data-public-key="${site.publicKey}"\n    strategy="afterInteractive"\n  />\n  <div id="replybase-lead-form" />\n</>`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Webchat Channels</h2>
            <p className="text-sm text-muted-foreground">
              Create and manage webchat instances for this bot.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleCreateChannel}
            disabled={isCreatingChannel || isChannelsLoading}
          >
            {isCreatingChannel ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Channel
          </Button>
        </div>

        {isChannelsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading channels...
          </div>
        ) : webChannels.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <Globe className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <h3 className="font-semibold">No webchat channels</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Add a webchat channel to generate an embed snippet for your website.
              </p>
              <Button size="sm" onClick={handleCreateChannel}>
                Add Webchat Channel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {webChannels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => handleSelectChannel(channel.id)}
                className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-slate-50 ${
                  selectedChannelId === channel.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "bg-white"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {channel.name}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    ID: {channel.id}
                  </p>
                </div>
                {selectedChannelId === channel.id && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedChannelId && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Appearance & Behavior</CardTitle>
                <CardDescription>
                  Configure how the widget looks and behaves on your site.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="channelName">Channel Display Name</Label>
                  <Input
                    id="channelName"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="Website Chat"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Widget Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Chat with us"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <div className="h-10 w-10 shrink-0 rounded-md border" style={{ backgroundColor: primaryColor }} />
                    <Input
                      id="primaryColor"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Welcome Message</Label>
                  <Textarea
                    id="welcomeMessage"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm"><input type="radio" checked={position === "right"} onChange={() => setPosition("right")} /> Right</label>
                    <label className="flex items-center gap-2 text-sm"><input type="radio" checked={position === "left"} onChange={() => setPosition("left")} /> Left</label>
                  </div>
                </div>
                <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full">
                  {isSavingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Configuration
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Security & Domains</CardTitle>
                   <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleLaunchTestWidget()}
                      disabled={isLaunchingTestWidget || !site?.publicKey}
                    >
                      {isLaunchingTestWidget ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="mr-2 h-4 w-4" />
                      )}
                      Test Widget
                    </Button>
                </div>
                <CardDescription>
                  Restrict where your widget can be used.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="allowedDomains">Allowed Origins</Label>
                  <Textarea
                    id="allowedDomains"
                    value={allowedDomainsDraft}
                    onChange={(e) => setAllowedDomainsDraft(e.target.value)}
                    placeholder="https://example.com"
                    rows={4}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <Label>API Credentials</Label>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Public Key</span>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => handleRotateKey("public")} disabled={isRotatingPublicKey || !site}>
                          {isRotatingPublicKey ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> : <RefreshCw className="h-2.5 w-2.5 mr-1" />}
                          Rotate
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input value={site?.publicKey || "Not generated"} readOnly className="h-8 font-mono text-[11px] bg-slate-50" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (site?.publicKey) { void navigator.clipboard.writeText(site.publicKey); toast.success("Public key copied"); } }} disabled={!site?.publicKey}><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Secret Key</span>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setIsSecretVisible(!isSecretVisible)}>{isSecretVisible ? <EyeOff className="h-2.5 w-2.5 mr-1" /> : <Eye className="h-2.5 w-2.5 mr-1" />}{isSecretVisible ? "Hide" : "Show"}</Button>
                          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => handleRotateKey("secret")} disabled={isRotatingSecretKey || !site}>{isRotatingSecretKey ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> : <RefreshCw className="h-2.5 w-2.5 mr-1" />}Rotate</Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type={isSecretVisible ? "text" : "password"} value={site?.secretKey || "Not generated"} readOnly className="h-8 font-mono text-[11px] bg-slate-50" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (site?.secretKey) { void navigator.clipboard.writeText(site.secretKey); toast.success("Secret key copied"); } }} disabled={!site?.secretKey}><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <ChannelFlowAssignmentCard
            title="Webchat Flow Assignment"
            description="Assign a specific flow to this webchat instance. If none is assigned, the bot's global entry flow is used."
            selectLabel="Active Flow"
            selectId="webchatFlowSelect"
            flows={flows}
            isFlowsLoading={isFlowsLoading}
            selectedFlowId={selectedFlowId}
            onSelectFlow={setSelectedFlowId}
            assignedFlowName={assignedFlow?.name}
            unassignedDescription={
              selectedBotEntryFlow
                ? "No channel flow assigned. Using bot entry flow."
                : "No channel or bot entry flow assigned. AI fallback only."
            }
            onAssign={handleAssignFlow}
            onUnassign={handleUnassignFlow}
            isAssigning={isAssigningFlow}
            isUnassigning={isUnassigningFlow}
            assignDisabled={!selectedFlowId || isAssigningFlow || assignedFlow?.id === selectedFlowId}
            unassignDisabled={!assignedFlow || isUnassigningFlow}
          />

          <Card>
            <CardHeader>
              <CardTitle>Embed Snippet</CardTitle>
              <CardDescription>Copy and paste this script before the closing <code>&lt;/body&gt;</code> tag on your website.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <SnippetTabs type="embed" html={embedSnippet || "Generate a public key first."} react={getReactEmbedSnippet()} nextjs={getNextJsEmbedSnippet()} label="Embed Snippet" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Form Snippet</CardTitle>
              <CardDescription>Paste this where you want a simple enquiry form.</CardDescription>
            </CardHeader>
            <CardContent>
              <SnippetTabs type="lead" html={leadFormSnippet || "Generate a public key first."} react={getReactLeadFormSnippet()} nextjs={getNextJsLeadFormSnippet()} label="Lead Form Snippet" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Diagnostics</CardTitle>
              <CardDescription>Recent activity and signals for this webchat site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">Last Ping</p>
                  <p className="mt-2 text-sm font-medium">{isDiagnosticsLoading ? "Loading..." : diagnostics?.lastPingAt ? new Date(diagnostics.lastPingAt).toLocaleString() : "No activity yet"}</p>
                </div>
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">Blocked Origins</p>
                  <p className="mt-2 text-2xl font-semibold">{diagnostics?.blockedOriginCount ?? 0}</p>
                </div>
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-sm text-muted-foreground">Rate-Limit Events</p>
                  <p className="mt-2 text-2xl font-semibold">{diagnostics?.rateLimitCount ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SnippetTabs({
  type,
  html,
  react,
  nextjs,
  label,
}: {
  type: "embed" | "lead";
  html: string;
  react: string;
  nextjs: string;
  label: string;
}) {
  const [tab, setTab] = useState<"html" | "react" | "nextjs">("html");
  const snippet = tab === "html" ? html : tab === "react" ? react : nextjs;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success(`${label} copied!`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={tab === "html" ? "default" : "outline"} onClick={() => setTab("html")}>HTML</Button>
          <Button type="button" size="sm" variant={tab === "react" ? "default" : "outline"} onClick={() => setTab("react")}>React</Button>
          <Button type="button" size="sm" variant={tab === "nextjs" ? "default" : "outline"} onClick={() => setTab("nextjs")}>Next.js</Button>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}><Copy className="mr-2 h-4 w-4" /> Copy Snippet</Button>
      </div>
      <Textarea value={snippet} readOnly rows={type === "lead" ? 14 : 10} className="font-mono text-xs" />
    </div>
  );
}
