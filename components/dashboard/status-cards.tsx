"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Activity,
  Clock,
} from "lucide-react";

interface StatusCardsProps {
  isAIActive: boolean;
  activePagesCount: number;
  connectedPagesCount: number;
  isEngineUp: boolean;
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
  isAIActive,
  activePagesCount,
  connectedPagesCount,
  isEngineUp,
  lastMessageTimestamp,
}: StatusCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* AI Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Status</CardTitle>
          {isAIActive ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isAIActive ? "Active" : "Inactive"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isAIActive
              ? `${activePagesCount} page${
                  activePagesCount !== 1 ? "s" : ""
                } active`
              : "No pages connected"}
          </p>
        </CardContent>
      </Card>

      {/* Connected Pages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Facebook Pages</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{connectedPagesCount}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {connectedPagesCount === 0
              ? "No pages connected"
              : `${activePagesCount} with AI enabled`}
          </p>
        </CardContent>
      </Card>

      {/* Engine Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Engine Status</CardTitle>
          {isEngineUp ? (
            <Activity className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isEngineUp ? "Online" : "Offline"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isEngineUp ? "System operational" : "Connection failed"}
          </p>
        </CardContent>
      </Card>

      {/* Last Message */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Message</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {lastMessageTimestamp ? formatTimeAgo(lastMessageTimestamp) : "—"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {lastMessageTimestamp ? "Most recent activity" : "No messages yet"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
