import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { verifyRestLockRecovery } from "./ci-rest-lock-recovery";

/** Actual session/bearer HTTP, PostgreSQL and current Plan UI, only on the isolated smoke stack. */
export async function verifyPlanProjectLineage(page: Page, api: string, web: string, projectId: string, otherId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const machine = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, other = `${api}/api/projects/${otherId}`;
  let tokenId: string | undefined;
  async function post(url: string, data: Record<string, unknown>) {
    const response = await page.request.post(url, { data });
    expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  const state = async () => ({
    plans: (await db.query("SELECT * FROM plans WHERE project_id=ANY($1::uuid[]) ORDER BY id", [[projectId, otherId]])).rows,
    runs: (await db.query("SELECT * FROM cycles WHERE project_id=ANY($1::uuid[]) ORDER BY id", [[projectId, otherId]])).rows,
    items: (await db.query("SELECT pi.* FROM plan_items pi JOIN plans p ON p.id=pi.plan_id WHERE p.project_id=ANY($1::uuid[]) ORDER BY pi.id", [[projectId, otherId]])).rows,
    cases: (await db.query("SELECT id,project_id,external_id,title,suite_id,deleted_at FROM testcases WHERE project_id=ANY($1::uuid[]) ORDER BY id", [[projectId, otherId]])).rows,
  });
  try {
    const plan = await post(`${base}/plans`, { name: "CI Local Lineage Plan" });
    await test.step("a genuinely empty Plan retains the existing no-associated-runs guidance", async () => {
      await page.goto(`${web}/projects/${projectId}/plans/${plan.id}`);
      await expect(page.getByText("No test runs associated with this plan yet. Create a new run or link an existing one to start tracking progress.", { exact: true })).toBeVisible();
    });
    const foreign = await post(`${other}/plans`, { name: "CI PRIVATE foreign Plan" });
    const suite = await post(`${base}/suites`, { name: "CI Local Lineage Suite" });
    const foreignSuite = await post(`${other}/suites`, { name: "CI PRIVATE foreign Suite" });
    const testcase = await post(`${base}/testcases`, { title: "CI Local Lineage Case" });
    const foreignCase = await post(`${other}/testcases`, { title: "CI PRIVATE foreign Case" });
    const run = await post(`${base}/cycles`, { name: "CI Local Linked Run", planId: plan.id });
    const unlinked = await post(`${base}/cycles`, { name: "CI Local Unlinked Run" });
    const issued = await post(`${base}/apikeys`, { name: "CI Plan lineage MCP", scopes: ["read", "write"] }); tokenId = issued.id;
    let rpcId = 0;
    const rpc = async (name: string, args: Record<string, unknown>, alias = false) => {
      const response = await machine.post(alias ? `${api}/api/mcp` : `${base}/mcp`, {
        headers: { Authorization: `Bearer ${issued.token}` },
        data: { jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } },
      });
      expect(response.status()).toBe(201); return response.json();
    };
    await test.step("session Plan-item and every Run-create alias reject foreign lineage before changing stored rows", async () => {
      const before = await state();
      for (const data of [{ suiteId: foreignSuite.id }, { testcaseId: foreignCase.id }, { suiteId: suite.id, testcaseId: foreignCase.id }]) {
        const denied = await page.request.post(`${api}/api/plans/${plan.id}/items`, { data });
        expect(denied.status(), await denied.text()).toBe(404); expect(await state()).toEqual(before);
      }
      for (const suffix of ["", "/from-plan", "/from-cases"]) {
        const denied = await page.request.post(`${base}/cycles${suffix}`, { data: { name: "Must not persist", planId: foreign.id } });
        expect(denied.status(), await denied.text()).toBe(404); expect(await state()).toEqual(before);
      }
      const denied = await page.request.patch(`${api}/api/cycles/${run.id}`, { data: { name: "Must not persist", planId: foreign.id } });
      expect(denied.status(), await denied.text()).toBe(404); expect(await state()).toEqual(before);
      const anonymous = await machine.post(`${api}/api/plans/${plan.id}/items`, { data: { testcaseId: testcase.id } });
      expect(anonymous.status()).toBe(400); expect(await anonymous.json()).toMatchObject({ error: "Authentication required" });
      expect(await state()).toEqual(before);
    });
    await test.step("both bearer MCP paths reject foreign Plan creation and allow a local Plan", async () => {
      const before = await state();
      for (const alias of [false, true]) {
        const denied = await rpc("create_cycle_from_plan", { name: "Must not persist", planId: foreign.id }, alias);
        expect(denied.error).toMatchObject({ code: -32003 }); expect(await state()).toEqual(before);
      }
      const allowed = await rpc("create_cycle_from_plan", { name: "CI MCP Local Plan Run", planId: plan.id });
      expect(allowed.error).toBeUndefined(); expect(allowed.result.isError).toBe(false);
      const created = JSON.parse(allowed.result.content[0].text);
      expect(created).toMatchObject({ projectId, planId: plan.id });
      expect((await db.query("SELECT plan_id,project_id FROM cycles WHERE id=$1", [created.id])).rows[0]).toEqual({ plan_id: plan.id, project_id: projectId });
    });
    await test.step("historical invalid links retain provenance but cannot expose foreign metadata in APIs, MCP or the Plan page", async () => {
      // Declared historical fixtures, not an inventory or mutation of real shared data.
      const badItem = (await db.query("INSERT INTO plan_items (plan_id,suite_id,testcase_id) VALUES ($1,$2,$3) RETURNING id", [plan.id, foreignSuite.id, foreignCase.id])).rows[0].id;
      const badRun = (await db.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'CI PRIVATE foreign Run') RETURNING id", [otherId, plan.id])).rows[0].id;
      const wrongPlanRun = (await db.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'CI Legacy wrong Plan Run') RETURNING id", [projectId, foreign.id])).rows[0].id;
      const before = await state();
      const itemsResponse = await page.request.get(`${api}/api/plans/${plan.id}/items`);
      expect(itemsResponse.ok()).toBeTruthy();
      expect((await itemsResponse.json()).find((item: { id: string }) => item.id === badItem)).toMatchObject({ suiteName: null, tcTitle: null, tcExternalId: null });
      const runsResponse = await page.request.get(`${api}/api/plans/${plan.id}/runs`); expect(runsResponse.ok()).toBeTruthy();
      const runs = await runsResponse.json(); expect(runs).toHaveLength(2); expect(runs.some((item: { id: string }) => item.id === badRun)).toBe(false);
      const progressResponse = await page.request.get(`${api}/api/plans/${plan.id}/progress`);
      expect(progressResponse.ok()).toBeTruthy(); expect(await progressResponse.json()).toMatchObject({ runCount: 2, totalCases: 0 });
      const enriched = await rpc("get_test_cycle", { cycleId: wrongPlanRun });
      expect(enriched.error).toBeUndefined(); expect(JSON.parse(enriched.result.content[0].text)).toMatchObject({ plan: null });
      expect(await state()).toEqual(before);
      await page.goto(`${web}/projects/${projectId}/plans/${plan.id}`);
      await expect(page.getByRole("link", { name: run.name, exact: true })).toBeVisible();
      await expect(page.getByText("No execution data is available for the associated runs yet. Add test cases to a run to start tracking progress.", { exact: true })).toBeVisible();
      await expect(page.getByText(/No test runs associated with this plan yet/)).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("CI PRIVATE");
      await testInfo.attach("plan-project-scoped-runs-with-invalid-history-retained", { body: await page.screenshot(), contentType: "image/png" });
    });
    await test.step("the unchanged Plan UI still links a valid local Run and persists it after reload", async () => {
      await page.getByRole("button", { name: "Link existing run", exact: true }).click();
      const modal = page.getByRole("heading", { name: "Link Existing Test Run", exact: true }).locator("..");
      const row = modal.getByRole("listitem").filter({ hasText: unlinked.name });
      const saved = page.waitForResponse((response) => response.url() === `${api}/api/cycles/${unlinked.id}` && response.request().method() === "PATCH");
      await row.getByRole("button", { name: "Link", exact: true }).click();
      expect((await saved).ok()).toBeTruthy();
      await page.reload();
      await expect(page.getByRole("link", { name: unlinked.name, exact: true })).toBeVisible();
      await expect(page.getByText("No execution data is available for the associated runs yet. Add test cases to a run to start tracking progress.", { exact: true })).toBeVisible();
      await expect(page.getByText(/No test runs associated with this plan yet/)).toHaveCount(0);
      expect((await db.query("SELECT plan_id FROM cycles WHERE id=$1", [unlinked.id])).rows[0].plan_id).toBe(plan.id);
      await expect(page.locator("body")).not.toContainText("CI PRIVATE");
      await testInfo.attach("plan-valid-ui-run-association-after-reload", { body: await page.screenshot(), contentType: "image/png" });
    });
    await verifyRestLockRecovery(page, api, web, projectId, testInfo);
  } finally {
    if (tokenId) expect((await page.request.delete(`${base}/apikeys/${tokenId}`)).ok()).toBeTruthy();
    await machine.dispose(); await db.end(); // Retain fixture/history/audit records until disposable DB teardown.
  }
}
