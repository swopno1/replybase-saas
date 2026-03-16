"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Bot {
  id: string;
  name: string;
  enabled: boolean;
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

export default function BotDetailPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingChannelType, setAddingChannelType] = useState<ChannelType | null>(
    null,
  );
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<BotFormData | null>(null);

  const fetchBot = async () => {
    try {
      const res = await fetch(`/api/bots/${botId}`);
      const data = await res.json();
      setBot(data.bot);
      setFormData({
        name: data.bot.name,
        status: data.bot.enabled,
      });
    } catch (error) {
      console.error("Failed to fetch bot:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBot();
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

  if (loading) return <div>Loading...</div>;
  if (!bot) return <div>Bot not found</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">{bot.name}</h1>

      <div className="border rounded-lg p-6 space-y-4">
        {editing ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Bot Name</label>
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
              <label className="block text-sm font-medium mb-1">Status</label>
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
                {CHANNEL_OPTIONS.map((option) => {
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
              {bot.channels.length === 0 ? (
                <p className="font-medium">No channels configured</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {bot.channels.map((channel) => {
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
                          {href ? (
                            <Link
                              href={href}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Configure
                            </Link>
                          ) : null}
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

            <div className="pt-4">
              <h3 className="font-medium mb-4">Flow Builder</h3>
              <p className="text-gray-600 text-sm mb-4">
                Visual flow builder coming soon. For now, configure your bot via
                API or webhooks.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="destructive">Delete Bot</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
