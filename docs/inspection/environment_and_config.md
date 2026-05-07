# Environment and Configuration Audit

## Environment Variables (.env)
The system relies on a significant number of environment variables for core functionality:
- **Database**: `DATABASE_URL`.
- **Auth**: `AUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`.
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **AI**: `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
- **System**: `ADMIN_EMAILS`, `STRICT_DEV_LOGIN`.

## Configuration Files
- `next.config.ts`: Configures the Next.js runtime, including experimental features or image domains.
- `prisma.config.ts`: (Note: Prisma 7+ uses this for generator/datasource config).
- `tsconfig.json`: Defines TypeScript compiler rules (strict mode is enabled).
- `components.json`: Configuration for shadcn/ui.
- `playwright.config.ts`: End-to-end test runner configuration.

## Missing or Unused Configs
- **Logging Configuration**: There is no centralized logger config (e.g., Winston or Pino). Logging is currently done via `console.log/error`.
- **Cache Config**: No explicit Redis or caching layer config is visible, suggesting reliance on Next.js's built-in data cache.

## Security Concerns
- **Secret Exposure**: Ensure that `.env` is never committed (it is correctly in `.gitignore`).
- **Client-Side Secrets**: `NEXT_PUBLIC_` variables are correctly limited to non-sensitive keys (like the Stripe Publishable Key).
- **Default Deny Policy**: The root `proxy.ts` implements a "default-deny" strategy, which is a strong security posture, but requires constant maintenance of the public paths list.
