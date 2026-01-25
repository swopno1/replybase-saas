import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId, planName } = await req.json();

    if (!priceId) {
      return NextResponse.json({ error: "Price ID is required" }, { status: 400 });
    }

    const userId = session.user.id;
    const tenantId = session.user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });
    }

    // 1. Get or Create Stripe Customer
    // Check if subscription already exists with a stripe customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    let stripeCustomerId = subscription?.stripeCustomerId;

    if (!stripeCustomerId) {
      // Create new customer
      const customer = await stripe!.customers.create({
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        metadata: {
          userId,
          tenantId,
        },
      });
      stripeCustomerId = customer.id;

      // Upsert subscription record with just the customer ID for now
      // Webhook will fill in the rest
      await prisma.subscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          stripeCustomerId,
          status: "dangling_customer", // Temporary status until checkout completes
          planId: (await prisma.plan.findUnique({ where: { name: 'free' } }))?.id || "missing_free_plan",
          currentPeriodEnd: new Date(),
          stripeId: `temp_${Date.now()}` // Temporary ID
        },
        update: {
          stripeCustomerId
        }
      });
    }

    // 2. Create Checkout Session
    const checkoutSession = await stripe!.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
      metadata: {
        userId,
        tenantId,
        planName
      },
      subscription_data: {
        metadata: {
          tenantId,
          planName
        }
      }
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
