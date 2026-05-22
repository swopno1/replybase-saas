import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing-service";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId: userTenantId }, request, context, db) => {
  try {
    const { searchParams } = new URL(request.url);
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
    if (!tenantId || tenantId !== userTenantId) {
      return NextResponse.json({ error: "Session tenant mismatch" }, { status: 403 });
    }

    const subscriptionId = checkoutSession.subscription as string;

    // 2. Proactive Sync Fallback
    try {
      if (subscriptionId) {
        await syncSubscription(tenantId, subscriptionId);
        console.log(`[Verify Session] Proactive sync successful for tenant ${tenantId}`);
      }
    } catch (syncErr) {
      console.error("[Verify Session] Proactive sync failed:", syncErr);
    }

    // 3. Check finalized state in DB
    const subscription = await db.subscription.findUnique({
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

    return NextResponse.json({ status: "syncing", message: "Finalizing your subscription..." });

  } catch (error) {
    console.error("[Verify Session] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
