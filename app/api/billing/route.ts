import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { authOptions } from "@/lib/auth";
import { getTenantUsage } from "@/lib/subscription";
import Stripe from "stripe";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 403 });
    }

    // 1. Get subscription from DB
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      // Fallback for tenants without subscription record (newly created)
      // This logic mirrors what was in /api/billing/subscription/route.ts
      let freePlan = await prisma.plan.findUnique({
        where: { name: "free" },
      });

      if (!freePlan) {
        freePlan = await prisma.plan.create({
          data: {
            name: "free",
            displayName: "Free",
            price: 0,
            currency: "GBP",
            dailyMessageLimit: 100,
            monthlyMessageLimit: 3000,
            flowExecutionCap: 100,
            maxBots: 1,
            maxChannelsPerBot: 1,
            maxConversations: 100,
          },
        });
      }

      const currentPeriodEnd = new Date();
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

      const created = await prisma.subscription.upsert({
        where: { tenantId },
        update: {},
        create: {
          tenantId,
          planId: freePlan.id,
          stripeId: `free_${tenantId}`,
          status: "FREE",
          currentPeriodStart: new Date(),
          currentPeriodEnd,
        },
        include: { plan: true },
      });

      const usage = await getTenantUsage(tenantId);

      return NextResponse.json({
        subscription: created,
        usage,
        invoices: [],
        paymentMethod: null,
      });
    }

    // 2. Fetch live data from Stripe if available
    let paymentMethod = null;
    let invoices: any[] = [];

    if (stripe && subscription.stripeId && !subscription.stripeId.startsWith("free_")) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeId, {
          expand: ["default_payment_method"],
        });

        if (stripeSub.default_payment_method && typeof stripeSub.default_payment_method !== "string") {
          const pm = stripeSub.default_payment_method as Stripe.PaymentMethod;
          if (pm.card) {
            paymentMethod = {
              brand: pm.card.brand,
              last4: pm.card.last4,
              expMonth: pm.card.exp_month,
              expYear: pm.card.exp_year,
            };
          }
        }

        if (subscription.stripeCustomerId) {
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
      } catch (err) {
        console.error("[Billing API] Stripe fetch error:", err);
        // Continue with DB data if Stripe fails
      }
    }

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
      paymentMethod,
    });
  } catch (error) {
    console.error("[Billing API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing data" },
      { status: 500 },
    );
  }
}
