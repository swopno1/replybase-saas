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
import { ArrowRight, Bell, Globe, Send } from "lucide-react";

interface SetupCTAProps {
  needsChannelConnection: boolean;
  needsLeadNotificationSetup: boolean;
}

export function SetupCTA({
  needsChannelConnection,
  needsLeadNotificationSetup,
}: SetupCTAProps) {
  if (!needsChannelConnection && !needsLeadNotificationSetup) {
    return null;
  }

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
          {needsLeadNotificationSetup && (
            <>
              <Bell className="h-5 w-5 text-primary" />
              Configure Instant Lead Alerts
            </>
          )}
        </CardTitle>
        <CardDescription>
          {needsChannelConnection &&
            "Connect Telegram or Webchat so ReplyBase can start receiving website enquiries."}
          {needsLeadNotificationSetup &&
            "Add an email address or Telegram chat ID so new leads alert your team instantly."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {needsChannelConnection && (
          <>
            <Link href="/integrations/webchat">
              <Button>
                <Globe className="mr-2 h-4 w-4" />
                Set Up Webchat
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/integrations/telegram">
              <Button variant="outline">
                <Send className="mr-2 h-4 w-4" />
                Set Up Telegram
              </Button>
            </Link>
          </>
        )}
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
