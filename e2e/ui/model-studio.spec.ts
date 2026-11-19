import fs from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, test } from "@playwright/test";
import { env } from "../utils/env";
import { exec, literal, scalar } from "../utils/psql";

const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf-8"));
const STATE_PATH = path.join(__dirname, "../.auth/state.json");

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
      scalar(`SELECT status FROM testcases
        WHERE project_id = ${literal(ctx.projectId)} AND title LIKE 'Model:%' AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT 1;`)
    ).toBe("Draft");

    /*
     * Governed run. A Draft cannot be dispatched, so the case is approved through the product's own
     * approval endpoint first — the same path the Test Cases screen uses — and then the studio is
     * reloaded so its eligibility list reflects the live status.
     */
    const modelDetail = await (await api.get(`/api/projects/${ctx.projectId}/model-studio/models/${modelId}`)).json();
    const revisionId = modelDetail.latestRevision.id as string;
    const caseId = scalar(`SELECT id FROM testcases
      WHERE project_id = ${literal(ctx.projectId)} AND title LIKE 'Model:%' AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1;`);
    const caseRow = await (await api.get(`/api/projects/${ctx.projectId}/testcases/${caseId}`)).json();
    const caseApproved = await api.post(`/api/projects/${ctx.projectId}/testcases/${caseId}/approve`, {
      data: { expectedRevision: caseRow.editRevision }
    });
    expect(caseApproved.status(), await caseApproved.text()).toBe(200);

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
  } finally {
    // The run references the case, so remove it before the case itself.
    if (cycleId) await api.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
    // Remove only the generated drafts; the model delete cascades its revisions and provenance.
    exec(`DELETE FROM testcases WHERE project_id = ${literal(ctx.projectId)} AND title LIKE 'Model:%';`);
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
