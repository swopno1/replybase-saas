-- Add a unique index on (source, event) for webhook_logs to prevent
-- duplicate webhook processing in concurrent/retry scenarios.
-- Only applied where event IS NOT NULL (event is nullable in schema).
--
-- Some production datasets already contain duplicates for non-null events.
-- Keep the newest row per (source, event) and remove older duplicates so
-- the unique index can be created safely.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source, event
      ORDER BY "createdAt" DESC, id DESC
    ) AS row_num
  FROM "webhook_logs"
  WHERE event IS NOT NULL
)
DELETE FROM "webhook_logs" w
USING ranked r
WHERE w.id = r.id
  AND r.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_logs_source_event_key"
  ON "webhook_logs"("source", "event")
  WHERE "event" IS NOT NULL;
