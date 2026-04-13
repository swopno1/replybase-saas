-- Add a unique index on (source, event) for webhook_logs to prevent
-- duplicate webhook processing in concurrent/retry scenarios.
-- Only applied where event IS NOT NULL (event is nullable in schema).
CREATE UNIQUE INDEX "webhook_logs_source_event_key"
  ON "webhook_logs"("source", "event")
  WHERE "event" IS NOT NULL;
