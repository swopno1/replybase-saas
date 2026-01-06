import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.APP_DATABASE_URL,
  },
});
