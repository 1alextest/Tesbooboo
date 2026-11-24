import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";

/** Real worker/HTTP/browser proof on the smoke's explicitly isolated tesbo_ci stack. */
export async function verifyReviewBoardUi(page: Page, api: string, web: string, projectId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  const base = `${api}/api/projects/${projectId}`, endpoint = `${base}/review-board/analysis`;
  const board = () => page.getByRole("region", { name: "Review Board", exact: true });
  const metric = (label: string) => board().locator("dl > div").filter({ has: page.locator("dt", { hasText: label }) }).locator("dd");
  const captured = async (name: string) => {
    await board().scrollIntoViewIfNeeded();
    await testInfo.attach(name, { body: await page.screenshot(), contentType: "image/png" });
  };
  const authoredCases = async () => (await db.query(`SELECT id,project_id,external_id,suite_id,title,description,preconditions,
    postconditions,test_data,steps,status,priority,severity,type,owner_id,deleted_at FROM testcases WHERE project_id=$1 ORDER BY id`, [projectId])).rows;
  async function open(id = projectId) {
    await page.goto(`${web}/projects/${id}/agents/tasks`);
    await page.getByRole("tab", { name: "Review Board", exact: true }).click();
    await expect(board()).toBeVisible();
  }
  async function analyse(count: number, pairs: number) {
    const pending = page.waitForResponse((response) => response.url() === endpoint && response.request().method() === "POST");
    await board().getByRole("button", { name: /^(Start Analysing|Analyse again)$/ }).click();
    const response = await pending; expect(response.status(), await response.text()).toBe(202);
    const run = (await response.json()).analysis;
    await expect.poll(async () => (await db.query("SELECT status FROM review_analysis_runs WHERE id=$1", [run.id])).rows[0]?.status, { timeout: 20_000 }).toBe("completed");
    expect((await db.query("SELECT project_id,testcases_analyzed,pairs_found FROM review_analysis_runs WHERE id=$1", [run.id])).rows[0])
      .toEqual({ project_id: projectId, testcases_analyzed: count, pairs_found: pairs });
    await expect(metric("Test cases checked")).toHaveText(String(count));
    await expect(metric("Pairs found")).toHaveText(String(pairs));
    return run.id as string;
  }
  async function add(title: string) {
    const response = await page.request.post(`${base}/testcases`, { data: { title, steps: [{ action: title, expectedResult: `Successful ${title}` }] } });
    expect(response.ok(), await response.text()).toBeTruthy(); return response.json();
  }
  try {
    const project = (await db.query("SELECT p.name,o.name AS workspace FROM projects p JOIN organizations o ON o.id=p.organization_id WHERE p.id=$1", [projectId])).rows[0];
    await open();
    await expect(page.getByRole("button", { name: "Switch workspace", exact: true })).toContainText(project.workspace);
    await expect(page.getByRole("link", { name: project.name, exact: true })).toBeVisible();
    await expect(board().getByRole("heading", { name: "No duplicate or similar test cases found", exact: true })).toHaveCount(0);

    await test.step("real zero/one/two-case analyses report their actual comparison coverage", async () => {
      await analyse(0, 0);
      await expect(board().getByRole("heading", { name: "No test cases were checked", exact: true })).toBeVisible();
      await captured("review-board-zero-cases");
      await add("Validate lunar rover antenna deployment"); await page.reload();
      await page.getByRole("tab", { name: "Review Board", exact: true }).click();
      const oneBefore = await authoredCases(); await analyse(1, 0);
      expect(await authoredCases()).toEqual(oneBefore);
      await expect(board().getByRole("heading", { name: "At least two test cases are needed", exact: true })).toBeVisible();
      await captured("review-board-one-case");
      await add("Reconcile quarterly payroll tax deductions");
      const twoBefore = await authoredCases(); await analyse(2, 0);
      expect(await authoredCases()).toEqual(twoBefore);
      await expect(board().getByRole("heading", { name: "No duplicate or similar test cases found", exact: true })).toBeVisible();
      await expect(board()).not.toContainText("Every test case in this project looks distinct");
      await captured("review-board-compared-without-pairs");
    });

    await test.step("existing findings and empty filters are not mislabeled as no findings", async () => {
      await add("Validate lunar rover antenna deployment");
      const before = await authoredCases(); await analyse(3, 1);
      await expect(board().getByRole("article")).toHaveCount(1);
      await board().getByRole("button", { name: "Keep as is", exact: true }).click();
      await expect(board().getByRole("heading", { name: "Nothing in “To review”", exact: true })).toBeVisible();
      expect(await authoredCases()).toEqual(before);
      await board().getByRole("tab", { name: /^Kept/ }).click();
      await expect(board().getByRole("article")).toHaveCount(1);
    });

    await test.step("historical unknown counts and persisted failure states remain distinct from successful comparison", async () => {
      // Explicit historical/failed-state fixtures; not a claimed worker fault reproduction.
      const latest = (await db.query("SELECT id FROM review_analysis_runs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1", [projectId])).rows[0].id;
      await db.query("UPDATE review_analysis_runs SET testcases_analyzed=NULL,pairs_found=NULL WHERE id=$1", [latest]);
      await open(); await expect(metric("Test cases checked")).toHaveText("Not available");
      await expect(metric("Pairs found")).toHaveText("Not available");
      // Existing findings still retain the filter-empty state even if coverage is unknown.
      await expect(board().getByRole("heading", { name: "Nothing in “To review”", exact: true })).toBeVisible();
      await db.query("UPDATE review_analysis_runs SET status='failed',error='CI persisted analysis failure' WHERE id=$1", [latest]);
      await open();
      await expect(board().getByRole("alert")).toContainText("CI persisted analysis failure");
      await expect(board().getByRole("button", { name: "Start Analysing", exact: true })).toBeEnabled();
      await expect(board().getByRole("heading", { name: "No duplicate or similar test cases found", exact: true })).toHaveCount(0);
      await captured("review-board-failed-analysis");
    });

    await test.step("successful list loading cannot hide failed analysis loading; retry is a read, not a mutation", async () => {
      await page.route(endpoint, (route) => route.request().method() === "GET"
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "CI analysis read unavailable" }) }) : route.continue());
      try {
        await open();
        await expect(board().getByRole("alert")).toContainText("Analysis could not be loaded");
        await expect(board().getByRole("button", { name: "Start Analysing", exact: true })).toBeDisabled();
        await expect(board().getByRole("heading", { name: "No duplicate or similar test cases found", exact: true })).toHaveCount(0);
        await page.unroute(endpoint);
        const before = (await db.query("SELECT * FROM review_analysis_runs WHERE project_id=$1 ORDER BY id", [projectId])).rows;
        await board().getByRole("button", { name: "Retry loading analysis", exact: true }).click();
        await expect(board()).not.toContainText("Analysis could not be loaded");
        expect((await db.query("SELECT * FROM review_analysis_runs WHERE project_id=$1 ORDER BY id", [projectId])).rows).toEqual(before);
      } finally { await page.unroute(endpoint); }
    });

    await test.step("a different project retains the workspace label but uses its own route and analysis", async () => {
      const response = await page.request.post(`${api}/api/projects`, { data: { name: "CI Other Review Scope", key: "ORV" } });
      expect(response.ok(), await response.text()).toBeTruthy(); const other = await response.json();
      await db.query("INSERT INTO review_analysis_runs (project_id,status,testcases_analyzed,pairs_found,finished_at) VALUES ($1,'completed',0,0,now())", [other.id]);
      await open(other.id);
      await expect(page.getByRole("button", { name: "Switch workspace", exact: true })).toContainText(project.workspace);
      await expect(page.getByRole("link", { name: other.name, exact: true })).toBeVisible();
      await expect(board().getByRole("heading", { name: "No test cases were checked", exact: true })).toBeVisible();
      await expect(board().getByRole("article")).toHaveCount(0);
      const latest = (await db.query("SELECT id FROM review_analysis_runs WHERE project_id=$1", [other.id])).rows[0].id;
      await db.query("UPDATE review_analysis_runs SET testcases_analyzed=NULL,pairs_found=NULL WHERE id=$1", [latest]);
      await open(other.id);
      await expect(board().getByRole("heading", { name: "Analysis coverage unavailable", exact: true })).toBeVisible();
      await expect(metric("Test cases checked")).toHaveText("Not available");
      await captured("review-board-unknown-coverage-and-project-context");
    });
  } finally { await db.end(); } // Retain synthetic run/decision provenance until disposable DB teardown.
}
