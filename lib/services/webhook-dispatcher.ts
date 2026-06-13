import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";

const MAX_CONSECUTIVE_FAILURES = 10;
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Executes a single webhook delivery attempt for a given subscription.
 * Called by the message-processing worker under the "webhook_delivery" job type.
 */
export async function executeWebhookDelivery(
  subscriptionId: string,
  eventType: string,
  payload: any,
  jobId: string | undefined
) {
  return Sentry.startSpan(
    {
      name: `Webhook Delivery - ${eventType}`,
      op: "webhook.deliver",
      attributes: {
        "webhook.subscription.id": subscriptionId,
        "webhook.event_type": eventType,
      },
    },
    async () => {
      const subscription = await prisma.webhookSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription || !subscription.isActive) {
        logger.info({ subscriptionId }, "[WebhookWorker] Subscription not found or inactive, skipping");
        return;
      }

      Sentry.setTag("tenant_id", subscription.tenantId);

      const body = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-ReplyBase-Event": eventType,
        "X-ReplyBase-Delivery": jobId || "",
      };

      if (subscription.secret) {
        const signature = crypto
          .createHmac("sha256", subscription.secret)
          .update(body)
          .digest("hex");
        headers["X-ReplyBase-Signature"] = `sha256=${signature}`;
      }

      let statusCode: number | undefined;
      let success = false;
      let errorMessage: string | undefined;

      try {
        const response = await fetch(subscription.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(10_000),
        });

        statusCode = response.status;
        success = response.ok;

        if (!response.ok) {
          errorMessage = `HTTP ${response.status}`;
          throw new Error(`Webhook delivery failed with status ${response.status}`);
        }

        logger.info({ subscriptionId, eventType }, "[WebhookWorker] Webhook delivered successfully");
      } catch (err) {
        if (!errorMessage) {
          errorMessage = err instanceof Error ? err.message : "Unknown error";
        }
        throw err;
      } finally {
        await prisma.webhookDeliveryLog.create({
          data: {
            subscriptionId,
            tenantId: subscription.tenantId,
            eventType,
            url: subscription.url,
            statusCode,
            success,
            errorMessage,
          },
        });

        if (success) {
          await prisma.webhookSubscription.update({
            where: { id: subscriptionId },
            data: { failureCount: 0, lastDeliveredAt: new Date() },
          });
        } else {
          const newFailureCount = (subscription.failureCount ?? 0) + 1;
          const shouldDisable = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

          await prisma.webhookSubscription.update({
            where: { id: subscriptionId },
            data: {
              failureCount: newFailureCount,
              ...(shouldDisable && { isActive: false }),
            },
          });

          if (shouldDisable) {
            logger.warn(
              { subscriptionId, tenantId: subscription.tenantId },
              "[WebhookWorker] Subscription disabled after 10 consecutive failures"
            );
          }
        }
      }
    }
  );
}

export async function dispatchWebhook(tenantId: string, eventType: string, payload: any) {
  if (isBuild) return;

  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { tenantId, isActive: true },
  });

  const matchingSubscriptions = subscriptions.filter((sub) => {
    const eventTypes = sub.eventTypes as string[];
    return eventTypes.includes(eventType);
  });

  if (matchingSubscriptions.length === 0) return;

  const { messageQueue } = await import("@/lib/queue");

  for (const sub of matchingSubscriptions) {
    await messageQueue.add(
      `webhook-${sub.id}-${eventType}`,
      {
        type: "webhook_delivery",
        tenantId,
        payload: {
          subscriptionId: sub.id,
          eventType,
          data: payload,
        },
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      }
    );
  }
}

export { SUPPORTED_WEBHOOK_EVENTS, type WebhookEventType } from "@/lib/webhook-events";
