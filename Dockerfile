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

# Copy entire node_modules from builder. Multi-stage still optimizes by excluding
# build artifacts, test files, and dev-only code via .dockerignore on the COPY . .
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Liveness probe using wget (available in node:slim, required by Coolify's healthcheck detector).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Run migrations then start the server.
# sh -c ensures DATABASE_URL (and other runtime env vars) are expanded correctly.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]