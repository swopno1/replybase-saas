"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Settings, Share2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function isBotChannelVisible(channelType: string): boolean {
  if (channelType === "web") return isChannelVisibleInUi("webchat");
  if (["telegram", "facebook", "whatsapp"].includes(channelType)) return isChannelVisibleInUi(channelType as any /* eslint-disable-line @typescript-eslint/no-explicit-any */);
  return true;
}

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { alert, confirm } = useConfirmation();
  const botId = params.botId as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [editing, setEditing] = useState(false);
  const [deletingBot, setDeletingBot] = useState(false);
  const [formData, setFormData] = useState<BotFormData | null>(null);
  const [limitStatus, setLimitStatus] = useState<{ allowed: boolean; limit: number } | null>(null);
  const [channelLimitStatus, setChannelLimitStatus] = useState<{ allowed: boolean; limit: number } | null>(null);

  const initialTab = searchParams.get("tab") || "general";
  const initialChannel = searchParams.get("channel") || null;
  const [activeChannelTab, setActiveChannelTab] = useState<string | null>(initialChannel);

  const fetchBot = async () => {
    try {
      const res = await fetch(`/api/bots/${botId}`);
      const data = await res.json();
      setBot(data.bot);
      setFormData({
        name: data.bot.name,
        status: data.bot.enabled,
        entryFlow: data.bot.entryFlow ?? null,
      });
    } catch (error) {
      console.error("Failed to fetch bot:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlows = async () => {
    try {
      const res = await fetch("/api/flows?type=my");
      const data = await res.json();
      setFlows(Array.isArray(data.flows) ? data.flows : []);
    } catch (error) {
      console.error("Failed to fetch flows:", error);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch(`/api/bots/${botId}/channels`);
      const data = await res.json();
      setChannelLimitStatus(data.limitStatus);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    }
  };

  useEffect(() => {
    if (botId) {
      setTimeout(() => {
        void fetchBot();
        void fetchFlows();
        void fetchChannels();
      }, 0);
    }
  }, [botId]);

  const handleSave = async () => {
    if (!formData) return;
    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          enabled: formData.status,
          entryFlowId: formData.entryFlow,
        }),
      });
      if (!res.ok) throw new Error("Failed to update bot");
      await fetchBot();
      setEditing(false);
    } catch (error) {
      await alert({ title: "Error", description: "Failed to save bot changes." });
    }
  };

  const handleDeleteBot = async () => {
    if (!bot || deletingBot) return;
    const confirmed = await confirm({
      title: "Delete Bot",
      description: `Delete bot "${bot.name}"? This removes its channels, webchat sites, and execution logs.`,
      confirmText: "Delete Bot",
      variant: "destructive",
    });
    if (!confirmed) return;

    setDeletingBot(true);
    try {
      const response = await fetch(`/api/bots/${botId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete bot");
      router.push("/bots");
      router.refresh();
    } catch (error) {
      await alert({ title: "Failed to Delete Bot", description: "Please try again.", variant: "destructive" });
      setDeletingBot(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!bot) return <div className="p-8">Bot not found</div>;

  const visibleChannelOptions = CHANNEL_OPTIONS.filter((option) => isBotChannelVisible(option.type));

  return (
    <div className="max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{bot.name}</h1>
        <div className="flex items-center gap-2">
          {!editing && (
            <Button variant="outline" onClick={() => setEditing(true)}>Edit Bot</Button>
          )}
          <Button variant="destructive" onClick={() => void handleDeleteBot()} disabled={deletingBot}>
            {deletingBot ? "Deleting..." : "Delete Bot"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger value="channels" className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Channels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6 space-y-6">
          <div className="border rounded-lg p-6 space-y-6 bg-white">
            {editing ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="botName">Bot Name</Label>
                  <Input id="botName" value={formData?.name || ""} onChange={(e) => setFormData(prev => prev ? { ...prev, name: e.target.value } : null)} />
                </div>
                <div className="flex items-center gap-2">
                  <input id="botStatus" type="checkbox" checked={formData?.status ?? false} onChange={(e) => setFormData(prev => prev ? { ...prev, status: e.target.checked } : null)} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <Label htmlFor="botStatus">Enabled</Label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="entryFlow">Entry Flow (Webchat)</Label>
                  <Select value={formData?.entryFlow ?? "__none__"} onValueChange={(value) => setFormData(prev => prev ? { ...prev, entryFlow: value === "__none__" ? null : value } : null)}>
                    <SelectTrigger id="entryFlow"><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (AI fallback only)</SelectItem>
                      {flows.map((flow) => <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave}>Save Changes</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 py-2 border-b">
                  <span className="text-muted-foreground font-medium">Status</span>
                  <div className="col-span-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${bot.enabled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {bot.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 py-2 border-b">
                  <span className="text-muted-foreground font-medium">Entry Flow</span>
                  <div className="col-span-2">
                    {bot.entryFlow ? <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /><span>{flows.find(f => f.id === bot.entryFlow)?.name || "Assigned"}</span></div> : <span className="text-amber-600">No entry flow set</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 py-2">
                  <span className="text-muted-foreground font-medium">Created</span>
                  <span className="col-span-2">{new Date(bot.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="channels" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-1 space-y-1">
              {visibleChannelOptions.map((option) => (
                <Button key={option.type} variant={activeChannelTab === option.type ? "secondary" : "ghost"} className="w-full justify-start font-normal" onClick={() => setActiveChannelTab(option.type)}>
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="md:col-span-3">
              {!activeChannelTab ? (
                <div className="border rounded-lg border-dashed p-12 text-center bg-white">
                  <Share2 className="h-12 w-12 mx-auto mb-4 opacity-10" />
                  <p className="text-muted-foreground">Select a channel to configure integration settings.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeChannelTab === "whatsapp" && <WhatsAppConfig botId={botId} channelLimitStatus={channelLimitStatus} />}
                  {activeChannelTab === "telegram" && <TelegramConfig botId={botId} channelLimitStatus={channelLimitStatus} />}
                  {activeChannelTab === "facebook" && <FacebookConfig botId={botId} channelLimitStatus={channelLimitStatus} />}
                  {(activeChannelTab === "web" || activeChannelTab === "webchat") && <WebchatConfig botId={botId} />}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
