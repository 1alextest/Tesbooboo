import fs from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";
import { env } from "../utils/env";
import { exec, literal, scalar } from "../utils/psql";
import { approveTestcase, createApprovedTestcase } from "../utils/testcase-approval";

let ctx: { projectId: string };
const STATE_PATH = path.join(__dirname, "../.auth/state.json");
// Discovery does not create an authenticated session. Read the real global-setup fixture only
// when the selected tests execute, after global setup has provisioned it.
test.beforeAll(() => {
  ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
});

const MODEL = {
  schemaVersion: "tesbo-fsm-draft/1",
  semantics: "SEQUENTIAL_FSM",
  initialStateId: "start",
  states: [
    { id: "start", label: "Start" },
    { id: "done", label: "Done" }
  ],
  transitions: [
    { id: "finish", from: "start", to: "done", action: "Submit", expectedObservation: "Submitted" }
  ]
};

async function createRunRecoveryFixture(api: APIRequestContext, label: string) {
  const name = `E2E run recovery ${label} ${Date.now()}`;
  let modelId = "", caseId = "";
  const cleanup = async () => {
    // Only this fixture's native rows, including a committed run whose response was never received.
    if (modelId) {
      exec(`DELETE FROM executions WHERE cycle_item_id IN (SELECT ci.id FROM cycle_items ci
        JOIN mbt_model_runs mr ON mr.cycle_id=ci.cycle_id WHERE mr.model_id=${literal(modelId)});
        DELETE FROM cycle_items WHERE cycle_id IN (SELECT cycle_id FROM mbt_model_runs WHERE model_id=${literal(modelId)});
        DELETE FROM cycles WHERE id IN (SELECT cycle_id FROM mbt_model_runs WHERE model_id=${literal(modelId)})
          AND project_id=${literal(ctx.projectId)};
        DELETE FROM mbt_models WHERE id=${literal(modelId)} AND project_id=${literal(ctx.projectId)};`);
    }
    if (caseId) await api.delete(`/api/projects/${ctx.projectId}/testcases/${caseId}`, { failOnStatusCode: false });
  };
  try {
    const created = await api.post(`/api/projects/${ctx.projectId}/model-studio/models`, { data: { name, model: MODEL } });
    expect(created.status(), await created.text()).toBe(201);
    const model = await created.json(); modelId = model.id;
    const revisionUrl = `/api/projects/${ctx.projectId}/model-studio/models/${modelId}/revisions/${model.latestRevision.id}`;
    const approved = await api.post(`${revisionUrl}/approve`, { data: { expectedHash: model.latestRevision.contentHash } });
    expect(approved.status(), await approved.text()).toBe(201);
    const testcase = await createApprovedTestcase(api, ctx.projectId, { title: `${name} case` }); caseId = testcase.id;
    const linked = await api.post(`${revisionUrl}/links`, { data: {
      testcaseId: caseId, testcaseRevision: testcase.editRevision, elementIds: ["finish"],
    } });
    expect(linked.status(), await linked.text()).toBe(201);
    return { modelId, caseId, name, revision: model.latestRevision, cleanup,
      runUrl: `${env.apiBaseUrl}${revisionUrl}/runs`, pageUrl: `/projects/${ctx.projectId}/model-studio?model=${modelId}`,
      nativeCount: (runName: string) => scalar(`SELECT count(*) FROM cycles WHERE project_id=${literal(ctx.projectId)} AND name=${literal(runName)};`),
      manifestCount: () => scalar(`SELECT count(*) FROM mbt_model_runs WHERE model_id=${literal(modelId)};`),
    };
  } catch (error) { await cleanup(); throw error; }
}

test("a committed model run with a lost response stays blocked across reload until the reviewer identifies its native run", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const fixture = await createRunRecoveryFixture(api, "lost ACK");
  const runName = `${fixture.name} native run`;
  let postCount = 0, cycleId = "";
  let release!: () => void, committed!: () => void, rejectCommit!: (cause: unknown) => void, finished!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const saved = new Promise<void>((resolve, reject) => { committed = resolve; rejectCommit = reject; });
  const dropped = new Promise<void>((resolve) => { finished = resolve; });
  void saved.catch(() => undefined);
  await page.route(fixture.runUrl, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    postCount++;
    try {
      const response = await route.fetch({ maxRetries: 0 });
      expect(response.status(), await response.text()).toBe(201);
      cycleId = (await response.json()).cycleId;
      committed(); await held; await route.abort("failed");
    } catch (cause) { rejectCommit(cause); throw cause; }
    finally { finished(); }
  });
  try {
    await page.goto(fixture.pageUrl);
    const runs = page.getByRole("region", { name: "Model runs", exact: true });
    await runs.getByLabel("Run name (optional)").fill(runName);
    await runs.getByLabel("Environment (optional)").fill("QA recovery");
    const start = runs.getByRole("button", { name: "Start run with 1 case", exact: true });
    await expect(start).toBeEnabled();
    await start.evaluate((element) => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
    await saved;
    expect(postCount).toBe(1);
    expect(fixture.nativeCount(runName)).toBe("1"); expect(fixture.manifestCount()).toBe("1");
    // The marker exists before an ACK, so a page reload during this window cannot permit a replay.
    const pending = await page.evaluate((modelId) => Object.keys(localStorage)
      .filter((key) => key.startsWith("tesbo:model-run-intent:v1:"))
      .map((key) => JSON.parse(localStorage.getItem(key)!)).find((entry) => entry.modelId === modelId), fixture.modelId);
    expect(pending).toMatchObject({ outcome: "OUTCOME_UNKNOWN", projectId: ctx.projectId, modelId: fixture.modelId,
      revisionId: fixture.revision.id, request: { name: runName, environment: "QA recovery", caseIds: [fixture.caseId] } });
    expect(pending.id).toEqual(expect.any(String)); expect(pending.requestedAt).toEqual(expect.any(String));
    const recovery = runs.getByRole("region", { name: "Run request recovery", exact: true });
    await page.reload(); // Reload while POST is still waiting for its ACK, not only after catch.
    await expect(recovery).toHaveAttribute("data-outcome", "OUTCOME_UNKNOWN");
    release(); await dropped;
    await expect(start).toBeDisabled();
    await start.evaluate((element) => (element as HTMLButtonElement).click());
    await page.reload();
    await expect(recovery).toBeVisible(); await expect(start).toBeDisabled();
    await expect(runs.getByLabel("Run name (optional)")).toHaveValue(runName);
    await expect(runs.getByLabel("Environment (optional)")).toHaveValue("QA recovery");
    expect(postCount).toBe(1); expect(fixture.nativeCount(runName)).toBe("1");
    await recovery.getByRole("button", { name: "Inspect existing runs", exact: true }).click();
    await expect(recovery).toContainText("Native run readback completed");
    await expect(recovery.getByRole("link", { name: runName, exact: true })).toHaveAttribute("href", `/projects/${ctx.projectId}/cycles/${cycleId}`);
    await expect(start).toBeDisabled(); // A title match and readback alone never release uncertainty.
    await expect(recovery.getByRole("button", { name: "Allow a separate new request" })).toBeDisabled();
    await recovery.getByRole("button", { name: `Use inspected run ${runName}`, exact: true }).click();
    await expect(recovery).toHaveCount(0);
    await expect(runs.getByRole("status")).toContainText("Using the native run you identified");
    const persisted = await api.get(`/api/cycles/${cycleId}/executions`);
    expect(persisted.ok(), await persisted.text()).toBeTruthy();
    expect((await persisted.json()).map((entry: { testcaseId: string }) => entry.testcaseId)).toEqual([fixture.caseId]);
    await page.reload();
    await expect(runs).toBeVisible(); await expect(recovery).toHaveCount(0);
    expect(postCount).toBe(1); expect(fixture.nativeCount(runName)).toBe("1"); expect(fixture.manifestCount()).toBe("1");
  } finally {
    release(); await page.unroute(fixture.runUrl); await fixture.cleanup(); await api.dispose();
  }
});

test("an unknown model run requires successful inspection and explicit duplicate acknowledgment before a separate new request", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const fixture = await createRunRecoveryFixture(api, "separate intent");
  const runName = `${fixture.name} native run`;
  let postCount = 0, secondIntentId = "";
  await page.route(fixture.runUrl, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    postCount++;
    if (postCount === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Synthetic unavailable response" }) });
    secondIntentId = await page.evaluate((modelId) => Object.keys(localStorage)
      .filter((key) => key.startsWith("tesbo:model-run-intent:v1:"))
      .map((key) => JSON.parse(localStorage.getItem(key)!)).find((entry) => entry.modelId === modelId)?.id, fixture.modelId);
    return route.continue();
  });
  try {
    await page.goto(fixture.pageUrl);
    const runs = page.getByRole("region", { name: "Model runs", exact: true });
    await runs.getByLabel("Run name (optional)").fill(runName);
    const start = runs.getByRole("button", { name: "Start run with 1 case", exact: true });
    await start.click();
    const recovery = runs.getByRole("region", { name: "Run request recovery", exact: true });
    await expect(recovery).toBeVisible(); await expect(start).toBeDisabled();
    const firstIntentId = await page.evaluate((modelId) => Object.keys(localStorage)
      .filter((key) => key.startsWith("tesbo:model-run-intent:v1:"))
      .map((key) => JSON.parse(localStorage.getItem(key)!)).find((entry) => entry.modelId === modelId)?.id, fixture.modelId);
    const listUrl = `${env.apiBaseUrl}/api/projects/${ctx.projectId}/cycles`;
    await page.route(listUrl, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Native run inspection unavailable" }) }));
    await recovery.getByRole("button", { name: "Inspect existing runs", exact: true }).click();
    await expect(runs.getByRole("alert").filter({ hasText: "Native run inspection unavailable" })).toBeVisible();
    await expect(recovery.getByText("No native runs were returned.", { exact: false })).toHaveCount(0);
    await expect(recovery.getByRole("checkbox")).toHaveCount(0);
    await expect(start).toBeDisabled();
    await page.unroute(listUrl);
    await recovery.getByRole("button", { name: "Inspect existing runs", exact: true }).click();
    await expect(recovery).toContainText("Native run readback completed");
    const allowNew = recovery.getByRole("button", { name: "Allow a separate new request" });
    await expect(allowNew).toBeDisabled();
    await recovery.getByRole("checkbox", { name: /I inspected native runs/ }).check();
    await allowNew.click();
    await expect(recovery).toHaveCount(0); await expect(start).toBeEnabled();
    await expect(runs.getByRole("status")).toContainText("previous request remains unconfirmed");
    expect(postCount).toBe(1); expect(fixture.nativeCount(runName)).toBe("0");
    await start.click();
    await expect(runs.getByRole("status").filter({ hasText: "Created run" })).toBeVisible();
    expect(postCount).toBe(2); expect(fixture.nativeCount(runName)).toBe("1"); expect(fixture.manifestCount()).toBe("1");
    expect(firstIntentId).toEqual(expect.any(String)); expect(secondIntentId).toEqual(expect.any(String));
    expect(secondIntentId).not.toBe(firstIntentId);
  } finally { await page.unroute(fixture.runUrl); await fixture.cleanup(); await api.dispose(); }
});

test("a confirmed mapping conflict keeps the model run form editable and creates no native run", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const fixture = await createRunRecoveryFixture(api, "known refusal");
  const runName = `${fixture.name} native run`;
  try {
    await page.goto(fixture.pageUrl);
    const runs = page.getByRole("region", { name: "Model runs", exact: true });
    await runs.getByLabel("Run name (optional)").fill(runName);
    // A real concurrently edited and reviewed case makes the accepted mapping stale.
    const edited = await api.put(`/api/projects/${ctx.projectId}/testcases/${fixture.caseId}`, { data: { description: "A newer reviewed case body" } });
    expect(edited.ok(), await edited.text()).toBeTruthy();
    await approveTestcase(api, ctx.projectId, fixture.caseId);
    const response = page.waitForResponse((entry) => entry.url() === fixture.runUrl && entry.request().method() === "POST");
    const start = runs.getByRole("button", { name: "Start run with 1 case", exact: true });
    await start.click();
    const refused = await response; expect(refused.status(), await refused.text()).toBe(409);
    expect((await refused.json()).code).toBe("MAPPING_CHANGED");
    await expect(runs.getByRole("alert")).toContainText("changed since it was linked");
    await expect(start).toBeEnabled(); await expect(runs.getByLabel("Run name (optional)")).toHaveValue(runName);
    await expect(runs.getByRole("region", { name: "Run request recovery" })).toHaveCount(0);
    expect(fixture.nativeCount(runName)).toBe("0"); expect(fixture.manifestCount()).toBe("0");
  } finally { await fixture.cleanup(); await api.dispose(); }
});

test("a mapping whose case changed since acceptance is reported for review, not rewritten", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const name = `E2E stale mapping model ${Date.now()}`;
  let modelId = "";
  let caseId = "";
  try {
    const created = await api.post(`/api/projects/${ctx.projectId}/model-studio/models`, { data: { name, model: MODEL } });
    expect(created.status(), await created.text()).toBe(201);
    const model = await created.json();
    modelId = model.id;

    const createdCase = await api.post(`/api/projects/${ctx.projectId}/testcases`, { data: { title: `E2E stale mapping case ${Date.now()}` } });
    expect(createdCase.status(), await createdCase.text()).toBe(201);
    caseId = (await createdCase.json()).id;
    const caseRevision = (await (await api.get(`/api/projects/${ctx.projectId}/testcases/${caseId}`)).json()).editRevision;

    const linked = await api.post(
      `/api/projects/${ctx.projectId}/model-studio/models/${modelId}/revisions/${model.latestRevision.id}/links`,
      { data: { testcaseId: caseId, elementIds: ["finish"], testcaseRevision: caseRevision } }
    );
    expect(linked.status(), await linked.text()).toBe(201);

    const edited = await api.put(`/api/projects/${ctx.projectId}/testcases/${caseId}`, { data: { title: `E2E stale mapping case edited ${Date.now()}` } });
    expect(edited.ok(), await edited.text()).toBeTruthy();

    await page.goto(`/projects/${ctx.projectId}/model-studio`);
    await page.getByRole("button", { name, exact: false }).click();
    const mappings = page.getByRole("region", { name: "Case mappings" });
    await expect(mappings).toContainText("1 linked");
    await expect(mappings.getByRole("status")).toContainText("1 case has changed since the mapping was accepted");
    await expect(mappings.getByRole("status")).toContainText("never rewrites a case, link or history");
  } finally {
    if (caseId) await api.delete(`/api/projects/${ctx.projectId}/testcases/${caseId}`, { failOnStatusCode: false });
    if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(ctx.projectId)};`);
    await api.dispose();
  }
});

test("a persisted model revision renders as a graph and accessible tables", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const name = `E2E studio model ${Date.now()}`;
  let modelId = "";
  try {
    const created = await api.post(`/api/projects/${ctx.projectId}/model-studio/models`, { data: { name, model: MODEL } });
    expect(created.status(), await created.text()).toBe(201);
    modelId = (await created.json()).id;

    await page.goto(`/projects/${ctx.projectId}/model-studio`);
    await expect(page.getByRole("heading", { name: "Model Studio", exact: true })).toBeVisible();
    await page.getByRole("button", { name, exact: false }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByText("Expected model · Draft · Not approved · Runtime evidence: none")).toBeVisible();
    await expect(page.getByRole("region", { name: "Draft state graph" })).toBeVisible();
    await expect(page.getByRole("table", { name: "States" })).toContainText("start");
    await expect(page.getByRole("table", { name: "Transitions" })).toContainText("finish");
    const mappings = page.getByRole("region", { name: "Case mappings" });
    await expect(mappings).toContainText("0 linked");
    // A clean latest revision (no links at all) must not render a staleness warning.
    await expect(mappings.getByRole("status")).toHaveCount(0);
  } finally {
    if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(ctx.projectId)};`);
    await api.dispose();
  }
});

test("archiving a model in the studio removes it from the list and keeps its history", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const name = `E2E archive model ${Date.now()}`;
  let modelId = "";
  try {
    const created = await api.post(`/api/projects/${ctx.projectId}/model-studio/models`, { data: { name, model: MODEL } });
    expect(created.status(), await created.text()).toBe(201);
    modelId = (await created.json()).id;

    // Archive is confirmed before it retires the model; accept the dialog so the click proceeds.
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`/projects/${ctx.projectId}/model-studio`);
    await page.getByRole("button", { name, exact: false }).click();
    // Exact: the model's own nav button is named "E2E archive model …" and would also match.
    await page.getByRole("button", { name: "Archive model", exact: true }).click();

    await expect(page.getByRole("button", { name, exact: false })).toHaveCount(0);
    expect((await api.get(`/api/projects/${ctx.projectId}/model-studio/models/${modelId}`)).status()).toBe(404);
  } finally {
    if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(ctx.projectId)};`);
    await api.dispose();
  }
});

test("a reviewer approves the revision, creates a draft case and starts a governed run", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const name = `E2E governed studio ${Date.now()}`;
  let modelId = "";
  let cycleId = "";
  try {
    const created = await api.post(`/api/projects/${ctx.projectId}/model-studio/models`, { data: { name, model: MODEL } });
    expect(created.status(), await created.text()).toBe(201);
    modelId = (await created.json()).id;

    // Approving asks for confirmation; the reviewer is attesting the content hash they saw.
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto(`/projects/${ctx.projectId}/model-studio`);
    await page.getByRole("button", { name, exact: false }).click();
    await page.getByRole("button", { name: "Approve revision 1" }).click();
    await expect(page.getByText(/Approved rev 1/)).toBeVisible();

    await page.getByRole("button", { name: "Generate paths" }).click();
    const firstPath = page.getByRole("checkbox", { name: /Select path/ }).first();
    await expect(firstPath).toBeVisible();
    await firstPath.check();
    await page.getByRole("button", { name: "Create draft cases" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Created" })).toBeVisible();
    // The generated case is listed with a link back to it, not only announced in a notice. Scoped
    // to the proposals panel: the same case also appears in the run-eligibility list below.
    await expect(
      page.getByRole("region", { name: "Path proposals" }).getByRole("link", { name: /^Model: / }).first()
    ).toBeVisible();

    // The proposal became a real, unapproved Draft case. Read the persisted row directly so the
    // assertion is about state, not about search ranking or list defaults.
    expect(
      scalar(`SELECT t.status FROM testcases t JOIN mbt_generated_cases gc ON gc.testcase_id=t.id
        WHERE gc.model_id=${literal(modelId)} AND t.project_id=${literal(ctx.projectId)} AND t.deleted_at IS NULL
        ORDER BY t.created_at DESC LIMIT 1;`)
    ).toBe("Draft");

    /*
     * Governed run. A Draft cannot be dispatched, so the case is approved through the product's own
     * approval endpoint first — the same path the Test Cases screen uses — and then the studio is
     * reloaded so its eligibility list reflects the live status.
     */
    const modelDetail = await (await api.get(`/api/projects/${ctx.projectId}/model-studio/models/${modelId}`)).json();
    const revisionId = modelDetail.latestRevision.id as string;
    const caseId = scalar(`SELECT t.id FROM testcases t JOIN mbt_generated_cases gc ON gc.testcase_id=t.id
      WHERE gc.model_id=${literal(modelId)} AND t.project_id=${literal(ctx.projectId)} AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC LIMIT 1;`);
    await approveTestcase(api, ctx.projectId, caseId);

    await page.reload();
    await page.getByRole("button", { name, exact: false }).click();
    const runs = page.getByRole("region", { name: "Model runs" });
    await expect(runs).toBeVisible();
    // The approved case is selectable and selected by default; a Draft would be listed disabled.
    const includeCase = runs.getByRole("checkbox", { name: /Include Model:/ }).first();
    await expect(includeCase).toBeChecked();
    await runs.getByRole("button", { name: /Start run with 1 case/ }).click();
    await expect(runs.getByRole("status").filter({ hasText: "Created run" })).toBeVisible();

    cycleId = scalar(
      `SELECT cycle_id FROM mbt_model_runs WHERE model_revision_id = ${literal(revisionId)} ORDER BY created_at DESC LIMIT 1;`
    );
    expect(cycleId, "the dispatch should have recorded a provenance row").toBeTruthy();

    // Execute the dispatched case through the native API, then reload: observed results are the
    // live execution outcomes, shown per model element.
    const execution = (await (await api.get(`/api/cycles/${cycleId}/executions`)).json())[0];
    expect((await api.patch(`/api/cycles/${cycleId}/executions/${execution.id}`, { data: { status: "Passed" } })).ok()).toBe(
      true
    );
    await page.reload();
    await page.getByRole("button", { name, exact: false }).click();
    const runsAfter = page.getByRole("region", { name: "Model runs" });
    await expect(runsAfter.getByRole("link", { name: /Model run:/ }).first()).toBeVisible();
    const observed = runsAfter.getByRole("list", { name: "Observed results by element" });
    await expect(observed).toContainText("Passed 1");

    // The native run page shows the model basis it came from and links back to the studio model.
    await page.goto(`/projects/${ctx.projectId}/cycles/${cycleId}`);
    const provenance = page.getByTestId("run-model-provenance");
    await expect(provenance).toContainText("Started from model");
    await expect(provenance).toContainText(name);
    await expect(provenance).toContainText("rev 1");
    await expect(provenance.getByRole("link", { name })).toHaveAttribute("href", /\/model-studio\?model=/);
  } finally {
    /*
     * The run references the generated case, and the API delete of a cycle is a SOFT delete — its
     * cycle_items and executions would still block the hard test-case delete below.
     * executions -> cycle_items -> cycles is the FK order.
     */
    if (modelId) {
      exec(
        `DELETE FROM executions WHERE cycle_item_id IN (SELECT ci.id FROM cycle_items ci
          JOIN mbt_model_runs mr ON mr.cycle_id = ci.cycle_id WHERE mr.model_id = ${literal(modelId)});`
      );
      exec(
        `DELETE FROM cycle_items WHERE cycle_id IN (SELECT cycle_id FROM mbt_model_runs WHERE model_id = ${literal(modelId)});`
      );
    }
    if (cycleId) await api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
    // Remove only the generated cases; the model delete cascades its revisions and provenance.
    if (modelId) exec(`DELETE FROM testcases WHERE project_id=${literal(ctx.projectId)}
      AND id IN (SELECT testcase_id FROM mbt_generated_cases WHERE model_id=${literal(modelId)});`);
    if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(ctx.projectId)};`);
    await api.dispose();
  }
});

test("a model is created and revised in the studio, and a case is linked and unlinked", async ({ page }) => {
  const api = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: STATE_PATH });
  const name = `E2E studio authoring ${Date.now()}`;
  const caseTitle = `E2E studio case ${Date.now()}`;
  let caseId = "";
  try {
    const createdCase = await api.post(`/api/projects/${ctx.projectId}/testcases`, { data: { title: caseTitle } });
    expect(createdCase.status(), await createdCase.text()).toBe(201);
    caseId = (await createdCase.json()).id;

    await page.goto(`/projects/${ctx.projectId}/model-studio`);
    await page.getByRole("button", { name: "New model" }).click();
    await page.getByPlaceholder("Checkout flow").fill(name);
    await page.getByRole("button", { name: "Create model" }).click();

    // The new model is selected and shows its first immutable revision.
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const revisionSelect = page.getByRole("combobox", { name: "Revision" });
    await expect(revisionSelect).toContainText("rev 1");

    // Saving revision 2 starts from the head and appends, rather than rewriting revision 1.
    await page.getByRole("button", { name: "New revision" }).click();
    await page.getByLabel("Transition 1 action").fill("Submit");
    await page.getByRole("button", { name: "Save revision" }).click();
    await expect(revisionSelect).toContainText("rev 2");

    // Link the case to the start state, then remove the mapping from the studio.
    await page.getByRole("button", { name: "Link case", exact: true }).click();
    await page.getByRole("combobox", { name: "Test case" }).selectOption({ label: caseTitle });
    await page.getByRole("checkbox", { name: /start/ }).check();
    await page.getByRole("button", { name: "Link selected case" }).click();

    const linked = page.getByRole("list", { name: "Linked cases" });
    await expect(linked).toContainText(caseTitle);
    await linked.getByRole("button", { name: "Unlink" }).click();
    await expect(page.getByRole("list", { name: "Linked cases" })).toHaveCount(0);

    // The case itself still exists; only the mapping was removed.
    expect((await api.get(`/api/projects/${ctx.projectId}/testcases/${caseId}`)).status()).toBe(200);
  } finally {
    if (caseId) await api.delete(`/api/projects/${ctx.projectId}/testcases/${caseId}`, { failOnStatusCode: false });
    // The model id is created through the UI; remove the row by its unique name.
    exec(`DELETE FROM mbt_models WHERE project_id = ${literal(ctx.projectId)} AND name = ${literal(name)};`);
    await api.dispose();
  }
});
