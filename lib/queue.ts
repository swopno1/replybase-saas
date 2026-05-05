import { Queue, Worker, Job } from "bullmq";
import { redis } from "./redis";
import logger from "./logger";

const QUEUE_NAME = "message-processing";

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

// BullMQ needs dedicated connections for the Queue and Worker to avoid
// blocking other commands. We duplicate the main connection and attach
// error listeners to prevent unsilenced connection errors from flooding the console.
const getQueueConnection = () => {
  if (isBuild || !redis) return undefined;
  // If redis is already a proxy/mock, it will return a mock
  const conn = redis.duplicate ? redis.duplicate() : redis;
  if (conn.on) {
    conn.on("error", () => {
      /* Silenced — handled by the main redis instance logger */
    });
  }
  return conn;
};

export const messageQueue = isBuild
  ? (null as any)
  : new Queue(QUEUE_NAME, {
      connection: getQueueConnection(),
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
  if (isBuild) return;

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job<MessageJobData>) => {
      const { type, payload } = job.data;
      logger.info({ jobId: job.id, type }, "[Worker] Processing message job");

      try {
        if (type === "whatsapp") {
          const { processWhatsAppJob } = await import(
            "@/lib/services/whatsapp-worker"
          );
          await processWhatsAppJob(payload);
        } else if (type === "facebook") {
          const { processFacebookJob } = await import(
            "@/lib/services/facebook-worker"
          );
          await processFacebookJob(payload);
        } else if (type === "telegram") {
          const { processTelegramJob } = await import(
            "@/lib/services/telegram-worker"
          );
          await processTelegramJob(payload);
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
