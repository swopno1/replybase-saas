# Code Quality Analysis

## Code Structure & Modularity
- **High Modularity**: The project excels at separating concerns. The `lib/` directory contains well-defined services, while `app/` focus strictly on routing and data fetching.
- **Service Layer**: Common business logic (billing, leads, AI) is encapsulated in dedicated services, making it reusable across API routes and server components.
- **Component Organization**: Use of `shadcn/ui` ensures a consistent look and feel and promotes the creation of small, reusable UI primitives.

## Duplication
- **Low Functional Duplication**: Core logic like sending messages or checking subscriptions is centralized.
- **UI Repetition**: Some dashboard pages share similar layout logic that could be further abstracted into higher-order components or shared layouts beyond what is already there.

## Dead Code & Refactoring Artifacts
- **AI Refactor Residue**: Multiple files contain comments like `// AI fallback removed April 2026`. This indicates a recent large-scale change where old logic was stripped but some scaffolding might remain.
- **Defunct Endpoints**: `app/api/ai/converse` and associated functions are marked as defunct in memory, representing potential dead code that should be removed.

## Naming Consistency
- **Strong Patterns**: The codebase follows standard TypeScript/React conventions.
  - Files: `kebab-case.ts` or `kebab-case.tsx`.
  - Components: `PascalCase`.
  - Functions/Variables: `camelCase`.
- **Database Alignment**: Model names in Prisma match their usage in the application logic, reducing cognitive load.

## Technical Debt
- **Type Safety**: There are over 230 instances of the `any` type. This is a significant risk for a project of this size, especially in complex areas like the Flow Engine and AI integrations.
- **Linting Issues**: Approximately 135 ESLint problems exist, including potentially problematic synchronous `setState` calls in `useEffect` (e.g., `billing-tab.tsx`).
- **Prisma Extensions**: While powerful, the tenant-scoping extension in `lib/prisma-tenant.ts` requires manual maintenance of the `tenantModels` list. If a new model with `tenantId` is added but not registered there, it could lead to data leaks or query failures.

## Documentation
- **Internal Docs**: The `doc/` folder (though skipped in this inspection) and `README.md` suggest a culture of documentation.
- **Code Comments**: Critical logic like the `FlowExecutionEngine` is reasonably commented, though some complex conditional logic in webchat routes lacks deep explanation.
