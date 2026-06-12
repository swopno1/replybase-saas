import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import logger from "./logger";
import { APP_CONFIG } from "./config";
import * as Sentry from "@sentry/nextjs";

const QUEUE_NAME = "message-processing";

const isBuild = APP_CONFIG.meta.isBuild;

const getQueueConnection = () => {
  if (isBuild || !redis) return undefined;
  const conn = redis.duplicate ? redis.duplicate() : redis;
  if (conn.on) {
    conn.on("error", () => {});
  }
  return conn;
};

export const messageQueue = isBuild
  ? (null as any)
  : new Queue(QUEUE_NAME, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

if (!isBuild && messageQueue) {
  const originalAdd = messageQueue.add.bind(messageQueue);
  messageQueue.add = async function (name: string, data: any, opts?: any) {
    const traceData = Sentry.getTraceData();
    const enrichedData = {
      ...data,
      _sentry: {
        sentryTrace: traceData["sentry-trace"] || data?._sentry?.sentryTrace,
        baggage: traceData["baggage"] || data?._sentry?.baggage,
      },
    };
    return originalAdd(name, enrichedData, opts);
  } as any;
}

export interface MessageJobData {
  type: "whatsapp" | "facebook" | "telegram" | "lead_enrichment" | "stripe";
  botId: string;
  tenantId?: string;
  payload: any;
  _sentry?: {
    sentryTrace?: string;
    baggage?: string;
  };
}

export const setupWorker = () => {
  if (isBuild) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<MessageJobData>) => {
      const { type, botId, tenantId: jobTenantId, payload, _sentry } = job.data;
      logger.info({ jobId: job.id, type, botId }, "[Worker] Processing message job");

      const traceContext = {
        sentryTrace: _sentry?.sentryTrace,
        baggage: _sentry?.baggage,
      };

      return Sentry.continueTrace(traceContext, async () => {
        const tenantId = jobTenantId || payload?.tenantId || payload?.channel?.bot?.tenantId;
        return Sentry.startSpan(
          {
            name: `Queue Process - ${type}`,
            op: "queue.process",
            attributes: {
              "messaging.message.id": job.id || undefined,
              "messaging.destination.name": QUEUE_NAME,
              "messaging.message.retry.count": job.attemptsMade,
              tenant_id: tenantId || undefined,
              bot_id: botId || undefined,
            },
          },
          async () => {
            if (tenantId) {
              Sentry.setTag("tenant_id", tenantId);
            }
            try {
              if (type === "whatsapp") {
                const { processWhatsAppJob } = await import("@/lib/services/whatsapp-worker");
                await processWhatsAppJob({ ...payload, botId });
              } else if (type === "facebook") {
                const { processFacebookJob } = await import("@/lib/services/facebook-worker");
                await processFacebookJob({ ...payload, botId });
              } else if (type === "telegram") {
                const { processTelegramJob } = await import("@/lib/services/telegram-worker");
                await processTelegramJob({ ...payload, botId });
              } else if (type === "lead_enrichment") {
                const { LeadEnrichmentService } = await import("@/lib/services/lead-enrichment");
                const { dispatchWebhook } = await import("@/lib/services/webhook-dispatcher");
                const { prisma: db } = await import("@/lib/prisma");

                const enrichmentService = new LeadEnrichmentService(db);
                const insights = await enrichmentService.enrichLead(payload.leadId);

                // Dispatch lead.created webhook after enrichment
                await dispatchWebhook(payload.tenantId, "lead.created", {
                  ...payload.leadData,
                  insights: insights || null,
                });
              } else if (type === "stripe") {
                const { processStripeJob } = await import("@/lib/services/stripe-worker");
                await processStripeJob(payload);
              }
            } catch (error) {
              logger.error({ jobId: job.id, error }, "[Worker] Job failed");
              throw error;
            }
          }
        );
      });
    },
    {
      connection: getQueueConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "[Worker] Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err }, "[Worker] Job failed");
  });

  return worker;
};

