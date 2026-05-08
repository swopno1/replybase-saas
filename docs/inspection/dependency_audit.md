# Dependency Audit

## Key Dependencies
- **Framework**: `next@16.2.4`, `react@19.2.3`.
- **ORM**: `@prisma/client@7.2.0`.
- **AI**: `ai@6.0.168` (Vercel AI SDK), `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`.
- **Payments**: `stripe@20.1.1`.
- **UI**: `@radix-ui/*`, `lucide-react`, `tailwind-merge`, `shadcn/ui` components.
- **State/Data**: `zod` (validation), `tanstack/react-table`.

## Risk Analysis

### 1. High-Frequency Updates (Bleeding Edge)
The project uses `next@16` and `react@19`. While providing the latest features, these are very new and may have undiscovered bugs or breaking changes in minor updates.

### 2. Dependency Sprawl
The `package.json` contains a large number of UI primitives (`@radix-ui/*`). While standard for shadcn/ui, it increases the maintenance surface area.

### 3. AI SDK Versioning
The project uses `ai@6.0.168`. The Vercel AI SDK has undergone significant API changes recently (e.g., `CoreMessage` vs `ModelMessage`). Any upgrade requires a careful audit of all AI-related files.

### 4. Unused Dependencies
- `tw-animate-css`: Likely used for specific animations, but could potentially be replaced by native Tailwind animations to reduce bundle size.
- `dotenv`: Next.js handles `.env` files natively; explicit `dotenv` usage in scripts is fine, but it might be duplicated in some logic.

### 5. Potential Conflicts
- **Prisma versions**: The project has both `prisma@7.2.0` and `@prisma/config@7.3.0`. Usually, these should be kept in sync to avoid unexpected behavior during generation or runtime.

## Recommendation
- Perform a `pnpm audit` to check for known vulnerabilities in nested dependencies.
- Consolidate Prisma versions to `7.3.0` or `7.2.0` consistently.
- Replace in-memory locking with a robust solution like Redis if scaling beyond a single server/instance is expected.
