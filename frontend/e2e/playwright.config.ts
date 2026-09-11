import { defineConfig, devices } from "@playwright/test";

/**
 * Systemdatum der Mock-API fuer die Smoke-Tests (Entscheidung 18): das
 * Testdatenpaket liegt im April/Mai 2026, der erfassbare Zeitraum ist damit
 * 2026-04-01 bis 2026-05-05. global-setup prueft einen wiederverwendeten
 * Server auf dieses Datum.
 */
export const SMOKE_TODAY = "2026-05-05";

export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  timeout: 30_000,
  workers: 1,
  // Jeder Test setzt die Testdaten zurueck (fixtures.ts); ein Wiederholungs-
  // versuch in CI faengt daher nur Timing, keine Reihenfolgeeffekte ab.
  retries: process.env.CI ? 1 : 0,
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
      env: { XTS_TODAY: SMOKE_TODAY },
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
