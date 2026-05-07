# Build and Development Workflow

## Development Workflow
1.  **Environment Setup**:
    - Install dependencies: `pnpm install`.
    - Set up `.env` from `.env.example`.
    - Initialize database: `pnpm prisma generate` and `pnpm prisma migrate deploy`.
    - Seed Stripe: `pnpm run seed:stripe`.
2.  **Running Locally**:
    - `pnpm dev`: Starts the Next.js development server.
3.  **Testing**:
    - Unit/Integration: `pnpm run test`.
    - Watch mode: `pnpm run test:watch`.
    - E2E: `pnpm run test:e2e`.

## Build Process
- **Command**: `pnpm run build`.
- **Steps**:
    1.  `prisma generate`: Rebuilds the Prisma client based on the current schema.
    2.  `next build`: Compiles the React/Next.js application, performs static analysis, and optimizes assets.
- **Artifacts**: Standard Next.js `.next` folder output.

## Scripts & Commands
- `db:cleanup`: Utility to prune old or test data.
- `seed:stripe`: Critical script to ensure the Stripe environment matches the application's expected plan IDs.
- `test:chatbot`: Specialized script for local testing of bot logic without needing external webhooks.
- `normalize:web-channel-type`: Data migration utility.

## Potential Issues
- **Prisma Generation in CI**: If `prisma generate` isn't run in the CI/CD pipeline before `tsc` (TypeScript check), the build will fail due to missing types.
- **Environment Variable Sync**: Developers must manually keep their `.env` files in sync with `.env.example`, which can lead to "works on my machine" issues if new variables are added.
- **Stripe Seeding**: If the Stripe environment is not seeded, many core features (registration, billing, dashboard access) will fail.
