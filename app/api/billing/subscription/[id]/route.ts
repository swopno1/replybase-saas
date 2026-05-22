import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { invalidateTenantCache } from "@/lib/subscription";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const DELETE = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    // Safely try to parse body if it exists (for feedback)
    let feedback = "";
    try {
      const body = await request.json();
      feedback = body.feedback || "";
    } catch (e) {
      // Body might be empty
    }

    if (feedback) {
      console.log(`[Subscription Cancel] Feedback from user: ${feedback}`);
    }

    const { id } = (await context.params) as { id: string };

    const subscription = await db.subscription.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    if (
      !stripe ||
      !subscription.stripeId ||
      subscription.stripeId.startsWith("free_")
    ) {
      const updated = await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "canceled",
          cancelAtPeriodEnd: true,
        },
      });
      return NextResponse.json({ subscription: updated });
    }

    const stripeSub = await stripe.subscriptions.update(subscription.stripeId, {
      cancel_at_period_end: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = stripeSub as any;
    const updated = await db.subscription.update({
      where: { id: subscription.id },
      data: {
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });

    await invalidateTenantCache(tenantId);

    return NextResponse.json({ subscription: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Subscription Cancel] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 },
    );
  }
});
