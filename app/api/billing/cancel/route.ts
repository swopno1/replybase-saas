import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const { feedback, type } = await req.json().catch(() => ({ feedback: "", type: "CANCEL" }));

    if (feedback) {
      console.log(
        `[Subscription Feedback] ${type} from tenant ${tenantId}: ${feedback}`,
      );
      await prisma.churnFeedback.create({
        data: {
          tenantId,
          userId: session.user.id,
          type: type || "CANCEL",
          reason: feedback,
        },
      });
      
      // If it's just feedback for downgrade, we don't proceed with cancellation logic
      if (type === "DOWNGRADE") {
        return NextResponse.json({ message: "Feedback recorded" });
      }
    }

    const subscription = await prisma.subscription.findUnique({
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
      const updated = await prisma.subscription.update({
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

    const updated = await prisma.subscription.update({
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
}
