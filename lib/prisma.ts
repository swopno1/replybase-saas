import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  // During `next build`, NODE_ENV is "production" but DATABASE_URL is not
  // available in the build container. Allow the build to proceed with a dummy
  // URL so route modules can be compiled without connecting to the database.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  if (process.env.NODE_ENV === "production" && !isBuildPhase) {
    throw new Error("DATABASE_URL must be configured in production");
  }

  if (process.env.NODE_ENV !== "test") {
    console.warn("DATABASE_URL is not set, using dummy URL outside production");
  }
  process.env.DATABASE_URL = "postgresql://dummy:dummy@dummy/dummy";
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

// Create PostgreSQL connection pool
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create Prisma client with adapter
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
