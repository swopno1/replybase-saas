"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  X,
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
import {
  ChannelGuidanceCard,
  ChannelPageHeader,
} from "@/components/channels/channel-ui";
import { ChannelFlowAssignmentCard } from "@/components/channels/channel-sections";

export const dynamic = "force-dynamic";

type Bot = {
  id: string;
  name: string;
  entryFlow?: string | null;
};

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

export default function WebchatIntegrationPage() {
  const { confirm } = useConfirmation();
  const [bots, setBots] = useState<Bot[]>([]);
  const [isBotsLoading, setIsBotsLoading] = useState(true);
  const [selectedBotId, setSelectedBotId] = useState("");
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
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
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
    loadBots();
  }, []);

  useEffect(() => {
    if (!selectedBotId) {
      setChannels([]);
      setSelectedChannelId("");
      setSite(null);
      setDiagnostics(null);
      setAllowedDomains([]);
      setAllowedDomainsDraft("");
      setSelectedBotEntryFlow(undefined);
      return;
    }
    void loadChannels(selectedBotId);
    void loadFlows();
    void fetch(`/api/bots/${selectedBotId}`)
      .then((r) => r.json())
      .then((d: { bot?: { entryFlow?: string | null } }) => {
        setSelectedBotEntryFlow(
          typeof d.bot?.entryFlow === "string" ? d.bot.entryFlow : null,
        );
      })
      .catch(() => setSelectedBotEntryFlow(null));
  }, [selectedBotId]);

  const webChannels = useMemo(
    () => channels.filter((channel) => channel.type.toLowerCase() === "web"),
    [channels],
  );

  useEffect(() => {
    if (!webChannels.length) {
      setSelectedChannelId("");
      return;
    }

    const selectedStillExists = webChannels.some(
      (channel) => channel.id === selectedChannelId,
    );
    if (!selectedStillExists) {
      setSelectedChannelId(webChannels[0].id);
    }
  }, [webChannels, selectedChannelId]);

  const selectedChannel = useMemo(
    () => webChannels.find((channel) => channel.id === selectedChannelId),
    [webChannels, selectedChannelId],
  );

  const assignedChannelFlow = useMemo(() => {
    const assignment = selectedChannel?.flowAssignments?.[0];
    if (!assignment?.flow) {
      return null;
    }

    return {
      id: assignment.flow.id,
      name: assignment.flow.name,
      isActive: assignment.flow.isActive,
    } satisfies FlowOption;
  }, [selectedChannel]);

  useEffect(() => {
    setSelectedFlowId(assignedChannelFlow?.id || "");
  }, [assignedChannelFlow?.id]);

  useEffect(() => {
    if (!selectedChannel) {
      return;
    }

    setChannelName(selectedChannel.name || "Website Chat");
    setTitle(
      typeof selectedChannel.config?.title === "string"
        ? selectedChannel.config.title
        : "Chat with us",
    );
    setPrimaryColor(
      typeof selectedChannel.config?.primaryColor === "string"
        ? selectedChannel.config.primaryColor
        : "#0f766e",
    );
    setWelcomeMessage(
      typeof selectedChannel.config?.welcomeMessage === "string"
        ? selectedChannel.config.welcomeMessage
        : "Hi. How can I help you today?",
    );
    setPosition(selectedChannel.config?.position === "left" ? "left" : "right");
  }, [selectedChannel]);

  useEffect(() => {
    if (!selectedBotId || !selectedChannelId) {
      setSite(null);
      setDiagnostics(null);
      setIsSecretVisible(false);
      setAllowedDomains([]);
      setAllowedDomainsDraft("");
      return;
    }

    void loadWebchatSite(selectedBotId, selectedChannelId);
    void loadWebchatDiagnostics(selectedBotId, selectedChannelId);
  }, [selectedBotId, selectedChannelId]);

  useEffect(() => {
    setAllowedDomains(site?.allowedDomains || []);
    setAllowedDomainsDraft("");
    setIsSecretVisible(false);
  }, [site]);

  const embedSnippet = useMemo(() => {
    if (!selectedChannelId) {
      return "";
    }

    const baseUrl = origin || "https://YOUR_REPLYBASE_DOMAIN";
    const targetAttribute = site?.publicKey
      ? `data-public-key=\"${site.publicKey}\"`
      : `data-channel-id=\"${selectedChannelId}\"`;

    return `<script\n  src=\"${baseUrl}/embed/replybase-webchat.js\"\n  data-base-url=\"${baseUrl}\"\n  ${targetAttribute}\n  data-title=\"${title.replace(/\"/g, "&quot;")}\"\n  data-primary-color=\"${primaryColor}\"\n  data-position=\"${position}\"\n  defer\n></script>`;
  }, [
    origin,
    position,
    primaryColor,
    selectedChannelId,
    site?.publicKey,
    title,
  ]);

  const leadFormSnippet = useMemo(() => {
    if (!site?.publicKey) {
      return "";
    }

    const baseUrl = origin || "https://YOUR_REPLYBASE_DOMAIN";
    const endpoint = `${baseUrl}/api/public/leads`;
    const accentColor = /^#[0-9a-fA-F]{6}$/.test(primaryColor.trim())
      ? primaryColor.trim()
      : "#0f766e";

    return `<div id="replybase-lead-form"></div>
<script>
(function () {
  var mount = document.getElementById("replybase-lead-form");
  if (!mount) return;

  var endpoint = ${JSON.stringify(endpoint)};
  var publicKey = ${JSON.stringify(site.publicKey)};
  var accentColor = ${JSON.stringify(accentColor)};

  mount.innerHTML = [
    '<form id="replybaseLeadForm" style="max-width:480px;padding:20px;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;font-family:Segoe UI,Tahoma,sans-serif;box-shadow:0 12px 30px rgba(15,23,42,0.08)">',
    '<div style="margin-bottom:16px">',
    '<h3 style="margin:0 0 6px;font-size:20px;color:#0f172a">Request a Callback</h3>',
    '<p style="margin:0;font-size:14px;color:#475569">Share your enquiry and ReplyBase will send it straight to your team.</p>',
    '</div>',
    '<label style="display:block;margin-bottom:12px;font-size:14px;color:#0f172a">Name<input name="name" required style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px" /></label>',
    '<label style="display:block;margin-bottom:12px;font-size:14px;color:#0f172a">Enquiry<textarea name="enquiry" required rows="4" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;resize:vertical"></textarea></label>',
    '<label style="display:block;margin-bottom:12px;font-size:14px;color:#0f172a">Email<input name="email" type="email" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px" /></label>',
    '<label style="display:block;margin-bottom:12px;font-size:14px;color:#0f172a">Phone<input name="phone" type="tel" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px" /></label>',
    '<button type="submit" style="width:100%;padding:12px 16px;border:none;border-radius:10px;background:' + accentColor + ';color:#ffffff;font-weight:600;cursor:pointer">Send Enquiry</button>',
    '<p data-status style="margin:12px 0 0;font-size:13px;color:#475569"></p>',
    '</form>',
  ].join('');

  var form = mount.querySelector('#replybaseLeadForm');
  var status = mount.querySelector('[data-status]');

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    status.textContent = 'Sending...';

    var formData = new FormData(form);
    var payload = {
      publicKey: publicKey,
      source: 'form',
      name: String(formData.get('name') || '').trim(),
      enquiry: String(formData.get('enquiry') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      metadata: {
        pageUrl: window.location.href,
        pageTitle: document.title,
      },
    };

    try {
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      var result = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(result.error || 'Unable to submit enquiry');
      }

      form.reset();
      status.textContent = 'Thanks. Your enquiry has been sent.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Unable to submit enquiry right now.';
    }
  });
})();
</script>`;
  }, [origin, primaryColor, site?.publicKey]);

  const previewColor = useMemo(() => {
    const hexColor = primaryColor.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hexColor)) {
      return hexColor;
    }
    return "#0f766e";
  }, [primaryColor]);

  const normalizedAllowedDomains = useMemo(
    () => normalizeAllowedDomains(allowedDomains),
    [allowedDomains],
  );

  const normalizedDraftDomains = useMemo(
    () => normalizeAllowedDomains(parseAllowedDomains(allowedDomainsDraft)),
    [allowedDomainsDraft],
  );

  const invalidDraftDomains = useMemo(
    () =>
      parseAllowedDomains(allowedDomainsDraft).filter(
        (entry) => !normalizeOrigin(entry),
      ),
    [allowedDomainsDraft],
  );

  const normalizedDashboardOrigin = useMemo(
    () => (origin ? normalizeOrigin(origin) : null),
    [origin],
  );

  const webchatEffectiveMode = useMemo(() => {
    if (!selectedBotId) {
      return {
        title: "Select a bot",
        description: "Choose a bot to view the active webchat response mode.",
      };
    }

    if (assignedChannelFlow) {
      return {
        title: "Channel flow first, AI fallback",
        description: `Webchat first runs the assigned channel flow (${assignedChannelFlow.name}). If no final response is produced, AI handles the reply.`,
      };
    }

    if (selectedBotEntryFlow) {
      return {
        title: "Flow first, AI fallback",
        description:
          "Webchat starts with the bot entry flow and uses AI if flow execution does not finish with a final reply.",
      };
    }

    return {
      title: "AI only",
      description:
        "No entry flow is configured for this bot, so webchat currently uses AI responses only.",
    };
  }, [assignedChannelFlow, selectedBotEntryFlow, selectedBotId]);

  const canLaunchTestFromDashboard = useMemo(() => {
    if (!site?.publicKey) {
      return false;
    }

    if (!normalizedAllowedDomains.length) {
      return true;
    }

    return Boolean(
      normalizedDashboardOrigin &&
      normalizedAllowedDomains.includes(normalizedDashboardOrigin),
    );
  }, [normalizedAllowedDomains, normalizedDashboardOrigin, site?.publicKey]);

  const testWidgetUrl = useMemo(() => {
    if (!site?.publicKey) {
      return "";
    }

    const params = new URLSearchParams({
      publicKey: site.publicKey,
      baseUrl: origin || "",
      title,
      primaryColor,
      position,
      welcomeMessage,
      siteName: site.name || channelName,
    });

    if (normalizedAllowedDomains.length) {
      params.set("allowedDomains", normalizedAllowedDomains.join(","));
    }

    return `/integrations/webchat/test?${params.toString()}`;
  }, [
    channelName,
    origin,
    normalizedAllowedDomains,
    position,
    primaryColor,
    site?.name,
    site?.publicKey,
    title,
    welcomeMessage,
  ]);

  const previewTitle = title.trim() || "Chat with us";
  const previewWelcomeMessage =
    welcomeMessage.trim() || "Hi. How can I help you today?";

  function handlePreviewSend() {
    const message = previewDraft.trim();
    if (!message) {
      return;
    }

    if (previewReplyTimeoutRef.current !== null) {
      window.clearTimeout(previewReplyTimeoutRef.current);
    }

    setIsPreviewOpen(true);
    setPreviewMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: message,
      },
    ]);
    setPreviewDraft("");

    const reply = buildPreviewReply(message);
    previewReplyTimeoutRef.current = window.setTimeout(() => {
      setPreviewMessages((current) => [
        ...current,
        {
          id: `bot-${Date.now()}`,
          role: "bot",
          text: reply,
        },
      ]);
      previewReplyTimeoutRef.current = null;
    }, 450);
  }

  function handleResetPreview() {
    if (previewReplyTimeoutRef.current !== null) {
      window.clearTimeout(previewReplyTimeoutRef.current);
      previewReplyTimeoutRef.current = null;
    }

    setPreviewMessages(PREVIEW_SEED_MESSAGES);
    setPreviewDraft(PREVIEW_DEFAULT_DRAFT);
    setIsPreviewOpen(true);
  }

  async function loadBots() {
    setIsBotsLoading(true);
    try {
      const response = await fetch("/api/bots");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load bots");
      }

      const flattenedBots: Bot[] = Array.isArray(data.projects)
        ? data.projects.flatMap((project: { bots?: Bot[] }) =>
            Array.isArray(project.bots) ? project.bots : [],
          )
        : Array.isArray(data.bots)
          ? data.bots
          : [];

      setBots(flattenedBots);
      if (flattenedBots.length > 0) {
        setSelectedBotId(flattenedBots[0].id);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load bots",
      );
    } finally {
      setIsBotsLoading(false);
    }
  }

  async function loadChannels(botId: string) {
    setIsChannelsLoading(true);
    try {
      const response = await fetch(`/api/bots/${botId}/channels`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load channels");
      }
      setChannels(Array.isArray(data.channels) ? data.channels : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load channels",
      );
      setChannels([]);
    } finally {
      setIsChannelsLoading(false);
    }
  }

  async function loadFlows() {
    setIsFlowsLoading(true);
    try {
      const response = await fetch("/api/flows?isActive=true");
      const data = await response.json();
      if (!response.ok) {
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load flows",
      );
      setFlows([]);
    } finally {
      setIsFlowsLoading(false);
    }
  }

  async function handleAssignFlowToChannel() {
    if (!selectedChannelId) {
      toast.error("Select a web channel first");
      return;
    }

    if (!selectedFlowId) {
      toast.error("Select a flow to assign");
      return;
    }

    setIsAssigningFlow(true);
    try {
      const response = await fetch(`/api/flows/${selectedFlowId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to assign flow");
      }

      toast.success("Flow assigned to webchat channel");
      await loadChannels(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign flow",
      );
    } finally {
      setIsAssigningFlow(false);
    }
  }

  async function handleUnassignFlowFromChannel() {
    if (!selectedChannelId || !assignedChannelFlow?.id) {
      toast.error("No assigned flow found for this channel");
      return;
    }

    setIsUnassigningFlow(true);
    try {
      const response = await fetch(
        `/api/flows/${assignedChannelFlow.id}/assign?channelId=${encodeURIComponent(selectedChannelId)}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to unassign flow");
      }

      toast.success("Flow unassigned from webchat channel");
      await loadChannels(selectedBotId);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unassign flow",
      );
    } finally {
      setIsUnassigningFlow(false);
    }
  }

  async function loadWebchatSite(botId: string, channelId: string) {
    setIsSiteLoading(true);
    try {
      const response = await fetch(
        `/api/bots/${botId}/webchat-site?channelId=${encodeURIComponent(channelId)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load webchat site");
      }

      setSite(data.site || null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load webchat site",
      );
      setSite(null);
    } finally {
      setIsSiteLoading(false);
    }
  }

  async function loadWebchatDiagnostics(botId: string, channelId: string) {
    setIsDiagnosticsLoading(true);
    try {
      const response = await fetch(
        `/api/bots/${botId}/webchat-site/diagnostics?channelId=${encodeURIComponent(channelId)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load diagnostics");
      }

      setDiagnostics(data.diagnostics || null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load diagnostics",
      );
      setDiagnostics(null);
    } finally {
      setIsDiagnosticsLoading(false);
    }
  }

  async function handleCreateWebChannel() {
    if (!selectedBotId) {
      toast.error("Select a bot first");
      return;
    }

    setIsCreatingChannel(true);
    try {
      const response = await fetch(`/api/bots/${selectedBotId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "web",
          name: channelName.trim() || "Website Chat",
          config: {
            title,
            primaryColor,
            welcomeMessage,
            position,
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create web channel");
      }

      toast.success("Webchat channel created");
      await loadChannels(selectedBotId);
      if (data.channel?.id) {
        setSelectedChannelId(data.channel.id);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create web channel",
      );
    } finally {
      setIsCreatingChannel(false);
    }
  }

  async function handleSaveConfig() {
    if (!selectedBotId || !selectedChannelId) {
      toast.error("Select a web channel first");
      return;
    }

    setIsSavingConfig(true);
    try {
      const response = await fetch(
        `/api/bots/${selectedBotId}/channels/${selectedChannelId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: channelName.trim() || "Website Chat",
            config: {
              ...(selectedChannel?.config || {}),
              title,
              primaryColor,
              welcomeMessage,
              position,
            },
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save webchat config");
      }

      const siteResponse = await fetch(
        `/api/bots/${selectedBotId}/webchat-site`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: selectedChannelId,
            name: channelName.trim() || "Website Chat",
            allowedDomains: normalizedAllowedDomains,
            themeConfig: {
              title,
              primaryColor,
              welcomeMessage,
              position,
            },
          }),
        },
      );

      const siteData = await siteResponse.json();
      if (!siteResponse.ok) {
        throw new Error(siteData.error || "Failed to save webchat site");
      }

      toast.success("Webchat config saved");
      await loadChannels(selectedBotId);
      setSite(siteData.site || null);
      await loadWebchatDiagnostics(selectedBotId, selectedChannelId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save webchat config",
      );
    } finally {
      setIsSavingConfig(false);
    }
  }

  function handleAddAllowedDomains() {
    if (!allowedDomainsDraft.trim()) {
      toast.error("Enter at least one origin to add");
      return;
    }

    if (invalidDraftDomains.length > 0) {
      toast.error("Only valid origins can be added");
      return;
    }

    if (!normalizedDraftDomains.length) {
      toast.error("No valid origins found in the input");
      return;
    }

    setAllowedDomains((current) =>
      normalizeAllowedDomains([...current, ...normalizedDraftDomains]),
    );
    setAllowedDomainsDraft("");
  }

  function handleRemoveAllowedDomain(domain: string) {
    setAllowedDomains((current) => current.filter((entry) => entry !== domain));
  }

  function handleAddCurrentOrigin() {
    if (!normalizedDashboardOrigin) {
      toast.error("Current origin is unavailable");
      return;
    }

    setAllowedDomains((current) =>
      normalizeAllowedDomains([...current, normalizedDashboardOrigin]),
    );
  }

  async function handleRotateKey(keyType: "public" | "secret") {
    if (!selectedBotId || !selectedChannelId) {
      toast.error("Select a web channel first");
      return;
    }

    const rotatePublicKey = keyType === "public";
    const confirmMessage = rotatePublicKey
      ? "Rotate the public key? Existing embed snippets will stop working until they are updated."
      : "Rotate the secret key? Use the new value anywhere this site secret is stored.";

    const confirmed = await confirm({
      title: rotatePublicKey ? "Rotate Public Key" : "Rotate Secret Key",
      description: confirmMessage,
      confirmText: "Rotate",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    if (rotatePublicKey) {
      setIsRotatingPublicKey(true);
    } else {
      setIsRotatingSecretKey(true);
    }

    try {
      const response = await fetch(`/api/bots/${selectedBotId}/webchat-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: selectedChannelId,
          rotatePublicKey,
          rotateSecretKey: !rotatePublicKey,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to rotate key");
      }

      setSite(data.site || null);
      toast.success(
        rotatePublicKey
          ? "Public key rotated. Update any deployed embed snippets."
          : "Secret key rotated.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to rotate key",
      );
    } finally {
      if (rotatePublicKey) {
        setIsRotatingPublicKey(false);
      } else {
        setIsRotatingSecretKey(false);
      }
    }
  }

  async function copyValue(value: string, successMessage: string) {
    if (!value) {
      toast.error("Nothing to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error("Failed to copy value");
    }
  }

  async function handleLaunchTestWidget() {
    if (
      !selectedBotId ||
      !selectedChannelId ||
      !site?.publicKey ||
      !testWidgetUrl
    ) {
      toast.error("Save or load a webchat site first");
      return;
    }

    setIsLaunchingTestWidget(true);
    try {
      let launchAllowedDomains = normalizedAllowedDomains;

      if (
        normalizedAllowedDomains.length > 0 &&
        normalizedDashboardOrigin &&
        !normalizedAllowedDomains.includes(normalizedDashboardOrigin)
      ) {
        const nextAllowedDomains = normalizeAllowedDomains([
          ...normalizedAllowedDomains,
          normalizedDashboardOrigin,
        ]);

        const patchResponse = await fetch(
          `/api/bots/${selectedBotId}/webchat-site`,
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

        setSite(patchData.site || null);
        setAllowedDomains(
          Array.isArray(patchData.site?.allowedDomains)
            ? patchData.site.allowedDomains
            : nextAllowedDomains,
        );
        launchAllowedDomains = normalizeAllowedDomains(
          Array.isArray(patchData.site?.allowedDomains)
            ? patchData.site.allowedDomains
            : nextAllowedDomains,
        );
        toast.success("Current origin added to allowlist for test launch");
      }

      const params = new URLSearchParams({
        publicKey: site.publicKey,
        baseUrl: origin || "",
        title,
        primaryColor,
        position,
        welcomeMessage,
        siteName: site.name || channelName,
      });

      if (launchAllowedDomains.length) {
        params.set("allowedDomains", launchAllowedDomains.join(","));
      }

      const launchUrl = `/integrations/webchat/test?${params.toString()}`;
      const nextWindow = window.open(launchUrl, "_blank", "noopener");
      if (!nextWindow) {
        toast.error("Unable to open the test widget window");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to launch test widget",
      );
    } finally {
      setIsLaunchingTestWidget(false);
    }
  }

  async function copySnippet() {
    if (!embedSnippet) {
      toast.error("Select or create a web channel first");
      return;
    }

    try {
      await navigator.clipboard.writeText(embedSnippet);
      toast.success("Embed snippet copied");
    } catch {
      toast.error("Failed to copy snippet");
    }
  }

  async function copyLeadFormSnippet() {
    if (!leadFormSnippet) {
      toast.error("Save or load a webchat site first");
      return;
    }

    try {
      await navigator.clipboard.writeText(leadFormSnippet);
      toast.success("Lead form snippet copied");
    } catch {
      toast.error("Failed to copy lead form snippet");
    }
  }

  return (
    <div className="space-y-6">
      <ChannelPageHeader
        title="Webchat Widget"
        description="Generate your website chat and lead form snippets, then manage webchat channel, public key, and domain config."
      />

      <ChannelGuidanceCard
        title="Effective Response Mode"
        description="Active runtime behavior for webchat message handling."
        icon={Globe}
        bullets={[`${webchatEffectiveMode.title}: ${webchatEffectiveMode.description}`]}
      />

      <ChannelFlowAssignmentCard
        title="Channel Flow Assignment"
        description="Assign an active flow to the selected web channel. Channel assignment takes precedence over bot entry flow."
        selectLabel="Assigned Flow"
        selectId="webchatFlowSelect"
        flows={flows}
        isFlowsLoading={isFlowsLoading}
        selectedFlowId={selectedFlowId}
        onSelectFlow={setSelectedFlowId}
        selectDisabled={!selectedChannelId}
        assignedFlowName={assignedChannelFlow?.name}
        unassignedDescription="No channel flow is assigned. Bot entry flow or AI fallback applies."
        onAssign={() => void handleAssignFlowToChannel()}
        onUnassign={() => void handleUnassignFlowFromChannel()}
        isAssigning={isAssigningFlow}
        isUnassigning={isUnassigningFlow}
        assignDisabled={
          !selectedChannelId ||
          !selectedFlowId ||
          isAssigningFlow ||
          assignedChannelFlow?.id === selectedFlowId
        }
        unassignDisabled={
          !selectedChannelId || !assignedChannelFlow || isUnassigningFlow
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Setup
          </CardTitle>
          <CardDescription>
            Pick a bot, create/select a web channel, then copy the snippet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Bot</Label>
              {isBotsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading bots...
                </div>
              ) : (
                <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                  <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Web Channel</Label>
              {isChannelsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading channels...
                </div>
              ) : webChannels.length > 0 ? (
                <Select
                  value={selectedChannelId}
                  onValueChange={setSelectedChannelId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a web channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {webChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No web channel exists for this bot yet.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleCreateWebChannel}
                    disabled={!selectedBotId || isCreatingChannel}
                  >
                    {isCreatingChannel ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Create Web Channel
                  </Button>
                </div>
              )}
            </div>
          </div>

          {selectedBotId && selectedBotEntryFlow === null && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">
                  No entry flow assigned
                </p>
                <p className="text-amber-700 mt-0.5">
                  This bot has no entry flow set. Webchat messages will receive
                  AI fallback responses only — structured conversation flows
                  will not run.
                </p>
                <Link
                  href={`/bots/${selectedBotId}`}
                  className="text-amber-800 underline hover:text-amber-900 mt-1 block"
                >
                  Open bot settings to assign an entry flow →
                </Link>
              </div>
            </div>
          )}
          {selectedBotId && selectedBotEntryFlow && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-green-800">
                Entry flow configured. Structured flow execution is active for
                this bot.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="channelName">Channel Name</Label>
              <Input
                id="channelName"
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="widgetTitle">Widget Title</Label>
              <Input
                id="widgetTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <Input
                id="primaryColor"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Widget Position</Label>
              <Select
                value={position}
                onValueChange={(value: "left" | "right") => setPosition(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message</Label>
            <Textarea
              id="welcomeMessage"
              value={welcomeMessage}
              onChange={(event) => setWelcomeMessage(event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="publicKey">Public Key</Label>
              <Input
                id="publicKey"
                value={site?.publicKey || (isSiteLoading ? "Loading..." : "")}
                readOnly
              />
              <p className="text-sm text-muted-foreground">
                Use this in your embed snippet as `data-public-key`.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void copyValue(site?.publicKey || "", "Public key copied")
                  }
                  disabled={!site?.publicKey}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Public Key
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRotateKey("public")}
                  disabled={!site?.publicKey || isRotatingPublicKey}
                >
                  {isRotatingPublicKey ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Rotate Public Key
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteName">Site Record Name</Label>
              <Input id="siteName" value={site?.name || channelName} readOnly />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="secretKey">Secret Key</Label>
              <Input
                id="secretKey"
                type={isSecretVisible ? "text" : "password"}
                value={site?.secretKey || (isSiteLoading ? "Loading..." : "")}
                readOnly
              />
              <p className="text-sm text-muted-foreground">
                Keep this private. Rotate it if you suspect leakage or need to
                re-issue site credentials.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsSecretVisible((value) => !value)}
                disabled={!site?.secretKey}
              >
                {isSecretVisible ? (
                  <EyeOff className="mr-2 h-4 w-4" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                {isSecretVisible ? "Hide Secret" : "Reveal Secret"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  void copyValue(site?.secretKey || "", "Secret key copied")
                }
                disabled={!site?.secretKey}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Copy Secret Key
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleRotateKey("secret")}
                disabled={!site?.secretKey || isRotatingSecretKey}
              >
                {isRotatingSecretKey ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Rotate Secret Key
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowedDomains">Allowed Domains</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="allowedDomains"
                value={allowedDomainsDraft}
                onChange={(event) => setAllowedDomainsDraft(event.target.value)}
                placeholder="https://example.com, https://www.example.com"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddAllowedDomains}
                disabled={!selectedChannelId}
              >
                Add Domains
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddCurrentOrigin}
                disabled={!normalizedDashboardOrigin || !selectedChannelId}
              >
                Add Current Origin
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Add exact origins only. Stored values are normalized to scheme +
              host + port. Leave the list empty to allow any origin that passes
              global CORS rules.
            </p>
            {invalidDraftDomains.length ? (
              <p className="text-sm text-amber-700">
                Invalid entries will not be added:{" "}
                {invalidDraftDomains.join(", ")}
              </p>
            ) : null}
            {normalizedAllowedDomains.length ? (
              <div className="flex flex-wrap gap-2 rounded-lg border bg-slate-50 p-3">
                {normalizedAllowedDomains.map((domain) => (
                  <Badge
                    key={domain}
                    variant="secondary"
                    className="gap-2 px-3 py-1 text-xs"
                  >
                    <span>{domain}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAllowedDomain(domain)}
                      className="rounded-full p-0.5 hover:bg-slate-300/60"
                      aria-label={`Remove ${domain}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-muted-foreground">
                No site-level origins configured yet.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSaveConfig}
              disabled={!selectedChannelId || isSavingConfig}
            >
              {isSavingConfig ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Config
            </Button>

            <Button
              variant="outline"
              onClick={copySnippet}
              disabled={!selectedChannelId || isSiteLoading}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Embed Snippet
            </Button>

            <Button
              variant="outline"
              onClick={() => void handleLaunchTestWidget()}
              disabled={
                !selectedChannelId ||
                isSiteLoading ||
                !site?.publicKey ||
                isLaunchingTestWidget
              }
            >
              {isLaunchingTestWidget ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              {isLaunchingTestWidget ? "Launching..." : "Launch Test Widget"}
            </Button>
          </div>

          {site?.publicKey ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Launch opens an internal harness page that loads the real embed
                script with this site&apos;s public key.
              </p>
              <p>
                Rotating the public key invalidates existing embed snippets.
                Rotating the secret key does not change the public snippet, but
                any stored private credential must be updated.
              </p>
              {!canLaunchTestFromDashboard &&
              normalizedAllowedDomains.length ? (
                <p className="text-amber-700">
                  The current dashboard origin {origin || "(unknown)"} is not on
                  this site&apos;s allowlist. The harness will surface the same
                  blocked-origin behavior until you add this origin or test from
                  an allowed domain.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embed Snippet</CardTitle>
          <CardDescription>
            Paste this in your website HTML before the closing body tag. This
            snippet prefers your webchat public key when available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={
              embedSnippet ||
              "Select a bot and web channel to generate the embed snippet."
            }
            readOnly
            rows={10}
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead Form Snippet</CardTitle>
          <CardDescription>
            Paste this where you want a simple enquiry form. It submits to the
            public leads endpoint and triggers the same lead dashboard and
            notification flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void copyLeadFormSnippet()}
              disabled={!site?.publicKey}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Lead Form Snippet
            </Button>
          </div>
          <Textarea
            value={
              leadFormSnippet ||
              "Save or load a webchat site to generate the lead form snippet."
            }
            readOnly
            rows={18}
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostics</CardTitle>
          <CardDescription>
            Recent site activity, blocked origins, and rate-limit signals for
            the selected webchat site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm text-muted-foreground">Last Ping</p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {isDiagnosticsLoading
                  ? "Loading..."
                  : diagnostics?.lastPingAt
                    ? new Date(diagnostics.lastPingAt).toLocaleString()
                    : "No activity yet"}
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm text-muted-foreground">Blocked Origins</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {diagnostics?.blockedOriginCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm text-muted-foreground">Rate-Limit Events</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {diagnostics?.rateLimitCount ?? 0}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-900">
              Recent Errors
            </h3>
            {isDiagnosticsLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading diagnostics...
              </p>
            ) : diagnostics?.recentErrors?.length ? (
              <div className="space-y-2">
                {diagnostics.recentErrors.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {entry.reason.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.stage
                        ? `Stage: ${entry.stage}`
                        : "Stage unavailable"}
                    </p>
                    {entry.message ? (
                      <p className="mt-2 text-sm text-slate-700">
                        {entry.message}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No diagnostics events recorded for this site yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>
                Real-time preview of your widget style before embedding.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetPreview}>
              Reset Preview
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-96 rounded-lg border bg-slate-50 p-4 overflow-hidden">
            <div
              className={`absolute bottom-4 ${
                position === "left" ? "left-4" : "right-4"
              } w-[280px] max-w-[90%]`}
            >
              {isPreviewOpen && (
                <div className="overflow-hidden rounded-xl border bg-white shadow-xl">
                  <div
                    className="flex items-center justify-between px-3 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: previewColor }}
                  >
                    <span>{previewTitle}</span>
                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(false)}
                      className="rounded px-2 py-1 text-xs font-semibold hover:bg-black/15"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-2 bg-slate-100 p-3">
                    <div className="max-w-[85%] rounded-xl border bg-white px-3 py-2 text-sm text-slate-900">
                      {previewWelcomeMessage}
                    </div>
                    {previewMessages.map((message) => (
                      <div
                        key={message.id}
                        className={
                          message.role === "user"
                            ? "ml-auto max-w-[85%] rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"
                            : "max-w-[85%] rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                        }
                      >
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 border-t bg-white p-2">
                    <input
                      type="text"
                      value={previewDraft}
                      onChange={(event) => setPreviewDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handlePreviewSend();
                        }
                      }}
                      placeholder="Type your message..."
                      className="h-9 flex-1 rounded-md border bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handlePreviewSend}
                      className="h-9 rounded-md px-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: previewColor }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsPreviewOpen((value) => !value)}
                className={`mt-3 h-12 w-12 rounded-full text-sm font-semibold text-white shadow-lg flex items-center justify-center ${
                  position === "left" ? "mr-auto" : "ml-auto"
                }`}
                style={{ backgroundColor: previewColor }}
              >
                {isPreviewOpen ? "Hide" : "Chat"}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
