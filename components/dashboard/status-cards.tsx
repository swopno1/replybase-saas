"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Bell,
  Radio,
} from "lucide-react";

interface StatusCardsProps {
  isAutomationReady: boolean;
  connectedChannelsCount: number;
  connectedLeadDestinationsCount: number;
  lastMessageTimestamp: Date | null;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

export function StatusCards({
  isAutomationReady,
  connectedChannelsCount,
  connectedLeadDestinationsCount,
  lastMessageTimestamp,
}: StatusCardsProps) {
  const cardClassName = "h-full cursor-pointer hover:bg-accent/40 hover:border-primary/20 transition-all duration-200";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* AI Status */}
      <Link href="/bots" className="block h-full">
        <Card className={cardClassName}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Automation</CardTitle>
            {isAutomationReady ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isAutomationReady ? "Ready" : "Pending"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isAutomationReady
                ? "Lead capture channels are connected"
                : "Connect Webchat or Telegram to start receiving leads"}
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Connected Channels */}
      <Link href="/settings?tab=channels" className="block h-full">
        <Card className={cardClassName}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Connected Channels
            </CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectedChannelsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {connectedChannelsCount === 0
                ? "No channels connected"
                : `${connectedChannelsCount} channel${connectedChannelsCount !== 1 ? "s" : ""} live`}
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Engine Status removed: AI/engine is deprecated */}

      {/* Lead Destinations */}
      <Link href="/settings?tab=notifications" className="block h-full">
        <Card className={cardClassName}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Alerts</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectedLeadDestinationsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {connectedLeadDestinationsCount === 0
                ? "No email or Telegram alerts configured"
                : `${connectedLeadDestinationsCount} destination${connectedLeadDestinationsCount !== 1 ? "s" : ""} configured`}
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Last Activity */}
      <Link href="/conversations" className="block h-full">
        <Card className={cardClassName}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastMessageTimestamp ? formatTimeAgo(lastMessageTimestamp) : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lastMessageTimestamp
                ? "Most recent lead activity"
                : "No conversations yet"}
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

