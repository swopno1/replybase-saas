import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "./env";

// Create PostgreSQL connection pool
const pool =
  (globalThis as unknown as { pool?: Pool }).pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
  });

// Create Prisma adapter
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

// Create Prisma client with adapter
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : env.NODE_ENV === "production"
          ? []
          : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}
