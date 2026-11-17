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
    await expect(page.getByRole("region", { name: "Case mappings" })).toContainText("0 linked");
  } finally {
    if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(ctx.projectId)};`);
    await api.dispose();
  }
});
