import { defineConfig, devices } from "@playwright/test";

if (!process.env.CI_API_BASE_URL || !process.env.CI_WEB_BASE_URL) {
  throw new Error("CI smoke requires explicit isolated CI_API_BASE_URL and CI_WEB_BASE_URL");
}
export default defineConfig({
  testDir: __dirname,
  testMatch: "ci-smoke.spec.ts",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-ci" }]],
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure", screenshot: "only-on-failure" },
});
