import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { handlePlanDowngrade } from "./subscription";

/**
 * Robust subscription synchronization service
 * Ensures local database projections match Stripe source of truth
 */
export async function syncSubscription(
  tenantId: string,
  stripeSubId: string,
) {
  if (!stripe) throw new Error("Stripe not initialized");

  const sub = (await stripe.subscriptions.retrieve(stripeSubId)) as any;
  const stripeCustomerId = sub.customer as string;

  // Ensure tenantId is valid and exists in DB
  let tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) {
    console.warn(`[Billing] Tenant ${tenantId} not found. Attempting fallback via Customer ID ${stripeCustomerId}...`);
    // Fallback: Try to find tenant by stripeCustomerId in existing subscriptions
    const existingSub = await prisma.subscription.findUnique({
      where: { stripeCustomerId }
    });
    if (existingSub) {
      tenantId = existingSub.tenantId;
      tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    }
  }

  if (!tenant) {
    // If still not found, we cannot proceed as it would violate foreign key constraints (P2003)
    throw new Error(`Tenant not found for ID: ${tenantId}. Cannot sync subscription ${stripeSubId}.`);
  }

  // 1. Map Stripe Product to Internal Plan
  // Prioritize planName from subscription metadata (set during checkout)
  let planName = sub.metadata?.planName;

  if (!planName) {
    const product = await stripe.products.retrieve(
      sub.items.data[0].price.product as string,
    );
    planName = product.metadata?.app_plan_id;

    if (!planName) {
      const nameLower = product.name.toLowerCase();
      // Improved matching order: more specific to less specific
      if (nameLower.includes("business")) planName = "business";
      else if (nameLower.includes("pro")) planName = "pro";
      else if (nameLower.includes("starter")) planName = "starter";
      else planName = "free";
    }
  }

  let dbPlan = await prisma.plan.findUnique({ where: { name: planName } });
  if (!dbPlan) {
    console.warn(`[Billing] Plan '${planName}' not found in DB. Auto-creating...`);
    
    // Define default limits based on plan name
    let dailyMessageLimit = 100;
    let monthlyMessageLimit = 3000;
    let flowExecutionCap = 100;
    let maxBots = 1;
    let price = 0;
    let displayName = "Free";

    if (planName === "starter") {
      dailyMessageLimit = 500;
      monthlyMessageLimit = 1000;
      flowExecutionCap = 1500;
      maxBots = 3;
      price = 29;
      displayName = "Starter";
    } else if (planName === "pro") {
      dailyMessageLimit = 2000;
      monthlyMessageLimit = 7500;
      flowExecutionCap = 10000;
      maxBots = 10;
      price = 89;
      displayName = "Pro";
    } else if (planName === "business") {
      dailyMessageLimit = 5000;
      monthlyMessageLimit = 25000;
      flowExecutionCap = 40000;
      maxBots = 25;
      price = 249;
      displayName = "Business";
    }

    dbPlan = await prisma.plan.create({
      data: {
        name: planName,
        displayName: displayName,
        price: price,
        currency: "GBP",
        dailyMessageLimit,
        monthlyMessageLimit,
        flowExecutionCap,
        maxBots,
        maxChannelsPerBot: 5,
        maxConversations: 1000,
      },
    });
  }

  // 2. Map Stripe Status to Strict State Machine (Rule #1)
  let status = sub.status.toUpperCase();
  if (status === "UNPAID" || status === "INCOMPLETE_EXPIRED") status = "CANCELED";
  if (status === "INCOMPLETE") status = "PAST_DUE";

  // 3. Handle Downgrade Logic (Rule #7)
  const isDowngradeScheduled = sub.cancel_at_period_end;
  
  return await prisma.$transaction(async (tx) => {
    const existingSub = await tx.subscription.findUnique({ where: { tenantId } });

    // If downgrading/reverting to free at period end
    if (status === "CANCELED" || (isDowngradeScheduled && sub.status !== "trialing")) {
      // Logic for downgrade consequences can be triggered here or via a separate job at period_end
    }

    const updatedSub = await tx.subscription.upsert({
      where: { tenantId },
      update: {
        stripeId: sub.id,
        stripeCustomerId,
        status: status,
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : new Date(),
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date(),
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        planId: dbPlan.id,
        downgradeScheduled: isDowngradeScheduled,
        downgradeEffectiveAt: (isDowngradeScheduled && sub.current_period_end) ? new Date(sub.current_period_end * 1000) : null,
      },
      create: {
        tenantId,
        stripeId: sub.id,
        stripeCustomerId,
        status: status,
        currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : new Date(),
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date(),
        cancelAtPeriodEnd: !!sub.cancel_at_period_end,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        planId: dbPlan.id,
      },
    });

    // Abuse Prevention: Track trial usage (Rule #9)
    if (status === "TRIALING") {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { trialUsed: true },
      });
    }

    // Apply immediate downgrade consequences if plan actually changed (e.g. mid-cycle adjustment)
    if (existingSub && existingSub.planId !== dbPlan.id) {
       await handlePlanDowngrade(tenantId, dbPlan.id);
    }

    return updatedSub;
  });
}

/**
 * Reconciliation job: Sync all active/trialing subscriptions to prevent drift (Rule #8)
 */
export async function reconcileSubscriptions() {
  if (!stripe) return;
  
  console.log("[Reconciliation] Starting daily sync...");
  const activeSubs = await prisma.subscription.findMany({
    where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } }
  });

  for (const dbSub of activeSubs) {
    try {
      await syncSubscription(dbSub.tenantId, dbSub.stripeId);
    } catch (err) {
      console.error(`[Reconciliation] Failed to sync tenant ${dbSub.tenantId}:`, err);
    }
  }
  console.log("[Reconciliation] Sync complete.");
}
