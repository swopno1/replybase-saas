import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { withAuthAndTenant } from "@/lib/route-helpers";
import logger from "@/lib/logger";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async ({ id: userId, tenantId }, request, context, db) => {
  try {
    const { feedback, type } = await request.json().catch(() => ({ feedback: "", type: "CANCEL" }));

    // DOWNGRADE is feedback-only: record it (if provided) and return — never cancel.
    if (type === "DOWNGRADE") {
      if (feedback) {
        logger.info({ tenantId }, "[Cancel] DOWNGRADE feedback recorded");
        await db.churnFeedback.create({
          data: { tenantId, userId, type: "DOWNGRADE", reason: feedback },
        });
      }
      return NextResponse.json({ message: "Feedback recorded" });
    }

    if (feedback) {
      logger.info({ tenantId }, "[Cancel] CANCEL feedback recorded");
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

    // Subscriptions in these states are already terminal — Stripe rejects any
    // update attempt with invalid_request_error. Just mark the DB record and return.
    const TERMINAL_STATUSES = ["INCOMPLETE_EXPIRED", "CANCELED"];
    const isTerminal = TERMINAL_STATUSES.includes(
      subscription.status?.toUpperCase() ?? "",
    );

    // Handle FREE plans, no stripe ID, or terminal Stripe states
    if (
      !stripe ||
      !subscription.stripeId ||
      subscription.stripeId.startsWith("free_") ||
      isTerminal
    ) {
      const updated = await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "CANCELED",
          cancelAtPeriodEnd: true,
        },
      });
      return NextResponse.json({
        message: "Subscription set to cancel at period end",
        subscription: updated,
      });
    }

    // Set cancel_at_period_end = true in Stripe
    let stripeSub: Awaited<ReturnType<typeof stripe.subscriptions.update>>;
    try {
      stripeSub = await stripe.subscriptions.update(subscription.stripeId, {
        cancel_at_period_end: true,
      });
    } catch (stripeErr: any) {
      if (stripeErr.code === "resource_missing") {
        // Subscription no longer exists in Stripe — mark DB record as canceled
        const updated = await db.subscription.update({
          where: { id: subscription.id },
          data: { status: "CANCELED", cancelAtPeriodEnd: true },
        });
        return NextResponse.json({
          message: "Subscription set to cancel at period end",
          subscription: updated,
        });
      }
      throw stripeErr;
    }

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
    logger.error({ error }, "[Cancel] Unhandled error cancelling subscription");
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 },
    );
  }
});
