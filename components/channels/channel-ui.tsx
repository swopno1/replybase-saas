"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BotOption = {
  id: string;
  name: string;
};

type ChannelPageHeaderProps = {
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
};

export function ChannelPageHeader({
  title,
  description,
  backHref = "/",
  backLabel = "Back to Dashboard",
}: ChannelPageHeaderProps) {
  return (
    <div>
      <Link href={backHref}>
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-muted-foreground">{description}</p>
    </div>
  );
}

type ChannelGuidanceCardProps = {
  title: string;
  description: string;
  bullets: string[];
  icon?: LucideIcon;
};

export function ChannelGuidanceCard({
  title,
  description,
  bullets,
  icon: Icon,
}: ChannelGuidanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5" /> : null}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {bullets.map((bullet) => (
          <p key={bullet}>{bullet}</p>
        ))}
      </CardContent>
    </Card>
  );
}

type ChannelBotSelectorCardProps = {
  title?: string;
  description?: string;
  loading: boolean;
  bots: BotOption[];
  selectedBotId: string;
  onSelectBot: (botId: string) => void;
  emptyState?: string;
  createBotHref?: string;
};

export function ChannelBotSelectorCard({
  title = "Select Bot",
  description = "Choose which ReplyBase bot this channel connection belongs to.",
  loading,
  bots,
  selectedBotId,
  onSelectBot,
  emptyState = "No bots found. Create a bot first.",
  createBotHref,
}: ChannelBotSelectorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bots...
          </div>
        ) : bots.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{emptyState}</p>
            {createBotHref ? (
              <Link href={createBotHref}>
                <Button variant="outline" size="sm">
                  Create Bot
                </Button>
              </Link>
            ) : null}
          </div>
        ) : (
          <Select value={selectedBotId} onValueChange={onSelectBot}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select a bot" />
            </SelectTrigger>
            <SelectContent>
              {bots.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>
                  {bot.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardContent>
    </Card>
  );
}
