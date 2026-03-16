import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3211",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 3211",
    url: "http://127.0.0.1:3211",
    // Always start the project web server for E2E to avoid attaching
    // to an unrelated server that happens to be running on the same port.
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
