# Use Node 22.12 to satisfy Prisma 7 requirements
FROM node:22.12-slim AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install ALL dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build-time environment variables (Check "Build Variable" in Coolify for these)
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL

# Generate Prisma Client and build the Next.js app
RUN npx prisma generate
RUN npm run build

# --- PRODUCTION STAGE ---
FROM node:22.12-slim AS runner

WORKDIR /app
ENV NODE_ENV production
ENV HOME=/app

# Re-install openssl in the final small image
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /app nextjs

# Copy only the necessary files from the builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Install Prisma CLI in the runner so it is available for migrations
RUN npm install prisma@7.2.0

# Correct ownership
RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT 3000

# FIX: Run migrations and start. 
# We use 'sh -c' to ensure environment variables like DATABASE_URL are expanded correctly.
# CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node server.js"]

# This prints the first 10 characters of the DB URL for safety, then tries the migration
CMD ["sh", "-c", "echo 'DB_URL starts with: ' ${DATABASE_URL:0:10}... && ./node_modules/.bin/prisma migrate deploy && node server.js"]