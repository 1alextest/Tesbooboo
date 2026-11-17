import { expect, test } from "@playwright/test";
import { loginAs, provisionRbacTenant } from "../utils/rbac-tenant";
import { exec, literal } from "../utils/psql";

const MODEL = {
  schemaVersion: "tesbo-fsm-draft/1",
  semantics: "SEQUENTIAL_FSM",
  initialStateId: "start",
  states: [
    { id: "start", label: "Start" },
    { id: "done", label: "Done" }
  ],
  transitions: [
    { id: "finish", from: "start", to: "done", action: "Submit", expectedObservation: "The submission is accepted" }
  ]
};

test.describe("persisted Model Studio revisions and mappings", () => {
  test("draft revisions are immutable, stale bases are refused and links are not coverage", async () => {
    const tenant = await provisionRbacTenant("model-studio");
    test.skip(!tenant, "requires direct SQL control for the disposable tenant");
    const projectId = tenant!.mainProjectId;
    const base = `/api/projects/${projectId}/model-studio/models`;
    const owner = await loginAs(tenant!.owner);
    const qa = await loginAs(tenant!.qa);
    let modelId = "";
    let caseId = "";
    try {
      const created = await owner.post(base, { data: { name: `E2E model ${Date.now()}`, model: MODEL } });
      expect(created.status(), await created.text()).toBe(201);
      const model = await created.json();
      modelId = model.id;
      expect(model).toMatchObject({
        name: expect.any(String),
        latestRevision: { revisionNumber: 1, status: "draft", authority: { approval: "NOT_APPROVED", runtimeEvidence: "NONE" } }
      });
      const first = model.latestRevision;

      const read = await (await owner.get(`${base}/${modelId}`)).json();
      expect(read.revisions).toHaveLength(1);
      expect(read.revisions[0].contentHash).toBe(first.contentHash);

      const secondModel = {
        ...MODEL,
        states: [...MODEL.states, { id: "retry", label: "Retry" }],
        transitions: [...MODEL.transitions, { id: "retry_edge", from: "done", to: "start", action: "Retry", expectedObservation: "The flow restarts" }]
      };
      const saved = await owner.post(`${base}/${modelId}/revisions`, { data: { baseRevisionId: first.id, model: secondModel } });
      expect(saved.status(), await saved.text()).toBe(201);
      const second = await saved.json();
      expect(second).toMatchObject({ revisionNumber: 2, parentRevisionId: first.id, status: "draft" });

      const stale = await owner.post(`${base}/${modelId}/revisions`, { data: { baseRevisionId: first.id, model: MODEL } });
      expect(stale.status()).toBe(409);
      expect((await stale.json()).code).toBe("STALE_BASE");
      const after = await (await owner.get(`${base}/${modelId}`)).json();
      expect(after.revisions).toHaveLength(2);
      expect(after.revisions.find((revision: { id: string }) => revision.id === first.id).content.states).toHaveLength(2);

      const invalid = await owner.post(`${base}/${modelId}/revisions`, {
        data: { baseRevisionId: second.id, model: { ...MODEL, initialStateId: "missing" } }
      });
      expect(invalid.status()).toBe(400);

      const createdCase = await owner.post(`/api/projects/${projectId}/testcases`, { data: { title: `E2E model case ${Date.now()}` } });
      expect(createdCase.status(), await createdCase.text()).toBe(201);
      caseId = (await createdCase.json()).id;

      const linkBody = { testcaseId: caseId, elementIds: ["start", "finish"] };
      const linked = await owner.post(`${base}/${modelId}/revisions/${second.id}/links`, { data: linkBody });
      expect(linked.status(), await linked.text()).toBe(201);
      const link = await linked.json();
      expect(link).toMatchObject({ coverageAssertion: "none", executionAssertion: "none" });
      const duplicate = await owner.post(`${base}/${modelId}/revisions/${second.id}/links`, { data: linkBody });
      expect(duplicate.status()).toBe(201);
      expect((await duplicate.json()).id).toBe(link.id);

      const coverage = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(coverage).toMatchObject({ coverageAssertion: "none", executionAssertion: "none" });
      expect(coverage.elements.find((element: { id: string }) => element.id === "start").linkedCases).toBe(1);
      expect(coverage.elements.find((element: { id: string }) => element.id === "done").linkedCases).toBe(0);

      // A member can read the project's models; a non-member/non-project URL cannot.
      expect((await qa.get(`${base}/${modelId}`)).status()).toBe(200);
      expect((await qa.get(`/api/projects/${tenant!.secondProjectId}/model-studio/models`)).status()).toBe(404);
    } finally {
      if (caseId) await owner.delete(`/api/projects/${projectId}/testcases/${caseId}`, { failOnStatusCode: false });
      if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`);
      await Promise.all([owner.dispose(), qa.dispose()]);
    }
  });
});
