# System Inspection Report - May 8, 2026

## Overview
This document outlines the findings of a comprehensive system audit performed on ReplyBase. The focus was on architectural integrity, multi-tenancy isolation, flow execution consistency, and UX/UI stability prior to production deployment.

## 1. Architectural & Logical Flaws

### 1.1 Inconsistent Flow Execution Logic (High Priority)
**Issue**: Core flow execution logic is duplicated and diverged between `lib/bot-entry-flow-engine.ts` and `lib/webchat-conversation-engine.ts`.
- **Lead Capture Deficiency**: The `webchat-conversation-engine.ts` correctly captures lead data (name, email, phone, tags) and creates `Lead` records. However, `bot-entry-flow-engine.ts` (used for Facebook, WhatsApp, Telegram) lacks this entire logic. Users interacting via Messenger will not be captured as leads in the dashboard.
- **Cooldown Inconsistency**: Webchat enforces a 1-hour cooldown (`FLOW_REPEAT_COOLDOWN_MS = 3600000`), whereas the general engine uses 0ms. This leads to inconsistent user experiences across channels.
- **Usage Tracking**: Webchat correctly associates flow executions with a `botId`, whereas the general engine leaves it `undefined`, breaking bot-specific usage analytics.

### 1.2 Multi-Tenancy Isolation Risks (Medium Priority)
**Issue**: Architectural roadmap goal for composite unique keys `(id, tenantId)` has not been implemented in the Prisma schema.
- **Impact**: While current API routes perform manual tenant checks, the lack of database-level constraints increases the risk of cross-tenant data leaks if a single check is missed or if a direct ID lookup is performed.

### 1.3 Redundant Flow Resolution Logic
**Issue**: `resolveFlow` is implemented twice with slightly different query patterns.
- **Impact**: Maintenance burden. Changes to how flows are assigned or filtered must be applied to both files, increasing the risk of regression.

## 2. Functional Inabilities

### 2.1 Missing Lead Management for Social Channels
- **Problem**: Because `bot-entry-flow-engine.ts` doesn't support the `tag_user` or `update_status` actions found in Webchat flows, the "Lead Management" feature is effectively broken for Facebook and WhatsApp.

### 2.2 Facebook Webhook Idempotency
- **Concern**: Unlike the recently fixed Webchat message route, the Facebook webhook route does not appear to have a robust idempotency layer using Redis/Postgres keys. Rapid message bursts from Meta could trigger duplicate AI responses.

## 3. UX & UI Issues

### 3.1 Design Inconsistency (Channel Configuration)
- **Webchat**: Uses a clean, dedicated `ChannelFlowAssignmentCard` for automation selection.
- **Facebook**: Uses small, inline select boxes and buttons that don't match the design language of the Webchat configuration.
- **Action**: Standardize the UI components used for channel-level flow assignment.

### 3.2 Technical Debt in WhatsApp Config
- **Issue**: `whatsapp-config.tsx` uses `any` types and contains `TODO` comments regarding type safety for limit statuses. This can hide bugs during build time.

## 4. Recommendations for Deployment

1.  **Unify Engines**: Extract the core node execution loop from `webchat-conversation-engine.ts` and `bot-entry-flow-engine.ts` into a single, channel-agnostic `lib/flow-runtime-service.ts`.
2.  **Backport Lead Capture**: Ensure that `persistLeadCapture` logic is available to all channels so that Facebook/WhatsApp users are properly recorded as leads.
3.  **Implement Schema Hardening**: Apply the `@@unique([id, tenantId])` constraints to `Bot`, `Flow`, `Contact`, and `Lead` models.
4.  **Standardize Channel UI**: Port the `ChannelFlowAssignmentCard` pattern to the Facebook, WhatsApp, and Telegram configuration tabs for a premium, consistent user experience.

---
**Status**: Ready for Production (Conditional on fixing Lead Capture for Social Channels)
**Auditor**: Antigravity AI
