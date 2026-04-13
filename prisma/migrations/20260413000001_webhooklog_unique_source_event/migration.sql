-- Add a scoped unique index on (source, event) for webhook_logs to prevent
-- duplicate webhook processing in concurrent/retry scenarios.
--
-- The webhook_logs table also stores operational setup events such as
-- `webchat_configure`, `connect_webhook`, etc. Those are intentionally
-- repeatable and must not be globally unique.
--
-- Dedupe keys used for idempotency are consistently colon-delimited
-- (e.g. `meta_message:<id>`, `twilio_status:<sid>:<status>`).
-- Restrict uniqueness to those keys only.
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_logs_source_event_key"
  ON "webhook_logs"("source", "event")
  WHERE "event" IS NOT NULL
    AND POSITION(':' IN "event") > 0;
