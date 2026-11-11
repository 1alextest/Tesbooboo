import { expect, request as newRequest, test, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { hashPasswordForSeed } from "./utils/password";

async function verifyBugCreateAccess(request: APIRequestContext, api: string, projectId: string, ownerId: string, organizationId: string) {
  // Called only after the test's explicit loopback/disposable-database safety checks.
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const nonmember = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`;
  const bugs: string[] = [];
  const tokenIds: string[] = [];
  let cycleId = "";
  let testcaseId = "";
  let otherOrgId = "";
  await db.connect();
  try {
    const outsider = (await db.query<{ id: string }>(
      "INSERT INTO users (email, name, password_hash, active_organization_id) VALUES ($1,'CI nonmember',$2,$3) RETURNING id",
      ["ci-bug-nonmember@tesbo.invalid", hashPasswordForSeed("Ci-Bugs-2026!"), organizationId]
    )).rows[0].id;
    await db.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,'qa_engineer')", [organizationId, outsider]);
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [organizationId, ownerId]);
    const login = await nonmember.post(`${api}/api/auth/password/login`, {
      data: { email: "ci-bug-nonmember@tesbo.invalid", password: "Ci-Bugs-2026!" }
    });
    expect(login.ok(), await login.text()).toBeTruthy();

    const testcaseResponse = await request.post(`${base}/testcases`, { data: { title: "CI authorization control" } });
    expect(testcaseResponse.ok(), await testcaseResponse.text()).toBeTruthy();
    testcaseId = (await testcaseResponse.json()).id;
    const cycleResponse = await request.post(`${base}/cycles`, { data: { name: "CI authorization control" } });
    expect(cycleResponse.ok(), await cycleResponse.text()).toBeTruthy();
    cycleId = (await cycleResponse.json()).id;
    const attached = await request.post(`${api}/api/cycles/${cycleId}/testcases`, { data: { testcaseIds: [testcaseId] } });
    expect(attached.ok(), await attached.text()).toBeTruthy();
    const execution = (await db.query<{ id: string }>(
      "SELECT e.id FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1", [cycleId]
    )).rows[0];
    const passed = await request.patch(`${api}/api/cycles/${cycleId}/executions/${execution.id}`, { data: { status: "Passed" } });
    expect(passed.ok(), await passed.text()).toBeTruthy();
    const body = { title: "CI authorized bug", links: [{ testcaseId, cycleId, executionId: execution.id }] };
    const persisted = async () => ({
      bugs: (await db.query("SELECT * FROM bugs WHERE project_id = $1 ORDER BY id", [projectId])).rows,
      links: (await db.query("SELECT bl.* FROM bug_links bl JOIN bugs b ON b.id = bl.bug_id WHERE b.project_id = $1 ORDER BY bl.id", [projectId])).rows,
      execution: (await db.query("SELECT * FROM executions WHERE id = $1", [execution.id])).rows,
      run: (await db.query("SELECT * FROM cycles WHERE id = $1", [cycleId])).rows,
      snapshot: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [cycleId])).rows
    });
    const denied = async (client: APIRequestContext, status: number, headers?: Record<string, string>) => {
      const before = await persisted();
      const response = await client.post(`${base}/bugs`, { data: body, headers });
      const data = await response.json();
      if (data.id) bugs.push(data.id); // Preserve cleanup if the regression accidentally accepts.
      expect(response.status(), JSON.stringify(data)).toBe(status);
      expect(await persisted()).toEqual(before);
    };
    await denied(anonymous, 400);
    await denied(anonymous, 400, { Authorization: "Bearer not-a-valid-token" });
    await denied(nonmember, 404);
    const tokens: Record<string, string> = {};
    for (const scope of ["read", "write"]) {
      const response = await request.post(`${base}/apikeys`, { data: { name: `CI bug ${scope}`, scopes: [scope] } });
      expect(response.ok(), await response.text()).toBeTruthy();
      const token = await response.json();
      tokenIds.push(token.id);
      tokens[scope] = token.token;
    }
    await denied(anonymous, 403, { Authorization: `Bearer ${tokens.read}` });

    await db.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, ownerId]);
    try {
      await denied(request, 404);
      await denied(anonymous, 404, { Authorization: `Bearer ${tokens.write}` });
      const before = await persisted();
      const refusedMcp = await anonymous.post(`${base}/mcp`, {
        headers: { Authorization: `Bearer ${tokens.write}` },
        data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_bug", arguments: body } }
      });
      expect(refusedMcp.ok()).toBeTruthy();
      expect((await refusedMcp.json()).error).toBeDefined();
      expect(await persisted()).toEqual(before);
    } finally {
      await db.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [projectId, ownerId]);
    }
    otherOrgId = (await db.query<{ id: string }>(
      "INSERT INTO organizations (name, slug) VALUES ('CI other workspace','ci-bug-auth-other') RETURNING id"
    )).rows[0].id;
    await db.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,'owner')", [otherOrgId, ownerId]);
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [otherOrgId, ownerId]);
    await denied(request, 404);
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [organizationId, ownerId]);
    await db.query("UPDATE projects SET archived_at = now() WHERE id = $1", [projectId]);
    await denied(request, 404);
    await db.query("UPDATE projects SET archived_at = NULL WHERE id = $1", [projectId]);

    for (const transport of ["REST", "MCP"]) {
      const response = await anonymous.post(transport === "REST" ? `${base}/bugs` : `${base}/mcp`, {
        headers: { Authorization: `Bearer ${tokens.write}` },
        data: transport === "REST" ? body : { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "create_bug", arguments: body } }
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      const result = await response.json();
      if (transport === "MCP") expect(result.error).toBeUndefined();
      const created = transport === "REST" ? result : JSON.parse(result.result.content[0].text);
      bugs.push(created.id);
      expect(created).toMatchObject({ reportedBy: ownerId });
      expect(created.links).toEqual(expect.arrayContaining([expect.objectContaining(body.links[0])]));
      expect((await persisted()).execution[0]).toMatchObject({ status: "Failed", executed_by: ownerId });
    }
  } finally {
    await db.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [organizationId, ownerId]);
    await db.query("UPDATE projects SET archived_at = NULL WHERE id = $1", [projectId]);
    await db.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [projectId, ownerId]);
    for (const id of bugs) await request.delete(`${api}/api/bugs/${id}`, { failOnStatusCode: false });
    for (const id of tokenIds) await request.delete(`${base}/apikeys/${id}`, { failOnStatusCode: false });
    if (cycleId) await request.delete(`${api}/api/cycles/${cycleId}`, { failOnStatusCode: false });
    if (testcaseId) await request.delete(`${base}/testcases/${testcaseId}`, { failOnStatusCode: false });
    if (otherOrgId) {
      await db.query("DELETE FROM organization_members WHERE organization_id = $1", [otherOrgId]);
      await db.query("DELETE FROM organizations WHERE id = $1", [otherOrgId]);
    }
    // Keep authenticated synthetic identity/audit provenance until the CI service teardown.
    // Do not delete immutable audit rows merely to remove a fixture user.
    await anonymous.dispose();
    await nonmember.dispose();
    await db.end();
  }
}

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

test("bug creation authorization and finalized automation preserve persisted results and truthful UI", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const api = process.env.CI_API_BASE_URL!;
  const web = process.env.CI_WEB_BASE_URL!;
  // This test bootstraps a fresh installation. Explicit loopback URLs AND the existing
  // disposable CI database are required; never run it against a shared deployment.
  for (const target of [api, web]) {
    expect(["127.0.0.1", "localhost"]).toContain(new URL(target).hostname);
  }
  const database = new URL(process.env.DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(database.hostname);
  expect(database.pathname).toBe("/tesbo_ci");
  const request = page.request; // Share the genuine session cookie with the browser.
  const setup = await request.post(`${api}/api/setup/first-admin`, {
    data: { email: "ci-bug-links@tesbo.invalid", password: "Ci-Bugs-2026!", orgName: "CI Bug Links", demoData: false }
  });
  expect(setup.ok(), await setup.text()).toBeTruthy();
  const bootstrap = await setup.json();
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
    await verifyBugCreateAccess(request, api, projectId, bootstrap.userId, bootstrap.organizationId);
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
        // Run and testcase deliberately share a title. Only the testcase button opens the drawer;
        // a first text match may instead click the breadcrumb/run heading after a reload.
        if (surface === "drawer") await page.getByRole("button", { name: title, exact: true }).click();
        // The background row has an icon-only action with the same accessible name.
        // Exercise the drawer/full-page footer's visible-text action, not an arbitrary match.
        await page.getByRole("button", { name: "Log bug", exact: true }).filter({ hasText: /^Log bug$/ }).click();
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
        await expect(page.getByLabel("Bug Title", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Bug Key", { exact: true })).toBeVisible();
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
        if (surface === "drawer") await page.getByRole("button", { name: title, exact: true }).click();
        await expect(page.getByLabel("Bug Title", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Bug Key", { exact: true })).toBeVisible();
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
