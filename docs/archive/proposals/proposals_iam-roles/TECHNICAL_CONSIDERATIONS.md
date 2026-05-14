# Technical Implementation: IAM Roles & Permissions

## 1. Schema Changes
- Add `permissions` Json field or a new `Permission` model linked to `TenantMember`.
- Transition from `User.role` to a junction table `TenantMember` to support multi-tenant users.

```prisma
model TenantMember {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  role      TenantRole @default(AGENT)
  createdAt DateTime @default(now())

  tenant    Tenant @relation(fields: [tenantId], references: [id])
  user      User   @relation(fields: [userId], references: [id])

  @@unique([tenantId, userId])
}

enum TenantRole {
  OWNER
  MANAGER
  AGENT
  ANALYST
}
```

## 2. Middleware & Protection
- Enhance `withAuthAndTenant` to check required permissions for a specific route.
- Implement a `can(user, action, resource)` utility function.

## 3. Frontend Enforcement
- High-order components (`withPermissionCheck`) to wrap sensitive UI sections.
- Server Actions should include a permission check before mutation.

## 4. Phase 1 Implementation
- Backfill all current users as `OWNER` of their respective `tenantId`.
- Implement basic "Manager" vs "Agent" separation for the CRM and Bot Editor.

## 5. AI-Readable Execution Prompts

### Prompt A: Schema Migration
"Create a new Prisma migration that adds the `TenantMember` model and `TenantRole` enum as defined in the technical considerations. Update the `Tenant` model to have a one-to-many relation with `TenantMember`. Ensure the `TenantMember` has a unique constraint on `[tenantId, userId]`."

### Prompt B: Access Control Middleware
"Enhance the `withAuthAndTenant` higher-order function in `lib/route-helpers.ts` to fetch the user's role from the `TenantMember` table. Add a parameter to the handler that includes the user's role. Implement a `requireRole(role: TenantRole)` wrapper to protect specific API routes."

### Prompt C: UI Role Gating
"Create a `HasRole` component that takes an array of allowed roles as a prop. Use this component to wrap the 'Billing' navigation link and the 'Delete Bot' button in the settings page, ensuring only `OWNER` or `MANAGER` roles can see them."
