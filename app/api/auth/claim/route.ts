import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

// Map plan names to Stripe price IDs sourced from env vars
const PLAN_PRICE_IDS: Record<string, { monthly: string; annual: string }> = {
  launch: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID || "",
    annual: process.env.NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID || "",
  },
  grow: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_GROW_PRICE_ID || "",
    annual: process.env.NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID || "",
  },
  scale: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID || "",
    annual: process.env.NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID || "",
  },
  business: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || "",
    annual: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID || "",
  },
};

const claimRequestSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
  email: z.string().email().toLowerCase().trim(),
  plan: z.enum(["launch", "grow", "scale", "business"]),
  source: z
    .string()
    .regex(/^[a-z0-9_-]{2,48}$/)
    .optional(),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
  promo: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: "Billing service unavailable" },
        { status: 503 },
      );
    }

    const parsed = claimRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { firstName, lastName, email, plan, source, billingCycle, promo } =
      parsed.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      return NextResponse.json(
        { error: "Configuration error" },
        { status: 500 },
      );
    }

    // 1. Guard duplicate email
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists. Please sign in instead.",
        },
        { status: 409 },
      );
    }

    // 2. Resolve price ID for selected plan + billing cycle
    const priceIds = PLAN_PRICE_IDS[plan];
    const priceId =
      billingCycle === "annual" ? priceIds.annual : priceIds.monthly;
    if (!priceId) {
      return NextResponse.json(
        { error: "Selected plan is not currently available" },
        { status: 400 },
      );
    }

    // 3. Create provisional user + tenant in one transaction.
    //    accountClaimed: false means this user has no password yet.
    //    emailVerified is left null; it will be set to now() on activation
    //    (clicking the activation link proves email ownership).
    const displayName = `${firstName} ${lastName}`.trim();

    const { userId, tenantId } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `${displayName}'s Workspace`,
          leadNotificationSettings: {
            create: { emailRecipients: [email] },
          },
        },
        select: { id: true },
      });

      const user = await tx.user.create({
        data: {
          name: displayName,
          email,
          tenantId: tenant.id,
          accountClaimed: false,
        },
        select: { id: true },
      });

      await tx.activityLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          type: "signup_intent",
          title: "Claim flow signup intent captured",
          description:
            "User entered reduced-friction claim flow — plan and source captured before checkout.",
          entityType: "signup",
          entityId: user.id,
          metadata: { plan, source: source ?? null, flow: "claim" },
        },
      });

      return { userId: user.id, tenantId: tenant.id };
    });

    // 4. Resolve Stripe customer (check for existing by email first)
    let stripeCustomerId: string | null = null;
    const existingCustomers = await stripe.customers.list({
      email: email.toLowerCase(),
      limit: 1,
    });
    if (
      existingCustomers.data.length > 0 &&
      !(existingCustomers.data[0] as any).deleted
    ) {
      stripeCustomerId = existingCustomers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email,
        name: displayName,
        metadata: { userId, tenantId },
      });
      stripeCustomerId = customer.id;
    }

    // 5. Claim users are always first-timers — always grant 14-day trial
    const trialDays = 14;

    const metadata: Record<string, string> = {
      userId,
      tenantId,
      billingCycle,
      planName: plan,
      claimed: "true",
      ...(source && { signupSource: source }),
    };

    // 6. Resolve promo — auto-apply FOUNDING50 on annual, same logic as regular checkout
    let appliedDiscount: { promotion_code: string } | null = null;
    const activePromo =
      promo || (billingCycle === "annual" ? "FOUNDING50" : undefined);

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
          logger.warn(
            { tenantId, promo: activePromo },
            "[Claim] Promo code not found or inactive — proceeding without discount",
          );
        }
      } catch (err) {
        logger.error(
          { tenantId, promo: activePromo, err },
          "[Claim] Failed to look up promo code",
        );
      }
    }

    // 7. Create Stripe checkout session.
    //    success_url points to /auth/claim/success (public, no auth required).
    const checkoutOptions: any = {
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/auth/claim/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/auth/claim?plan=${plan}&canceled=true`,
      metadata,
      subscription_data: { metadata, trial_period_days: trialDays },
    };

    if (appliedDiscount) {
      checkoutOptions.discounts = [appliedDiscount];
    } else {
      checkoutOptions.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(checkoutOptions);
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    logger.error({ error }, "[Claim] Unhandled error");
    return NextResponse.json(
      { error: "Unable to process your request. Please try again." },
      { status: 500 },
    );
  }
}
