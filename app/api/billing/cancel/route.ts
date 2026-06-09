import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async ({ id: userId, tenantId }, request, context, db) => {
  try {
    const { feedback, type } = await request.json().catch(() => ({ feedback: "", type: "CANCEL" }));

    // DOWNGRADE is feedback-only: record it (if provided) and return — never cancel.
    if (type === "DOWNGRADE") {
      if (feedback) {
        console.log(
          `[Subscription Feedback] DOWNGRADE from tenant ${tenantId}: ${feedback}`,
        );
        await db.churnFeedback.create({
          data: { tenantId, userId, type: "DOWNGRADE", reason: feedback },
        });
      }
      return NextResponse.json({ message: "Feedback recorded" });
    }

    if (feedback) {
      console.log(
        `[Subscription Feedback] CANCEL from tenant ${tenantId}: ${feedback}`,
      );
      await db.churnFeedback.create({
        data: {
          tenantId,
          userId,
          type: "CANCEL",
          reason: feedback,
        },
      });
    }

    const subscription = await db.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 },
      );
    }

    // Handle FREE plans or no stripe ID
    if (
      !stripe ||
      !subscription.stripeId ||
      subscription.stripeId.startsWith("free_")
    ) {
      const updated = await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "CANCELED",
          cancelAtPeriodEnd: true,
        },
      });
      return NextResponse.json({ subscription: updated });
    }

    // Set cancel_at_period_end = true in Stripe
    const stripeSub = await stripe.subscriptions.update(subscription.stripeId, {
      cancel_at_period_end: true,
    });

    const updated = await db.subscription.update({
      where: { id: subscription.id },
      data: {
        status: (stripeSub as any).status.toUpperCase(),
        cancelAtPeriodEnd: (stripeSub as any).cancel_at_period_end,
        currentPeriodEnd: (stripeSub as any).current_period_end 
          ? new Date((stripeSub as any).current_period_end * 1000) 
          : new Date(),
      },
    });

    return NextResponse.json({
        message: "Subscription set to cancel at period end",
        subscription: updated
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Subscription Cancel] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 },
    );
  }
});
