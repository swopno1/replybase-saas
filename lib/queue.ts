import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import logger from "./logger";

const QUEUE_NAME = "message-processing";

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

export const messageQueue = isBuild
  ? (null as any)
  : new Queue(QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

export interface MessageJobData {
  type: "whatsapp" | "facebook" | "telegram";
  payload: any;
}

export const setupWorker = () => {
  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<MessageJobData>) => {
      const { type, payload } = job.data;
      logger.info({ jobId: job.id, type }, "[Worker] Processing message job");

      try {
        if (type === "whatsapp") {
          const { processWhatsAppJob } = await import("@/lib/services/whatsapp-worker");
          await processWhatsAppJob(payload);
        } else if (type === "facebook") {
          const { processFacebookJob } = await import("@/lib/services/facebook-worker");
          await processFacebookJob(payload);
        } else if (type === "telegram") {
          const { processTelegramJob } = await import("@/lib/services/telegram-worker");
          await processTelegramJob(payload);
        }
      } catch (error) {
        logger.error({ jobId: job.id, error }, "[Worker] Job failed");
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "[Worker] Job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err }, "[Worker] Job failed");
  });

  return worker;
};
