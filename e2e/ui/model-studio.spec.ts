import fs from "node:fs";
import path from "node:path";
import { expect, request as pwRequest, test } from "@playwright/test";
import { env } from "../utils/env";
import { exec, literal } from "../utils/psql";

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
