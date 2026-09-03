import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4200",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run start --workspace mock-api",
      cwd: "../..",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "npm run start --workspace frontend -- --host 127.0.0.1 --port 4200",
      cwd: "../..",
      url: "http://127.0.0.1:4200",
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
