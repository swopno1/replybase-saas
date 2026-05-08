# Multi-Tenant Isolation Audit

**Date:** 2026-05-08
**Status:** **HIGH RISK (Architectural Vigilance Required)**
**Auditor:** QA Director / Malicious Tenant Persona

## 1. The "Malicious Tenant" Threat Model
A malicious tenant (Tenant A) signs up for a free account. They extract their session token and begin fuzzing the `/api/` endpoints, replacing their `tenantId` or `botId` with UUIDs belonging to Tenant B.

## 2. Prisma Query Isolation
*   **Findings:** The codebase uses standard Prisma queries (`prisma.model.findFirst`). 
*   **Vulnerability Pattern:** Any query that looks up a resource by its ID *without* compounding it with the `tenantId` is vulnerable to IDOR (Insecure Direct Object Reference).
    *   *Example of Vulnerable Code:* `prisma.crmConversation.findUnique({ where: { id: req.body.conversationId } })`
    *   *Example of Secure Code:* `prisma.crmConversation.findFirst({ where: { id: req.body.conversationId, tenantId: session.user.tenantId } })`
*   **Audit Results:** While `lib/prisma-tenant.ts` was introduced, direct `prisma.*` usage is still widespread. The `bot-entry-flow-engine.ts` heavily relies on `contactId` and `scopeKey` without explicitly querying by `tenantId` in every internal step. While `contactId` acts as a pseudo-barrier, it is structurally weaker than a hard `tenantId` constraint.

## 3. Dashboard Data Bleed
*   **Findings:** The dashboard UI fetches data based on the logged-in user.
*   **Risks:** If an API endpoint (e.g., Export Leads) relies on a client-provided `tenantId` rather than extracting it securely from the server-side session, Tenant A can export Tenant B's leads.
*   **Verdict:** Enforce a strict backend rule: *Never trust a `tenantId` provided in the request body or query params.* Always derive `tenantId` from the verified JWT/Session.

## 4. Cross-Tenant Webhook Leakage
*   **Findings:** Webhooks arrive globally to `/api/facebook/webhook`.
*   **Risks:** The webhook must securely map the `recipient.id` (Page ID) to the correct `tenantId` via the database. If this mapping logic is flawed, or if a malicious user claims a Page ID they don't own, messages will route to the wrong tenant.
*   **Verdict:** The system must strictly verify Meta Page ownership via OAuth access tokens before allowing a tenant to link a Page ID to their `tenantId`.
