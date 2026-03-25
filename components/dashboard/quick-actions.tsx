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
import { Activity, Bell, Globe, Send } from "lucide-react";

interface QuickActionsProps {
  hasConnectedChannels: boolean;
}

export function QuickActions({ hasConnectedChannels }: QuickActionsProps) {
  if (!hasConnectedChannels) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your lead capture stack</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href="/integrations/webchat">
            <Button variant="outline" className="w-full justify-start">
              <Globe className="mr-2 h-4 w-4" />
              Manage Webchat Widget
            </Button>
          </Link>
          <Link href="/integrations/telegram">
            <Button variant="outline" className="w-full justify-start">
              <Send className="mr-2 h-4 w-4" />
              Manage Telegram Notifications
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="outline" className="w-full justify-start">
              <Bell className="mr-2 h-4 w-4" />
              Configure Lead Alerts
            </Button>
          </Link>
          <Link href="/activity">
            <Button variant="outline" className="w-full justify-start">
              <Activity className="mr-2 h-4 w-4" />
              View Activity Logs
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
