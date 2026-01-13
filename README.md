# Replybase SaaS

Tech Stack:

- Next.js (App Router)
- TypeScript
- Prisma + PostgreSQL
- NextAuth
- Stripe
- Server-only AI Engine integration

Key Rules:

- No direct browser → AI Engine access
- All AI calls via `/api/ai/*`
- Secrets are server-only
- Production-grade security required

Folder overview:

- app/ → Next.js app & API routes
- lib/ → shared backend logic
- prisma/ → schema & migrations
- components/ → UI components
