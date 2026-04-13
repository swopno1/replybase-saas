"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Globe,
  MessageCircle,
  MessageSquare,
  Send,
} from "lucide-react";
import type { ChannelId, ChannelStatus } from "@/lib/channel-config";

const CHANNEL_ROUTES: Record<ChannelId, string> = {
  webchat: "/integrations/webchat",
  telegram: "/integrations/telegram",
  facebook: "/integrations/facebook",
  whatsapp: "/integrations/whatsapp",
};

const CHANNEL_ICONS: Record<ChannelId, React.FC<{ className?: string }>> = {
  webchat: ({ className }) => <Globe className={className} />,
  telegram: ({ className }) => <Send className={className} />,
  facebook: ({ className }) => <MessageSquare className={className} />,
  whatsapp: ({ className }) => <MessageCircle className={className} />,
};

interface SetupCTAProps {
  needsChannelConnection: boolean;
  needsLeadNotificationSetup: boolean;
  availableChannels: ChannelStatus[];
}

export function SetupCTA({
  needsChannelConnection,
  needsLeadNotificationSetup,
  availableChannels,
}: SetupCTAProps) {
  if (!needsChannelConnection && !needsLeadNotificationSetup) {
    return null;
  }

  const channelCount = availableChannels.length;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {needsChannelConnection && (
            <>
              <Globe className="h-5 w-5 text-primary" />
              Connect Your First Lead Channel
            </>
          )}
          {needsLeadNotificationSetup && !needsChannelConnection && (
            <>
              <Bell className="h-5 w-5 text-primary" />
              Configure Instant Lead Alerts
            </>
          )}
        </CardTitle>
        <CardDescription>
          {needsChannelConnection &&
            `Connect ${channelCount > 1 ? "a channel" : (availableChannels[0]?.displayName ?? "a channel")} so ReplyBase can start receiving enquiries from your leads.`}
          {needsLeadNotificationSetup &&
            !needsChannelConnection &&
            "Add an email address or Telegram chat ID so new leads alert your team instantly."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {needsChannelConnection &&
          availableChannels.map((channel, index) => {
            const Icon = CHANNEL_ICONS[channel.id];
            const href = CHANNEL_ROUTES[channel.id];
            const isPrimary = index === 0;
            return (
              <Link key={channel.id} href={href}>
                <Button variant={isPrimary ? "default" : "outline"}>
                  <Icon className="mr-2 h-4 w-4" />
                  Set Up {channel.displayName}
                  {isPrimary && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </Link>
            );
          })}
        {needsLeadNotificationSetup && (
          <Link href="/settings">
            <Button variant={needsChannelConnection ? "outline" : "default"}>
              <Bell className="mr-2 h-4 w-4" />
              Configure Alerts
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
