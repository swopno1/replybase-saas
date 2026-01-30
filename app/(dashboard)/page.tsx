import { getServerSession } from "next-auth";
import { checkHealth } from "@/lib/ai-engine";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@/components/subscription-status";
import { authOptions } from "@/lib/auth";
import { DashboardErrorBoundary } from "@/components/dashboard/error-boundary";
import { SetupCTA } from "@/components/dashboard/setup-cta";
import { StatusCards } from "@/components/dashboard/status-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";

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
