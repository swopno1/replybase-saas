# ... [Base and Deps Stages remain the same] ...

# 2. Rebuild the source code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure the config file is present during build
# RUN npx prisma generate   <-- Keep this

# 3. Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV HOME=/app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /app nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# --- IMPORTANT: COPY THE CONFIG FILE TO THE RUNNER ---
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./
# -----------------------------------------------------

RUN npm install prisma@7.2.0
RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ./node_modules/.bin/prisma migrate deploy && node server.js