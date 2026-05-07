import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import logger from "./logger";

const QUEUE_NAME = "message-processing";

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

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
  type: "whatsapp" | "facebook" | "telegram";
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
