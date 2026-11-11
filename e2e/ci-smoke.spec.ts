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

test("finalized automation keeps bug links, verdicts and truthful drawer/full-page state", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const api = process.env.CI_API_BASE_URL!;
  const web = process.env.CI_WEB_BASE_URL!;
  // This test bootstraps a fresh installation. Explicit loopback URLs AND the existing
  // disposable CI database are required; never run it against a shared deployment.
  for (const target of [api, web]) {
    expect(["127.0.0.1", "localhost"]).toContain(new URL(target).hostname);
  }
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/tesbo_ci");
  const request = page.request; // Share the genuine session cookie with the browser.
  const setup = await request.post(`${api}/api/setup/first-admin`, {
    data: { email: "ci-bug-links@tesbo.invalid", password: "Ci-Bug-Links-2026!", orgName: "CI Bug Links", demoData: false }
  });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  const projectResponse = await request.post(`${api}/api/projects`, { data: { name: "CI Bug Links", key: "CBL" } });
  expect(projectResponse.ok(), await projectResponse.text()).toBeTruthy();
  const projectId = (await projectResponse.json()).id;
  const base = `${api}/api/projects/${projectId}`;
  const bugs: string[] = [];
  const runs: string[] = [];
  const cases: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    for (const surface of ["drawer", "full-page"]) {
      for (const status of ["pass", "fail"]) {
        const title = `CI sealed ${surface} ${status}`;
        const testcaseResponse = await request.post(`${base}/testcases`, { data: { title } });
        expect(testcaseResponse.ok(), await testcaseResponse.text()).toBeTruthy();
        const testcase = await testcaseResponse.json();
        cases.push(testcase.id);
        const runResponse = await request.post(`${base}/automation/runs`, {
          data: { name: title, caseIds: [testcase.externalId] }
        });
        expect(runResponse.ok(), await runResponse.text()).toBeTruthy();
        const runId = (await runResponse.json()).runId;
        runs.push(runId);
        const result = await request.post(`${base}/automation/runs/${runId}/results`, {
          data: { caseId: testcase.externalId, status, retryCount: 1, durationMs: 42 }
        });
        expect(result.ok(), await result.text()).toBeTruthy();
        const close = await request.patch(`${base}/automation/runs/${runId}/close`, { data: { status: "completed" } });
        expect(close.ok(), await close.text()).toBeTruthy();
        const beforeSummary = await close.json();
        const before = await (await request.get(`${api}/api/cycles/${runId}/executions`)).json();
        const execution = (before.list ?? before)[0];
        expect(execution.status).toBe(status === "pass" ? "Passed" : "Failed");
        const bugTitle = `${title} finding`;
        let existingId = "";
        if (surface === "full-page") {
          const unlinked = await request.post(`${base}/bugs`, { data: { title: bugTitle } });
          expect(unlinked.ok(), await unlinked.text()).toBeTruthy();
          existingId = (await unlinked.json()).id;
          bugs.push(existingId);
        }

        const runUrl = `${web}/projects/${projectId}/cycles/${runId}`;
        await page.goto(surface === "drawer" ? runUrl : `${runUrl}/execute/${execution.id}`);
        if (surface === "drawer") await page.getByText(title, { exact: true }).first().click();
        await page.getByRole("button", { name: "Log bug", exact: true }).click();
        await expect(page.getByText("Test case marked as Failed", { exact: true })).toHaveCount(0);
        if (surface === "drawer") {
          await page.getByPlaceholder("Brief summary of the bug…").fill(bugTitle);
          const saved = page.waitForResponse((response) => response.url() === `${base}/bugs` && response.request().method() === "POST");
          await page.getByRole("button", { name: "Report Bug", exact: true }).click();
          const response = await saved;
          expect(response.ok(), await response.text()).toBeTruthy();
          bugs.push((await response.json()).id);
        } else {
          await page.getByRole("button", { name: "Yes, link existing" }).click();
          await page.getByRole("button", { name: "Existing Tesbo bug", exact: true }).click();
          await page.getByRole("button", { name: "Choose an existing bug…" }).click();
          const picker = page.getByTestId("existing-bug-picker");
          await picker.getByPlaceholder("Search bugs by title…").fill(bugTitle);
          await picker.getByText(bugTitle, { exact: true }).click();
          await picker.getByRole("button", { name: "Add Selected (1)", exact: true }).click();
          await page.getByRole("button", { name: "Link Bug", exact: true }).click();
        }
        await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeHidden();
        await expect(page.getByLabel("Bug Title", { exact: true })).toHaveValue(bugTitle);
        const activeColor = status === "pass" ? /bg-\[var\(--success\)\]/ : /bg-\[var\(--error\)\]/;
        await expect(page.getByRole("button", { name: execution.status, exact: true })).toHaveClass(activeColor);
        expect(await (await request.get(`${api}/api/cycles/${runId}/executions`)).json()).toEqual(before);
        const persistedBug = await (await request.get(`${api}/api/bugs/${existingId || bugs[bugs.length - 1]}`)).json();
        expect(persistedBug.links).toEqual(expect.arrayContaining([
          expect.objectContaining({ testcaseId: testcase.id, cycleId: runId, executionId: execution.id })
        ]));
        const repeated = await request.patch(`${base}/automation/runs/${runId}/close`, { data: { status: "completed" } });
        expect(await repeated.json()).toEqual({ ...beforeSummary, alreadyClosed: true });
        await page.reload();
        if (surface === "drawer") await page.getByText(title, { exact: true }).first().click();
        await expect(page.getByLabel("Bug Title", { exact: true })).toHaveValue(bugTitle);
        await expect(page.getByRole("button", { name: execution.status, exact: true })).toHaveClass(activeColor);
        await testInfo.attach(`${surface}-${status}`, { body: await page.screenshot(), contentType: "image/png" });
      }
    }
    expect(consoleErrors).toEqual([]);
  } finally {
    for (const id of bugs) await request.delete(`${api}/api/bugs/${id}`, { failOnStatusCode: false });
    for (const id of runs) await request.delete(`${api}/api/cycles/${id}`, { failOnStatusCode: false });
    for (const id of cases) await request.delete(`${base}/testcases/${id}`, { failOnStatusCode: false });
  }
});
