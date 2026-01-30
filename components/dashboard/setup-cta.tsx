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
import { AlertCircle, MessageSquare, Zap, ArrowRight } from "lucide-react";

interface SetupCTAProps {
  needsFacebookConnection: boolean;
  needsPageConnection: boolean;
  needsAIActivation: boolean;
}

export function SetupCTA({
  needsFacebookConnection,
  needsPageConnection,
  needsAIActivation,
}: SetupCTAProps) {
  if (!needsFacebookConnection && !needsPageConnection && !needsAIActivation) {
    return null;
  }

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {needsFacebookConnection && (
            <>
              <AlertCircle className="h-5 w-5 text-primary" />
              Connect Your Facebook Account
            </>
          )}
          {needsPageConnection && (
            <>
              <MessageSquare className="h-5 w-5 text-primary" />
              Connect Your Facebook Page
            </>
          )}
          {needsAIActivation && (
            <>
              <Zap className="h-5 w-5 text-primary" />
              Enable AI Replies
            </>
          )}
        </CardTitle>
        <CardDescription>
          {needsFacebookConnection &&
            "Connect your Facebook account to get started."}
          {needsPageConnection &&
            "Select a Facebook Page to connect with ReplyBase."}
          {needsAIActivation && "Enable AI replies for your connected pages."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {needsFacebookConnection && (
          <Link href="/integrations/facebook">
            <Button>
              Connect Facebook Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
        {needsPageConnection && (
          <Link href="/integrations/facebook">
            <Button>
              Connect Facebook Page
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
        {needsAIActivation && (
          <Link href="/ai-status">
            <Button>
              Enable AI Replies
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
