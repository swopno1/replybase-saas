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
RUN npm ci

# ------------------------------
# Build
# ------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ------------------------------
# Production runtime (NO dev deps)
# ------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: non-root
RUN addgroup -g 1001 nodejs \
 && adduser -u 1001 -G nodejs -s /bin/sh -D nextjs

# Copy build artifacts only
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json

# Install prod-only deps
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
