FROM node:22.12-slim AS base

# 1. Install dependencies
FROM base AS deps
# Prisma needs openssl to run
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
# We need the prisma folder for the generate command
COPY prisma ./prisma/ 
RUN npm ci

# 2. Rebuild the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time Envs (must be checked as Build Variables in Coolify)
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL

# Generate client and build app
RUN npx prisma generate
RUN npm run build

# 3. Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

# Ensure openssl is in the final image too
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy prisma schema so we can run migrations at runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT 3000

# MAGIC STEP: Run migrations then start the server
CMD npx prisma migrate deploy && node server.js