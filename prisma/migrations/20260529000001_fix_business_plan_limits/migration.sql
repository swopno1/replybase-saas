-- Fix Business plan limits
-- Sets monthlyMessageLimit and flowExecutionCap to match plans.ts config
-- Business plan: £249/month → 25,000 AI responses, 40,000 flow executions

UPDATE "plans"
SET
  "monthlyMessageLimit" = 25000,
  "flowExecutionCap"    = 40000,
  "dailyMessageLimit"   = 1500
WHERE "name" = 'business';
