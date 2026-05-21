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
  promoCode: z.string().optional(),
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

    const { priceId, planName, promoCode } = parsedBody.data;

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

    // 1. Resolve Stripe Customer
    // Identity Handling: Reuse customer if email exists (Rule #9)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscriptions: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    let stripeCustomerId = tenant.subscriptions?.stripeCustomerId;

    if (!stripeCustomerId && session.user.email) {
      const existingCustomers = await stripe.customers.list({
        email: session.user.email.toLowerCase(),
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        metadata: {
          userId,
          tenantId,
        },
      });
      stripeCustomerId = customer.id;
    }

    // 2. Prevent Trial Abuse (Rule #2)
    // Check if this tenant has already used a trial
    const hasUsedTrial = tenant.trialUsed;
    const trialDays = hasUsedTrial ? undefined : 14;

    const metadata: Record<string, string> = {
      userId,
      tenantId,
    };

    if (planName) {
      metadata.planName = planName;
    }

    // 3. Create Checkout Session
    // Redesign: Use /billing/success with session_id for reliable sync (Step 3)
    
    // Stripe does not allow passing both allow_promotion_codes and discounts.
    const checkoutOptions: any = {
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=true`,
      metadata,
      subscription_data: {
        metadata,
        trial_period_days: trialDays,
      },
    };

    if (promoCode) {
      // For promotion codes (not just coupons), use the coupon ID or if passing a user-facing code it must be handled differently or matched to its API ID
      // To keep it simple, we pass the user-facing string "FOUNDING50" as coupon (if Stripe is set up to accept the name as the coupon ID)
      // Actually, if it's a promotion_code, the ID was `promo_1TZSrRJlpKwK1y1z3iPZIr3o`
      // We will just use `coupon: promoCode` as it usually resolves if the coupon ID matches the name, 
      // or we can map it if we strictly know it. The user showed: API ID = promo_1TZSrRJlpKwK1y1z3iPZIr3o, Coupon = FOUNDING50
      // Often, the Coupon ID in Stripe is the same as the name if created manually.
      checkoutOptions.discounts = [{ coupon: promoCode }];
    } else {
      checkoutOptions.allow_promotion_codes = true;
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutOptions);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
