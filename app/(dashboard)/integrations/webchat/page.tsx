"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChannelBotSelectorCard } from "@/components/channels/channel-ui";

interface Bot {
  id: string;
  name: string;
}

export default function WebchatLegacyPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBots() {
      try {
        const res = await fetch("/api/bots");
        const data = await res.json();
        const botList = data.bots || [];
        setBots(botList);

        if (botList.length === 1) {
          router.push(`/bots/${botList[0].id}?tab=channels&channel=webchat`);
        } else if (botList.length === 0) {
          router.push("/bots");
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch bots:", error);
        setLoading(false);
      }
    }
    void fetchBots();
  }, [router]);

  const handleSelectBot = (botId: string) => {
    router.push(`/bots/${botId}?tab=channels&channel=webchat`);
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Webchat Integration</h1>
        <p className="text-muted-foreground mt-1">
          Select a bot to configure its Webchat connection.
        </p>
      </div>

      <ChannelBotSelectorCard
        loading={loading}
        bots={bots}
        selectedBotId=""
        onSelectBot={handleSelectBot}
      />
    </div>
  );
}
