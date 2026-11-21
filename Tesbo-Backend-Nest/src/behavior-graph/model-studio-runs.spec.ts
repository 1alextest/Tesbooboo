import { ForbiddenException } from "@nestjs/common";
import { ModelStudioRepository } from "./model-studio-repository";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import { generateModelPaths } from "./model-studio-generator";
import type { PreviewDefinition } from "./model-studio-preview.core";

const user = "00000000-0000-4000-8000-000000000001";
const project = "00000000-0000-4000-8000-000000000002";
const model = "00000000-0000-4000-8000-000000000003";
const revision = "00000000-0000-4000-8000-000000000004";
const testcase = "00000000-0000-4000-8000-000000000005";
const cycle = "00000000-0000-4000-8000-000000000006";
const cycleItem = "00000000-0000-4000-8000-000000000007";
const execution = "00000000-0000-4000-8000-000000000008";
const replacementItem = "00000000-0000-4000-8000-000000000009";
const replacementExecution = "00000000-0000-4000-8000-000000000010";
const hash = "a".repeat(64);
const occurrence = { cycleItemId: cycleItem, executionId: execution, snapshotApprovalRevision: hash };
const definition: PreviewDefinition = {
  schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "start",
  states: [{ id: "start", label: "Start" }, { id: "done", label: "Done" }],
  transitions: [{ id: "finish", from: "start", to: "done", action: "Submit", expectedObservation: "Accepted" }]
};

/** Composition checks only; the matching .db.spec proves PostgreSQL rollback and lock behavior. */
function fixture() {
  const state = { active: true, current: true, approved: true, authorized: true, fail: "", committed: false, inside: false,
    runs: 0, candidates: 0, stagedRuns: 0, stagedCandidates: 0,
    generated: true, editRevision: hash, links: [] as Array<Record<string, unknown>>,
    occurrences: [{ testcase_id: testcase, cycle_item_id: cycleItem, execution_id: execution,
      snapshot_approval_revision: hash }] as Array<Record<string, unknown>> };
  const failure = new Error("Required model provenance write failed");
  const effectStates: Array<{ inside: boolean; committed: boolean }> = [];
  const effect = jest.fn(async () => { effectStates.push({ inside: state.inside, committed: state.committed }); });
  const execute = async (sql: string, values: unknown[] = []) => {
    if (sql.includes("INSERT INTO mbt_model_approvals")) return { rows: [{ id: "approval", content_hash: hash, approved_by: user }] };
    if (sql.includes("UPDATE mbt_model_revisions")) return { rows: [] };
    if (sql.includes("INSERT INTO mbt_model_runs")) {
      if (state.fail === "run") throw failure;
      return { rows: [{ id: "manifest", project_id: project, model_id: model, model_revision_id: revision,
        approval_id: "approval", content_hash: hash, cycle_id: cycle }] };
    }
    if (sql.includes("INSERT INTO mbt_generated_cases")) {
      if (state.fail === "candidate") throw failure;
      return { rows: [] };
    }
    if (sql.includes("FROM cycle_items ci") && sql.includes("JOIN executions e")) return { rows: state.occurrences };
    if (sql.includes("FROM mbt_models")) return { rows: state.active ? [{ id: model, name: "Reviewed model" }] : [] };
    if (sql.includes("FROM mbt_model_revisions")) return { rows: [{
      id: sql.includes("ORDER BY revision_number") && !state.current ? "new-head" : revision,
      content_hash: hash, content: definition, revision_number: 1, model_name: "Reviewed model"
    }] };
    if (sql.includes("FROM mbt_model_approvals")) return { rows: state.approved ? [{ id: "approval", content_hash: hash }] : [] };
    if (sql.includes("FROM mbt_generated_cases g")) return { rows: state.generated ? [{ testcase_id: testcase, path_digest: "path",
      element_ids: ["start", "finish"], title: "Earlier title", status: "Approved", deleted: false }] : [] };
    if (sql.includes("FROM testcases")) return { rows: [{ id: testcase, title: "Current reviewed title", status: "Approved", deleted: false,
      edit_revision: state.editRevision }] };
    if (sql.includes("FROM mbt_model_case_links")) return { rows: state.links };
    if (sql.includes("INSERT INTO mbt_model_case_links")) return { rows: state.links.length ? [] : [{ id: "new-link",
      testcase_id: testcase, testcase_revision: values[4], element_ids: values[5] }] };
    if (sql.includes("FROM mbt_generated_cases") || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}; ${values.length} parameters`);
  };
  const client = { query: jest.fn(async (sql: string, values?: unknown[]) => {
    expect(state.inside).toBe(true);
    return execute(sql,values);
  }) };
  const db = {
    query: jest.fn(execute),
    transaction: jest.fn(async (fn: (runner: typeof client) => Promise<unknown>) => {
      state.inside = true;
      try {
        const result = await fn(client);
        state.runs += state.stagedRuns; state.candidates += state.stagedCandidates;
        state.committed = true;
        return result;
      } finally { state.inside = false; state.stagedRuns = 0; state.stagedCandidates = 0; }
    })
  };
  const legacy = {
    requireProjectAccess: jest.fn(async () => ({ id: project })),
    requireCurrentProjectAuthority: jest.fn(async (runner, p, u) => {
      expect(runner).toBe(client); expect(p).toBe(project); expect(u).toBe(user);
      expect(state.inside).toBe(true);
      if (!state.authorized) throw new ForbiddenException({ error: "Current project and workspace membership are required" });
      return { id: project };
    }),
    lockTestcaseSuiteWrites: jest.fn(async (runner, p) => {
      await runner.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`suite-tree:${p}`]);
    }),
    createCycleWithTestcasesForUser: jest.fn(async (_user, _project, _body, runner) => {
      if (runner === client) state.stagedRuns++; else state.runs++;
      return { cycle: { id: cycle, name: "Native run" }, requested: 1, added: 1, skipped: 0 };
    }),
    createTestCase: jest.fn(async (_project, _user, body, transaction) => {
      if (transaction?.client === client) {
        state.stagedCandidates++; transaction.afterCommit.push(effect);
      } else { state.candidates++; await effect(); }
      return { id: testcase, title: body.title };
    }),
    deleteCycle: jest.fn(async () => { throw new Error("Compensation is unavailable"); })
  };
  const repository = new ModelStudioRepository(db as unknown as DatabaseService, legacy as unknown as LegacyService);
  return { repository, state, failure, effect, effectStates, client, db, legacy };
}

describe("governed model/native writer composition", () => {
  it.each(["approval", "candidate"] as const)("SEC-NATIVE-02 rechecks current authority after a blocked %s owner resumes", async operation => {
    const f = fixture(), original = f.client.query.getMockImplementation()!;
    f.client.query.mockImplementation(async (sql, values) => {
      // Deterministic unit analogue of the DB barrier: preflight succeeded, then membership
      // changed while the real model/candidate lock was awaited. Only a final owner check catches it.
      if (operation === "approval" ? sql.includes("FOR UPDATE OF r") : String(values?.[0]).startsWith("model-candidates:")) {
        f.state.authorized = false;
      }
      return original(sql, values);
    });
    const options = { strategy: "edge_coverage" as const, maxPaths: 20, maxDepth: 12, seed: revision };
    const digest = generateModelPaths({ definition, revisionId: revision, contentHash: hash, options }).paths[0].digest;
    const attempt = operation === "approval"
      ? f.repository.approveRevisionForUser(user, project, model, revision, { expectedHash: hash }, { kind: "human_session" })
      : f.repository.createCasesFromPathsForUser(user, project, model, revision, { ...options, digests: [digest] }, { kind: "human_session" });
    await expect(attempt).rejects.toMatchObject({ status: 403 });
    expect(f.legacy.requireProjectAccess).toHaveBeenCalled();
    expect(f.legacy.requireCurrentProjectAuthority).toHaveBeenCalledTimes(1);
    expect(f.client.query.mock.calls.some(([sql]) => /(?:INSERT INTO|UPDATE) mbt_/.test(sql))).toBe(false);
    expect(f.legacy.createTestCase).not.toHaveBeenCalled();
    expect(f.effect).not.toHaveBeenCalled();
    expect(f.state.committed).toBe(false);
  });

  it("SEC-NATIVE-02 keeps an authorized exact human approval available", async () => {
    const f = fixture();
    await expect(f.repository.approveRevisionForUser(user, project, model, revision,
      { expectedHash: hash }, { kind: "human_session" })).resolves.toMatchObject({ alreadyApproved: false });
    expect(f.legacy.requireCurrentProjectAuthority).toHaveBeenCalledWith(f.client, project, user);
    expect(f.state.committed).toBe(true);
  });

  it("propagates manifest failure through the shared transaction without a compensating delete", async () => {
    const f = fixture(); f.state.fail = "run";
    await expect(f.repository.dispatchRunForUser(user, project, model, revision, { caseIds: [testcase] })).rejects.toBe(f.failure);
    expect(f.state.committed).toBe(false);
    expect(f.state.runs).toBe(0);
    expect(f.legacy.deleteCycle).not.toHaveBeenCalled();
    expect(f.db.query).not.toHaveBeenCalled();
  });

  it("keeps native ownership and records the refreshed reviewed case in a successful manifest", async () => {
    const f = fixture();
    const run = await f.repository.dispatchRunForUser(user, project, model, revision, { caseIds: [testcase] });
    expect(run).toMatchObject({ cycleId: cycle, modelRevisionId: revision, contentHash: hash, added: 1,
      manifest: { cases: [{ testcaseId: testcase, title: "Current reviewed title", nativeOccurrence: occurrence }] } });
    expect(f.legacy.createCycleWithTestcasesForUser).toHaveBeenCalledWith(user, project,
      expect.objectContaining({ testcaseIds: [testcase] }), f.client);
    expect(f.state.committed).toBe(true);
    expect(f.db.query).not.toHaveBeenCalled();
  });

  it.each(["missing", "ambiguous", "missing snapshot"])(
    "refuses %s native occurrence identity inside the dispatch transaction", async kind => {
      const f = fixture();
      if (kind === "missing") f.state.occurrences = [];
      else if (kind === "ambiguous") f.state.occurrences.push({ ...f.state.occurrences[0], execution_id: replacementExecution });
      else f.state.occurrences[0].snapshot_approval_revision = null;
      await expect(f.repository.dispatchRunForUser(user, project, model, revision, { caseIds: [testcase] }))
        .rejects.toMatchObject({ status: 409, response: { code: "NATIVE_OCCURRENCE_UNAVAILABLE" } });
      expect(f.state.committed).toBe(false);
      expect(f.state.runs).toBe(0);
      expect(f.client.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO mbt_model_runs"))).toBe(false);
      expect(f.legacy.deleteCycle).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["active", 404], ["current", 409], ["approved", 409]
  ] as const)("refuses a missing %s basis before native writes", async (condition, status) => {
    const f = fixture(); f.state[condition] = false;
    await expect(f.repository.dispatchRunForUser(user, project, model, revision, {})).rejects.toMatchObject({ status });
    expect(f.legacy.createCycleWithTestcasesForUser).not.toHaveBeenCalled();
    expect(f.state.committed).toBe(false);
  });

  it("refuses a recorded mapping whose case changed even after the current case was approved again", async () => {
    const f = fixture(); f.state.generated = false; f.state.editRevision = "b".repeat(64);
    f.state.links = [{ id: "accepted-link", testcase_id: testcase, testcase_revision: hash,
      element_ids: ["finish"], title: "Earlier title", status: "Approved", deleted: false }];
    await expect(f.repository.dispatchRunForUser(user, project, model, revision, { caseIds: [testcase] }))
      .rejects.toMatchObject({ response: { code: "MAPPING_CHANGED" } });
    expect(f.legacy.createCycleWithTestcasesForUser).not.toHaveBeenCalled();
    expect(f.state.runs).toBe(0);
    expect(f.state.links[0].testcase_revision).toBe(hash);
  });

  it("retains the exact current explicit mapping basis in a native run manifest", async () => {
    const f = fixture(); f.state.generated = false;
    f.state.links = [{ id: "accepted-link", testcase_id: testcase, testcase_revision: hash,
      element_ids: ["finish"], title: "Current reviewed title", status: "Approved", deleted: false }];
    const run = await f.repository.dispatchRunForUser(user, project, model, revision, { caseIds: [testcase] });
    expect(run.manifest.cases).toEqual([expect.objectContaining({ testcaseId: testcase,
      mappings: [{ id: "accepted-link", testcaseRevision: hash, basis: "CURRENT" }] })]);
    expect(f.state.runs).toBe(1);
  });

  it("rejects a stale case revision at link creation without inserting a mapping", async () => {
    const f = fixture(); f.state.editRevision = "b".repeat(64);
    await expect(f.repository.linkCaseForUser(user, project, model, revision,
      { testcaseId: testcase, testcaseRevision: hash, elementIds: ["finish"] }))
      .rejects.toMatchObject({ response: { code: "MAPPING_CHANGED" } });
    expect(f.client.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO mbt_model_case_links"))).toBe(false);
  });

  it("refuses to silently reuse an older mapping when a caller supplies a new case revision", async () => {
    const f = fixture(); f.state.editRevision = "b".repeat(64);
    f.state.links = [{ id: "accepted-link", testcase_id: testcase, testcase_revision: hash, element_ids: ["finish"] }];
    await expect(f.repository.linkCaseForUser(user, project, model, revision,
      { testcaseId: testcase, testcaseRevision: f.state.editRevision, elementIds: ["finish"] }))
      .rejects.toMatchObject({ response: { code: "MAPPING_CHANGED" } });
    expect(f.state.links[0].testcase_revision).toBe(hash);
  });

  it("does not publish candidate effects when its mapping fails, then publishes after a successful commit", async () => {
    const f = fixture(); f.state.fail = "candidate";
    const options = { strategy: "edge_coverage" as const, maxPaths: 20, maxDepth: 12, seed: revision };
    const digest = generateModelPaths({ definition, revisionId: revision, contentHash: hash, options }).paths[0].digest;
    const body = { ...options, digests: [digest] };
    await expect(f.repository.createCasesFromPathsForUser(user, project, model, revision, body, { kind: "human_session" })).rejects.toBe(f.failure);
    expect(f.state.committed).toBe(false);
    expect(f.state.candidates).toBe(0);
    expect(f.effect).not.toHaveBeenCalled();
    f.state.fail = "";
    expect(await f.repository.createCasesFromPathsForUser(user, project, model, revision, body, { kind: "human_session" })).toMatchObject({ created: 1, skipped: 0 });
    expect(f.effect).toHaveBeenCalledTimes(1);
    expect(f.state.candidates).toBe(1);
    expect(f.effectStates).toEqual([{ inside: false, committed: true }]);
    expect(f.db.query).not.toHaveBeenCalled();
  });

  it.each([undefined, { kind: "api_token" as const }])("refuses untrusted model approval and native materialization before any effect: %j", async principal => {
    const f = fixture();
    // Body claims and a real human issuer ID do not supply a trusted session principal.
    const body = { expectedHash: hash, principal: { kind: "human_session" }, approvedBy: user };
    for (const attempt of [
      () => f.repository.approveRevisionForUser(user, project, model, revision, body, principal),
      () => f.repository.createCasesFromPathsForUser(user, project, model, revision, body, principal)
    ]) await expect(attempt()).rejects.toMatchObject({ response: { code: "HUMAN_REVIEW_REQUIRED" } });
    expect(f.legacy.requireProjectAccess).not.toHaveBeenCalled();
    expect(f.db.query).not.toHaveBeenCalled();
    expect(f.db.transaction).not.toHaveBeenCalled();
    expect(f.legacy.createTestCase).not.toHaveBeenCalled();
  });
});

describe("governed model results retain their dispatched native occurrence", () => {
  const nativeResult = (overrides: Record<string, unknown> = {}) => ({
    model_run_id: "dispatch", testcase_id: testcase, cycle_item_id: cycleItem, execution_id: execution,
    snapshot_approval_revision: hash, status: "Passed", ...overrides
  });
  function projectionFixture(cases: Array<Record<string, unknown>>, results: Array<Record<string, unknown>>) {
    const manifest = { contentHash: hash, cases };
    const run = { id: "dispatch", cycle_id: cycle, cycle_name: "Editable native run", cycle_deleted: null,
      created_at: "2026-11-20T00:00:00Z", case_count: results.length, manifest };
    const db = { query: jest.fn(async (sql: string) => {
      // Supply the actual native rows, including replacement occurrences. Correct attribution
      // must distinguish their IDs; filtering this fixture by testcaseId would hide the defect.
      if (sql.includes("JOIN executions e")) {
        if (sql.includes("COUNT(*)")) return { rows: results.map(row => ({ ...row, count: 1 })) };
        return { rows: results };
      }
      if (sql.includes("FROM mbt_model_runs")) return { rows: [run] };
      throw new Error(`Unexpected projection query: ${sql}`);
    }) };
    const repository = new ModelStudioRepository(db as unknown as DatabaseService, {} as LegacyService);
    const projections = repository as unknown as {
      governedRunsFor(revisionId: string, projectId: string): Promise<Array<Record<string, unknown>>>;
      observedByElementFor(revisionId: string, projectId: string): Promise<Array<Record<string, unknown>>>;
    };
    return { projections, manifest };
  }
  const manifestCase = (overrides: Record<string, unknown> = {}) => ({
    testcaseId: testcase, elementIds: ["finish"], nativeOccurrence: occurrence, ...overrides
  });

  it("continues to attribute the original exact occurrence and excludes later native additions", async () => {
    const f = projectionFixture([manifestCase()], [nativeResult(), nativeResult({
      cycle_item_id: replacementItem, execution_id: replacementExecution, status: "Failed"
    })]);
    expect(await f.projections.observedByElementFor(revision, project)).toEqual([
      { elementId: "finish", runs: 1, results: 1, statusCounts: { Passed: 1 } }
    ]);
    expect(await f.projections.governedRunsFor(revision, project)).toEqual([expect.objectContaining({
      caseCount: 1, occurrenceBasis: "PINNED", attributedCaseCount: 1, unavailableCaseCount: 0, unknownCaseCount: 0,
      statusCounts: { Passed: 1 }
    })]);
  });

  it.each([
    ["re-added case", { cycle_item_id: replacementItem, execution_id: replacementExecution }],
    ["different execution", { execution_id: replacementExecution }],
    ["different reviewed snapshot", { snapshot_approval_revision: "b".repeat(64) }],
    ["unrelated case", { testcase_id: replacementItem }]
  ])("never attributes a %s to the original manifest", async (_label, replacement) => {
    const f = projectionFixture([manifestCase()], [nativeResult(replacement as Record<string, unknown>)]);
    expect(await f.projections.observedByElementFor(revision, project)).toEqual([]);
    expect(await f.projections.governedRunsFor(revision, project)).toEqual([expect.objectContaining({
      caseCount: 1, occurrenceBasis: "PINNED", attributedCaseCount: 0, unavailableCaseCount: 1,
      unknownCaseCount: 0, statusCounts: {}
    })]);
  });

  it("keeps the original dispatch count when its occurrence is removed", async () => {
    const f = projectionFixture([manifestCase()], []);
    expect(await f.projections.observedByElementFor(revision, project)).toEqual([]);
    expect(await f.projections.governedRunsFor(revision, project)).toEqual([expect.objectContaining({
      caseCount: 1, occurrenceBasis: "PINNED", attributedCaseCount: 0, unavailableCaseCount: 1,
      unknownCaseCount: 0, statusCounts: {}
    })]);
  });

  it.each([undefined, {}, { cycleItemId: cycleItem, executionId: execution },
    { ...occurrence, executionId: "not-an-occurrence" }])(
    "keeps legacy or incomplete occurrence pins UNKNOWN without testcaseId reconstruction: %j", async nativeOccurrence => {
      const f = projectionFixture([manifestCase({ nativeOccurrence })], [nativeResult()]);
      expect(await f.projections.observedByElementFor(revision, project)).toEqual([]);
      expect(await f.projections.governedRunsFor(revision, project)).toEqual([expect.objectContaining({
        caseCount: 1, occurrenceBasis: "UNKNOWN", attributedCaseCount: 0, unavailableCaseCount: 0,
        unknownCaseCount: 1, statusCounts: {}
      })]);
    }
  );

  it("does not count an ambiguously duplicated occurrence twice", async () => {
    const f = projectionFixture([manifestCase(), manifestCase({ elementIds: ["done"] })], [nativeResult()]);
    expect(await f.projections.observedByElementFor(revision, project)).toEqual([]);
    expect(await f.projections.governedRunsFor(revision, project)).toEqual([expect.objectContaining({
      caseCount: 2, occurrenceBasis: "UNKNOWN", attributedCaseCount: 0, unavailableCaseCount: 0,
      unknownCaseCount: 2, statusCounts: {}
    })]);
  });
});
