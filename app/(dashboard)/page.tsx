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

export const dynamic = 'force-dynamic';

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

  const [
    telegramChannelsCount,
    webchatSitesCount,
    lastMessage,
    firstTelegramChannel,
    firstWebchatChannel,
  ] = await Promise.all([
    prisma.channel.count({
      where: {
        type: "telegram",
        accessToken: { not: null },
        bot: { tenantId: user.tenantId },
      },
    }),
    prisma.webChatSite.count({
      where: { tenantId: user.tenantId },
    }),
    prisma.crmMessage.findFirst({
      where: {
        conversation: {
          contact: {
            tenantId: user.tenantId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
      },
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

  const connectedChannelsCount = telegramChannelsCount + webchatSitesCount;
  const isAutomationReady = connectedChannelsCount > 0;
  const lastMessageTimestamp = lastMessage?.createdAt || null;

  const firstConnectedChannelAt = [
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

  const leadNotificationSettings =
    await prisma.tenantLeadNotificationSettings.findUnique({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        emailRecipients: true,
        telegramChatIds: true,
        updatedAt: true,
      },
    });

  const hasLeadDestinationEmail = Array.isArray(
    leadNotificationSettings?.emailRecipients,
  )
    ? leadNotificationSettings.emailRecipients.some(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      )
    : false;

  const hasLeadDestinationTelegram = Array.isArray(
    leadNotificationSettings?.telegramChatIds,
  )
    ? leadNotificationSettings.telegramChatIds.some(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      )
    : false;

  const hasLeadNotificationDestinations =
    hasLeadDestinationEmail || hasLeadDestinationTelegram;
  const connectedLeadDestinationsCount =
    Number(hasLeadDestinationEmail) + Number(hasLeadDestinationTelegram);
  const setupComplete =
    connectedChannelsCount > 0 && hasLeadNotificationDestinations;
  const needsChannelConnection = connectedChannelsCount === 0;
  const needsLeadNotificationSetup = !hasLeadNotificationDestinations;

  const firstAutomatedReplyAt = firstAutomatedReply?.createdAt;
  const onboardingMilestones = [
    {
      id: "first-channel",
      title: "First connected channel",
      description:
        "Connect Telegram or Webchat so ReplyBase can start receiving website enquiries.",
      completed: Boolean(firstConnectedChannelAt),
      completedAt: firstConnectedChannelAt,
      actionLabel: "Connect a channel",
      actionHref: "/integrations/webchat",
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
    {
      id: "lead-notifications",
      title: "Lead notification destinations",
      description:
        "Set your tenant's email or Telegram destinations so new website leads alert your team instantly.",
      completed: hasLeadNotificationDestinations,
      completedAt: hasLeadNotificationDestinations
        ? leadNotificationSettings?.updatedAt || null
        : null,
      actionLabel: "Configure destinations",
      actionHref: "/settings",
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
            ? "Your lead capture stack is live and notifications are configured."
            : "Connect Webchat or Telegram, then add instant notifications for new leads."}
        </p>
      </div>

      {/* Setup CTA - Wrapped in Error Boundary */}
      <DashboardErrorBoundary title="Setup Guide">
        <SetupCTA
          needsChannelConnection={needsChannelConnection}
          needsLeadNotificationSetup={needsLeadNotificationSetup}
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
          isAutomationReady={isAutomationReady}
          connectedChannelsCount={connectedChannelsCount}
          connectedLeadDestinationsCount={connectedLeadDestinationsCount}
          isEngineUp={isEngineUp}
          lastMessageTimestamp={lastMessageTimestamp}
        />
      </DashboardErrorBoundary>

      {/* Quick Actions - Wrapped in Error Boundary */}
      <DashboardErrorBoundary title="Quick Actions">
        <QuickActions hasConnectedChannels={connectedChannelsCount > 0} />
      </DashboardErrorBoundary>
    </div>
  );
}
