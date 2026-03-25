import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = 'force-dynamic';




export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const subscription = await prisma.subscription.findFirst({
      where: {
        id,
        tenantId: session.user.tenantId,
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
      const updated = await prisma.subscription.update({
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
    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      },
    });

    return NextResponse.json({ subscription: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Subscription Cancel] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: message },
      { status: 500 },
    );
  }
}
