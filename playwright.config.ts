import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "https://accel-v7.vercel.app",
    headless: true,
    viewport: { width: 390, height: 844 }, // iPhone 14 — matches mobile-first design
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
