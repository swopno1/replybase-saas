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
import { DashboardFunnelTracker } from "@/components/analytics/dashboard-funnel-tracker";

export const dynamic = 'force-dynamic';

type SignupPlanIntent = "free" | "starter" | "pro" | "business";

function parseSignupPlanIntent(value: unknown): SignupPlanIntent | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "starter" ||
    normalized === "pro" ||
    normalized === "business"
  ) {
    return normalized;
  }

  return null;
}

function planDisplayName(plan: SignupPlanIntent): string {
  if (plan === "free") return "Free";
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  return "Business";
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
  const health = await checkHealth();
  const isEngineUp = health.engine === "ok";

  const [
    telegramChannelsCount,
    webchatSitesCount,
    lastMessage,
    firstTelegramChannel,
    firstWebchatChannel,
    signupIntentLog,
    activeSubscription,
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
    prisma.activityLog.findFirst({
      where: {
        tenantId: user.tenantId,
        type: "signup_intent",
      },
      orderBy: { createdAt: "desc" },
      select: {
        metadata: true,
      },
    }),
    prisma.subscription.findUnique({
      where: {
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        plan: {
          select: {
            name: true,
          },
        },
      },
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

  const intentMetadata =
    signupIntentLog?.metadata && typeof signupIntentLog.metadata === "object"
      ? (signupIntentLog.metadata as Record<string, unknown>)
      : null;
  const intentPlan = parseSignupPlanIntent(intentMetadata?.plan);
  const intentSource =
    typeof intentMetadata?.source === "string" ? intentMetadata.source : null;
  const recommendedPlan: SignupPlanIntent = intentPlan || "pro";
  const recommendedPlanLabel = planDisplayName(recommendedPlan);
  const hasSelectedPlan = Boolean(activeSubscription?.id);
  const isBusinessIntent = recommendedPlan === "business";

  const recommendedPlanBenefits =
    recommendedPlan === "business"
      ? [
          "Scale to high conversation volume with advanced AI capacity",
          "Priority+ support and faster escalation when issues happen",
          "Designed for teams managing multiple channels and agents",
        ]
      : recommendedPlan === "starter"
        ? [
            "Start small with enough automation for early traction",
            "Keep costs low while validating your lead workflow",
            "Upgrade seamlessly as inbound volume grows",
          ]
        : recommendedPlan === "free"
          ? [
              "Launch quickly without cost while your stack is being configured",
              "Validate your first lead flows before committing budget",
              "Move to a paid trial later when you need scale",
            ]
          : [
              "Best balance of automation scale and AI usage for growth teams",
              "Includes API + priority support for serious lead operations",
              "Strong fit once your first channel is live and producing leads",
            ];

  const planActionHref = isBusinessIntent
    ? "mailto:sales@replybase.co.uk?subject=Business%20Plan%20Onboarding"
    : `/pricing?plan=${recommendedPlan}&source=onboarding_plan_step`;
  const planActionLabel = isBusinessIntent
    ? "Talk to Business Specialist"
    : `Choose ${recommendedPlanLabel}`;

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
      id: "plan-selection",
      title: `Confirm your ${recommendedPlanLabel} plan`,
      description: isBusinessIntent
        ? "Business includes concierge onboarding support. We will tailor setup to your team and volume."
        : "No charge during trial and you can change plans anytime. Pick the best fit once your setup has momentum.",
      completed: hasSelectedPlan,
      completedAt: null,
      actionLabel: planActionLabel,
      actionHref: planActionHref,
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
  const completedMilestoneIds = onboardingMilestones
    .filter((milestone) => milestone.completed)
    .map((milestone) => milestone.id);

  return (
    <div className="space-y-6">
      <DashboardFunnelTracker
        tenantId={user.tenantId}
        completedMilestoneIds={completedMilestoneIds}
      />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {completedMilestones === 0
            ? `Welcome, ${session?.user?.name?.split(" ")[0] ?? "there"} \u2014 let\u2019s capture your first lead`
            : `Welcome back${session?.user?.name ? `, ${session.user.name}` : ""}`}
        </h1>
        <p className="text-muted-foreground mt-1">
          {setupComplete
            ? "Your lead capture stack is live and notifications are configured."
            : completedMilestones === 0
              ? `You\u2019re ${onboardingMilestones.length} quick steps away from automatically capturing and replying to leads.`
              : `${onboardingMilestones.length - completedMilestones} step${onboardingMilestones.length - completedMilestones === 1 ? "" : "s"} left to complete your setup.`}
        </p>
      </div>

      {/* Setup CTA - Wrapped in Error Boundary */}
      <DashboardErrorBoundary title="Setup Guide">
        <SetupCTA
          needsChannelConnection={needsChannelConnection}
          needsLeadNotificationSetup={needsLeadNotificationSetup}
        />
      </DashboardErrorBoundary>

      {!hasSelectedPlan && (
        <DashboardErrorBoundary title="Plan Recommendation">
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  Recommended plan: {recommendedPlanLabel}
                </CardTitle>
                <Badge variant="secondary">No charge during trial</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isBusinessIntent
                  ? "Based on your signup intent, we prepared a Business onboarding path with specialist support."
                  : "Choose your plan after setup momentum, not before. You can change anytime."}
                {intentSource ? ` Source: ${intentSource.replaceAll("_", " ")}.` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {recommendedPlanBenefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <Link href={planActionHref}>
                  <Button>
                    {planActionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                {!isBusinessIntent && (
                  <Link href="/pricing?source=onboarding_plan_compare">
                    <Button variant="outline">Compare all plans</Button>
                  </Link>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Reassurance: no card charge during trial, and you can switch plans anytime.
              </p>
            </CardContent>
          </Card>
        </DashboardErrorBoundary>
      )}

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
            {onboardingMilestones.map((milestone, idx) => {
              const isNextAction = !milestone.completed && onboardingMilestones.slice(0, idx).every((m) => m.completed);
              return (
              <div
                key={milestone.id}
                className={`flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between${isNextAction ? " border-primary bg-primary/5" : ""}`}
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
                    <Button size="sm" variant={isNextAction ? "default" : "outline"}>
                      {milestone.actionLabel}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
              );
            })}
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
