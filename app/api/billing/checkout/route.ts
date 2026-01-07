import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { stripe, PLANS } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 500 }
    );
  }
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    const { planKey } = await req.json();
    const plan = PLANS[planKey as keyof typeof PLANS];

    if (!plan || !plan.priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    let customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
      });
      customerId = customer.id;

      if (subscription) {
        await prisma.subscription.update({
          where: { tenantId: user.tenantId },
          data: { stripeCustomerId: customerId },
        });
      } else {
        // If no subscription exists, create one with customer ID
        await prisma.subscription.create({
          data: {
            tenantId: user.tenantId,
            stripeCustomerId: customerId,
            planId: plan.priceId, // Assuming plan.id is available
            stripeId: "", // Placeholder, will be updated after Stripe
            currentPeriodEnd: new Date(), // Placeholder
          },
        });
      }
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
