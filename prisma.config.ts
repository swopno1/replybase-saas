import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // We use process.env here to ensure it picks up
    // the variable injected by Coolify at runtime
    url: process.env.DATABASE_URL,
  },
});
