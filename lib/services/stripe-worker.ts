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
        } else {
          logger.warn(
            `[Stripe Worker] No DB subscription found for Stripe customer ${subscription.customer} on event ${eventType}`,
          );
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
          logger.warn(`[Stripe Worker] Payment failed for tenant ${dbSub.tenantId}. Status → PAST_DUE.`);
        }
        break;
      }

      // 3D Secure / SCA — invoice requires customer action (e.g. bank auth)
      case "invoice.payment_action_required": {
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
          logger.warn(
            `[Stripe Worker] Payment action required for tenant ${dbSub.tenantId}. Status → PAST_DUE.`,
          );
        }
        break;
      }

      // Trial ending in 3 days — log; wire up email in a dedicated notification service
      case "customer.subscription.trial_will_end": {
        const subscription = eventData;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: subscription.customer },
        });

        if (dbSub) {
          const trialEnd = subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : "unknown";
          logger.info(
            `[Stripe Worker] Trial ending for tenant ${dbSub.tenantId} at ${trialEnd}. TODO: send reminder email.`,
          );
          await prisma.activityLog.create({
            data: {
              tenantId: dbSub.tenantId,
              type: "TRIAL_ENDING_SOON",
              title: "Trial Ending Soon",
              description: `Your free trial ends on ${trialEnd}. Add a payment method to continue.`,
              metadata: { trialEnd },
            },
          });
        }
        break;
      }

      // Chargeback filed — mark for ops review, do NOT auto-cancel
      case "charge.dispute.created": {
        const dispute = eventData;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: dispute.customer },
        });

        if (dbSub) {
          logger.error(
            { tenantId: dbSub.tenantId, disputeId: dispute.id, amount: dispute.amount },
            `[Stripe Worker] Chargeback dispute created for tenant ${dbSub.tenantId}. Manual review required.`,
          );
          await prisma.activityLog.create({
            data: {
              tenantId: dbSub.tenantId,
              type: "DISPUTE_CREATED",
              title: "Chargeback Dispute Filed",
              description: `Stripe dispute ${dispute.id} for ${dispute.amount / 100} ${dispute.currency?.toUpperCase()} requires review.`,
              metadata: { disputeId: dispute.id, amount: dispute.amount, reason: dispute.reason },
            },
          });
        }
        break;
      }

      // A charge refund is NOT a subscription cancellation — log only
      case "charge.refunded": {
        const charge = eventData;
        const dbSub = await prisma.subscription.findUnique({
          where: { stripeCustomerId: charge.customer },
        });

        if (dbSub) {
          logger.info(
            { tenantId: dbSub.tenantId, chargeId: charge.id, amountRefunded: charge.amount_refunded },
            `[Stripe Worker] Charge refunded for tenant ${dbSub.tenantId}. Subscription NOT modified.`,
          );
        }
        break;
      }

      default:
        logger.info(`[Stripe Worker] Unhandled event type: ${eventType}`);
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
    // Throw so BullMQ retries (queue: attempts=3, exponential backoff)
    throw error;
  }
}
