import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';




export async function GET() {
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

    // Get subscription by tenantId
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      // Ensure a free plan exists
      let freePlan = await prisma.plan.findUnique({
        where: { name: "free" },
      });

      if (!freePlan) {
        const { PLAN_CONFIGS } = await import("@/lib/plans");
        const config = PLAN_CONFIGS.free;
        freePlan = await prisma.plan.create({
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

      const created = await prisma.subscription.upsert({
        where: { tenantId: user.tenantId },
        update: {},
        create: {
          tenantId: user.tenantId,
          planId: freePlan.id,
          stripeId: `free_${user.tenantId}`,
          status: "FREE",
          currentPeriodStart: new Date(),
          currentPeriodEnd,
          trialEndsAt: null, // No trial started for Free plan
        },
        include: { plan: true },
      });

      const { getTenantUsage } = await import("@/lib/subscription");
      const usage = await getTenantUsage(user.tenantId);

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
    const usage = await getTenantUsage(user.tenantId);

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
    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId, planId } = await req.json();

    if (!priceId || !planId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Resolve Plan
    const plan = await prisma.plan.findFirst({
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

    const tenantId = session.user.tenantId;
    const subscription = await prisma.subscription.findUnique({
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
      proration_behavior: "always_invoice", // Charge/credit immediately
    });

    // Update DB
    const updated = await prisma.subscription.update({
      where: { tenantId },
      data: {
        planId: plan.id,
        updatedAt: new Date(),
      },
      include: { plan: true },
    });

    // Invalidate Cache
    const { invalidateTenantCache } = await import("@/lib/subscription");
    await invalidateTenantCache(tenantId);

    return NextResponse.json({ subscription: updated });
  } catch (error: any) {
    console.error("Subscription update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update subscription" },
      { status: 500 },
    );
  }
}
