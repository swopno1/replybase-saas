import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { withAuthAndTenant } from "@/lib/route-helpers";
import logger from "@/lib/logger";

export const dynamic = 'force-dynamic';

export const GET = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    // Get subscription by tenantId
    const subscription = await db.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      // Ensure a free plan exists
      let freePlan = await db.plan.findUnique({
        where: { name: "free" },
      });

      if (!freePlan) {
        const { PLAN_CONFIGS } = await import("@/lib/plans");
        const config = PLAN_CONFIGS.free;
        freePlan = await db.plan.create({
          data: {
            name: "free",
            displayName: config.displayName,
            price: config.price,
            currency: "GBP",
            dailyMessageLimit: config.dailyMessageLimit,
            monthlyMessageLimit: config.monthlyMessageLimit,
            flowExecutionCap: config.flowExecutionCap,
            maxBots: config.maxBots,
            maxChannelsPerBot: config.maxChannelsPerBot,
            maxConversations: 100,
          },
        });
      }

      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      const created = await db.subscription.upsert({
        where: { tenantId },
        update: {},
        create: {
          tenantId,
          planId: freePlan.id,
          stripeId: `free_${tenantId}`,
          status: "FREE",
          currentPeriodStart: new Date(),
          currentPeriodEnd,
          trialEndsAt: null, // No trial started for Free plan
        },
        include: { plan: true },
      });

      const { getTenantUsage } = await import("@/lib/subscription");
      const usage = await getTenantUsage(tenantId);

      return NextResponse.json({
        subscription: {
          ...created,
          trialDaysRemaining: 0,
        },
        usage,
        invoices: [],
      });
    }

    let invoices: Array<{
      id: string;
      invoiceNumber: string;
      amount: number;
      status: string;
      paidAt: string | null;
      dueDate: string;
      downloadUrl?: string;
    }> = [];

    if (stripe && subscription.stripeCustomerId) {
      const stripeInvoices = await stripe.invoices.list({
        customer: subscription.stripeCustomerId,
        limit: 10,
      });

      invoices = stripeInvoices.data.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.number || invoice.id,
        amount: invoice.amount_due,
        status: invoice.status || "unknown",
        paidAt: invoice.status_transitions.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
          : null,
        dueDate: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString()
          : new Date(invoice.created * 1000).toISOString(),
        downloadUrl: invoice.invoice_pdf || undefined,
      }));
    }

    const { getTenantUsage } = await import("@/lib/subscription");
    const usage = await getTenantUsage(tenantId);

    const trialDaysRemaining = subscription.trialEndsAt
      ? Math.ceil(
          (subscription.trialEndsAt.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return NextResponse.json({
      subscription: {
        ...subscription,
        trialDaysRemaining: Math.max(0, trialDaysRemaining),
      },
      usage,
      invoices,
    });
  } catch (error) {
    logger.error({ error }, "[Subscription GET] Failed to fetch subscription");
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 },
    );
  }
});

export const PATCH = withAuthAndTenant(async ({ tenantId }, request, context, db) => {
  try {
    const { priceId, planId } = await request.json();

    if (!priceId || !planId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Resolve Plan
    const plan = await db.plan.findFirst({
      where: {
        OR: [
          { id: planId },
          { name: planId }
        ]
      }
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const subscription = await db.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription || !subscription.stripeId || subscription.stripeId.startsWith("free_")) {
      return NextResponse.json({ error: "No active paid subscription found to update" }, { status: 400 });
    }

    // Direct Stripe Update
    if (!stripe) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeId);

    await stripe.subscriptions.update(subscription.stripeId, {
      items: [{
        id: stripeSubscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: "always_invoice",
    });

    // Update DB — if this fails, the webhook from Stripe will correct it shortly
    let updated;
    try {
      updated = await db.subscription.update({
        where: { tenantId },
        data: { planId: plan.id, updatedAt: new Date() },
        include: { plan: true },
      });
    } catch (dbErr: any) {
      logger.error({ tenantId, error: dbErr }, "[Subscription PATCH] Stripe updated but DB write failed — webhook will reconcile");
      return NextResponse.json(
        { error: "Subscription updated in Stripe but DB sync failed. Your plan will reflect correctly within a few minutes." },
        { status: 500 },
      );
    }

    // Invalidate Cache
    const { invalidateTenantCache } = await import("@/lib/subscription");
    await invalidateTenantCache(tenantId);

    return NextResponse.json({ subscription: updated });
  } catch (error: any) {
    logger.error({ error }, "[Subscription PATCH] Failed to update subscription");
    return NextResponse.json(
      { error: error.message || "Failed to update subscription" },
      { status: 500 },
    );
  }
});
