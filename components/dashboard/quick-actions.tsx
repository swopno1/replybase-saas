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
import { MessageSquare, Zap, Activity } from "lucide-react";

interface QuickActionsProps {
  setupComplete: boolean;
}

export function QuickActions({ setupComplete }: QuickActionsProps) {
  if (!setupComplete) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your integration</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link href="/integrations/facebook">
            <Button variant="outline" className="w-full justify-start">
              <MessageSquare className="mr-2 h-4 w-4" />
              Manage Facebook Pages
            </Button>
          </Link>
          <Link href="/ai-status">
            <Button variant="outline" className="w-full justify-start">
              <Zap className="mr-2 h-4 w-4" />
              Configure AI Status
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
