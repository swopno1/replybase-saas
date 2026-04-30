import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { syncSubscription } from "@/lib/billing-service";

export const dynamic = 'force-dynamic';

/**
 * Verifies a Stripe Checkout session and checks if the subscription has been synced.
 * Redesign: Includes proactive sync fallback (Rule #5/8) to handle webhook failures.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID missing" }, { status: 400 });
    }

    if (!stripe) {
      return NextResponse.json({ error: "Billing service unavailable" }, { status: 503 });
    }

    // 1. Retrieve session from Stripe to ensure it's valid
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (checkoutSession.status !== "complete") {
      return NextResponse.json({ status: "pending", message: "Checkout session incomplete" });
    }

    const tenantId = checkoutSession.metadata?.tenantId;
    if (!tenantId || tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: "Session tenant mismatch" }, { status: 403 });
    }

    const subscriptionId = checkoutSession.subscription as string;

    // 2. Proactive Sync Fallback
    // Even if webhook fails, we can sync right here since we know the session is complete.
    try {
      if (subscriptionId) {
        await syncSubscription(tenantId, subscriptionId);
        console.log(`[Verify Session] Proactive sync successful for tenant ${tenantId}`);
      }
    } catch (syncErr) {
      console.error("[Verify Session] Proactive sync failed:", syncErr);
      // We don't block here, we'll try to read from DB next.
    }

    // 3. Check finalized state in DB
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true }
    });

    if (subscription && (subscription.stripeId === subscriptionId || ["ACTIVE", "TRIALING"].includes(subscription.status))) {
      return NextResponse.json({ 
        status: "success", 
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: subscription.plan.displayName
        }
      });
    }

    // Webhook and proactive sync both haven't finalized yet
    return NextResponse.json({ status: "syncing", message: "Finalizing your subscription..." });

  } catch (error) {
    console.error("[Verify Session] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
