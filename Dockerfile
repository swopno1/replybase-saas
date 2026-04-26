# Use Node 22.12 to satisfy Prisma 7 requirements
FROM node:22.12-slim AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app


# Install pnpm and copy dependency files
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies with pnpm
RUN pnpm install --frozen-lockfile

# Pre-generate Prisma client to maximise layer cache hits
# (build script runs it again, but this layer is only invalidated on schema changes)
RUN npx prisma generate

# Copy the rest of the source code
COPY . .

# Build-time environment variables (Check "Build Variable" in Coolify for these)
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL

# Build the Next.js app
RUN pnpm run build

# --- PRODUCTION STAGE ---
FROM node:22.12-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOME=/app

# Install openssl (required by Prisma) and wget (required by HEALTHCHECK / Coolify)
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /app nextjs

# Copy only the necessary files from the builder
# Standalone mode includes a minimal node_modules with only production dependencies
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Install prisma CLI globally in runner for migrations (much smaller than copying 1.9GB node_modules)
RUN npm install -g prisma@7.7.0

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Liveness probe using wget (available in node:slim, required by Coolify's healthcheck detector).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Run migrations then start the server.
# Standalone output places node_modules at ./node_modules inside the standalone folder.
CMD ["sh", "-c", "prisma migrate deploy --schema ./prisma/schema.prisma && node server.js"]