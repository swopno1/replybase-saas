"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ChannelConfig {
  id: string;
  displayName: string;
  description: string;
  enabled: boolean;
  tenantEnabled: boolean;
  systemEnabled: boolean;
}

interface ChannelStatus {
  facebook: boolean;
  telegram: boolean;
  webchat: boolean;
  whatsapp: boolean;
}

const CHANNEL_INFO: Record<string, { icon: string; color: string }> = {
  facebook: { icon: "f", color: "bg-blue-500" },
  telegram: { icon: "✈", color: "bg-cyan-500" },
  webchat: { icon: "◆", color: "bg-green-500" },
  whatsapp: { icon: "W", color: "bg-green-600" },
};

export function ChannelsClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [status, setStatus] = useState<ChannelStatus>({
    facebook: false,
    telegram: true,
    webchat: true,
    whatsapp: false,
  });

  // Fetch channel configurations
  useEffect(() => {
    async function fetchChannels() {
      try {
        const response = await fetch("/api/tenant/channels");
        if (!response.ok) throw new Error("Failed to fetch channels");

        const data = await response.json();

        // Build channel list
        const channelList: ChannelConfig[] = [
          {
            id: "facebook",
            displayName: "Facebook Messenger",
            description:
              "Meta Facebook Messenger integration (currently disabled due to verification failure)",
            enabled: data.tenant.facebook,
            tenantEnabled: data.tenantOnly.facebook,
            systemEnabled: data.systemLevel.facebook,
          },
          {
            id: "telegram",
            displayName: "Telegram",
            description: "Telegram Bot integration",
            enabled: data.tenant.telegram,
            tenantEnabled: data.tenantOnly.telegram,
            systemEnabled: data.systemLevel.telegram,
          },
          {
            id: "webchat",
            displayName: "Web Chat",
            description: "Embedded webchat widget for websites",
            enabled: data.tenant.webchat,
            tenantEnabled: data.tenantOnly.webchat,
            systemEnabled: data.systemLevel.webchat,
          },
          {
            id: "whatsapp",
            displayName: "WhatsApp",
            description: "WhatsApp Business API integration",
            enabled: data.tenant.whatsapp,
            tenantEnabled: data.tenantOnly.whatsapp,
            systemEnabled: data.systemLevel.whatsapp,
          },
        ];

        setChannels(channelList);
        setStatus({
          facebook: data.tenantOnly.facebook,
          telegram: data.tenantOnly.telegram,
          webchat: data.tenantOnly.webchat,
          whatsapp: data.tenantOnly.whatsapp,
        });
      } catch (error) {
        console.error("Failed to fetch channels:", error);
        toast.error("Failed to load channel settings");
      } finally {
        setLoading(false);
      }
    }

    fetchChannels();
  }, []);

  const handleChannelToggle = async (
    channelId: keyof ChannelStatus,
    checked: boolean,
  ) => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel || !channel.systemEnabled) {
      toast.error("This channel cannot be enabled at the system level");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tenant/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [channelId]: checked,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update channel");
      }

      setStatus((prev) => ({
        ...prev,
        [channelId]: checked,
      }));

      toast.success(
        `${channel.displayName} has been ${checked ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      console.error("Failed to update channel:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update channel settings",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className="flex items-start justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start gap-4 flex-1">
            <div className="mt-0.5">
              <div
                className={`w-10 h-10 rounded-lg ${CHANNEL_INFO[channel.id]?.color || "bg-gray-500"} flex items-center justify-center text-white font-semibold text-sm`}
              >
                {CHANNEL_INFO[channel.id]?.icon || "?"}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold">{channel.displayName}</h4>
                {channel.systemEnabled ? (
                  <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Available
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                    <AlertCircle className="h-3 w-3" />
                    System Disabled
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {channel.description}
              </p>
            </div>
          </div>

          <div className="ml-4 flex items-center gap-3">
            <Checkbox
              checked={status[channel.id as keyof ChannelStatus]}
              onCheckedChange={(checked) =>
                handleChannelToggle(
                  channel.id as keyof ChannelStatus,
                  checked as boolean,
                )
              }
              disabled={!channel.systemEnabled || saving}
              className="mt-0.5"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
