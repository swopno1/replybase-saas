import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}", "**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "scripts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/webchat*.ts", "lib/flow-runtime-utils.ts", "app/api/webchat/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "**/__tests__/**",
        "tests/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
