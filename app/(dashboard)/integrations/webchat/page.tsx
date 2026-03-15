"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Globe, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
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

type Bot = {
  id: string;
  name: string;
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
};

type PreviewMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
};

function buildPreviewReply(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("price") || normalized.includes("plan")) {
    return "We offer multiple plans depending on message volume and channel needs.";
  }

  if (normalized.includes("demo") || normalized.includes("trial")) {
    return "Yes. You can start with a guided setup flow and test the widget before rollout.";
  }

  if (normalized.includes("integrat") || normalized.includes("website")) {
    return "Integration is done with a single embed script plus your webchat channel ID.";
  }

  return "That is the kind of reply your live widget will show after your AI flow is configured.";
}

export default function WebchatIntegrationPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isBotsLoading, setIsBotsLoading] = useState(true);
  const [selectedBotId, setSelectedBotId] = useState("");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [isChannelsLoading, setIsChannelsLoading] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");

  const [channelName, setChannelName] = useState("Website Chat");
  const [title, setTitle] = useState("Chat with us");
  const [primaryColor, setPrimaryColor] = useState("#0f766e");
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Hi. How can I help you today?",
  );
  const [position, setPosition] = useState<"left" | "right">("right");

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(true);
  const [previewDraft, setPreviewDraft] = useState(
    "Can you help me choose the right plan?",
  );
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([
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
  ]);
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
      return;
    }
    void loadChannels(selectedBotId);
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

  const embedSnippet = useMemo(() => {
    if (!selectedChannelId) {
      return "";
    }

    const baseUrl = origin || "https://YOUR_REPLYBASE_DOMAIN";
    return `<script\n  src=\"${baseUrl}/embed/replybase-webchat.js\"\n  data-base-url=\"${baseUrl}\"\n  data-channel-id=\"${selectedChannelId}\"\n  data-title=\"${title.replace(/\"/g, "&quot;")}\"\n  data-primary-color=\"${primaryColor}\"\n  data-position=\"${position}\"\n  defer\n></script>`;
  }, [origin, position, primaryColor, selectedChannelId, title]);

  const previewColor = useMemo(() => {
    const hexColor = primaryColor.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(hexColor)) {
      return hexColor;
    }
    return "#0f766e";
  }, [primaryColor]);

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

      toast.success("Webchat config saved");
      await loadChannels(selectedBotId);
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Webchat Widget</h1>
        <p className="text-muted-foreground mt-1">
          Generate your website chat embed snippet and manage webchat channel
          config.
        </p>
      </div>

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
              disabled={!selectedChannelId}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy Embed Snippet
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embed Snippet</CardTitle>
          <CardDescription>
            Paste this in your website HTML before the closing body tag.
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
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>
            Real-time preview of your widget style before embedding.
          </CardDescription>
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
