import { getServerSession } from "next-auth";
import { BotpressService } from "@/lib/botpress";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscriptionStatus } from "@/components/subscription-status";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Activity,
  MessageSquare,
  Zap,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { authOptions } from "@/lib/auth";

// Simple date formatter
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    return null; // No tenant found
  }

  // Get engine health
  const health = await BotpressService.getHealth();
  const isEngineUp = !!health;

  // Get connected Facebook pages (tenant-scoped)
  const connectedPages = await prisma.facebookPage.findMany({
    where: { userId: session.user.id }, // Already scoped to user, which is tenant-safe
    select: {
      id: true,
      facebookId: true,
      name: true,
      engineConnected: true,
    },
  });

  const connectedPagesCount = connectedPages.length;
  const activePagesCount = connectedPages.filter(
    (p) => p.engineConnected
  ).length;
  const isAIActive = activePagesCount > 0 && isEngineUp;

  // Get last message timestamp (tenant-scoped via facebookPageId)
  let lastMessageTimestamp: Date | null = null;
  if (connectedPages.length > 0) {
    const facebookPageIds = connectedPages.map((p) => p.facebookId);
    const lastMessage = await prisma.messageLog.findFirst({
      where: {
        conversation: {
          facebookPageId: {
            in: facebookPageIds,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
    });
    lastMessageTimestamp = lastMessage?.createdAt || null;
  }

  // Determine setup status (tenant-scoped)
  const hasFacebookAccount = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "facebook",
    },
  });

  const setupComplete =
    hasFacebookAccount &&
    connectedPagesCount > 0 &&
    activePagesCount > 0 &&
    isEngineUp;
  const needsFacebookConnection = !hasFacebookAccount;
  const needsPageConnection = hasFacebookAccount && connectedPagesCount === 0;
  const needsAIActivation = connectedPagesCount > 0 && activePagesCount === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          {setupComplete
            ? "Your AI is ready to reply to messages automatically."
            : "Get started by connecting your Facebook Page and enabling AI replies."}
        </p>
      </div>

      {/* Setup CTA - Show if setup incomplete */}
      {!setupComplete && (
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
              {!isEngineUp && (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Engine Offline
                </>
              )}
            </CardTitle>
            <CardDescription>
              {needsFacebookConnection &&
                "Connect your Facebook account to get started."}
              {needsPageConnection &&
                "Select a Facebook Page to connect with ReplyBase."}
              {needsAIActivation &&
                "Enable AI replies for your connected pages."}
              {!isEngineUp &&
                "The AI engine is currently offline. Please try again later."}
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
      )}

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SubscriptionStatus />
      </div>
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
            <CardTitle className="text-sm font-medium">
              Facebook Pages
            </CardTitle>
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
              {health?.version ? `v${health.version}` : "Connection failed"}
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
              {lastMessageTimestamp
                ? "Most recent activity"
                : "No messages yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {setupComplete && (
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
      )}
    </div>
  );
}
