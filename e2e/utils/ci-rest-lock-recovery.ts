import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import { Client } from "pg";

/** UI-only refusal injection on the existing isolated stack. Native tests own real billing denial. */
export async function verifyRestLockRecovery(page: Page, api: string, web: string, projectId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const base = `${api}/api/projects/${projectId}`;
  const message = "This project is read-only — CI controlled UI refusal.";
  async function post(url: string, data: Record<string, unknown>) {
    const response = await page.request.post(url, { data });
    expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  const state = async () => ({
    plans: (await db.query("SELECT * FROM plans WHERE project_id=$1 ORDER BY id", [projectId])).rows,
    items: (await db.query("SELECT i.* FROM plan_items i JOIN plans p ON p.id=i.plan_id WHERE p.project_id=$1 ORDER BY i.id", [projectId])).rows,
    runs: (await db.query("SELECT * FROM cycles WHERE project_id=$1 ORDER BY id", [projectId])).rows,
    results: (await db.query("SELECT e.* FROM executions e JOIN cycle_items i ON i.id=e.cycle_item_id JOIN cycles c ON c.id=i.cycle_id WHERE c.project_id=$1 ORDER BY e.id", [projectId])).rows,
    evidence: (await db.query("SELECT * FROM attachments WHERE project_id=$1 ORDER BY id", [projectId])).rows,
    audit: (await db.query("SELECT * FROM audit_logs WHERE project_id=$1 ORDER BY id", [projectId])).rows
  });
  async function refused(endpoint: string, method: string, action: () => Promise<unknown>, retained: () => Promise<void>, screenshot: string) {
    const before = await state(); let calls = 0;
    const handler = async (route: Route) => {
      if (route.request().method() !== method) return route.continue();
      calls++;
      return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: message }) });
    };
    await page.route(endpoint, handler);
    try {
      await action();
      await expect(page.getByRole("alert").filter({ hasText: message }).last()).toBeVisible();
      await retained(); expect(calls).toBe(1); expect(await state()).toEqual(before);
      await testInfo.attach(screenshot, { body: await page.screenshot(), contentType: "image/png" });
    } finally { await page.unroute(endpoint, handler); }
  }
  try {
    const projectResponse = await page.request.get(base); expect(projectResponse.ok()).toBeTruthy();
    const project = await projectResponse.json();
    const configured = await page.request.patch(base, { data: { settings: JSON.stringify({ ...project.settings,
      testRunEnvironments: [{ name: "QA", url: "https://qa.tesbo.invalid" }] }) } });
    expect(configured.ok(), await configured.text()).toBeTruthy();
    const plan = await post(`${base}/plans`, { name: "CI REST recovery Plan" });
    const run = await post(`${base}/cycles`, { name: "CI REST recovery Run", environment: "QA" });
    const testcase = await post(`${base}/testcases`, { title: "CI REST recovery Case" });
    await post(`${api}/api/cycles/${run.id}/testcases`, { testcaseIds: [testcase.id] });
    const execution = (await db.query("SELECT e.id FROM executions e JOIN cycle_items i ON i.id=e.cycle_item_id WHERE i.cycle_id=$1", [run.id])).rows[0];
    await db.query("UPDATE executions SET actual_result='Retained UI result',history='[{\"status\":\"Blocked\"}]'::jsonb WHERE id=$1", [execution.id]);
    const planUrl = `${web}/projects/${projectId}/plans/${plan.id}`, runUrl = `${web}/projects/${projectId}/cycles/${run.id}`;
    const planApi = `${api}/api/plans/${plan.id}`, runApi = `${api}/api/cycles/${run.id}`;
    await test.step("Plan edit refusal retains the draft and a selected retry persists it", async () => {
      await page.goto(planUrl);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Plan name", { exact: true }).fill("CI REST edited Plan");
      await refused(planApi, "PATCH", () => page.getByRole("button", { name: "Save", exact: true }).click(), async () => {
        await expect(page.getByLabel("Plan name", { exact: true })).toHaveValue("CI REST edited Plan");
        await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
      }, "rest-plan-edit-refusal-draft");
      const saved = page.waitForResponse((response) => response.url() === planApi && response.request().method() === "PATCH");
      await page.getByRole("button", { name: "Save", exact: true }).click(); expect((await saved).ok()).toBeTruthy();
      await expect(page.getByRole("heading", { name: "CI REST edited Plan", exact: true })).toBeVisible();
      expect((await db.query("SELECT name FROM plans WHERE id=$1", [plan.id])).rows[0].name).toBe("CI REST edited Plan");
    });
    await test.step("Plan association and unlink refusals preserve relationships and recover", async () => {
      await page.getByRole("button", { name: "Link existing run", exact: true }).click();
      const modal = page.getByRole("heading", { name: "Link Existing Test Run", exact: true }).locator("..");
      const row = modal.getByRole("listitem").filter({ hasText: run.name });
      await refused(runApi, "PATCH", () => row.getByRole("button", { name: "Link", exact: true }).click(), async () => {
        await expect(modal).toBeVisible(); await expect(row.getByRole("button", { name: "Link", exact: true })).toBeEnabled();
      }, "rest-plan-association-refusal");
      await row.getByRole("button", { name: "Link", exact: true }).click();
      await expect(page.getByRole("link", { name: run.name, exact: true })).toBeVisible();
      expect((await db.query("SELECT plan_id FROM cycles WHERE id=$1", [run.id])).rows[0].plan_id).toBe(plan.id);
      const unlink = page.getByRole("link", { name: run.name, exact: true }).locator("../../../..").getByTitle("Unlink from plan");
      await refused(runApi, "PATCH", async () => { page.once("dialog", (dialog) => dialog.accept()); await unlink.click(); }, async () => {
        await expect(page.getByRole("link", { name: run.name, exact: true })).toBeVisible();
      }, "rest-plan-unlink-refusal");
      page.once("dialog", (dialog) => dialog.accept()); await unlink.click();
      await expect(page.getByRole("link", { name: run.name, exact: true })).toHaveCount(0);
      expect((await db.query("SELECT plan_id FROM cycles WHERE id=$1", [run.id])).rows[0].plan_id).toBeNull();
    });
    await test.step("creating a Run from a Plan retains its entered name and environment on refusal", async () => {
      await page.getByRole("button", { name: "Create test run", exact: true }).first().click();
      const form = page.locator("form").filter({ has: page.getByPlaceholder("CI REST edited Plan", { exact: true }) });
      await form.getByPlaceholder("CI REST edited Plan", { exact: true }).fill("CI REST created Run");
      await form.locator("select").selectOption("QA");
      await refused(`${base}/cycles/from-plan`, "POST", () => form.getByRole("button", { name: "Create Test Run", exact: true }).click(), async () => {
        await expect(form.getByPlaceholder("CI REST edited Plan", { exact: true })).toHaveValue("CI REST created Run");
        await expect(form.locator("select")).toHaveValue("QA");
      }, "rest-plan-create-run-refusal-draft");
      await form.getByRole("button", { name: "Create Test Run", exact: true }).click();
      await expect(page.getByRole("link", { name: "CI REST created Run", exact: true })).toBeVisible();
      expect((await db.query("SELECT plan_id FROM cycles WHERE project_id=$1 AND name='CI REST created Run'", [projectId])).rows).toEqual([{ plan_id: plan.id }]);
    });
    await test.step("Plan detail deletion explains refusal without navigating or deleting its Runs", async () => {
      await refused(planApi, "DELETE", async () => { page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Delete", exact: true }).click(); }, async () => {
        await expect(page.getByRole("heading", { name: "CI REST edited Plan", exact: true })).toBeVisible();
      }, "rest-plan-detail-delete-refusal");
      page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page.waitForURL(`**/projects/${projectId}/plans`);
      expect((await db.query("SELECT deleted_at IS NOT NULL AS deleted FROM plans WHERE id=$1", [plan.id])).rows[0].deleted).toBe(true);
      expect((await db.query("SELECT deleted_at FROM cycles WHERE id=$1", [run.id])).rows[0].deleted_at).toBeNull();
    });
    await test.step("Plan-list optimistic deletion is restored with an error and can be retried", async () => {
      const target = await post(`${base}/plans`, { name: "CI REST list-delete Plan" });
      await page.reload();
      const card = page.locator("div.group").filter({ has: page.getByRole("link", { name: target.name, exact: true }) }).first();
      await expect(card).toBeVisible();
      await refused(`${api}/api/plans/${target.id}`, "DELETE", async () => { page.once("dialog", (dialog) => dialog.accept()); await card.getByTitle("Delete plan", { exact: true }).click(); }, async () => {
        await expect(card).toBeVisible();
      }, "rest-plan-list-delete-refusal");
      page.once("dialog", (dialog) => dialog.accept()); await card.getByTitle("Delete plan", { exact: true }).click();
      await expect(card).toHaveCount(0);
      await expect.poll(async () => (await db.query("SELECT deleted_at IS NOT NULL AS deleted FROM plans WHERE id=$1", [target.id])).rows[0].deleted).toBe(true);
    });
    await test.step("Run lifecycle refusal preserves the displayed and persisted status before a successful retry", async () => {
      await page.goto(runUrl);
      await refused(runApi, "PATCH", () => page.getByRole("button", { name: "Start Execution", exact: true }).click(), async () => {
        await expect(page.getByRole("button", { name: "Start Execution", exact: true })).toBeEnabled();
      }, "rest-run-lifecycle-refusal");
      await page.getByRole("button", { name: "Start Execution", exact: true }).click();
      await expect(page.getByRole("button", { name: "Mark Completed", exact: true })).toBeVisible();
      expect((await db.query("SELECT status FROM cycles WHERE id=$1", [run.id])).rows[0].status).toBe("In Progress");
    });
    await test.step("full-page execution refusal retains entered result and assignment, then persists a selected retry", async () => {
      await page.goto(`${runUrl}/execute/${execution.id}`);
      await page.getByPlaceholder("Describe what actually happened…").fill("Retained REST UI draft");
      await page.getByRole("button", { name: "Passed", exact: true }).click();
      const assignee = page.getByRole("combobox", { name: "Assigned to", exact: true });
      const member = await assignee.locator("option").nth(1).getAttribute("value"); expect(member).toBeTruthy();
      await assignee.selectOption(member!);
      await refused(`${runApi}/executions/${execution.id}`, "PATCH", () => page.getByRole("button", { name: "Save", exact: true }).click(), async () => {
        await expect(page.getByPlaceholder("Describe what actually happened…")).toHaveValue("Retained REST UI draft");
        await expect(assignee).toHaveValue(member!); await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
      }, "rest-full-execution-refusal-draft");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.waitForURL(`**/projects/${projectId}/cycles/${run.id}`);
      expect((await db.query("SELECT status,actual_result,assignee_id,history FROM executions WHERE id=$1", [execution.id])).rows[0])
        .toEqual({ status: "Passed", actual_result: "Retained REST UI draft", assignee_id: member, history: [{ status: "Blocked" }] });
      await page.reload();
      await expect(page.getByRole("heading", { name: run.name, exact: true })).toBeVisible();
      await testInfo.attach("rest-recovery-persisted-run", { body: await page.screenshot(), contentType: "image/png" });
    });
  } finally { await db.end(); } // Retain synthetic rows/history until disposable stack teardown.
}
