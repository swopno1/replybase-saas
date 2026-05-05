import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { syncSubscription } from "@/lib/billing-service";
import { invalidateTenantCache } from "@/lib/subscription";

export const dynamic = 'force-dynamic';

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Webhook] Signature verification failed: ${errorMessage}`);
    return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
  }

  // Idempotency & Audit Check (Rule #8)
  const existingEvent = await prisma.stripeEvent.findUnique({
    where: { stripeEventId: event.id },
  });

  if (existingEvent && existingEvent.status === "PROCESSED") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Log event for audit
  const auditLog = await prisma.stripeEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      type: event.type,
      status: "PENDING",
      metadata: event.data.object as any,
    },
    update: {},
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const subscriptionId = session.subscription as string;

        if (tenantId && subscriptionId) {
          await syncSubscription(tenantId, subscriptionId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: subscription.customer as string },
        });

        if (dbSub) {
          await syncSubscription(dbSub.tenantId, subscription.id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if ((invoice as any).subscription) {
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeCustomerId: invoice.customer as string },
          });

          if (dbSub) {
            await syncSubscription(dbSub.tenantId, (invoice as any).subscription as string);

            // Rule #8: Idempotent Revenue Tracking
            await prisma.revenue.upsert({
              where: { stripeInvoiceId: invoice.id },
              create: {
                stripeInvoiceId: invoice.id,
                stripeSubscriptionId: (invoice as any).subscription as string,
                tenantId: dbSub.tenantId,
                amount: invoice.amount_paid, // Cents from Stripe
                currency: invoice.currency.toUpperCase(),
                status: "paid",
                paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
                metadata: {
                  invoice_pdf: invoice.invoice_pdf,
                  number: invoice.number,
                },
              },
              update: {
                status: "paid",
                paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
              },
            });
            console.log(`[Webhook] Revenue recorded for tenant ${dbSub.tenantId}: ${invoice.amount_paid} ${invoice.currency}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: invoice.customer as string },
        });

        if (dbSub) {
          // Rule #3: Handle failed payments -> PAST_DUE
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: { status: "PAST_DUE" },
          });
          await invalidateTenantCache(dbSub.tenantId);
          console.warn(`[Webhook] Payment failed for tenant ${dbSub.tenantId}. Status set to PAST_DUE.`);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: charge.customer as string },
        });

        if (dbSub) {
          // Rule #5: Handle refunds -> CANCELED
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: { status: "CANCELED" },
          });
          await invalidateTenantCache(dbSub.tenantId);
          console.log(`[Webhook] Charge refunded for tenant ${dbSub.tenantId}. Subscription revoked.`);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type ${event.type}`);
    }

    // Mark event as processed
    await prisma.stripeEvent.update({
      where: { id: auditLog.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Processing failed";
    console.error(`[Webhook] Error processing ${event.type}:`, errorMessage);
    
    await prisma.stripeEvent.update({
      where: { id: auditLog.id },
      data: { status: "FAILED", error: errorMessage },
    });

    return NextResponse.json(
      { error: "Webhook handling failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
