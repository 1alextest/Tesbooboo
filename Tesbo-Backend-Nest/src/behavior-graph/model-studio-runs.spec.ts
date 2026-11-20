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
const hash = "a".repeat(64);
const definition: PreviewDefinition = {
  schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "start",
  states: [{ id: "start", label: "Start" }, { id: "done", label: "Done" }],
  transitions: [{ id: "finish", from: "start", to: "done", action: "Submit", expectedObservation: "Accepted" }]
};

/** Composition checks only; the matching .db.spec proves PostgreSQL rollback and lock behavior. */
function fixture() {
  const state = { active: true, current: true, approved: true, fail: "", committed: false, inside: false,
    runs: 0, candidates: 0, stagedRuns: 0, stagedCandidates: 0 };
  const failure = new Error("Required model provenance write failed");
  const effectStates: Array<{ inside: boolean; committed: boolean }> = [];
  const effect = jest.fn(async () => { effectStates.push({ inside: state.inside, committed: state.committed }); });
  const execute = async (sql: string, values: unknown[] = []) => {
    if (sql.includes("INSERT INTO mbt_model_runs")) {
      if (state.fail === "run") throw failure;
      return { rows: [{ id: "manifest", project_id: project, model_id: model, model_revision_id: revision,
        approval_id: "approval", content_hash: hash, cycle_id: cycle }] };
    }
    if (sql.includes("INSERT INTO mbt_generated_cases")) {
      if (state.fail === "candidate") throw failure;
      return { rows: [] };
    }
    if (sql.includes("FROM mbt_models")) return { rows: state.active ? [{ id: model, name: "Reviewed model" }] : [] };
    if (sql.includes("FROM mbt_model_revisions")) return { rows: [{
      id: sql.includes("ORDER BY revision_number") && !state.current ? "new-head" : revision,
      content_hash: hash, content: definition, revision_number: 1, model_name: "Reviewed model"
    }] };
    if (sql.includes("FROM mbt_model_approvals")) return { rows: state.approved ? [{ id: "approval", content_hash: hash }] : [] };
    if (sql.includes("FROM mbt_generated_cases g")) return { rows: [{ testcase_id: testcase, path_digest: "path",
      element_ids: ["start", "finish"], title: "Earlier title", status: "Approved", deleted: false }] };
    if (sql.includes("FROM testcases")) return { rows: [{ id: testcase, title: "Current reviewed title", status: "Approved", deleted: false }] };
    if (sql.includes("FROM mbt_model_case_links") || sql.includes("FROM mbt_generated_cases") || sql.includes("pg_advisory_xact_lock")) return { rows: [] };
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
      manifest: { cases: [{ testcaseId: testcase, title: "Current reviewed title" }] } });
    expect(f.legacy.createCycleWithTestcasesForUser).toHaveBeenCalledWith(user, project,
      expect.objectContaining({ testcaseIds: [testcase] }), f.client);
    expect(f.state.committed).toBe(true);
    expect(f.db.query).not.toHaveBeenCalled();
  });

  it.each([
    ["active", 404], ["current", 409], ["approved", 409]
  ] as const)("refuses a missing %s basis before native writes", async (condition, status) => {
    const f = fixture(); f.state[condition] = false;
    await expect(f.repository.dispatchRunForUser(user, project, model, revision, {})).rejects.toMatchObject({ status });
    expect(f.legacy.createCycleWithTestcasesForUser).not.toHaveBeenCalled();
    expect(f.state.committed).toBe(false);
  });

  it("does not publish candidate effects when its mapping fails, then publishes after a successful commit", async () => {
    const f = fixture(); f.state.fail = "candidate";
    const options = { strategy: "edge_coverage" as const, maxPaths: 20, maxDepth: 12, seed: revision };
    const digest = generateModelPaths({ definition, revisionId: revision, contentHash: hash, options }).paths[0].digest;
    const body = { ...options, digests: [digest] };
    await expect(f.repository.createCasesFromPathsForUser(user, project, model, revision, body)).rejects.toBe(f.failure);
    expect(f.state.committed).toBe(false);
    expect(f.state.candidates).toBe(0);
    expect(f.effect).not.toHaveBeenCalled();
    f.state.fail = "";
    expect(await f.repository.createCasesFromPathsForUser(user, project, model, revision, body)).toMatchObject({ created: 1, skipped: 0 });
    expect(f.effect).toHaveBeenCalledTimes(1);
    expect(f.state.candidates).toBe(1);
    expect(f.effectStates).toEqual([{ inside: false, committed: true }]);
    expect(f.db.query).not.toHaveBeenCalled();
  });
});


it("keeps model approval unavailable to machine principals before accessing persistence", async () => {
  const access = jest.fn();
  const transaction = jest.fn();
  const repository = new ModelStudioRepository(
    { transaction } as unknown as DatabaseService,
    { requireProjectAccess: access } as unknown as LegacyService
  );
  await expect(repository.approveRevisionForUser(
    user, project, model, revision, { expectedHash: hash }, { kind: "api_token" }
  )).rejects.toMatchObject({ status: 403, response: { code: "HUMAN_REVIEW_REQUIRED" } });
  expect(access).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
});
