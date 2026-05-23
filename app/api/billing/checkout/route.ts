import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";

export const dynamic = 'force-dynamic';

const checkoutRequestSchema = z.object({
  priceId: z.string().min(1),
  planName: z.string().optional(),
  promoCode: z.string().optional(),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
});

export const POST = withAuthAndTenant(async (user, request, context, db) => {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Billing service unavailable" },
        { status: 503 },
      );
    }

    const parsedBody = checkoutRequestSchema.safeParse(await request.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsedBody.error.issues },
        { status: 400 },
      );
    }

    const { priceId, planName, promoCode, billingCycle } = parsedBody.data;

    const { id: userId, tenantId, email, name: userName } = user;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "Billing configuration error" },
        { status: 500 },
      );
    }

    // 1. Resolve Stripe Customer
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { subscriptions: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    let stripeCustomerId = (tenant as any).subscriptions?.stripeCustomerId;

    if (!stripeCustomerId && email) {
      const existingCustomers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: userName || undefined,
        metadata: {
          userId,
          tenantId,
        },
      });
      stripeCustomerId = customer.id;
    }

    // 2. Prevent Trial Abuse
    const hasUsedTrial = (tenant as any).trialUsed;
    const trialDays = hasUsedTrial ? undefined : 14;

    const metadata: Record<string, string> = {
      userId,
      tenantId,
      billingCycle,
    };

    if (planName) {
      metadata.planName = planName;
    }

    // 3. Create Checkout Session
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
      allow_promotion_codes: true, // Always allow manual entry
    };

    // 4. Handle Founding Offer & Coupons
    const activePromo = promoCode || (billingCycle === "annual" ? "FOUNDING50" : undefined);
    if (activePromo) {
      try {
        const promoCodes = await stripe.promotionCodes.list({
          code: activePromo,
          active: true,
          limit: 1,
        });

        if (promoCodes.data.length > 0) {
          checkoutOptions.discounts = [
            {
              promotion_code: promoCodes.data[0].id,
            },
          ];
        } else {
          console.warn(`[Stripe Checkout] Active promotion code '${activePromo}' not found in Stripe`);
        }
      } catch (err) {
        console.error(`[Stripe Checkout] Failed to fetch/apply promo code '${activePromo}':`, err);
      }
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
});
