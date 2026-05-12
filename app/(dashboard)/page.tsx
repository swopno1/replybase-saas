import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@/components/subscription-status";
import { authOptions } from "@/lib/auth";
import { DashboardErrorBoundary } from "@/components/dashboard/error-boundary";
import { SetupCTA } from "@/components/dashboard/setup-cta";
import { getAllChannelConfigs } from "@/lib/channel-config";
import { StatusCards } from "@/components/dashboard/status-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, AlertCircle } from "lucide-react";
import { DashboardFunnelTracker } from "@/components/analytics/dashboard-funnel-tracker";
import { MilestoneAction } from "@/components/dashboard/milestone-action";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

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

  // Capture now once so the same instant is used consistently across all
  // time-based calculations in this render (trial days remaining, etc.).
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { tenant: true },
  });

  if (!user?.tenantId) {
    return null; // No tenant found
  }

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
        status: true,
        stripeCustomerId: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
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
  const availableChannels = getAllChannelConfigs().filter(
    (ch) => ch.enabled && ch.uiVisible,
  );

  const intentMetadata =
    signupIntentLog?.metadata && typeof signupIntentLog.metadata === "object"
      ? (signupIntentLog.metadata as Record<string, unknown>)
      : null;
  const intentPlan = parseSignupPlanIntent(intentMetadata?.plan);
  const intentSource =
    typeof intentMetadata?.source === "string" ? intentMetadata.source : null;
  const recommendedPlan: SignupPlanIntent = intentPlan || "pro";
  const recommendedPlanLabel = planDisplayName(recommendedPlan);
  const activePlanName = parseSignupPlanIntent(activeSubscription?.plan?.name);
  const hasSelectedPlan = Boolean(activePlanName && activePlanName !== "free");
  const trialEndsAt = activeSubscription?.trialEndsAt || null;
  const trialDaysRemaining = trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;
  const inTrialWindow = trialDaysRemaining !== null && trialDaysRemaining > 0;
  const shouldShowTrialBillingPrompt =
    inTrialWindow && !hasSelectedPlan && trialDaysRemaining <= 10;
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
    ? "https://wa.me/447822033580?text=Hi%2C%20I%27m%20interested%20in%20the%20Business%20Plan"
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
      docHref: "https://replybase.co.uk/docs/get-started#connecting-channels"
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
      docHref: "https://replybase.co.uk/docs/get-started#testing"
    },
    {
      id: "plan-selection",
      title: `Confirm your ${recommendedPlanLabel} plan`,
      description: isBusinessIntent
        ? "Business includes concierge onboarding support. We will tailor setup to your team and volume."
        : "No charge during trial. Confirm your paid plan before trial end to keep automations running without interruption.",
      completed: hasSelectedPlan,
      completedAt: null,
      actionLabel: planActionLabel,
      actionHref: planActionHref,
      docHref: "https://replybase.co.uk/docs/get-started#pricing"
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
      actionHref: "/settings?tab=notifications",
      docHref: "https://replybase.co.uk/docs/get-started#notifications"
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
          availableChannels={availableChannels}
        />
      </DashboardErrorBoundary>

      {shouldShowTrialBillingPrompt && (
        <DashboardErrorBoundary title="Trial Billing Reminder">
          <Card className="border-amber-300 bg-amber-50/70">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-700" />
                  Add Billing Before Trial Ends
                </CardTitle>
                <Badge variant="secondary">
                  {trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"}{" "}
                  left
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Your trial is active. Choose a paid plan now so lead capture and
                reply automation continue without disruption after trial end.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/pricing?plan=${recommendedPlan}&source=trial_expiry_billing_prompt`}
                >
                  <Button>
                    Choose {recommendedPlanLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/settings?tab=billing">
                  <Button variant="outline">Open Billing Settings</Button>
                </Link>
                {isBusinessIntent && (
                  <Link href="https://wa.me/447822033580?text=Hi%2C%20I%27d%20like%20to%20discuss%20Business%20Plan%20billing">
                    <Button variant="outline">
                      Talk to Billing Specialist
                    </Button>
                  </Link>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended trigger: send reminder emails at 10, 5, and 2 days
                before trial end, then show this in-app prompt daily in the last
                5 days.
              </p>
            </CardContent>
          </Card>
        </DashboardErrorBoundary>
      )}

      {!hasSelectedPlan && (
        <DashboardErrorBoundary title="Plan Recommendation">
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Recommended plan: {recommendedPlanLabel}</CardTitle>
                <Badge variant="secondary">No charge during trial</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isBusinessIntent
                  ? "Based on your signup intent, we prepared a Business onboarding path with specialist support."
                  : "Choose your plan after setup momentum, not before. You can change anytime."}
                {intentSource
                  ? ` Source: ${intentSource.replaceAll("_", " ")}.`
                  : ""}
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
                Reassurance: no card charge during trial, and you can switch
                plans anytime.
              </p>
            </CardContent>
          </Card>
        </DashboardErrorBoundary>
      )}

      {completedMilestones < onboardingMilestones.length && (
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
                const isNextAction =
                  !milestone.completed &&
                  onboardingMilestones.slice(0, idx).every((m) => m.completed);
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
                        <a 
                          href={milestone.docHref} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-2 text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
                        >
                          Guide: How to complete this step <ExternalLink className="h-2 w-2" />
                        </a>
                      </div>
                    </div>
                    {!milestone.completed && (
                      <MilestoneAction 
                        id={milestone.id}
                        actionLabel={milestone.actionLabel}
                        actionHref={milestone.actionHref}
                        isNextAction={isNextAction}
                        tenantId={user.tenantId}
                      />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </DashboardErrorBoundary>
      )}

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
