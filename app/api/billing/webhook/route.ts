import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const dynamic = 'force-dynamic';




// Disable body parsing logic is not needed for App Router like Pages Router
// We consume req.text() which reads the stream

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }
    event = stripe!.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown webhook error";
    console.error(
      `[Stripe Webhook] Signature verification failed: ${errorMessage}`,
    );
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  const session = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = session as Stripe.Checkout.Session;
        // Metadata from checkout session creation
        const tenantId = checkoutSession.metadata?.tenantId;
        const subscriptionId = checkoutSession.subscription as string;

        if (tenantId && subscriptionId) {
          // Retrieve the subscription to get details
          const subscription =
            await stripe!.subscriptions.retrieve(subscriptionId);

          await syncSubscription(tenantId, subscription);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = session as Stripe.Subscription;
        // We need to find the tenant associated with this stripe subscription
        // We store stripeCustomerId in our DB, so let's look it up
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (dbSub) {
          await syncSubscription(dbSub.tenantId, subscription);
        } else {
          console.warn(
            `[Stripe Webhook] No database subscription found for customer ${subscription.customer}`,
          );
        }
        break;
      }

      case "invoice.paid": {
        const invoice = session as any;
        const stripeCustomerId = invoice.customer as string;
        const stripeSubscriptionId = invoice.subscription as string;

        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId },
        });

        if (dbSub) {
          await prisma.revenue.create({
            data: {
              stripeInvoiceId: invoice.id,
              stripeSubscriptionId,
              tenantId: dbSub.tenantId,
              amount: invoice.amount_paid / 100, // convert cents to currency units
              currency: invoice.currency,
              status: "paid",
              paidAt: new Date(),
              metadata: {
                invoiceUrl: invoice.hosted_invoice_url,
                invoicePdf: invoice.invoice_pdf,
              },
            },
          });
          console.log(
            `[Stripe Webhook] Recorded revenue for tenant ${dbSub.tenantId}: ${invoice.amount_paid / 100} ${invoice.currency}`,
          );
        } else {
          console.warn(
            `[Stripe Webhook] No database subscription found for customer ${stripeCustomerId} during invoice.paid`,
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = session as Stripe.Invoice;
        console.warn(
          `[Stripe Webhook] Payment failed for invoice ${invoice.id} (Customer: ${invoice.customer})`,
        );
        // We could also record this in Revenue with a "failed" status if desired
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type ${event.type}`);
    }
  } catch (error: unknown) {
    console.error("[Stripe Webhook] Error processing event:", error);
    return NextResponse.json(
      { error: "Webhook handling failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(
  tenantId: string,
  stripeSub: Stripe.Subscription,
) {
  // Type-safe casting to access Stripe subscription properties
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = stripeSub as any;

  // 1. Determine Plan based on price ID
  // We assume the first item is the main plan
  // Find our local plan that matches this price (via metadata or price lookup?)
  // Our seed script sets price = X. We can iterate limit 1.
  // Or we rely on the product name or metadata set in seed script.

  const product = await stripe!.products.retrieve(
    sub.items.data[0].price.product as string,
  );
  let planName = product.metadata.app_plan_id;

  // Fallback: If metadata is missing, try to infer from product name (e.g. "ReplyBase Pro")
  if (!planName) {
    const nameLower = product.name.toLowerCase();
    if (nameLower.includes("pro")) planName = "pro";
    else if (nameLower.includes("starter")) planName = "starter";
    else if (nameLower.includes("business")) planName = "business";
    else planName = "free";
  }

  const dbPlan = await prisma.plan.findUnique({ where: { name: planName } });

  if (!dbPlan) {
    console.error(
      `[Stripe Webhook] Sync failed: Unknown plan name '${planName}'`,
    );
    return;
  }

  await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      stripeId: sub.id,
      stripeCustomerId: sub.customer as string,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      planId: dbPlan.id,
    },
    create: {
      tenantId,
      stripeId: sub.id,
      stripeCustomerId: sub.customer as string,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      planId: dbPlan.id,
    },
  });

  console.log(
    `[Stripe Webhook] Synced subscription for tenant ${tenantId} to plan ${planName} (${sub.status})`,
  );
}
