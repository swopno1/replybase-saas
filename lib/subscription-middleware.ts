import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Ensures the current user has a fully active (paid) subscription.
 * Blocks TRIALING, PAST_DUE, and CANCELED states.
 */
export async function requireActiveSubscription() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: session.user.tenantId },
  });

  if (!sub || sub.status !== "ACTIVE") {
    redirect("/pricing?reason=active_required");
  }

  return { session, sub };
}

/**
 * Ensures the current user is either trialing or has an active subscription.
 * Blocks PAST_DUE and CANCELED states.
 */
export async function requireTrialOrActive() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login");

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: session.user.tenantId },
  });

  const validStates = ["ACTIVE", "TRIALING"];
  if (!sub || !validStates.includes(sub.status)) {
    redirect("/pricing?reason=upgrade_required");
  }

  return { session, sub };
}

/**
 * Helper to check subscription status in API routes
 */
export async function getSubscriptionStatus(tenantId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { tenantId },
  });

  return {
    isTrialing: sub?.status === "TRIALING",
    isActive: sub?.status === "ACTIVE",
    isPastDue: sub?.status === "PAST_DUE",
    isCanceled: sub?.status === "CANCELED" || !sub,
    status: sub?.status || "FREE",
  };
}
