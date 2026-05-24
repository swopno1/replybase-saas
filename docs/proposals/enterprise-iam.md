# Strategic Proposal: Enterprise IAM Roles & Permissions

## 1. Overview
As ReplyBase scales into the enterprise market, the need for granular access control becomes critical. Currently, users are either a regular tenant user or a platform-wide superadmin. This proposal outlines the transition to a robust Role-Based Access Control (RBAC) system within each tenant.

## 2. Business Value
- **Enterprise Readiness**: Meets the security requirements of larger organizations that need to restrict access to sensitive PII and billing data.
- **Agency Support**: Enables agencies to grant their clients limited access (e.g., "Viewer" or "Agent") to their specific bots without exposing administrative or global settings.
- **Operational Safety**: Reduces the risk of accidental configuration changes or channel disconnections by non-technical staff.

## 3. Proposed Role Hierarchy
| Role | Permissions | Use Case |
| :--- | :--- | :--- |
| **Owner** | Full access to billing, team management, and all tenant resources. | Business owner / Primary contact. |
| **Admin** | Full access to bots, flows, and integrations; no billing/subscription access. | Technical manager / Lead ops. |
| **Agent** | View/Reply to conversations, manage leads. No access to bot/channel config. | Support staff / Sales reps. |
| **Viewer** | Read-only access to analytics, logs, and conversations. | Stakeholders / Auditors. |

## 4. Technical Implementation Strategy
- **Schema Evolution**:
  - Introduce a `TenantRole` enum in Prisma.
  - Update the `User` model with a `role` field (defaulting to `ADMIN` or `OWNER` for existing users).
- **Middleware Hardening**:
  - Enhance `withAuthAndTenant` to support optional permission checks: `withAuthAndTenant(..., { requiredRole: 'ADMIN' })`.
  - Implement a centralized `lib/permissions.ts` for fine-grained capability checks.
- **Frontend Enforcement**:
  - Create a `usePermission` React hook to conditionally hide/disable UI elements (e.g., "Delete Bot" button).
  - Implement server-side redirects in `layout.tsx` for restricted pages (e.g., Billing).

## 5. Rollout Strategy
1. **Phase 1 (Audit)**: Identify every API route and its required minimal role. Initial audit recommends:
   - `ADMIN`: `/api/bots/*`, `/api/flows/*`, `/api/settings/channels/*`.
   - `AGENT`: `/api/conversations/*`, `/api/contacts/*`, `/api/leads/*`.
   - `OWNER`: `/api/billing/*`, `/api/settings/team/*`.
2. **Phase 2 (Migration)**: Deploy schema changes and backfill roles for existing 1,000+ users.
3. **Phase 3 (Gating)**: Enable API-level enforcement and UI "Grey-out" states.
4. **Phase 4 (Management)**: Launch the "Team Management" UI in Tenant Settings.

## 6. Strategic Impact
This transition moves ReplyBase from a "Prosumer" tool to an "Enterprise SaaS Platform," unlocking higher-tier pricing opportunities and enabling multi-agent team collaboration at scale.
