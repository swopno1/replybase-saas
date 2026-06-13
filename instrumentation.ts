import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");

    // Only start the worker in runtime, not during build
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { setupWorker } = await import("@/lib/queue");
      setupWorker();
      console.log("[Instrumentation] BullMQ Worker started");
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;

