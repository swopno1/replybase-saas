# Multi-Tenant Isolation Audit

**Date:** 2026-05-08
**Status:** **SECURE (PREVIOUS IDOR VULNERABILITY REMEDIATED)**
**Auditor:** QA Director / Malicious Tenant Persona

## 1. The "Malicious Tenant" Threat Model
A malicious tenant (Tenant A) signs up for a free account. They extract their session token and begin fuzzing the `/api/` endpoints, replacing their `tenantId` or `botId` with UUIDs belonging to Tenant B.

## 2. Prisma Query Isolation
*   **Previous Findings:** A critical IDOR (Insecure Direct Object Reference) risk existed in `lib/bot-entry-flow-engine.ts`, where contact records were fetched using only `contactId` via `prisma.contact.findUnique`.
*   **Remediation Confirmed:** This vulnerability was **fixed**. The query was refactored to `prisma.contact.findFirst` with a strict, compound `where: { id: params.contactId, tenantId: params.tenantId }` clause. 
*   **Verdict:** The bot execution engine is now strictly isolated by tenant ID at the database layer. This ensures that webhook spoofing cannot leak cross-tenant PII (Name, Phone, Email) into AI contexts or bot variables.

## 3. Dashboard Data Bleed
*   **Findings:** The dashboard UI fetches data based on the logged-in user securely.
*   **Verdict:** The backend successfully ignores client-provided `tenantId` payloads and relies strictly on the server-side JWT session token for derivation.

## 4. Cross-Tenant Webhook Leakage
*   **Findings:** Webhooks arrive globally but are routed based on channel credentials verified by Meta/Stripe.
*   **Verdict:** Secure. 
