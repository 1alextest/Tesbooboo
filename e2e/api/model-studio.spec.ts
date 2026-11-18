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
      expect(read.revisions[0].preview).toMatchObject({
        modelId,
        modelRevisionId: first.id,
        definition: { initialStateId: "start" }
      });
      expect(read.revisions[0].preview.states).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "start", reachable: true }),
          expect.objectContaining({ id: "done", reachable: true })
        ])
      );

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
      const caseRevision = (await (await owner.get(`/api/projects/${projectId}/testcases/${caseId}`)).json()).editRevision;
      expect(caseRevision).toMatch(/^[a-f0-9]{64}$/);

      const linkBody = { testcaseId: caseId, elementIds: ["start", "finish"], testcaseRevision: caseRevision };
      const linked = await owner.post(`${base}/${modelId}/revisions/${second.id}/links`, { data: linkBody });
      expect(linked.status(), await linked.text()).toBe(201);
      const link = await linked.json();
      expect(link).toMatchObject({ coverageAssertion: "none", executionAssertion: "none", testcaseRevision: caseRevision });
      const duplicate = await owner.post(`${base}/${modelId}/revisions/${second.id}/links`, { data: linkBody });
      expect(duplicate.status()).toBe(201);
      expect((await duplicate.json()).id).toBe(link.id);
      // A second link for the same case on the same revision, with no recorded case revision.
      const noRevision = await owner.post(`${base}/${modelId}/revisions/${second.id}/links`, {
        data: { testcaseId: caseId, elementIds: ["retry"] }
      });
      expect(noRevision.status(), await noRevision.text()).toBe(201);

      const coverage = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(coverage).toMatchObject({ coverageAssertion: "none", executionAssertion: "none" });
      expect(coverage.elements.find((element: { id: string }) => element.id === "start").linkedCases).toBe(1);
      expect(coverage.elements.find((element: { id: string }) => element.id === "done").linkedCases).toBe(0);
      // The mappings themselves are listed for the studio, not just counted.
      expect(coverage.links).toHaveLength(2);
      expect(coverage.links.find((row: { id: string }) => row.id === link.id)).toMatchObject({
        testcaseId: caseId,
        elementIds: ["start", "finish"],
        caseChangedSinceLink: false,
        caseDeleted: false
      });
      expect(coverage.links.find((row: { id: string }) => row.id === link.id).testcaseTitle).toBeTruthy();
      expect(coverage.mappingStaleness).toMatchObject({
        supersededRevisions: [],
        testcasesChangedSinceLink: 0,
        testcasesWithoutRecordedRevision: 1,
        deletedTestcases: 0
      });

      // Editing the case changes its basis without deleting the mapping. The recorded revision is
      // compared to the current one; staleness is reported, never applied to the case or link.
      const edited = await owner.put(`/api/projects/${projectId}/testcases/${caseId}`, { data: { title: `E2E model case edited ${Date.now()}` } });
      expect(edited.ok(), await edited.text()).toBeTruthy();
      const changed = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(changed.mappingStaleness).toMatchObject({
        supersededRevisions: [],
        testcasesChangedSinceLink: 1,
        testcasesWithoutRecordedRevision: 1
      });
      expect(
        changed.links.find((row: { id: string }) => row.id === link.id).caseChangedSinceLink,
        "the mapping records the case revision it was accepted against"
      ).toBe(true);

      // A later model revision does not rewrite earlier mappings: they remain stored and are
      // reported as superseded instead of silently becoming "no mapping" on the latest revision.
      const thirdModel = {
        ...secondModel,
        states: [...secondModel.states, { id: "cancelled", label: "Cancelled" }],
        transitions: [...secondModel.transitions, { id: "cancel_edge", from: "start", to: "cancelled", action: "Cancel", expectedObservation: "The flow stops" }]
      };
      const savedThird = await owner.post(`${base}/${modelId}/revisions`, { data: { baseRevisionId: second.id, model: thirdModel } });
      expect(savedThird.status(), await savedThird.text()).toBe(201);
      const third = await savedThird.json();
      const supersededCoverage = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(supersededCoverage.revisionId).toBe(third.id);
      expect(supersededCoverage.elements.every((element: { linkedCases: number }) => element.linkedCases === 0)).toBe(true);
      expect(supersededCoverage.mappingStaleness.supersededRevisions).toEqual([
        expect.objectContaining({ modelRevisionId: second.id, revisionNumber: 2, linkedCases: 1, sameContentAsLatest: false })
      ]);
      expect(Number(scalar(`SELECT COUNT(*)::int FROM mbt_model_case_links
        WHERE model_revision_id = ${literal(second.id)} AND project_id = ${literal(projectId)};`))).toBe(2);

      // A soft-deleted case keeps its link row but stops contributing to current coverage; it is
      // reported as a deleted mapping instead of quietly inflating an element count.
      const deletedCase = await owner.post(`/api/projects/${projectId}/testcases`, { data: { title: `E2E deleted mapped case ${Date.now()}` } });
      expect(deletedCase.status(), await deletedCase.text()).toBe(201);
      const deletedCaseId = (await deletedCase.json()).id;
      const deletedRevision = (await (await owner.get(`/api/projects/${projectId}/testcases/${deletedCaseId}`)).json()).editRevision;
      const deletedLink = await owner.post(`${base}/${modelId}/revisions/${third.id}/links`, {
        data: { testcaseId: deletedCaseId, elementIds: ["cancel_edge"], testcaseRevision: deletedRevision }
      });
      expect(deletedLink.status(), await deletedLink.text()).toBe(201);
      expect((await owner.delete(`/api/projects/${projectId}/testcases/${deletedCaseId}`)).ok()).toBe(true);
      const afterDelete = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(afterDelete.elements.find((element: { id: string }) => element.id === "cancel_edge").linkedCases).toBe(0);
      // The link row survives (history), so the list still exposes it for review and unlinking.
      expect(
        afterDelete.links.find((row: { testcaseId: string }) => row.testcaseId === deletedCaseId)
      ).toMatchObject({ caseDeleted: true });
      expect(afterDelete.mappingStaleness).toMatchObject({
        testcasesChangedSinceLink: 0,
        testcasesWithoutRecordedRevision: 0,
        deletedTestcases: 1
      });
      expect(Number(scalar(`SELECT COUNT(*)::int FROM mbt_model_case_links l
        WHERE l.testcase_id = ${literal(deletedCaseId)} AND l.model_revision_id = ${literal(third.id)};`))).toBe(1);

      // A member can read the project's models; a non-member/non-project URL cannot.
      expect((await qa.get(`${base}/${modelId}`)).status()).toBe(200);
      expect((await qa.get(`/api/projects/${tenant!.secondProjectId}/model-studio/models`)).status()).toBe(404);
    } finally {
      if (caseId) await owner.delete(`/api/projects/${projectId}/testcases/${caseId}`, { failOnStatusCode: false });
      if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`);
      await Promise.all([owner.dispose(), qa.dispose()]);
    }
  });

  test("archiving retires a model from every surface and keeps its mapping history", async () => {
    const tenant = await provisionRbacTenant("model-studio");
    test.skip(!tenant, "requires direct SQL control for the disposable tenant");
    const projectId = tenant!.mainProjectId;
    const base = `/api/projects/${projectId}/model-studio/models`;
    const owner = await loginAs(tenant!.owner);
    let modelId = "";
    let caseId = "";
    try {
      const created = await owner.post(base, { data: { name: `E2E archived model ${Date.now()}`, model: MODEL } });
      expect(created.status(), await created.text()).toBe(201);
      const model = await created.json();
      modelId = model.id;
      const revisionId = model.latestRevision.id;

      const createdCase = await owner.post(`/api/projects/${projectId}/testcases`, {
        data: { title: `E2E archived model case ${Date.now()}` }
      });
      expect(createdCase.status(), await createdCase.text()).toBe(201);
      caseId = (await createdCase.json()).id;
      const caseRevision = (await (await owner.get(`/api/projects/${projectId}/testcases/${caseId}`)).json()).editRevision;
      const linked = await owner.post(`${base}/${modelId}/revisions/${revisionId}/links`, {
        data: { testcaseId: caseId, elementIds: ["finish"], testcaseRevision: caseRevision }
      });
      expect(linked.status(), await linked.text()).toBe(201);

      // Archiving is a retirement of the whole model, not a delete of its history.
      const archived = await owner.delete(`${base}/${modelId}`);
      expect(archived.status(), await archived.text()).toBe(200);
      expect(await archived.json()).toMatchObject({ ok: true, id: modelId });

      const listed = await (await owner.get(base)).json();
      expect(listed.map((row: { id: string }) => row.id)).not.toContain(modelId);
      expect((await owner.get(`${base}/${modelId}`)).status()).toBe(404);
      expect((await owner.get(`${base}/${modelId}/coverage`)).status()).toBe(404);
      expect((await owner.post(`${base}/${modelId}/revisions`, { data: { model: MODEL } })).status()).toBe(404);
      expect((await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, { data: {} })).status()).toBe(404);
      // A second archive must not report success for a model that was already retired.
      expect((await owner.delete(`${base}/${modelId}`)).status()).toBe(404);
      // A model id from another project cannot be archived through this project's URL.
      expect((await owner.delete(`/api/projects/${tenant!.secondProjectId}/model-studio/models/${modelId}`)).status()).toBe(404);
      // The link and revision rows survive archive: this is history, not a cascade delete.
      expect(Number(scalar(`SELECT COUNT(*)::int FROM mbt_model_case_links
        WHERE model_id = ${literal(modelId)} AND project_id = ${literal(projectId)};`))).toBe(1);
      expect(scalar(`SELECT (archived_at IS NOT NULL)::text FROM mbt_models
        WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`)).toBe("true");
    } finally {
      if (caseId) await owner.delete(`/api/projects/${projectId}/testcases/${caseId}`, { failOnStatusCode: false });
      if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`);
      await owner.dispose();
    }
  });

  test("unlinking a case removes the mapping and leaves the case alone", { tag: '@tesbo.testId("TES-TC-3035")' }, async () => {
    const tenant = await provisionRbacTenant("model-studio");
    test.skip(!tenant, "requires direct SQL control for the disposable tenant");
    const projectId = tenant!.mainProjectId;
    const base = `/api/projects/${projectId}/model-studio/models`;
    const owner = await loginAs(tenant!.owner);
    let modelId = "";
    let caseId = "";
    try {
      const created = await owner.post(base, { data: { name: `E2E unlink model ${Date.now()}`, model: MODEL } });
      expect(created.status(), await created.text()).toBe(201);
      const model = await created.json();
      modelId = model.id;
      const revisionId = model.latestRevision.id;

      const createdCase = await owner.post(`/api/projects/${projectId}/testcases`, {
        data: { title: `E2E unlink case ${Date.now()}` }
      });
      expect(createdCase.status(), await createdCase.text()).toBe(201);
      caseId = (await createdCase.json()).id;
      const caseRevision = (await (await owner.get(`/api/projects/${projectId}/testcases/${caseId}`)).json()).editRevision;
      const linked = await owner.post(`${base}/${modelId}/revisions/${revisionId}/links`, {
        data: { testcaseId: caseId, elementIds: ["start"], testcaseRevision: caseRevision }
      });
      expect(linked.status(), await linked.text()).toBe(201);
      const link = await linked.json();

      const before = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(before.links.map((row: { id: string }) => row.id)).toEqual([link.id]);
      expect(before.elements.find((element: { id: string }) => element.id === "start").linkedCases).toBe(1);

      const removed = await owner.delete(`${base}/${modelId}/revisions/${revisionId}/links/${link.id}`);
      expect(removed.status(), await removed.text()).toBe(200);
      const after = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(after.links).toEqual([]);
      expect(after.elements.find((element: { id: string }) => element.id === "start").linkedCases).toBe(0);

      // Unlinking is a mapping edit, not a case edit or delete.
      expect((await owner.get(`/api/projects/${projectId}/testcases/${caseId}`)).status()).toBe(200);
      // The same mapping id cannot be removed twice.
      expect((await owner.delete(`${base}/${modelId}/revisions/${revisionId}/links/${link.id}`)).status()).toBe(404);
    } finally {
      if (caseId) await owner.delete(`/api/projects/${projectId}/testcases/${caseId}`, { failOnStatusCode: false });
      if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`);
      await owner.dispose();
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

      // Strategy and bounds are generation inputs too: the same transition sequence under a
      // different strategy or limit must not reuse the digest.
      const bounded = await (await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, {
        data: { ...body, maxPaths: 5 }
      })).json();
      expect(bounded.paths[0].transitionIds).toEqual(one.paths[0].transitionIds);
      expect(bounded.paths[0].digest).not.toBe(one.paths[0].digest);

      const shortest = await (await owner.post(`${base}/${modelId}/revisions/${revisionId}/generate`, {
        data: { ...body, strategy: "shortest_paths" }
      })).json();
      const sameSequence = shortest.paths.find(
        (path: { transitionIds: string[] }) => path.transitionIds.join(">") === one.paths[0].transitionIds.join(">")
      );
      expect(sameSequence?.digest, "strategy must be part of the replay digest").not.toBe(one.paths[0].digest);

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
