FROM node:22.12-slim AS base

# 1. Install dependencies
FROM base AS deps
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
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

RUN npx prisma generate
RUN npm run build

# 3. Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

# FIX: Set HOME to /app so npm/npx has a place to write temp files
ENV HOME=/app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# FIX: Create the user with a real home directory
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /app nextjs

# Copy the standalone build
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# FIX: Pre-install prisma in the runner stage so 'npx' doesn't try to download it at runtime
RUN npm install prisma@7.2.0

# Ensure permissions are correct for the nextjs user
RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT 3000

# Run migration and start the app
# Using the local prisma binary directly is safer than npx
CMD ./node_modules/.bin/prisma migrate deploy && node server.js