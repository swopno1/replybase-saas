# PROJECT STRUCTURE

/app
/app/api
/app/(dashboard)
/app/auth

/hooks
/lib
/lib
/prisma

## MULTI-TENANT MODEL

- Every business entity has tenantId
- tenantId is derived from session
- Never passed from client manually

## AUTH

- Already implemented
- Session contains userId + tenantId

## BILLING

- Stripe handled in /api/stripe only
- Webhooks are source of truth
