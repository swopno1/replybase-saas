import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

/**
 * Verifies a Stripe Checkout session and checks if the subscription has been synced.
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

    // 2. Check if the subscription has been synced by the webhook yet
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true }
    });

    // If subscription exists and matches the expected session (stripeId)
    // or if it was just updated and is ACTIVE/TRIALING
    if (subscription && (subscription.stripeId === checkoutSession.subscription || ["ACTIVE", "TRIALING"].includes(subscription.status))) {
      return NextResponse.json({ 
        status: "success", 
        subscription: {
          id: subscription.id,
          status: subscription.status,
          plan: subscription.plan.displayName
        }
      });
    }

    // Webhook hasn't processed yet
    return NextResponse.json({ status: "syncing", message: "Waiting for background sync..." });

  } catch (error) {
    console.error("[Verify Session] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
