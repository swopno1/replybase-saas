# Proposal: Granular Admin Audit Logging (Superadmin Observability)

## Overview
As ReplyBase moves toward enterprise adoption, internal security and observability become critical. Current logging (`AdminActivity`) primarily tracks **mutations** (CREATE, UPDATE, DELETE). This proposal extends the logging system to track **read-access** to sensitive data (PII, Conversation history, Tenant settings) by users with `SUPERADMIN` or `ADMIN` roles.

## Business Value
- **Enterprise Trust**: Provide enterprise customers with the assurance that access to their data is logged and auditable.
- **Compliance**: Alignment with SOC2 and GDPR requirements for "Access Monitoring".
- **Internal Security**: Detect and prevent potential internal data misuse.

## UX Impact
- **Transparency**: Admins will see a notice that their actions are logged.
- **Audit UI**: A new "Audit Log" view in the Admin Panel for Superadmins to review access patterns.

## Technical Considerations
- **High-Volume Logging**: Read-access logging can generate significant volume. Logs should be buffered and stored in a compressed format or a dedicated time-series store if necessary.
- **Middleware/Decorator Pattern**: Implement a standard wrapper or middleware for Admin API routes that automatically logs the accessed resource and the performing admin.
- **Data Sensitivity Levels**: Categorize data (e.g., PUBLIC, PRIVATE, SENSITIVE) and only log access to SENSITIVE data.

## Implementation Phases
1. **Phase 1**: Define "Sensitive" Admin API endpoints.
2. **Phase 2**: Extend `AdminActivity` model or create `AdminReadLog`.
3. **Phase 3**: Implement the logging decorator in `app/api/admin/*`.
4. **Phase 4**: Build the Audit Log viewer in the Admin Panel.

## Risks
- **Performance**: Excessive logging could impact Admin Panel responsiveness.
- **Storage**: Rapid growth of audit log table.

## AI-Readable Execution Prompts
- "Implement a Higher-Order Function `withAdminAudit` that records the `adminId`, `url`, and `resourceId` to the `AdminActivity` table for every GET request in the admin API."
