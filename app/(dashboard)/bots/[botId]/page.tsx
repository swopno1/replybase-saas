"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Settings, Share2, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isChannelVisibleInUi } from "@/lib/channel-config";
import { useConfirmation } from "@/components/ui/confirmation-provider";
import { WhatsAppConfig } from "@/components/channels/WhatsAppConfig";
import { TelegramConfig } from "@/components/channels/TelegramConfig";
import { FacebookConfig } from "@/components/channels/FacebookConfig";
import { WebchatConfig } from "@/components/channels/WebchatConfig";

export const dynamic = "force-dynamic";

interface Bot {
  id: string;
  name: string;
  enabled: boolean;
  entryFlow: string | null;
  createdAt: string;
  channels: Array<{
    id: string;
    type: string;
    name: string;
    enabled: boolean;
    isActive: boolean;
  }>;
}

interface BotFormData {
  name: string;
  status: boolean;
  entryFlow: string | null;
}

interface Flow {
  id: string;
  name: string;
  isActive: boolean;
}

type ChannelType = "web" | "telegram" | "facebook" | "whatsapp";

const CHANNEL_OPTIONS: Array<{
  type: ChannelType;
  label: string;
}> = [
  { type: "web", label: "Webchat" },
  { type: "telegram", label: "Telegram" },
  { type: "facebook", label: "Facebook" },
  { type: "whatsapp", label: "WhatsApp" },
];

function channelLabel(type: string) {
  if (type === "web") return "Webchat";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function BotDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, confirm } = useConfirmation();
  const botId = params.botId as string;

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "general");
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(
    (searchParams.get("channel") as ChannelType) || null
  );

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [addingChannelType, setAddingChannelType] =
    useState<ChannelType | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<BotFormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingBot, setDeletingBot] = useState(false);

  useEffect(() => {
    if (!botId) return;
    void loadBot();
    void loadFlows();
  }, [botId]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);

    const channel = searchParams.get("channel") as ChannelType;
    if (channel) setActiveChannel(channel);
  }, [searchParams]);

  const loadBot = async () => {
    try {
      const response = await fetch(`/api/bots/${botId}`);
      if (!response.ok) throw new Error("Failed to fetch bot");
      const data = await response.json();
      setBot(data.bot);
      setFormData({
        name: data.bot.name,
        status: data.bot.enabled,
        entryFlow: data.bot.entryFlow,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadFlows = async () => {
    try {
      const response = await fetch("/api/flows");
      if (!response.ok) throw new Error("Failed to fetch flows");
      const data = await response.json();
      setFlows(data.flows || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (!formData || saving) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          enabled: formData.status,
          entryFlow: formData.entryFlow,
        }),
      });
      if (!response.ok) throw new Error("Failed to update bot");
      await loadBot();
      setEditing(false);
    } catch (error) {
      console.error(error);
      await alert({
        title: "Error",
        description: "Failed to save bot changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddChannel = async (type: ChannelType) => {
    setAddingChannelType(type);
    try {
      const response = await fetch(`/api/bots/${botId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: `${channelLabel(type)} Channel`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add channel");
      }

      await loadBot();
      setActiveChannel(type);
    } catch (error) {
      console.error(error);
      await alert({
        title: "Failed to Add Channel",
        description: error instanceof Error ? error.message : "Try again later",
        variant: "destructive",
      });
    } finally {
      setAddingChannelType(null);
    }
  };

  const handleRemoveChannel = async (id: string, type: string) => {
    const confirmed = await confirm({
      title: "Remove Channel",
      description: `Are you sure you want to remove the ${channelLabel(type)} channel? This will delete its configuration.`,
      confirmText: "Remove",
      variant: "destructive",
    });

    if (!confirmed) return;

    setDeletingChannelId(id);
    try {
      const response = await fetch(`/api/bots/${botId}/channels/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove channel");
      }

      if (activeChannel === type) {
        setActiveChannel(null);
      }
      await loadBot();
    } catch (error) {
      console.error(error);
      await alert({
        title: "Error",
        description: "Failed to remove channel",
        variant: "destructive",
      });
    } finally {
      setDeletingChannelId(null);
    }
  };

  const handleDeleteBot = async () => {
    if (!bot || deletingBot) return;

    const confirmed = await confirm({
      title: "Delete Bot",
      description: `Delete bot \"${bot.name}\"? This removes its channels, webchat sites, and execution logs.`,
      confirmText: "Delete Bot",
      variant: "destructive",
    });

    if (!confirmed) return;

    setDeletingBot(true);
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete bot");

      router.push("/bots");
    } catch (error) {
      console.error(error);
      await alert({
        title: "Error",
        description: "Failed to delete bot",
        variant: "destructive",
      });
      setDeletingBot(false);
    }
  };

  const visibleChannelOptions = CHANNEL_OPTIONS.filter((opt) => {
    if (opt.type === "web") return isChannelVisibleInUi("webchat");
    return isChannelVisibleInUi(opt.type);
  });

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2" /> Loading...</div>;
  if (!bot) return <div className="p-8">Bot not found</div>;

  const renderChannelConfig = () => {
    if (!activeChannel) return null;

    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveChannel(null)}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Channels
        </Button>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{channelLabel(activeChannel)} Configuration</h2>
        </div>

        {activeChannel === "whatsapp" && <WhatsAppConfig botId={botId} />}
        {activeChannel === "telegram" && <TelegramConfig botId={botId} />}
        {activeChannel === "facebook" && <FacebookConfig botId={botId} />}
        {activeChannel === "web" && <WebchatConfig botId={botId} />}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{bot.name}</h1>
        <div className="flex gap-2">
           <Button variant="outline" onClick={() => setEditing(!editing)}>
            <Settings className="mr-2 h-4 w-4" />
            {editing ? "View Details" : "Edit Bot"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="general" className="flex items-center gap-1">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-1">
            <Share2 className="h-4 w-4" />
            Channels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="border rounded-lg p-6 space-y-6 bg-white shadow-sm">
            {editing ? (
              <>
                <div className="space-y-4">
                  <div>
                    <Label className="block text-sm font-medium mb-1">Bot Name</Label>
                    <Input
                      value={formData?.name || ""}
                      onChange={(e) =>
                        setFormData((prev) =>
                          prev ? { ...prev, name: e.target.value } : null,
                        )
                      }
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="bot-enabled"
                      checked={formData?.status ?? false}
                      onChange={(e) =>
                        setFormData((prev) =>
                          prev ? { ...prev, status: e.target.checked } : null,
                        )
                      }
                    />
                    <Label htmlFor="bot-enabled">Enabled</Label>
                  </div>

                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      Entry Flow
                    </Label>
                    <p className="text-xs text-gray-500 mb-2">
                      Default flow for webchat or when no channel flow is assigned.
                    </p>
                    <Select
                      value={formData?.entryFlow ?? "__none__"}
                      onValueChange={(value) =>
                        setFormData((prev) =>
                          prev
                            ? {
                                ...prev,
                                entryFlow: value === "__none__" ? null : value,
                              }
                            : null,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None (AI fallback only)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          None (AI fallback only)
                        </SelectItem>
                        {flows.map((flow) => (
                          <SelectItem key={flow.id} value={flow.id}>
                            {flow.name}
                            {!flow.isActive ? " (inactive)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={bot.enabled ? "secondary" : "outline"} className={bot.enabled ? "bg-green-100 text-green-800 border-none" : ""}>
                      {bot.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium text-sm">
                      {new Date(bot.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Default Entry Flow</p>
                  <p className="text-xs text-gray-500 mb-3">
                    If no specific channel flow is assigned, ReplyBase uses this.
                  </p>
                  {bot.entryFlow ? (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="font-medium">
                        {flows.find((f) => f.id === bot.entryFlow)?.name ??
                          bot.entryFlow}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-amber-700">
                        No entry flow set. Bot uses AI fallback by default.
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-8 border-t">
                   <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteBot}
                    disabled={deletingBot}
                  >
                    {deletingBot ? "Deleting..." : "Delete Bot"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="channels">
          {activeChannel ? (
            renderChannelConfig()
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Available Channels</CardTitle>
                  <CardDescription>
                    Add channels to connect this bot to different platforms.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {visibleChannelOptions.map((option) => {
                      const exists = bot.channels.some(
                        (channel) => channel.type === option.type,
                      );
                      return (
                        <Button
                          key={option.type}
                          variant="outline"
                          onClick={() => handleAddChannel(option.type)}
                          disabled={exists || addingChannelType !== null}
                        >
                          {addingChannelType === option.type
                            ? `Adding...`
                            : exists
                              ? `${option.label} (Added)`
                              : `Add ${option.label}`}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="font-semibold px-1 text-lg">Configured Channels</h3>
                {bot.channels.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1 italic">No channels configured yet.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {bot.channels.map((channel) => (
                      <Card key={channel.id} className="overflow-hidden shadow-sm">
                         <div className="p-4 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold">{channelLabel(channel.type)}</h4>
                            <Badge variant={channel.isActive ? "secondary" : "outline"} className={channel.isActive ? "bg-green-50 text-green-700 border-green-100" : ""}>
                              {channel.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-4 truncate">{channel.name}</p>
                          <div className="flex items-center gap-2 mt-auto pt-2">
                            <Button
                              size="sm"
                              className="flex-1"
                              onClick={() => setActiveChannel(channel.type as ChannelType)}
                            >
                              Configure
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRemoveChannel(channel.id, channel.type)}
                              disabled={deletingChannelId === channel.id}
                            >
                              {deletingChannelId === channel.id ? "..." : "Remove"}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function BotDetailPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading bot details...</div>}>
      <BotDetailContent />
    </Suspense>
  );
}
