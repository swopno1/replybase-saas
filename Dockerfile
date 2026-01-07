# ------------------------------
# Base
# ------------------------------
FROM node:20-alpine AS base
WORKDIR /app

# ------------------------------
# Dependencies (WITH dev deps)
# ------------------------------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --production

# ------------------------------
# Build
# ------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Ensure Prisma is installed globally (if not already in dependencies)
RUN npm install -g prisma
RUN npx prisma generate
# RUN npx prisma migrate deploy
RUN npm run build

# ------------------------------
# Production runtime (NO dev deps)
# ------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Engines prerequisites
RUN apk add --no-cache openssl libstdc++

# Security: non-root
RUN addgroup -g 1001 nodejs \
    && adduser -u 1001 -G nodejs -s /bin/sh -D nextjs

# Copy build artifacts only
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Prisma CLI for runtime migrations
RUN npm install -g prisma

# Install prod-only deps
# COPY --from=builder /app/node_modules ./node_modules
# RUN npm prune --omit=dev  <-- Skip prune to ensure prisma engine is available for MVP stability

USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && npm start"]
