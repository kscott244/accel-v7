import { defineConfig, devices } from "@playwright/test";

// ─── Playwright Smoke Test Config ─────────────────────────────────────────────
// Run against the live Vercel deployment.
//
// HOW TO RUN:
//   npx playwright install chromium
//   npx playwright test
//
// The app loads a 1.7MB static data bundle — cold starts can take 15–30s.
// Timeouts are set generously to account for this.
//
// SCREENSHOTS: captured automatically on failure in test-results/

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,        // per-test: 60s (generous for cold Vercel boot + 1.7MB bundle)
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "https://accel-v7.vercel.app",
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 — matches mobile-first design
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",   // saved to test-results/<test-name>/
    video: "retain-on-failure",      // useful for diagnosing subtle regressions
    trace: "on-first-retry",         // Playwright trace viewer on retry
    navigationTimeout: 30_000,       // separate timeout for page.goto()
  },
  projects: [
    {
      name: "chromium-mobile",
      use: { ...devices["iPhone 14"] },   // primary — matches Ken's daily device
    },
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
