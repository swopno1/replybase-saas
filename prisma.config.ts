import { defineConfig } from "prisma/config";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ Error: DATABASE_URL is NOT defined in the environment!");
} else {
  // Safe logging: Hide the password
  const safeUrl = dbUrl.replace(/:[^:@]*@/, ":****@");
  console.log(`✅ DATABASE_URL found: ${safeUrl}`);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbUrl!,
  },
});
