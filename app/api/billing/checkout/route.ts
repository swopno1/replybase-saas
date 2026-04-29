import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { randomUUID } from "node:crypto";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = 'force-dynamic';




const checkoutRequestSchema = z.object({
  priceId: z.string().min(1),
  planName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Billing service unavailable" },
        { status: 503 },
      );
    }

    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = checkoutRequestSchema.safeParse(await req.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { priceId, planName } = parsedBody.data;

    const userId = session.user.id;
    const tenantId = session.user.tenantId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID missing" }, { status: 400 });
    }

    if (!appUrl) {
      return NextResponse.json(
        { error: "Billing configuration error" },
        { status: 500 },
      );
    }

    // 1. Get or Create Stripe Customer
    // Check if subscription already exists with a stripe customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    let stripeCustomerId: string | undefined =
      subscription?.stripeCustomerId ?? undefined;

    if (!stripeCustomerId) {
      // Create new customer
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        metadata: {
          userId,
          tenantId,
        },
      });
      stripeCustomerId = customer.id;

      const freePlan = await prisma.plan.findUnique({
        where: { name: "free" },
      });
      if (!freePlan) {
        console.error(
          "[Stripe Checkout] Missing required 'free' plan in database",
        );
        return NextResponse.json(
          { error: "Billing configuration error" },
          { status: 500 },
        );
      }

      // Upsert subscription record with just the customer ID for now
      // Webhook will fill in the rest
      await prisma.subscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          stripeCustomerId,
          status: "dangling_customer", // Temporary status until checkout completes
          planId: freePlan.id,
          currentPeriodEnd: new Date(),
          stripeId: `temp_${randomUUID()}`, // Temporary ID
        },
        update: {
          stripeCustomerId,
        },
      });
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Failed to resolve Stripe customer" },
        { status: 500 },
      );
    }

    const metadata: Record<string, string> = {
      userId,
      tenantId,
    };

    if (planName) {
      metadata.planName = planName;
    }

    // 2. Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=canceled`,
      metadata,
      subscription_data: {
        metadata,
        trial_period_days: 14,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
