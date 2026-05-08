import { Queue, Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import crypto from "crypto";

const WEBHOOK_QUEUE_NAME = "outbound-webhooks";
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

const getQueueConnection = () => {
  if (isBuild || !redis) return undefined;
  return redis.duplicate ? redis.duplicate() : redis;
};

export const webhookQueue = isBuild
  ? (null as any)
  : new Queue(WEBHOOK_QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });

export interface WebhookJobData {
  subscriptionId: string;
  eventType: string;
  payload: any;
}

export const setupWebhookWorker = () => {
  if (isBuild) return;

  const worker = new Worker(
    WEBHOOK_QUEUE_NAME,
    async (job: Job<WebhookJobData>) => {
      const { subscriptionId, eventType, payload } = job.data;

      const subscription = await prisma.webhookSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription || !subscription.isActive) {
        logger.info({ subscriptionId }, "[WebhookWorker] Subscription not found or inactive, skipping");
        return;
      }

      const body = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-ReplyBase-Event": eventType,
        "X-ReplyBase-Delivery": job.id || "",
      };

      if (subscription.secret) {
        const signature = crypto
          .createHmac("sha256", subscription.secret)
          .update(body)
          .digest("hex");
        headers["X-ReplyBase-Signature"] = signature;
      }

      const response = await fetch(subscription.url, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error(`Webhook delivery failed with status ${response.status}`);
      }

      logger.info({ subscriptionId, eventType }, "[WebhookWorker] Webhook delivered successfully");
    },
    {
      connection: getQueueConnection(),
      concurrency: 10,
    },
  );

  return worker;
};

export async function dispatchWebhook(tenantId: string, eventType: string, payload: any) {
  if (isBuild) return;

  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      tenantId,
      isActive: true,
    },
  });

  const matchingSubscriptions = subscriptions.filter((sub) => {
    const eventTypes = sub.eventTypes as string[];
    return eventTypes.includes(eventType);
  });

  for (const sub of matchingSubscriptions) {
    await webhookQueue.add(`webhook-${sub.id}-${eventType}`, {
      subscriptionId: sub.id,
      eventType,
      payload,
    });
  }
}
