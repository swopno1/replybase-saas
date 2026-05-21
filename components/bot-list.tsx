"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isChannelVisibleInUi, type ChannelId } from "@/lib/channel-config";

interface Bot {
  id: string;
  name: string;
  primaryChannel: string;
  channels: Array<{
    id: string;
    type: string;
    name: string;
    enabled: boolean;
    isActive: boolean;
  }>;
  status: boolean;
  createdAt: string;
}

interface LimitStatus {
  allowed: boolean;
  limit: number;
  current: number;
  planName: string;
}

export function BotList() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBots = async () => {
      try {
        const res = await fetch("/api/bots");
        const data = await res.json();
        setBots(data.bots || []);
        setLimitStatus(data.limitStatus || null);
      } catch (error) {
        console.error("Failed to fetch bots:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBots();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  const toLabel = (value: string) => {
    const val = value.toLowerCase();
    if (val === "web" || val === "webchat") return "Web";
    if (val === "whatsapp") return "WhatsApp";
    if (val === "facebook") return "Facebook";
    if (val === "telegram") return "Telegram";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const isChannelVisible = (type: string) => {
    const channelId = type.toLowerCase() === "web" ? "webchat" : type.toLowerCase();
    if (["facebook", "telegram", "webchat", "whatsapp"].includes(channelId)) {
      return isChannelVisibleInUi(channelId as ChannelId);
    }
    return false;
  };

  const isLimitReached = limitStatus ? !limitStatus.allowed : false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Your Bots</h3>
          {limitStatus && (
            <span className="text-sm text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">
              {limitStatus.current} / {limitStatus.limit} Bots
            </span>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  size="sm"
                  asChild={!isLimitReached}
                  disabled={isLimitReached}
                >
                  {isLimitReached ? (
                    <span>
                      <Plus className="mr-2 h-4 w-4" />
                      New Bot
                    </span>
                  ) : (
                    <Link href="/bots/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New Bot
                    </Link>
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {isLimitReached && (
              <TooltipContent>
                <p>Limit reached ({limitStatus?.current}/{limitStatus?.limit} bots). Upgrade your {limitStatus?.planName} plan to create more.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLimitReached && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Bot Limit Reached</p>
            <p className="text-sm text-amber-700">
              You have reached the maximum of {limitStatus?.limit} bots for your {limitStatus?.planName} plan.
              <Link href="/settings?tab=billing" className="ml-1 underline font-semibold">
                Upgrade your plan
              </Link> to create more bots.
            </p>
          </div>
        </div>
      )}

      {bots.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-600 mb-4">
            No bots yet. Create one to get started.
          </p>
          {!isLimitReached && (
            <Link href="/bots/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Bot
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {bots.map((bot) => (
            <Link key={bot.id} href={`/bots/${bot.id}`}>
              <div className="border rounded p-4 hover:bg-gray-50 cursor-pointer">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{bot.name}</p>
                    <p className="text-sm text-gray-600">
                      Primary:{" "}
                      {!isChannelVisible(bot.primaryChannel)
                        ? "Legacy"
                        : toLabel(bot.primaryChannel)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {bot.channels
                        .filter(
                          (channel) =>
                            isChannelVisible(channel.type),
                        )
                        .map((channel) => (
                          <span
                            key={channel.id}
                            className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {toLabel(channel.type)}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        bot.status
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {bot.status ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
