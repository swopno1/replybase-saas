import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (!process.env.APP_DATABASE_URL && !process.env.DATABASE_URL) {
  console.warn("APP_DATABASE_URL or DATABASE_URL is not set, using dummy URL");
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
    connectionString: process.env.APP_DATABASE_URL || process.env.DATABASE_URL,
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
