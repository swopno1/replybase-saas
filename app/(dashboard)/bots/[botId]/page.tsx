"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Settings, Share2, ArrowLeft, Loader2, Plus, MessageSquare, Globe, Bot, Calendar, Power, Trash2 } from "lucide-react";
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
import { WhatsAppConfig } from "@/components/channels/whatsapp-config";
import { TelegramConfig } from "@/components/channels/telegram-config";
import { FacebookConfig } from "@/components/channels/facebook-config";
import { WebchatConfig } from "@/components/channels/webchat-config";

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
  const [channelLimitStatus, setChannelLimitStatus] = useState<{allowed: boolean, current: number, limit: number, planName: string} | null>(null);

  // Sync tab and channel state to URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      let changed = false;

      if (activeTab === "general" && currentUrl.searchParams.has("tab")) {
        currentUrl.searchParams.delete("tab");
        changed = true;
      } else if (activeTab !== "general" && currentUrl.searchParams.get("tab") !== activeTab) {
        currentUrl.searchParams.set("tab", activeTab);
        changed = true;
      }

      if (!activeChannel && currentUrl.searchParams.has("channel")) {
        currentUrl.searchParams.delete("channel");
        changed = true;
      } else if (activeChannel && currentUrl.searchParams.get("channel") !== activeChannel) {
        currentUrl.searchParams.set("channel", activeChannel);
        changed = true;
      }

      if (changed) {
        window.history.replaceState(null, "", currentUrl.toString());
      }
    }
  }, [activeTab, activeChannel]);

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
      setChannelLimitStatus(data.channelLimitStatus || null);
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

    // Check if the selected flow is inactive
    if (formData.entryFlow) {
      const selectedFlow = flows.find(f => f.id === formData.entryFlow);
      if (selectedFlow && !selectedFlow.isActive) {
        const proceed = await confirm({
          title: "Inactive Flow Selected",
          description: `The flow "${selectedFlow.name}" is currently inactive. If you assign it, your bot may not respond to users until you activate the flow in the Flow Builder. Do you want to proceed anyway?`,
          confirmText: "Assign Anyway",
          cancelText: "Cancel",
          variant: "destructive"
        });
        if (!proceed) return;
      }
    }

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
    // For social channels, we don't create them immediately via the generic API 
    // because they require specific IDs (Page ID, Phone Number, Token).
    // Instead, we just open the configuration view.
    if (type !== "web") {
      setActiveChannel(type);
      return;
    }

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

        {activeChannel === "whatsapp" && <WhatsAppConfig botId={botId} channelLimitStatus={channelLimitStatus} />}
        {activeChannel === "telegram" && <TelegramConfig botId={botId} channelLimitStatus={channelLimitStatus} />}
        {activeChannel === "facebook" && <FacebookConfig botId={botId} channelLimitStatus={channelLimitStatus} />}
        {activeChannel === "web" && (
          <WebchatConfig 
            botId={botId} 
            channelId={bot.channels.find((c) => c.type === "web")?.id} 
            channelLimitStatus={channelLimitStatus} 
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 no-scrollbar">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{bot.name}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between border-b mb-6">
          <TabsList className="bg-transparent border-none p-0 h-auto">
            <TabsTrigger 
              value="general" 
              className="flex items-center gap-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-2"
            >
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger 
              value="channels" 
              className="flex items-center gap-1 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-4 py-2"
            >
              <Share2 className="h-4 w-4" />
              Channels
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2 pb-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              <Settings className="mr-2 h-4 w-4" />
              {editing ? "View Details" : "Edit Bot"}
            </Button>
          </div>
        </div>

        <TabsContent value="general" className="space-y-6 mt-0 w-full">
          <Card className="shadow-sm border-slate-200 w-full">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                <Bot className="h-5 w-5 text-indigo-500" />
                Bot Profile & Settings
              </CardTitle>
              <CardDescription>
                Manage your bot's core identity and default fallback behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {editing ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-semibold">Bot Name</Label>
                    <Input
                      value={formData?.name || ""}
                      onChange={(e) =>
                        setFormData((prev) =>
                          prev ? { ...prev, name: e.target.value } : null,
                        )
                      }
                      className="focus-visible:ring-indigo-500"
                    />
                  </div>

                  <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50/50">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold text-slate-800">Activation Status</Label>
                      <p className="text-sm text-slate-500">
                        Enable or disable all automated responses for this bot.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="bot-enabled" className="text-sm cursor-pointer">{formData?.status ? 'Active' : 'Paused'}</Label>
                      <input
                        type="checkbox"
                        id="bot-enabled"
                        checked={formData?.status ?? false}
                        onChange={(e) =>
                          setFormData((prev) =>
                            prev ? { ...prev, status: e.target.checked } : null,
                          )
                        }
                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 font-semibold">
                      Default Entry Flow
                    </Label>
                    <p className="text-xs text-slate-500 mb-2">
                      If no specific channel flow is assigned, the bot will use this flow. If none is set, it falls back to AI knowledge.
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
                      <SelectTrigger className="focus-visible:ring-indigo-500">
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

                  <div className="flex gap-3 pt-6 border-t">
                    <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Power className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Status</span>
                      </div>
                      <Badge variant={bot.enabled ? "secondary" : "outline"} className={`px-3 py-1 text-sm font-medium ${bot.enabled ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "text-slate-600"}`}>
                        {bot.enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Created On</span>
                      </div>
                      <p className="text-base font-medium text-slate-800">
                        {new Date(bot.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-start gap-2">
                      <div className="flex items-center gap-2 text-slate-500 mb-1">
                        <Share2 className="h-4 w-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Connected Channels</span>
                      </div>
                      <p className="text-base font-medium text-slate-800">
                        {bot.channels.length} Integration{bot.channels.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 rounded-xl p-6 border border-indigo-100/50">
                    <h3 className="text-sm font-semibold text-indigo-900 mb-1">Default Entry Flow</h3>
                    <p className="text-xs text-indigo-700/70 mb-4">
                      The default routing path when a conversation starts without a channel-specific assignment.
                    </p>
                    {bot.entryFlow ? (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-indigo-100 shadow-sm inline-flex">
                        <div className="bg-emerald-100 p-1.5 rounded-md">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        </div>
                        <span className="font-semibold text-slate-800 pr-2">
                          {flows.find((f) => f.id === bot.entryFlow)?.name ??
                            bot.entryFlow}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-lg border border-amber-100 inline-flex">
                        <div className="bg-amber-100 p-1.5 rounded-md">
                          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        </div>
                        <span className="font-medium text-amber-800 pr-2 text-sm">
                          No entry flow set. Bot uses AI fallback by default.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t mt-8">
                     <Button
                      variant="destructive"
                      className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none shadow-none"
                      onClick={handleDeleteBot}
                      disabled={deletingBot}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingBot ? "Deleting Bot..." : "Delete Bot Permanently"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">This action cannot be undone and will remove all associated channel settings.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="w-full">
          {activeChannel ? (
            renderChannelConfig()
          ) : (
            <div className="space-y-6 w-full">
              {/* Available Channels */}
              <Card className="shadow-sm border-slate-200 w-full">
                <CardHeader className="bg-slate-50/50 border-b pb-4 flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                      <Plus className="h-5 w-5 text-emerald-500" />
                      Available Integrations
                    </CardTitle>
                    <CardDescription>
                      Connect your bot to messaging platforms to start receiving messages.
                    </CardDescription>
                  </div>
                  {channelLimitStatus && (
                    <Badge variant="outline" className="px-3 py-1 bg-white shadow-sm font-medium text-slate-700">
                      {channelLimitStatus.current} / {channelLimitStatus.limit} Used
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {visibleChannelOptions.map((option) => {
                      const exists = bot.channels.some(
                        (channel) => channel.type === option.type,
                      );
                      
                      let Icon = Globe;
                      if (option.type === 'facebook') Icon = MessageSquare;
                      if (option.type === 'telegram') Icon = MessageSquare;
                      if (option.type === 'whatsapp') Icon = MessageSquare;
                      
                      return (
                        <Button
                          key={option.type}
                          variant={exists ? "secondary" : "outline"}
                          className={`h-auto py-4 flex flex-col items-center justify-center gap-3 transition-all ${exists ? 'bg-slate-100 opacity-70' : 'hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700'}`}
                          onClick={() => handleAddChannel(option.type)}
                          disabled={addingChannelType !== null || exists}
                        >
                          <Icon className={`h-6 w-6 ${exists ? 'text-slate-400' : 'text-slate-700'}`} />
                          <div className="space-y-1 text-center">
                            <p className="font-medium text-sm leading-none">{option.label}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {addingChannelType === option.type
                                ? `Adding...`
                                : exists
                                  ? `Connected`
                                  : option.type === 'web' 
                                    ? `Add Channel`
                                    : `Setup Channel`}
                            </p>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Configured Channels */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-indigo-500" />
                  Active Connections
                </h3>
                {bot.channels.length === 0 ? (
                  <Card className="border-dashed border-2 bg-slate-50/50 shadow-none">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <Share2 className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-base font-medium text-slate-700">No channels configured</p>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm">Connect a channel above to start routing messages through this bot.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {bot.channels.map((channel) => (
                      <Card key={channel.id} className="overflow-hidden shadow-sm border-slate-200 transition-all hover:shadow-md hover:border-slate-300 group">
                         <div className="p-5 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                {channel.type === 'web' ? <Globe className="h-5 w-5 text-indigo-600" /> : <MessageSquare className="h-5 w-5 text-indigo-600" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800">{channelLabel(channel.type)}</h4>
                                <p className="text-xs text-slate-500 truncate max-w-[150px]">{channel.name}</p>
                              </div>
                            </div>
                            <Badge variant={channel.isActive ? "secondary" : "outline"} className={`uppercase text-[10px] tracking-wider font-bold ${channel.isActive ? "bg-emerald-100 text-emerald-800 border-none" : "text-slate-500"}`}>
                              {channel.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-100">
                            <Button
                              size="sm"
                              className="flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-none"
                              onClick={() => setActiveChannel(channel.type as ChannelType)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Configure Settings
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                              onClick={() => handleRemoveChannel(channel.id, channel.type)}
                              disabled={deletingChannelId === channel.id}
                              title="Remove Channel"
                            >
                              {deletingChannelId === channel.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
