export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupWorker } = await import("@/lib/queue");
    setupWorker();
    console.log("[Instrumentation] BullMQ Worker started");
  }
}
