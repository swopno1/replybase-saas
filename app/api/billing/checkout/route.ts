import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";
import { withAuthAndTenant } from "@/lib/route-helpers";
import logger from "@/lib/logger";

export const dynamic = 'force-dynamic';

const checkoutRequestSchema = z.object({
  priceId: z.string().min(1),
  planName: z.string().optional(),
  promoCode: z.string().optional(),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
  source: z.string().max(100).optional(),
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

    const { priceId, planName, promoCode, billingCycle, source } = parsedBody.data;

    const { id: userId, tenantId, email, name: userName } = user;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "Billing configuration error" },
        { status: 500 },
      );
    }

    // 1. Resolve tenant and guard against duplicate active subscriptions
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: { subscriptions: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const existingSub = (tenant as any).subscriptions;
    if (
      existingSub &&
      !existingSub.stripeId?.startsWith("free_") &&
      ["ACTIVE", "TRIALING"].includes(existingSub.status)
    ) {
      return NextResponse.json(
        { error: "An active subscription already exists. Use the billing portal to make changes." },
        { status: 409 },
      );
    }

    // 2. Resolve Stripe Customer — verify any cached customer ID is not deleted
    let stripeCustomerId = existingSub?.stripeCustomerId;

    if (stripeCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(stripeCustomerId);
        if ((existing as any).deleted) {
          logger.warn({ tenantId, stripeCustomerId }, "[Checkout] Cached Stripe customer is deleted — creating a new one");
          stripeCustomerId = null;
        }
      } catch {
        stripeCustomerId = null;
      }
    }

    if (!stripeCustomerId && email) {
      const existingCustomers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        const candidate = existingCustomers.data[0];
        stripeCustomerId = (candidate as any).deleted ? null : candidate.id;
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name: userName || undefined,
        metadata: { userId, tenantId },
      });
      stripeCustomerId = customer.id;
    }

    // 3. Prevent Trial Abuse
    const hasUsedTrial = (tenant as any).trialUsed;
    const trialDays = hasUsedTrial ? undefined : 14;

    const metadata: Record<string, string> = {
      userId,
      tenantId,
      billingCycle,
      planName: planName || "",
      ...(source ? { source } : {}),
    };

    // 4. Resolve promo code
    // Stripe does not allow allow_promotion_codes and discounts together —
    // if a discount is pre-applied, promotion code field is removed from the session.
    let appliedDiscount: { promotion_code: string } | null = null;
    const activePromo = promoCode || (billingCycle === "annual" ? "FOUNDING50" : undefined);

    if (activePromo) {
      try {
        const promoCodes = await stripe.promotionCodes.list({
          code: activePromo,
          active: true,
          limit: 1,
        });

        if (promoCodes.data.length > 0) {
          appliedDiscount = { promotion_code: promoCodes.data[0].id };
        } else {
          logger.warn({ tenantId, promoCode: activePromo }, "[Checkout] Promo code not found or inactive — checkout proceeds without discount");
        }
      } catch (err) {
        logger.error({ tenantId, promoCode: activePromo, err }, "[Checkout] Failed to look up promo code — proceeding without discount");
      }
    }

    // 5. Create Checkout Session
    const checkoutOptions: any = {
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?canceled=true`,
      metadata,
      subscription_data: { metadata, trial_period_days: trialDays },
    };

    if (appliedDiscount) {
      // Pre-applied discount: customer sees it locked in, cannot enter another code
      checkoutOptions.discounts = [appliedDiscount];
    } else {
      // No pre-applied discount: let customer enter any code manually
      checkoutOptions.allow_promotion_codes = true;
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutOptions);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    logger.error({ error }, "[Checkout] Unhandled error creating checkout session");
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
});
