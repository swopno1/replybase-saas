"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isChannelVisibleInUi, type ChannelId } from "@/lib/channel-config";
import { useConfirmation } from "@/components/ui/confirmation-provider";

export const dynamic = "force-dynamic";

type BotChannelType = "web" | "telegram" | "facebook" | "whatsapp";

interface LimitStatus {
  allowed: boolean;
  limit: number;
  current: number;
  planName: string;
}

function isBotChannelVisible(channel: BotChannelType): boolean {
  if (channel === "web") {
    return isChannelVisibleInUi("webchat");
  }

  return isChannelVisibleInUi(channel as ChannelId);
}

function CreateBotContent() {
  const router = useRouter();
  const { alert } = useConfirmation();
  const [loading, setLoading] = useState(false);
  const [checkingLimits, setCheckingLimits] = useState(true);
  const [limitStatus, setLimitStatus] = useState<LimitStatus | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    channel: "web" as BotChannelType,
    context: "",
  });

  useEffect(() => {
    async function checkLimits() {
      try {
        const res = await fetch("/api/bots");
        const data = await res.json();
        if (data.limitStatus) {
          setLimitStatus(data.limitStatus);
        }
      } catch (error) {
        console.error("Failed to check bot limits:", error);
      } finally {
        setCheckingLimits(false);
      }
    }
    checkLimits();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.name.trim()) {
        await alert({
          title: "Bot Name Required",
          description: "Please enter a bot name before creating the bot.",
        });
        setLoading(false);
        return;
      }

      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          channel: formData.channel,
          context: formData.context || "",
        }),
      });

      if (response.ok) {
        await response.json();
        await alert({
          title: "Bot Created",
          description: "Your bot was created successfully.",
        });
        router.push("/bots");
      } else {
        const error = await response.json();
        await alert({
          title: "Failed to Create Bot",
          description: `Failed to create bot: ${error.details || error.error || "Unknown error"}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      await alert({
        title: "Unexpected Error",
        description: "An error occurred while creating the bot.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isLimitReached = limitStatus ? !limitStatus.allowed : false;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bots">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Bots
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create New Bot</h1>
        <p className="text-gray-600">
          Create a new bot and start building conversations
        </p>
      </div>

      {isLimitReached && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-800">Bot Limit Reached</p>
                <p className="text-sm text-amber-700">
                  You have reached the maximum of {limitStatus?.limit} bots for your {limitStatus?.planName} plan.
                  You cannot create more bots until you upgrade your plan or delete an existing bot.
                </p>
                <Button size="sm" asChild className="bg-amber-600 hover:bg-amber-700">
                  <Link href="/settings?tab=billing">Upgrade Plan</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Bot Information</CardTitle>
          <CardDescription>
            Configure your bot settings. You can edit these later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Bot Name</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="My Bot"
                required
                disabled={isLimitReached}
              />
              <p className="text-xs text-gray-500 mt-1">
                Give your bot a descriptive name
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Channel</label>
              <select
                value={formData.channel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    channel: e.target.value as BotChannelType,
                  })
                }
                disabled={isLimitReached}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                {isBotChannelVisible("web") ? (
                  <option value="web">Webchat</option>
                ) : null}
                {isBotChannelVisible("telegram") ? (
                  <option value="telegram">Telegram</option>
                ) : null}
                {isBotChannelVisible("facebook") ? (
                  <option value="facebook">Facebook</option>
                ) : null}
                {isBotChannelVisible("whatsapp") ? (
                  <option value="whatsapp">WhatsApp</option>
                ) : null}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select the primary channel for this bot. You can add more
                channels later.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Bot Context (optional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                rows={4}
                placeholder="Paste JSON or plain text context for your bot (optional)"
                value={formData.context}
                onChange={(e) =>
                  setFormData({ ...formData, context: e.target.value })
                }
                disabled={isLimitReached}
              />
              <p className="text-xs text-gray-500 mt-1">
                Optionally provide context or instructions for your bot. Leave
                blank for none.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="text-sm text-blue-800">
                <strong>Next:</strong> After creating your bot, you&apos;ll be
                able to configure it using our visual builder.
              </p>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !formData.name || isLimitReached || checkingLimits}>
                {loading ? "Creating..." : "Create Bot"}
              </Button>
              <Link href="/bots">
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreateBotPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateBotContent />
    </Suspense>
  );
}
