import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL targets a deployed environment (ex: staging) for the
// pre-prod gate. When set, no local server is started.
// E2E_AUTH_BYPASS=1 starts the dev server with NEXT_PUBLIC_LOCAL_AUTH_BYPASS
// so @authed specs exercise the approved-admin shell without real Google login.
const localPort = process.env.E2E_PORT || "4100";
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${localPort}`;
const useLocalServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: useLocalServer
    ? {
        command: `pnpm dev --port ${localPort}`,
        // Static asset proves the server is up; pages compile on first request.
        url: `http://localhost:${localPort}/manifest.json`,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
        timeout: 120 * 1000,
        env: process.env.E2E_AUTH_BYPASS
          ? { NEXT_PUBLIC_LOCAL_AUTH_BYPASS: "true" }
          : {},
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
