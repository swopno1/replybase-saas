"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { isChannelVisibleInUi, type ChannelId } from "@/lib/channel-config";

export const dynamic = 'force-dynamic';

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
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function channelConfigHref(type: string) {
  if (type === "web") return "/integrations/webchat";
  if (type === "telegram") return "/integrations/telegram";
  if (type === "facebook") return "/integrations/facebook";
  return null;
}

function isBotChannelVisible(channelType: string): boolean {
  if (channelType === "web") {
    return isChannelVisibleInUi("webchat");
  }

  if (
    channelType === "telegram" ||
    channelType === "facebook" ||
    channelType === "whatsapp"
  ) {
    return isChannelVisibleInUi(channelType as ChannelId);
  }

  return true;
}

export default function BotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [addingChannelType, setAddingChannelType] =
    useState<ChannelType | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [editing, setEditing] = useState(false);
  const [deletingBot, setDeletingBot] = useState(false);
  const [formData, setFormData] = useState<BotFormData | null>(null);
  const visibleChannelOptions = CHANNEL_OPTIONS.filter((option) =>
    isBotChannelVisible(option.type),
  );
  const visibleBotChannels = bot?.channels.filter((channel) =>
    isBotChannelVisible(channel.type),
  );

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

  useEffect(() => {
    void fetchBot();
    void fetchFlows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const handleAddChannel = async (type: ChannelType) => {
    if (!bot) {
      return;
    }

    setAddingChannelType(type);
    try {
      const payload: {
        type: ChannelType;
        name: string;
        channelId?: string;
      } = {
        type,
        name: `${channelLabel(type)} Channel`,
      };

      if (type !== "web") {
        payload.channelId = `${type}-${bot.id.slice(0, 8)}`;
      }

      const response = await fetch(`/api/bots/${botId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create channel");
      }

      await fetchBot();
    } catch (error) {
      console.error("Failed to add channel:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to add channel. Please try again.",
      );
    } finally {
      setAddingChannelType(null);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          enabled: formData.status,
          entryFlow: formData.entryFlow,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBot((previous) =>
          previous
            ? {
                ...previous,
                ...updated.bot,
              }
            : updated.bot,
        );
        setEditing(false);
      }
    } catch (error) {
      console.error("Failed to update bot:", error);
    }
  };

  const handleRemoveChannel = async (
    channelId: string,
    channelType: string,
  ) => {
    if (!bot) {
      return;
    }

    const confirmed = window.confirm(
      `Remove ${channelLabel(channelType)} channel from this bot?`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingChannelId(channelId);
    try {
      const response = await fetch(`/api/bots/${botId}/channels/${channelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete channel");
      }

      await fetchBot();
    } catch (error) {
      console.error("Failed to remove channel:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to remove channel. Please try again.",
      );
    } finally {
      setDeletingChannelId(null);
    }
  };

  const handleDeleteBot = async () => {
    if (!bot || deletingBot) {
      return;
    }

    const confirmed = window.confirm(
      `Delete bot \"${bot.name}\"? This removes its channels, webchat sites, and execution logs. Existing conversation history will be detached from the bot reference.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingBot(true);
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete bot");
      }

      router.push("/bots");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete bot:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete bot. Please try again.",
      );
      setDeletingBot(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!bot) return <div>Bot not found</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">{bot.name}</h1>

      <div className="border rounded-lg p-6 space-y-4">
        {editing ? (
          <>
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

            <div>
              <Label className="block text-sm font-medium mb-1">Status</Label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData?.status ?? false}
                  onChange={(e) =>
                    setFormData((prev) =>
                      prev ? { ...prev, status: e.target.checked } : null,
                    )
                  }
                />
                <span>Enabled</span>
              </label>
            </div>

            <div>
              <Label className="block text-sm font-medium mb-1">
                Entry Flow
              </Label>
              <p className="text-xs text-gray-500 mb-2">
                The first flow that runs when a user sends a message via
                webchat. Without one, only AI responds.
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
              {flows.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  No flows yet.{" "}
                  <Link href="/flows" className="text-blue-600 hover:underline">
                    Create one in Flows →
                  </Link>
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Save Changes</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm text-gray-600">Channels</p>
              <div className="mt-2 mb-3 flex flex-wrap gap-2">
                {visibleChannelOptions.map((option) => {
                  const exists = bot.channels.some(
                    (channel) => channel.type === option.type,
                  );
                  return (
                    <Button
                      key={option.type}
                      size="sm"
                      variant="outline"
                      onClick={() => void handleAddChannel(option.type)}
                      disabled={exists || addingChannelType !== null}
                    >
                      {addingChannelType === option.type
                        ? `Adding ${option.label}...`
                        : exists
                          ? `${option.label} Added`
                          : `Add ${option.label}`}
                    </Button>
                  );
                })}
              </div>
              {visibleBotChannels?.length === 0 ? (
                <p className="font-medium">No channels configured</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {visibleBotChannels?.map((channel) => {
                    const href = channelConfigHref(channel.type);
                    return (
                      <div
                        key={channel.id}
                        className="rounded border px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">
                            {channelLabel(channel.type)}
                          </p>
                          <div className="flex items-center gap-3">
                            {href ? (
                              <Link
                                href={href}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                Configure
                              </Link>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                void handleRemoveChannel(
                                  channel.id,
                                  channel.type,
                                )
                              }
                              disabled={deletingChannelId === channel.id}
                              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
                            >
                              {deletingChannelId === channel.id
                                ? "Removing..."
                                : "Remove"}
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">{channel.name}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span
                className={`inline-block px-2 py-1 rounded text-sm ${
                  bot.enabled
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {bot.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">Entry Flow</p>
              <p className="text-xs text-gray-500 mb-3">
                When a user sends a message via webchat, ReplyBase runs this
                flow first. If no flow is set, only the AI fallback responds.
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
                    No entry flow set. Webchat messages will receive AI fallback
                    responses only.
                  </span>
                </div>
              )}
              <Link
                href="/flows"
                className="text-xs text-blue-600 hover:underline mt-2 block"
              >
                Manage flows →
              </Link>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteBot()}
                disabled={deletingBot}
              >
                {deletingBot ? "Deleting..." : "Delete Bot"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
