"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ChannelBotSelectorCard, ChannelPageHeader } from "@/components/channels/channel-ui";

interface Bot {
  id: string;
  name: string;
}

function WebchatRedirectContent() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBots = async () => {
      try {
        const res = await fetch("/api/bots");
        const data = await res.json();
        const list: Bot[] = Array.isArray(data.bots)
          ? data.bots
          : Array.isArray(data.projects)
            ? data.projects.flatMap((p: any) => p.bots || [])
            : [];
        setBots(list);

        if (list.length === 1) {
          router.replace(`/bots/${list[0].id}?tab=channels&channel=web`);
        }
      } catch {
        toast.error("Failed to load bots");
      } finally {
        setLoading(false);
      }
    };
    loadBots();
  }, [router]);

  const handleSelectBot = (botId: string) => {
    router.push(`/bots/${botId}?tab=channels&channel=web`);
  };

  if (loading) return <div className="p-8 flex items-center gap-2"><Loader2 className="animate-spin" /> Loading...</div>;

  return (
    <div className="space-y-6">
      <ChannelPageHeader title="Webchat Widget" description="Select a bot to manage its Webchat configuration." />
      <ChannelBotSelectorCard
        loading={loading}
        bots={bots}
        selectedBotId=""
        onSelectBot={handleSelectBot}
        createBotHref="/bots"
      />
    </div>
  );
}

export default function WebchatIntegrationRedirect() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <WebchatRedirectContent />
    </Suspense>
  );
}
