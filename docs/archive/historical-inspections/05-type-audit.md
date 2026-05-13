# Codebase Audit: TypeScript Types & Interfaces

## 1. Unused or Dead Types (SAFE TO DELETE)
The following types are defined but never used in the application logic:
- `LegacyOnboardingData` (in `types/shared/onboarding.ts`): Leftover from a previous onboarding schema. The migration function `migrateLegacyOnboardingData` is also unused.
- `PaginatedResponse<T>` (in `types/shared/api.ts`): Defined but currently not used by any API response.

## 2. Type Duplication
- **Prisma Types vs. Manual Interfaces**: There are several places where manual interfaces are created for objects that Prisma already provides types for (e.g., `Lead`, `Bot`, `Channel`).
- **Webchat Types**: Webchat message types are defined in multiple places (`app/api/webchat/message/route.ts` and `lib/webchat-conversation-engine.ts`).

## 3. "any" Usage
- **Explicit `any`**: Found 35 instances of `: any`.
- **Type casting to `any`**: Found 38 instances of `as any`.

**Risk Areas:**
- `lib/prisma-tenant.ts`: Uses `any` for dynamic Prisma method interception.
- Webchat message processing: Uses `any` for raw payload handling from different providers.

## 4. Recommendations
- **Purge Legacy Types**: Remove `LegacyOnboardingData` and its associated migration function.
- **Strict Typing for APIs**: Implement `ApiResponse<T>` and `PaginatedResponse<T>` across all API routes to ensure consistency.
- **Type Refinement**: Conduct a pass to replace `any` with proper interfaces, especially in the webchat and worker logic where the shape of data is known.
- **Centralize Common Types**: Move all shared interfaces between frontend and backend to `types/shared`.
