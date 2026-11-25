import { expect, test, type Page } from "@playwright/test";
import { env } from "../utils/env";

const email = "oauth-browser@example.test";
const code = "123456";
const apiBase = (process.env.CI_API_BASE_URL || env.apiBaseUrl).replace(/\/$/, "");
const interactionPath = "/api/oauth/interactions/browser-flow_1";
const interactionUrl = apiBase + interactionPath;
const loginUrl = "/login?" + new URLSearchParams({ redirect: interactionPath });

test.use({ storageState: { cookies: [], origins: [] } });

// The API integration suite exercises the real consent controller. Here the fixture only serves
// its HTML for a top-level GET to the exact configured API URL after sign-in and profile setup.
async function interceptApi(page: Page, signedIn = false, profileComplete = true) {
  let codeRequested = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = request.url();
    if (url === interactionUrl && request.method() === "GET" && request.isNavigationRequest()
      && request.frame() === page.mainFrame() && signedIn && profileComplete) {
      return route.fulfill({ contentType: "text/html", body: "<h1>Authorize Tesbo QA access</h1>" });
    }

    if (url.startsWith(apiBase + "/api/")) {
      const endpoint = request.method() + " " + url.slice(apiBase.length);
      switch (endpoint) {
        case "GET /api/setup/status":
          return route.fulfill({ json: { required: false } });
        case "GET /api/auth/me":
          return signedIn
            ? route.fulfill({ json: { userId: "browser-user", email, profileComplete } })
            : route.fulfill({ status: 401, json: { error: "Signed out" } });
        case "POST /api/auth/password/login":
          expect(request.postDataJSON()).toEqual({ email, password: "browser-fixture" });
          signedIn = true;
          return route.fulfill({ json: { ok: true, userId: "browser-user" } });
        case "POST /api/auth/otp/request":
          expect(request.postDataJSON()).toEqual({ email });
          codeRequested = true;
          return route.fulfill({ status: 204 });
        case "POST /api/auth/otp/verify":
          expect(codeRequested).toBe(true);
          expect(request.postDataJSON()).toEqual({ email, code });
          signedIn = true;
          return route.fulfill({ json: { ok: true, userId: "browser-user" } });
        case "POST /api/auth/complete-profile":
          expect(signedIn).toBe(true);
          expect(request.postDataJSON()).toEqual({ firstName: "Taylor", lastName: "Tester" });
          profileComplete = true;
          return route.fulfill({ status: 204 });
      }
    }
    // Also intercept requests on the web origin. A regression must never reach a deployment's
    // fallback /api rewrite or be mistaken for a successful visit to the consent document.
    return route.fulfill({ status: 404, json: { error: "Unknown fixture endpoint" } });
  });
}

async function expectConsent(page: Page) {
  await expect(page).toHaveURL(interactionUrl);
  await expect(page.getByRole("heading", { name: "Authorize Tesbo QA access" })).toBeVisible();
}

test("password sign-in resumes the original OAuth interaction on the API", async ({ page }) => {
  await interceptApi(page);
  await page.goto(loginUrl);
  await page.getByLabel("Email *", { exact: true }).fill(email);
  await page.getByLabel("Password *", { exact: true }).fill("browser-fixture");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectConsent(page);
});

for (const profileComplete of [true, false]) {
  const step = profileComplete ? "directly" : "after first-time profile completion";
  test(`OTP sign-in resumes the original OAuth interaction ${step}`, async ({ page }) => {
    await interceptApi(page, false, profileComplete);
    await page.goto(loginUrl);
    await page.getByRole("button", { name: "Email code" }).click();
    await page.getByLabel("Email *", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Send login code" }).click();
    const digits = page.locator('input[inputmode="numeric"]');
    for (let i = 0; i < code.length; i++) {
      await digits.nth(i).fill(code[i]);
    }
    await page.getByRole("button", { name: "Verify and sign in" }).click();
    if (!profileComplete) {
      await page.getByLabel("First name *").fill("Taylor");
      await page.getByLabel("Last name *").fill("Tester");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }
    await expectConsent(page);
  });
}

test("an existing session resumes the OAuth interaction when login opens", async ({ page }) => {
  await interceptApi(page, true);
  await page.goto(loginUrl);
  await expectConsent(page);
});

test("returning to an already completed profile resumes the OAuth interaction", async ({ page }) => {
  await interceptApi(page, true);
  await page.goto("/complete-profile?" + new URLSearchParams({ redirect: interactionPath }));
  await expectConsent(page);
});
