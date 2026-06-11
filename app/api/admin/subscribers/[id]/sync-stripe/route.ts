import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/route-helpers";
import { stripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing-service";
import { logAdminActivity } from "@/lib/admin-audit";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (session, request, context, db) => {
  try {
    const { id } = (await context.params) as { id: string };

    const subscription = await db.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    if (!subscription.stripeId || subscription.stripeId.startsWith("free_") || subscription.stripeId.startsWith("manual_grant_")) {
      return NextResponse.json({ error: "No real Stripe subscription to sync" }, { status: 400 });
    }

    const syncResult = await syncSubscription(subscription.tenantId, subscription.stripeId);

    if (syncResult && (syncResult as any).canceled) {
      await logAdminActivity({
        adminId: session.user.id,
        action: "SUBSCRIPTION_STRIPE_SYNC",
        entityType: "SUBSCRIPTION",
        entityId: id,
        description: `Stripe sync for ${id}: subscription ${subscription.stripeId} not found in Stripe, marked CANCELED`,
        metadata: { tenantId: subscription.tenantId, stripeId: subscription.stripeId, autoResolved: true },
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      });
      return NextResponse.json(
        { error: `Stripe subscription ${subscription.stripeId} no longer exists. Local record marked as CANCELED.` },
        { status: 404 },
      );
    }

    const updated = await db.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });

    await logAdminActivity({
      adminId: session.user.id,
      action: "SUBSCRIPTION_STRIPE_SYNC",
      entityType: "SUBSCRIPTION",
      entityId: id,
      description: `Admin triggered Stripe sync for subscription ${id} (tenant ${subscription.tenantId})`,
      metadata: { tenantId: subscription.tenantId, stripeId: subscription.stripeId },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ subscription: updated });
  } catch (error) {
    console.error("[Admin API] Error syncing from Stripe:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync from Stripe" },
      { status: 500 },
    );
  }
});
