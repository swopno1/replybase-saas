import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { handlePlanDowngrade, getTenantUsage, invalidateTenantCache } from "./subscription";
import { Invoice, PaymentMethodInfo } from "@/types/shared/billing";
import logger from "./logger";

export async function syncSubscription(tenantId: string, stripeSubId: string) {
  if (!stripe) throw new Error("Stripe not initialized");
  const sub = await stripe.subscriptions.retrieve(stripeSubId);
  const stripeCustomerId = sub.customer as string;
  let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    logger.warn({ tenantId, stripeCustomerId }, "[Billing] Tenant not found. Attempting fallback via Customer ID");
    const existingSub = await prisma.subscription.findUnique({ where: { stripeCustomerId } });
    if (existingSub) {
      tenantId = existingSub.tenantId;
      tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    }
  }
  if (!tenant) throw new Error(`Tenant not found for ID: ${tenantId}. Cannot sync subscription ${stripeSubId}.`);
  let planName = sub.metadata?.planName;
  if (!planName) {
    const product = await stripe.products.retrieve(sub.items.data[0].price.product as string);
    planName = product.metadata?.app_plan_id;
    if (!planName) {
      const nameLower = product.name.toLowerCase();
      if (nameLower.includes("business")) planName = "business";
      else if (nameLower.includes("scale") || nameLower.includes("pro")) planName = "scale";
      else if (nameLower.includes("grow")) planName = "grow";
      else if (nameLower.includes("launch") || nameLower.includes("starter")) planName = "launch";
      else planName = "free";
    }
  }
  let dbPlan = await prisma.plan.findUnique({ where: { name: planName } });
  if (!dbPlan) {
    logger.warn({ planName }, "[Billing] Plan not found in DB. Auto-creating from central config...");
    const { getPlanConfig } = await import("./plans");
    const config = getPlanConfig(planName);
    
    dbPlan = await prisma.plan.create({ 
      data: { 
        name: planName, 
        displayName: config.displayName, 
        price: config.price, 
        currency: "GBP", 
        dailyMessageLimit: config.dailyMessageLimit, 
        monthlyMessageLimit: config.monthlyMessageLimit, 
        flowExecutionCap: config.flowExecutionCap, 
        maxBots: config.maxBots, 
        maxChannelsPerBot: config.maxChannelsPerBot, 
        maxConversations: 1000 
      } 
    });
  }
  let status = sub.status.toUpperCase();
  if (status === "UNPAID" || status === "INCOMPLETE_EXPIRED") status = "CANCELED";
  if (status === "INCOMPLETE") status = "PAST_DUE";
  const isDowngradeScheduled = sub.cancel_at_period_end;
  return await prisma.$transaction(async (tx) => {
    const existingSub = await tx.subscription.findUnique({ where: { tenantId } });
    const updatedSub = await tx.subscription.upsert({
      where: { tenantId },
      update: {
        stripeId: sub.id, stripeCustomerId, status,
        currentPeriodStart: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000) : new Date(),
        currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : new Date(),
        cancelAtPeriodEnd: !!(sub as any).cancel_at_period_end,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        planId: dbPlan!.id, downgradeScheduled: isDowngradeScheduled,
        downgradeEffectiveAt: (isDowngradeScheduled && (sub as any).current_period_end) ? new Date((sub as any).current_period_end * 1000) : null,
      },
      create: {
        tenantId, stripeId: sub.id, stripeCustomerId, status,
        currentPeriodStart: (sub as any).current_period_start ? new Date((sub as any).current_period_start * 1000) : new Date(),
        currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : new Date(),
        cancelAtPeriodEnd: !!(sub as any).cancel_at_period_end,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        planId: dbPlan!.id,
      },
    });
    if (status === "TRIALING") await tx.tenant.update({ where: { id: tenantId }, data: { trialUsed: true } });
    if (existingSub && existingSub.planId !== dbPlan!.id) await handlePlanDowngrade(tenantId, dbPlan!.id);
    await invalidateTenantCache(tenantId);
    return updatedSub;
  });
}
export async function reconcileSubscriptions() {
  if (!stripe) return;
  logger.info("[Reconciliation] Starting daily sync...");
  const activeSubs = await prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } } });
  for (const dbSub of activeSubs) {
    try { await syncSubscription(dbSub.tenantId, dbSub.stripeId); }
    catch (err) { logger.error({ tenantId: dbSub.tenantId, error: err }, "[Reconciliation] Failed to sync tenant"); }
  }
  logger.info("[Reconciliation] Sync complete.");
}
export class BillingService {
  constructor(private db: any = prisma) {}
  async getBillingData(tenantId: string) {
    let subscription = await this.db.subscription.findUnique({ where: { tenantId }, include: { plan: true } });
    if (!subscription) {
      let freePlan = await this.db.plan.findUnique({ where: { name: "free" } });
      if (!freePlan) {
        const { PLAN_CONFIGS } = await import("./plans");
        const config = PLAN_CONFIGS.free;
        freePlan = await this.db.plan.create({ 
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
            maxConversations: 100 
          } 
        });
      }
      const currentPeriodEnd = new Date(); currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      subscription = await this.db.subscription.upsert({ where: { tenantId }, update: {}, create: { tenantId, planId: freePlan.id, stripeId: `free_${tenantId}`, status: "FREE", currentPeriodStart: new Date(), currentPeriodEnd }, include: { plan: true } });
    }
    let paymentMethod: PaymentMethodInfo | null = null;
    let invoices: Invoice[] = [];
    if (stripe && subscription.stripeId && !subscription.stripeId.startsWith("free_")) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeId, { expand: ["default_payment_method"] });
        if (stripeSub.default_payment_method && typeof stripeSub.default_payment_method !== "string") {
          const pm = stripeSub.default_payment_method as Stripe.PaymentMethod;
          if (pm.card) paymentMethod = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
        }
        if (subscription.stripeCustomerId) {
          const stripeInvoices = await stripe.invoices.list({ customer: subscription.stripeCustomerId, limit: 10 });
          invoices = stripeInvoices.data.map((invoice: any): Invoice => ({ id: invoice.id, invoiceNumber: invoice.number || invoice.id, amount: invoice.amount_due, status: invoice.status || "unknown", paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null, dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : new Date(invoice.created * 1000).toISOString(), downloadUrl: invoice.invoice_pdf || undefined }));
        }
      } catch (err) { logger.error({ tenantId, error: err }, "[BillingService] Stripe fetch error"); }
    }
    const usage = await getTenantUsage(tenantId);
    const trialDaysRemaining = subscription.trialEndsAt ? Math.ceil((subscription.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    return { subscription: { ...subscription, trialDaysRemaining: Math.max(0, trialDaysRemaining) }, usage, invoices, paymentMethod };
  }
}
