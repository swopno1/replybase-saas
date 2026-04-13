# Use Node 22.12 to satisfy Prisma 7 requirements
FROM node:22.12-slim AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies (postinstall runs automatically via npm ci lifecycle)
RUN npm ci

# Pre-generate Prisma client to maximise layer cache hits
# (build script runs it again, but this layer is only invalidated on schema changes)
RUN npx prisma generate

# Copy the rest of the source code
COPY . .

# Build-time environment variables (Check "Build Variable" in Coolify for these)
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL

# Build the Next.js app
RUN npm run build

# --- PRODUCTION STAGE ---
FROM node:22.12-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOME=/app

# Re-install openssl in the final small image
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /app nextjs

# Copy only the necessary files from the builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./

# Reuse Prisma CLI/artifacts from builder to avoid slow npm install in runner.
# dotenv is required by prisma.config.ts (import "dotenv/config") at migrate-deploy time.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Liveness probe — Coolify / Docker Swarm / Kubernetes will restart unhealthy containers
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run migrations then start the server.
# sh -c ensures DATABASE_URL (and other runtime env vars) are expanded correctly.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]