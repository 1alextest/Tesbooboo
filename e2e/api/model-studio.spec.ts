import { expect, request as pwRequest, test } from "@playwright/test";
import { loginAs, provisionRbacTenant } from "../utils/rbac-tenant";
import { env } from "../utils/env";
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

  test("approval gates proposal-to-case creation, keeps provenance and reports observed case evidence separately", { tag: '@tesbo.testId("TES-TC-3040")' }, async () => {
    const tenant = await provisionRbacTenant("model-studio");
    test.skip(!tenant, "requires direct SQL control for the disposable tenant");
    const projectId = tenant!.mainProjectId;
    const base = `/api/projects/${projectId}/model-studio/models`;
    const owner = await loginAs(tenant!.owner);
    let modelId = "";
    let runCaseId = "";
    let cycleId = "";
    const generatedCaseIds: string[] = [];
    try {
      const created = await owner.post(base, { data: { name: `E2E governed model ${Date.now()}`, model: MODEL } });
      expect(created.status(), await created.text()).toBe(201);
      const model = await created.json();
      modelId = model.id;
      const revision1 = model.latestRevision;
      const revisionTwoModel = {
        ...MODEL,
        states: [...MODEL.states, { id: "retry", label: "Retry" }],
        transitions: [
          ...MODEL.transitions,
          { id: "retry_edge", from: "done", to: "start", action: "Retry", expectedObservation: "The flow restarts" }
        ]
      };
      const saved = await owner.post(`${base}/${modelId}/revisions`, { data: { baseRevisionId: revision1.id, model: revisionTwoModel } });
      expect(saved.status(), await saved.text()).toBe(201);
      const revision2 = await saved.json();
      expect(revision2.approval).toMatchObject({ status: "NOT_APPROVED" });

      // Generation alone is still read-only; creating cases from it requires approval.
      const unapproved = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/candidates`, {
        data: { digests: ["0".repeat(64)] }
      });
      expect(unapproved.status()).toBe(409);
      expect((await unapproved.json()).code).toBe("MODEL_NOT_APPROVED");

      const wrongHash = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/approve`, {
        data: { expectedHash: "a".repeat(64) }
      });
      expect(wrongHash.status()).toBe(409);
      expect((await wrongHash.json()).code).toBe("MODEL_APPROVAL_CONFLICT");

      const superseded = await owner.post(`${base}/${modelId}/revisions/${revision1.id}/approve`, {
        data: { expectedHash: revision1.contentHash }
      });
      expect(superseded.status()).toBe(409);
      expect((await superseded.json()).code).toBe("SUPERSEDED_REVISION");

      const approved = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/approve`, {
        data: { expectedHash: revision2.contentHash }
      });
      expect(approved.status(), await approved.text()).toBe(201);
      expect(await approved.json()).toMatchObject({
        status: "approved",
        approval: { status: "APPROVED", contentHash: revision2.contentHash },
        alreadyApproved: false
      });
      const repeated = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/approve`, {
        data: { expectedHash: revision2.contentHash }
      });
      expect(repeated.status()).toBe(201);
      expect((await repeated.json()).alreadyApproved).toBe(true);
      const detail = await (await owner.get(`${base}/${modelId}`)).json();
      expect(detail.latestRevision.approval.status).toBe("APPROVED");
      expect(detail.revisions.find((row: { id: string }) => row.id === revision1.id).approval.status).toBe("NOT_APPROVED");

      const generation = { strategy: "edge_coverage", maxPaths: 10, maxDepth: 8 };
      const proposals = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/generate`, { data: generation });
      expect(proposals.status()).toBe(200);
      const paths = (await proposals.json()).paths as Array<{ digest: string }>;
      expect(paths.length).toBeGreaterThan(0);

      const fabricated = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/candidates`, {
        data: { ...generation, digests: ["f".repeat(64)] }
      });
      expect(fabricated.status()).toBe(400);
      expect(JSON.stringify(await fabricated.json())).toContain("Unknown or stale path digest");

      const candidates = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/candidates`, {
        data: { ...generation, digests: [paths[0].digest] }
      });
      expect(candidates.status(), await candidates.text()).toBe(201);
      const batch = await candidates.json();
      expect(batch).toMatchObject({ created: 1, skipped: 0, coverageAssertion: "none", executionAssertion: "none" });
      const generatedCaseId = batch.cases[0].testcaseId as string;
      generatedCaseIds.push(generatedCaseId);
      const generatedCase = await (await owner.get(`/api/projects/${projectId}/testcases/${generatedCaseId}`)).json();
      expect(generatedCase.status).toBe("Draft");
      expect(generatedCase.title).toMatch(/^Model: /);
      expect(generatedCase.description).toContain(paths[0].digest);
      expect(Number(scalar(`SELECT COUNT(*)::int FROM mbt_generated_cases
        WHERE model_revision_id = ${literal(revision2.id)} AND path_digest = ${literal(paths[0].digest)};`))).toBe(1);

      // Repeating the same request is idempotent: no duplicate case, no second provenance row.
      const repeatedBatch = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/candidates`, {
        data: { ...generation, digests: [paths[0].digest] }
      });
      expect(await repeatedBatch.json()).toMatchObject({
        created: 0,
        skipped: 1,
        cases: [expect.objectContaining({ testcaseId: generatedCaseId, created: false })]
      });

      // A separately approved case linked to the revision, executed once, is reported as observed
      // evidence — explicitly not model verification.
      const runCase = await owner.post(`/api/projects/${projectId}/testcases`, {
        data: { title: `E2E evidence case ${Date.now()}`, status: "Approved" }
      });
      expect(runCase.status(), await runCase.text()).toBe(201);
      runCaseId = (await runCase.json()).id;
      const runCaseRevision = (await (await owner.get(`/api/projects/${projectId}/testcases/${runCaseId}`)).json()).editRevision;
      const linked = await owner.post(`${base}/${modelId}/revisions/${revision2.id}/links`, {
        data: { testcaseId: runCaseId, elementIds: ["start"], testcaseRevision: runCaseRevision }
      });
      expect(linked.status(), await linked.text()).toBe(201);
      cycleId = (await (await owner.post(`/api/projects/${projectId}/cycles`, { data: { name: `E2E evidence run ${Date.now()}` } })).json()).id;
      expect((await owner.post(`/api/cycles/${cycleId}/testcases`, { data: { testcaseIds: [runCaseId] } })).status()).toBeLessThan(400);
      const execution = (await (await owner.get(`/api/cycles/${cycleId}/executions`)).json())[0];
      expect((await owner.patch(`/api/cycles/${cycleId}/executions/${execution.id}`, { data: { status: "Failed" } })).ok()).toBe(true);

      const coverage = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(coverage.approval.status).toBe("APPROVED");
      // The studio can show back what the proposals produced, with the digest that generated it.
      expect(coverage.generatedCases).toContainEqual(
        expect.objectContaining({
          testcaseId: generatedCaseId,
          pathDigest: paths[0].digest,
          testcaseStatus: "Draft",
          caseDeleted: false
        })
      );
      const evidence = coverage.caseEvidence.find((row: { testcaseId: string }) => row.testcaseId === runCaseId);
      expect(evidence).toMatchObject({ latestStatus: "Failed", statusCounts: { Failed: 1 } });
      expect(coverage.evidenceNote).toMatch(/not model verification/i);
      expect(coverage.coverageAssertion).toBe("none");
    } finally {
      if (cycleId) await owner.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
      for (const id of [runCaseId, ...generatedCaseIds]) {
        if (id) await owner.delete(`/api/projects/${projectId}/testcases/${id}`, { failOnStatusCode: false });
      }
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

  test("a governed run requires the current approved revision and its own Approved cases", { tag: '@tesbo.testId("TES-TC-3043")' }, async () => {
    const tenant = await provisionRbacTenant("model-studio");
    test.skip(!tenant, "requires direct SQL control for the disposable tenant");
    const projectId = tenant!.mainProjectId;
    const base = `/api/projects/${projectId}/model-studio/models`;
    const owner = await loginAs(tenant!.owner);
    let modelId = "";
    let caseId = "";
    let foreignCaseId = "";
    let cycleId = "";
    let ordinaryRunId = "";
    const dispatchUrl = (revisionId: string) => `${base}/${modelId}/revisions/${revisionId}/runs`;
    try {
      const created = await owner.post(base, { data: { name: `E2E run model ${Date.now()}`, model: MODEL } });
      expect(created.status(), await created.text()).toBe(201);
      const model = await created.json();
      modelId = model.id;
      const revision = model.latestRevision;

      // An unapproved revision is not a runnable basis, whatever cases exist.
      const unapproved = await owner.post(dispatchUrl(revision.id), { data: {} });
      expect(unapproved.status()).toBe(409);
      expect((await unapproved.json()).code).toBe("MODEL_NOT_APPROVED");

      const approved = await owner.post(`${base}/${modelId}/revisions/${revision.id}/approve`, {
        data: { expectedHash: revision.contentHash }
      });
      expect(approved.status(), await approved.text()).toBe(201);
      const generation = { strategy: "edge_coverage", maxPaths: 10, maxDepth: 8 };
      const paths = (await (
        await owner.post(`${base}/${modelId}/revisions/${revision.id}/generate`, { data: generation })
      ).json()).paths as Array<{ digest: string }>;
      const batch = await (
        await owner.post(`${base}/${modelId}/revisions/${revision.id}/candidates`, {
          data: { ...generation, digests: [paths[0].digest] }
        })
      ).json();
      caseId = batch.cases[0].testcaseId;

      // A generated case starts as a Draft; a Draft is refused by name, and no run is left behind.
      const draftDispatch = await owner.post(dispatchUrl(revision.id), { data: { caseIds: [caseId] } });
      expect(draftDispatch.status()).toBe(409);
      expect(await draftDispatch.json()).toMatchObject({ code: "CASE_NOT_APPROVED", caseIds: [caseId] });
      expect(Number(scalar(`SELECT COUNT(*)::int FROM mbt_model_runs WHERE model_id = ${literal(modelId)};`))).toBe(0);
      expect(
        Number(
          scalar(
            `SELECT COUNT(*)::int FROM cycles WHERE project_id = ${literal(projectId)} AND name LIKE 'Model run:%';`
          )
        )
      ).toBe(0);

      // Approve the case, then dispatch it.
      const caseRow = await (await owner.get(`/api/projects/${projectId}/testcases/${caseId}`)).json();
      const caseApproved = await owner.post(`/api/projects/${projectId}/testcases/${caseId}/approve`, {
        data: { expectedRevision: caseRow.editRevision }
      });
      // The approval endpoint answers 200 (it updates and returns the case + receipt).
      expect(caseApproved.status(), await caseApproved.text()).toBe(200);

      const dispatched = await owner.post(dispatchUrl(revision.id), {
        data: { caseIds: [caseId], name: `E2E model run ${Date.now()}` }
      });
      expect(dispatched.status(), await dispatched.text()).toBe(201);
      const run = await dispatched.json();
      cycleId = run.cycleId;
      expect(run).toMatchObject({
        modelRevisionId: revision.id,
        contentHash: revision.contentHash,
        coverageAssertion: "none",
        executionAssertion: "governed-run",
        requested: 1,
        added: 1,
        skipped: 0,
        run: { id: cycleId }
      });
      expect(run.manifest.cases).toEqual([
        expect.objectContaining({ testcaseId: caseId, pathDigest: paths[0].digest, sources: ["generated"] })
      ]);
      expect(run.manifest.cases[0].elementIds).toEqual(expect.arrayContaining(["start", "done", "finish"]));

      // Native run membership and the provenance row are both present.
      expect(
        Number(
          scalar(`SELECT COUNT(*)::int FROM cycle_items ci WHERE ci.cycle_id = ${literal(cycleId)} AND ci.deleted_at IS NULL;`)
        )
      ).toBe(1);
      expect(Number(scalar(`SELECT COUNT(*)::int FROM mbt_model_runs WHERE cycle_id = ${literal(cycleId)};`))).toBe(1);

      // The run page reads the model basis by cycle id; an ordinary run answers null.
      const provenance = await owner.get(`/api/projects/${projectId}/model-studio/runs/by-cycle/${cycleId}`);
      expect(provenance.status(), await provenance.text()).toBe(200);
      expect(await provenance.json()).toMatchObject({
        modelId,
        modelRevisionId: revision.id,
        revisionNumber: 1,
        caseCount: 1
      });
      const ordinaryRun = await (
        await owner.post(`/api/projects/${projectId}/cycles`, { data: { name: `E2E ordinary run ${Date.now()}` } })
      ).json();
      ordinaryRunId = ordinaryRun.id;
      const noProvenance = await owner.get(`/api/projects/${projectId}/model-studio/runs/by-cycle/${ordinaryRunId}`);
      expect(noProvenance.status()).toBe(200);
      expect(await noProvenance.json()).toBeNull();

      // Dispatch is project-scoped: an anonymous caller is refused, and the model is not reachable
      // through another project even by a member of both.
      const anon = await pwRequest.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
      try {
        const denied = await anon.post(dispatchUrl(revision.id), { data: { caseIds: [caseId] }, failOnStatusCode: false });
        expect(denied.status()).toBe(403);
      } finally {
        await anon.dispose();
      }
      const crossProject = await owner.post(
        `/api/projects/${tenant!.secondProjectId}/model-studio/models/${modelId}/revisions/${revision.id}/runs`,
        { data: { caseIds: [caseId] }, failOnStatusCode: false }
      );
      expect(crossProject.status()).toBe(404);

      // Coverage separates the governed run from coverage: results are case outcomes per element.
      let coverage = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      expect(coverage.executionAssertion).toBe("governed-runs");
      expect(coverage.coverageAssertion).toBe("none");
      expect(coverage.governedRuns).toEqual([
        expect.objectContaining({ cycleId, caseCount: 1, runDeleted: false })
      ]);
      for (const element of ["start", "done", "finish"]) {
        expect(coverage.observedByElement).toContainEqual(
          expect.objectContaining({ elementId: element, runs: 1, results: 1, statusCounts: { Untested: 1 } })
        );
      }

      const execution = (await (await owner.get(`/api/cycles/${cycleId}/executions`)).json())[0];
      expect((await owner.patch(`/api/cycles/${cycleId}/executions/${execution.id}`, { data: { status: "Passed" } })).ok()).toBe(
        true
      );
      coverage = await (await owner.get(`${base}/${modelId}/coverage`)).json();
      for (const element of ["start", "done", "finish"]) {
        expect(coverage.observedByElement).toContainEqual(
          expect.objectContaining({ elementId: element, statusCounts: { Passed: 1 } })
        );
      }
      expect(coverage.note).toMatch(/do not prove the modeled behavior/i);

      // A case that belongs to no part of this revision is refused by id, not silently dropped.
      const foreignCase = await (
        await owner.post(`/api/projects/${projectId}/testcases`, {
          data: { title: `E2E unrelated case ${Date.now()}`, status: "Approved" }
        })
      ).json();
      foreignCaseId = foreignCase.id;
      const foreign = await owner.post(dispatchUrl(revision.id), { data: { caseIds: [foreignCaseId] } });
      expect(foreign.status()).toBe(400);
      expect(await foreign.json()).toMatchObject({ code: "CASE_NOT_IN_MODEL" });

      // Saving a revision moves the active basis: the earlier approved revision cannot start a run.
      const saved = await owner.post(`${base}/${modelId}/revisions`, {
        data: {
          baseRevisionId: revision.id,
          model: {
            ...MODEL,
            states: [...MODEL.states, { id: "retry", label: "Retry" }],
            transitions: [
              ...MODEL.transitions,
              { id: "retry_edge", from: "done", to: "start", action: "Retry", expectedObservation: "Restarts" }
            ]
          }
        }
      });
      expect(saved.status(), await saved.text()).toBe(201);
      const superseded = await owner.post(dispatchUrl(revision.id), { data: { caseIds: [caseId] } });
      expect(superseded.status()).toBe(409);
      expect((await superseded.json()).code).toBe("SUPERSEDED_REVISION");
    } finally {
      if (cycleId) await owner.delete(`/api/cycles/${cycleId}`, { failOnStatusCode: false });
      if (ordinaryRunId) await owner.delete(`/api/cycles/${ordinaryRunId}`, { failOnStatusCode: false });
      for (const id of [caseId, foreignCaseId]) {
        if (id) await owner.delete(`/api/projects/${projectId}/testcases/${id}`, { failOnStatusCode: false });
      }
      if (modelId) exec(`DELETE FROM mbt_models WHERE id = ${literal(modelId)} AND project_id = ${literal(projectId)};`);
      await owner.dispose();
    }
  });
});
