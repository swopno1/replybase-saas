# Repository Structure Analysis

The ReplyBase project follows a standard Next.js App Router structure with clear separation between routing, business logic, and UI components.

## Directory Breakdown

### `app/`
Contains the Next.js application routes, layouts, and API endpoints.
- `(dashboard)/`: Protected routes for the authenticated user dashboard (bots, conversations, leads, settings).
- `api/`: Backend API endpoints for various services (auth, billing, bots, flows, integrations, etc.).
- `auth/`: Public authentication pages (login, register, forgot-password).
- `layout.tsx` & `page.tsx`: Root layout and landing page.

### `components/`
React components categorized by feature or utility.
- `admin/`: Components for the internal platform admin dashboard.
- `analytics/`: Tracking and reporting components.
- `conversation/`: UI for the unified inbox and message feed.
- `onboarding/`: Components for the user onboarding experience.
- `ui/`: Reusable primitive components (shadcn/ui), built on Radix UI.
- `skeletons/`: Loading state placeholders.

### `lib/`
The core business logic and service layer.
- `services/`: Specialized service classes (billing, leads).
- `server/`: Server-only utilities (password hashing, Facebook helpers).
- `flow-execution-engine.ts`: Core logic for executing conversational trees.
- `ai-service.ts`: Integration with AI providers (Gemini, OpenAI, Anthropic).
- `prisma-tenant.ts`: Multi-tenancy logic using Prisma extensions.
- `subscription.ts`: Logic for checking plan limits and status.

### `prisma/`
Database configuration and schema.
- `schema.prisma`: The source of truth for the PostgreSQL database structure.

### `hooks/`
Custom React hooks for client-side logic (e.g., `use-mobile.ts`).

### `scripts/`
Utility scripts for maintenance, database migrations (custom), and testing.
- `seed-stripe.ts`: Populates Stripe products and plans.
- `safe-migration.ts`: Handles sensitive data migrations (e.g., currency precision).

### `tests/`
Comprehensive test suite.
- `e2e/`: Playwright end-to-end tests.
- `lib/`: Unit tests for core libraries.
- `api/`: Integration tests for API routes.

### `types/`
TypeScript type definitions and interfaces, separated into `shared` and route-specific types.

### `public/`
Static assets like images, icons, and fonts.

## Workspace Analysis
The project is a monolithic Next.js repository. While not a "monorepo" in the sense of using Turborepo or Nx for multiple packages, it is organized internally to keep concerns separated (e.g., `lib` vs `app`). It uses `pnpm` for package management.
