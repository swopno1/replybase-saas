export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Only start the worker in runtime, not during build
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { setupWorker } = await import("@/lib/queue");
      setupWorker();
      console.log("[Instrumentation] BullMQ Worker started");
    }
  }
}
