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

  // 1. Map Stripe Product to Internal Plan
  const product = await stripe.products.retrieve(
    sub.items.data[0].price.product as string,
  );
  let planName = product.metadata.app_plan_id;

  if (!planName) {
    const nameLower = product.name.toLowerCase();
    if (nameLower.includes("pro")) planName = "pro";
    else if (nameLower.includes("starter")) planName = "starter";
    else if (nameLower.includes("business")) planName = "business";
    else planName = "free";
  }

  const dbPlan = await prisma.plan.findUnique({ where: { name: planName } });
  if (!dbPlan) throw new Error(`Unknown plan: ${planName}`);

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
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        planId: dbPlan.id,
        downgradeScheduled: isDowngradeScheduled,
        downgradeEffectiveAt: isDowngradeScheduled ? new Date(sub.current_period_end * 1000) : null,
      },
      create: {
        tenantId,
        stripeId: sub.id,
        stripeCustomerId,
        status: status,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
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
