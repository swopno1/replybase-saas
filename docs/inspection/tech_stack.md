# Technology Stack Audit

## Core Frameworks
- **Next.js 16.2.4**: Modern App Router framework providing SSR, ISR, and API routes.
- **React 19.2.3**: The latest major version of React.
- **TypeScript 5**: Ensures type safety across the entire stack.

## Database & ORM
- **PostgreSQL**: Robust relational database.
- **Prisma 7.2.0**: Type-safe ORM for database modeling and migrations.
- **@prisma/adapter-pg**: Optimized for serverless PostgreSQL connection pooling.

## Authentication & Security
- **NextAuth.js 4.24.13**: Handles OAuth (Google, Facebook) and Credentials-based authentication.
- **Jose**: Used for JWT manipulation and security.
- **Bcrypt**: Password hashing (via `lib/server/password.ts`).

## Payments & Billing
- **Stripe**: Comprehensive payment processing and subscription management.

## AI & Automation
- **AI SDK (Vercel)**: Unified interface for interacting with LLMs.
- **@ai-sdk/google**: Gemini models.
- **@ai-sdk/openai**: GPT models.
- **@ai-sdk/anthropic**: Claude models.

## UI & Styling
- **Tailwind CSS 4**: Utility-first CSS framework.
- **Radix UI**: Primitive components for high accessibility.
- **Lucide React & Tabler Icons**: Iconography.
- **Sonner**: Toast notifications.
- **Recharts**: Data visualization for the dashboard.
- **TanStack Table**: Advanced data table management.

## Testing & Quality
- **Vitest**: Fast unit and integration testing.
- **Playwright**: End-to-end browser testing.
- **ESLint**: Linting and code style enforcement.

## Potential Risks & Limitations
- **Next.js 16/React 19 Stability**: Using the bleeding edge of the ecosystem may occasionally lead to compatibility issues with older libraries.
- **Single Point of Failure (Stripe/AI)**: Heavy reliance on external APIs; outages in these services directly impact core functionality.
- **Connection Pooling**: In serverless environments (like Vercel), PostgreSQL connection limits can be reached quickly without careful management (addressed via `@prisma/adapter-pg`).
- **Complexity of Webhooks**: Relying on multiple external webhooks (FB, Telegram, WhatsApp, Stripe) increases the surface area for failures and requires robust idempotency logic.
