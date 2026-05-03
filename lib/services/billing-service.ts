import { stripe } from "@/lib/stripe";
import { getTenantUsage } from "@/lib/subscription";
import { PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { Invoice, PaymentMethodInfo } from "@/types/shared/billing";

export class BillingService {
  constructor(private db: PrismaClient) {}

  async getBillingData(tenantId: string) {
    // 1. Get subscription from DB
    let subscription = await this.db.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      let freePlan = await this.db.plan.findUnique({
        where: { name: "free" },
      });

      if (!freePlan) {
        freePlan = await this.db.plan.create({
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

      subscription = await this.db.subscription.upsert({
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
    }

    // 2. Fetch live data from Stripe if available
    let paymentMethod: PaymentMethodInfo | null = null;
    let invoices: Invoice[] = [];

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

          invoices = stripeInvoices.data.map((invoice): Invoice => ({
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
        console.error("[BillingService] Stripe fetch error:", err);
      }
    }

    const usage = await getTenantUsage(tenantId);

    const trialDaysRemaining = subscription.trialEndsAt
      ? Math.ceil(
          (subscription.trialEndsAt.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return {
      subscription: {
        ...subscription,
        trialDaysRemaining: Math.max(0, trialDaysRemaining),
      },
      usage,
      invoices,
      paymentMethod,
    };
  }
}
