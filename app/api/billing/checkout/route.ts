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
    let effectivePromoCode = promoCode;

    // Auto-apply FOUNDING50 for annual plans if requested
    if (billingCycle === "annual" && (promoCode === "FOUNDING50" || !promoCode)) {
       // We can either auto-apply or just allow it.
       // For the founding offer, we'll auto-apply if it's annual and no other code is provided
       // Note: In production, you might want to verify coupon validity here first.
       if (!promoCode) effectivePromoCode = "FOUNDING50";
    }

    if (effectivePromoCode) {
      // If a specific code is provided, we can either validate it here or let Stripe handle it.
      // Stripe Checkout discounts array requires a coupon ID (not necessarily the promo code string).
      // For simplicity, we'll use allow_promotion_codes: true and handle FOUNDING50 specially if needed.

      // If we want to FORCE a coupon (Founding Offer), we use 'discounts'
      if (effectivePromoCode === "FOUNDING50" && billingCycle === "annual") {
          // checkoutOptions.discounts = [{ coupon: "FOUNDING50" }];
          // NOTE: Usually you'd use the Coupon ID from Stripe.
          // To be safe and flexible, we'll just let the user enter it OR pass it via URL
          // and let Stripe handle the validation.
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
