import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import logger from "./logger";
import { APP_CONFIG } from "./config";

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
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

export interface MessageJobData {
  type: "whatsapp" | "facebook" | "telegram" | "lead_enrichment";
  botId: string;
  payload: any;
}

export const setupWorker = () => {
  if (isBuild) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<MessageJobData>) => {
      const { type, botId, payload } = job.data;
      logger.info({ jobId: job.id, type, botId }, "[Worker] Processing message job");

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
        }
      } catch (error) {
        logger.error({ jobId: job.id, error }, "[Worker] Job failed");
        throw error;
      }
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
