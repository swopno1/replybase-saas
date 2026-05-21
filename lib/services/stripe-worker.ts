import { prisma } from "@/lib/prisma";
import { syncSubscription } from "@/lib/billing-service";
import { invalidateTenantCache } from "@/lib/subscription";
import logger from "@/lib/logger";

export async function processStripeJob(payload: { stripeEventId: string }) {
  const { stripeEventId } = payload;
  const auditLog = await prisma.stripeEvent.findUnique({
    where: { stripeEventId },
  });

  if (!auditLog) {
    logger.error(`[Stripe Worker] Stripe event ${stripeEventId} not found`);
    return;
  }

  if (auditLog.status === "PROCESSED") {
    return;
  }

  const eventType = auditLog.type;
  const eventData = auditLog.metadata as any;

  try {
    switch (eventType) {
      case "checkout.session.completed": {
        const session = eventData;
        const tenantId = session.metadata?.tenantId;
        const subscriptionId = session.subscription;

        if (tenantId && subscriptionId) {
          await syncSubscription(tenantId, subscriptionId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = eventData;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: subscription.customer },
        });

        if (dbSub) {
          await syncSubscription(dbSub.tenantId, subscription.id);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = eventData;
        if (invoice.subscription) {
          const dbSub = await prisma.subscription.findUnique({
            where: { stripeCustomerId: invoice.customer },
          });

          if (dbSub) {
            await syncSubscription(dbSub.tenantId, invoice.subscription);

            await prisma.revenue.upsert({
              where: { stripeInvoiceId: invoice.id },
              create: {
                stripeInvoiceId: invoice.id,
                stripeSubscriptionId: invoice.subscription,
                tenantId: dbSub.tenantId,
                amount: invoice.amount_paid,
                currency: invoice.currency.toUpperCase(),
                status: "paid",
                paidAt: new Date(invoice.status_transitions.paid_at * 1000),
                metadata: {
                  invoice_pdf: invoice.invoice_pdf,
                  number: invoice.number,
                },
              },
              update: {
                status: "paid",
                paidAt: new Date(invoice.status_transitions.paid_at * 1000),
              },
            });
            logger.info(`[Stripe Worker] Revenue recorded for tenant ${dbSub.tenantId}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = eventData;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: invoice.customer },
        });

        if (dbSub) {
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: { status: "PAST_DUE" },
          });
          await invalidateTenantCache(dbSub.tenantId);
          logger.warn(`[Stripe Worker] Payment failed for tenant ${dbSub.tenantId}. PAST_DUE.`);
        }
        break;
      }

      case "charge.refunded": {
        const charge = eventData;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: charge.customer },
        });

        if (dbSub) {
          await prisma.subscription.update({
            where: { id: dbSub.id },
            data: { status: "CANCELED" },
          });
          await invalidateTenantCache(dbSub.tenantId);
          logger.info(`[Stripe Worker] Charge refunded for tenant ${dbSub.tenantId}. CANCELED.`);
        }
        break;
      }

      default:
        logger.info(`[Stripe Worker] Unhandled event type ${eventType}`);
    }

    await prisma.stripeEvent.update({
      where: { id: auditLog.id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  } catch (error: any) {
    logger.error({ error }, `[Stripe Worker] Processing failed for ${stripeEventId}`);
    
    await prisma.stripeEvent.update({
      where: { id: auditLog.id },
      data: { status: "FAILED", error: error.message || "Unknown error" },
    });
    throw error;
  }
}
