-- Remove legacy plan names: "starter" (alias of launch) and "pro" (alias of scale)
-- Any subscription still pointing at these rows is migrated to the canonical plan first.

-- 1. Migrate starter → launch
UPDATE "subscriptions"
SET "planId" = (SELECT id FROM "plans" WHERE name = 'launch')
WHERE "planId" IN (SELECT id FROM "plans" WHERE name = 'starter');

-- 2. Migrate pro → scale
UPDATE "subscriptions"
SET "planId" = (SELECT id FROM "plans" WHERE name = 'scale')
WHERE "planId" IN (SELECT id FROM "plans" WHERE name = 'pro');

-- 3. Delete the legacy rows (safe now — no FK references remain)
DELETE FROM "plans" WHERE name IN ('starter', 'pro');
