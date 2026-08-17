import { defineConfig, devices } from "@playwright/test";

/**
 * Local-only E2E config: Chromium/Firefox/WebKit as the closest available proxy for
 * NFR-007's Chromium/Firefox/Safari-family browser matrix (WebKit here is Playwright's
 * bundled engine, not real Safari/iOS). Runs against the production build via `vite preview`
 * so route-level code splitting and the real bundle are exercised, not the dev server.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
