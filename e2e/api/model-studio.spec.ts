import { expect, test } from "@playwright/test";
import { loginAs, provisionRbacTenant } from "../utils/rbac-tenant";
import { exec, literal, scalar } from "../utils/psql";

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

  test("bounded generation is deterministic, respects bounds and writes no case or run", async () => {
    const tenant = await provisionRbacTenant("model-studio");
    test.skip(!tenant, "requires direct SQL control for the disposable tenant");
    const projectId = tenant!.mainProjectId;
    const base = `/api/projects/${projectId}/model-studio/models`;
    const owner = await loginAs(tenant!.owner);
    let modelId = "";
    try {
      const created = await owner.post(base, { data: { name: `E2E generated model ${Date.now()}`, model: MODEL } });
      expect(created.status(), await created.text()).toBe(201);
      const model = await created.json();
      modelId = model.id;
      const revisionId = model.latestRevision.id;
      const counts = () => ({
        cases: Number(scalar(`SELECT COUNT(*)::int FROM testcases WHERE project_id = ${literal(projectId)};`)),
        runs: Number(scalar(`SELECT COUNT(*)::int FROM cycles WHERE project_id = ${literal(projectId)};`)),
        executions: Number(scalar(`SELECT COUNT(*)::int FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id JOIN cycles c ON c.id=ci.cycle_id WHERE c.project_id = ${literal(projectId)};`))
      });
      const before = counts();
      const body = { strategy: "edge_coverage", maxPaths: 10, maxDepth: 8, seed: "e2e-seed" };
      const first = await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, { data: body });
      expect(first.status(), await first.text()).toBe(200);
      const one = await first.json();
      const two = await (await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, { data: body })).json();
      expect(two).toEqual(one);
      expect(one).toMatchObject({
        status: "PROPOSAL_ONLY",
        coverageAssertion: "none",
        executionAssertion: "none",
        modelId,
        revisionId,
        generator: { id: "tesbo-fsm-bfs", version: "1" }
      });
      expect(one.paths.length).toBeGreaterThan(0);
      expect(one.paths.every((path: { transitionIds: string[] }) => path.transitionIds.length <= 8)).toBe(true);
      expect(counts()).toEqual(before);

      const otherSeed = await (await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, { data: { ...body, seed: "other-seed" } })).json();
      expect(otherSeed.paths.map((path: { transitionIds: string[] }) => path.transitionIds)).toEqual(
        one.paths.map((path: { transitionIds: string[] }) => path.transitionIds)
      );
      expect(otherSeed.paths.map((path: { digest: string }) => path.digest)).not.toEqual(
        one.paths.map((path: { digest: string }) => path.digest)
      );

      expect((await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, { data: { maxPaths: 0 } })).status()).toBe(400);
      expect((await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, { data: { strategy: "nope" } })).status()).toBe(400);
      expect(
        (await owner.post(`/api/projects/${tenant!.secondProjectId}/model-studio/models/${modelId}/revisions/${revisionId}/generate`, { data: body })).status()
      ).toBe(404);
    } finally {
      if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`);
      await owner.dispose();
    }
  });
});
