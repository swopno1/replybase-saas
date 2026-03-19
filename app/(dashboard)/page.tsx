import { getServerSession } from "next-auth";
import { checkHealth } from "@/lib/ai-engine";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@/components/subscription-status";
import { authOptions } from "@/lib/auth";
import { DashboardErrorBoundary } from "@/components/dashboard/error-boundary";
import { SetupCTA } from "@/components/dashboard/setup-cta";
import { StatusCards } from "@/components/dashboard/status-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

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
  const health = await checkHealth();
  const isEngineUp = health.engine === "ok";

  // Get connected Facebook pages (tenant-scoped)
  const connectedPages = await prisma.facebookPage.findMany({
    where: { tenantId: user.tenantId },
    select: {
      id: true,
      facebookId: true,
      name: true,
      engineConnected: true,
    },
  });

  const connectedPagesCount = connectedPages.length;
  const activePagesCount = connectedPages.filter(
    (p) => p.engineConnected,
  ).length;
  // Always show AI as active once pages are connected (Typebot is managed service)
  const isAIActive = activePagesCount > 0;

  // Get last message timestamp (tenant-scoped via the new facebookPageId relation)
  let lastMessageTimestamp: Date | null = null;
  if (connectedPages.length > 0) {
    const pageIds = connectedPages.map((p) => p.id);
    const lastMessage = await prisma.crmMessage.findFirst({
      where: {
        conversation: {
          facebookPageId: {
            in: pageIds,
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

  const hasFacebookConnectionBool = !!hasFacebookAccount;
  const setupComplete =
    hasFacebookConnectionBool &&
    connectedPagesCount > 0 &&
    activePagesCount > 0;
  const needsFacebookConnection = !hasFacebookConnectionBool;
  const needsPageConnection =
    hasFacebookConnectionBool && connectedPagesCount === 0;
  const needsAIActivation = connectedPagesCount > 0 && activePagesCount === 0;

  const [firstFacebookChannel, firstTelegramChannel, firstWebchatChannel] =
    await Promise.all([
      prisma.facebookPage.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.channel.findFirst({
        where: {
          type: "telegram",
          accessToken: { not: null },
          bot: { tenantId: user.tenantId },
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.webChatSite.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

  const firstConnectedChannelAt = [
    firstFacebookChannel?.createdAt,
    firstTelegramChannel?.createdAt,
    firstWebchatChannel?.createdAt,
  ]
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const firstAutomatedReply = await prisma.crmMessage.findFirst({
    where: {
      direction: "outbound",
      conversation: {
        contact: {
          tenantId: user.tenantId,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const firstAutomatedReplyAt = firstAutomatedReply?.createdAt;
  const onboardingMilestones = [
    {
      id: "first-channel",
      title: "First connected channel",
      description:
        "Connect Facebook, Telegram, or Webchat so ReplyBase can start receiving messages.",
      completed: Boolean(firstConnectedChannelAt),
      completedAt: firstConnectedChannelAt,
      actionLabel: "Connect a channel",
      actionHref: "/integrations/facebook",
    },
    {
      id: "first-automated-reply",
      title: "First automated reply",
      description:
        "Send a test message and confirm that a flow or AI fallback sends an outbound reply.",
      completed: Boolean(firstAutomatedReplyAt),
      completedAt: firstAutomatedReplyAt,
      actionLabel: "Run a reply test",
      actionHref: "/integrations/telegram",
    },
  ];

  const completedMilestones = onboardingMilestones.filter(
    (milestone) => milestone.completed,
  ).length;

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

      {/* Setup CTA - Wrapped in Error Boundary */}
      <DashboardErrorBoundary title="Setup Guide">
        <SetupCTA
          needsFacebookConnection={needsFacebookConnection}
          needsPageConnection={needsPageConnection}
          needsAIActivation={needsAIActivation}
        />
      </DashboardErrorBoundary>

      <DashboardErrorBoundary title="Activation Milestones">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Activation Milestones</CardTitle>
              <Badge
                variant={
                  completedMilestones === onboardingMilestones.length
                    ? "default"
                    : "secondary"
                }
              >
                {completedMilestones}/{onboardingMilestones.length} completed
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {onboardingMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  {milestone.completed ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{milestone.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                    {milestone.completedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Completed on{" "}
                        {milestone.completedAt.toLocaleDateString("en-US")}
                      </p>
                    )}
                  </div>
                </div>
                {!milestone.completed && (
                  <Link href={milestone.actionHref}>
                    <Button size="sm" variant="outline">
                      {milestone.actionLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </DashboardErrorBoundary>

      {/* Subscription Status - Wrapped in Error Boundary */}
      <DashboardErrorBoundary title="Subscription">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SubscriptionStatus />
        </div>
      </DashboardErrorBoundary>

      {/* Status Cards - Wrapped in Error Boundary */}
      <DashboardErrorBoundary title="Status Overview">
        <StatusCards
          isAIActive={isAIActive}
          activePagesCount={activePagesCount}
          connectedPagesCount={connectedPagesCount}
          isEngineUp={isEngineUp}
          lastMessageTimestamp={lastMessageTimestamp}
        />
      </DashboardErrorBoundary>

      {/* Quick Actions - Wrapped in Error Boundary */}
      <DashboardErrorBoundary title="Quick Actions">
        <QuickActions setupComplete={setupComplete} />
      </DashboardErrorBoundary>
    </div>
  );
}
