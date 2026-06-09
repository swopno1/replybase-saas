import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { withAuthAndTenant } from "@/lib/route-helpers";
import logger from "@/lib/logger";

export const dynamic = 'force-dynamic';

export const POST = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const subscription = await db.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 },
      );
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Billing service unavailable" },
        { status: 503 },
      );
    }

    const stripeSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
    });

    return NextResponse.json({ url: stripeSession.url });
  } catch (error: unknown) {
    logger.error({ error }, "[Billing Portal] Failed to create portal session");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
});
