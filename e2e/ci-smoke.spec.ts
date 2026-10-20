import { expect, test } from "@playwright/test";

// CI-only smoke suite: separate from e2e/playwright.config.ts and its
// tenant-provisioning global setup. Never connects to a shared demo project.
test("backend health endpoint responds with the expected contract", async ({ request }) => {
  const response = await request.get(`${process.env.CI_API_BASE_URL}/health`);
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok" });
});

test("fresh installation sends unauthenticated users to setup", async ({ page }) => {
  await page.goto(`${process.env.CI_WEB_BASE_URL}/login`);
  await expect(page.locator("body")).toBeVisible();
  await expect(page).toHaveURL(/\/setup/);
});
