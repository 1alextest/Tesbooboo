import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { ModelStudioRepository } from "./model-studio-repository";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { CustomTagsService } from "../custom-tags/custom-tags.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import { RequestCacheService } from "../request-cache/request-cache.service";
import type { AppConfigService } from "../config/app-config.service";

const url = process.env.DATABASE_URL ?? "";
const MODEL = {
  schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "start",
  states: [{ id: "start", label: "Start" }, { id: "done", label: "Done" }],
  transitions: [{ id: "finish", from: "start", to: "done", action: "Submit", expectedObservation: "Accepted" }]
};
const NEXT = { ...MODEL, transitions: [{ ...MODEL.transitions[0], expectedObservation: "Accepted with receipt" }] };
type Body = Record<string, any>;
function latch() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("governed model atomicity — migrated PostgreSQL", () => {
  let admin: Client, pool: Pool, project: string, user: string;
  const stamp = randomUUID(), applicationName = `model-runs-${stamp}`;
  beforeAll(async () => {
    admin = new Client({ connectionString: url }); await admin.connect();
    pool = new Pool({ connectionString: url, max: 8, application_name: applicationName });
    user = (await admin.query("INSERT INTO users(email,name) VALUES ($1,'Model run QA') RETURNING id", [`model-${stamp}@tesbo.invalid`])).rows[0].id;
    const org = (await admin.query("INSERT INTO organizations(name,slug) VALUES ('Model run QA',$1) RETURNING id", [`model-${stamp}`])).rows[0].id;
    project = (await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'MRA','Model run atomicity') RETURNING id", [org])).rows[0].id;
    await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')", [org,user]);
    await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner')", [project,user]);
    await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [user,org]);
  });
  afterAll(async () => { await pool?.end(); await admin?.end(); }); // Disposable isolated CI tenant.

  function services(db = new DatabaseService(pool)) {
    const legacy = makeLegacy(db), internals = legacy as unknown as Body;
    const plans = { assertCustomFieldsEnabled: jest.fn().mockResolvedValue(undefined) } as unknown as PlanLimitsService;
    internals.customFields = new CustomFieldsService(db, plans,
      new ProjectLookupService(db, new RequestCacheService({} as AppConfigService)), legacy);
    internals.customTags = new CustomTagsService(db, legacy, internals.testcasesListCache);
    const embedding = jest.spyOn(internals, "enqueueTestcaseEmbedding").mockReturnValue(undefined);
    const suitesCache = jest.spyOn(internals.suitesCache, "invalidate").mockResolvedValue(undefined);
    const listCache = jest.spyOn(internals.testcasesListCache, "invalidate").mockResolvedValue(undefined);
    jest.spyOn(internals, "notifyExecutionChange").mockResolvedValue(undefined);
    return { db, legacy, repository: new ModelStudioRepository(db, legacy), embedding, suitesCache, listCache };
  }
  async function newModel() {
    const s = services(), model = await s.repository.createModelForUser(user,project,{ name: `Atomic model ${randomUUID()}`, model: MODEL });
    const revision = model.latestRevision!;
    await s.repository.approveRevisionForUser(user,project,model.id,revision.id,{ expectedHash: revision.contentHash },{ kind: "human_session" });
    return { modelId: model.id as string, revisionId: revision.id as string, hash: revision.contentHash as string };
  }
  async function ready() {
    const basis = await newModel(), s = services();
    const testcase = await s.legacy.createTestCase(project,user,{ title: `Reviewed native case ${randomUUID()}`, status: "Draft" });
    const reviewed = await s.legacy.getTestCaseForUser(user,project,testcase.id);
    await s.legacy.approveTestCaseForUser(user,project,testcase.id,{
      expectedRevision: reviewed.editRevision, expectedApprovalRevision: reviewed.approvalRevision
    }, { kind: "human_session" });
    const link = await s.repository.linkCaseForUser(user,project,basis.modelId,basis.revisionId,{
      testcaseId: testcase.id, elementIds: ["start", "finish", "done"]
    });
    return { ...basis, testcaseId: String(testcase.id), linkId: String(link.id) };
  }
  const dispatch = (s: ReturnType<typeof services>, basis: Awaited<ReturnType<typeof ready>>) =>
    s.repository.dispatchRunForUser(user,project,basis.modelId,basis.revisionId,{ caseIds: [basis.testcaseId] });
  async function runRows() {
    const [cycles, items, executions, manifests] = await Promise.all([
      admin.query("SELECT * FROM cycles WHERE project_id=$1 ORDER BY id",[project]),
      admin.query("SELECT ci.* FROM cycle_items ci JOIN cycles c ON c.id=ci.cycle_id WHERE c.project_id=$1 ORDER BY ci.id",[project]),
      admin.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id JOIN cycles c ON c.id=ci.cycle_id WHERE c.project_id=$1 ORDER BY e.id",[project]),
      admin.query("SELECT * FROM mbt_model_runs WHERE project_id=$1 ORDER BY id",[project])
    ]);
    return { cycles: cycles.rows, items: items.rows, executions: executions.rows, manifests: manifests.rows };
  }
  async function candidateRows() {
    const [cases, mappings, audits] = await Promise.all([
      admin.query("SELECT * FROM testcases WHERE project_id=$1 ORDER BY id",[project]),
      admin.query("SELECT * FROM mbt_generated_cases WHERE project_id=$1 ORDER BY id",[project]),
      admin.query("SELECT * FROM audit_logs WHERE project_id=$1 ORDER BY id",[project])
    ]);
    return { cases: cases.rows, mappings: mappings.rows, audits: audits.rows };
  }
  function failProvenance(db: DatabaseService, table: "mbt_model_runs" | "mbt_generated_cases") {
    const transaction = db.transaction.bind(db);
    return jest.spyOn(db,"transaction").mockImplementation(fn => transaction(async client => {
      // A real SQL error after the native writes: DatabaseService must roll back that same
      // PostgreSQL transaction. The proxy scopes fault injection to this caller, never a tenant-wide trigger.
      const runner = new Proxy(client, { get(target, key) {
        if (key === "query") return (sql: string, values?: unknown[]) =>
          sql.includes(`INSERT INTO ${table}`) ? target.query("SELECT 1 / 0") : target.query(sql,values);
        const value = Reflect.get(target,key);
        return typeof value === "function" ? value.bind(target) : value;
      } });
      return fn(runner);
    }));
  }
  async function waitForLock(fragment: string) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const blocked = await admin.query(
        "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2",
        [applicationName,`%${fragment}%`]
      );
      if (blocked.rowCount) return;
      await new Promise(resolve => setTimeout(resolve,20));
    }
    throw new Error(`Expected the competing owner to wait on ${fragment}`);
  }

  const authorityWaits = ["approval", "candidate-digest", "candidate-suite"] as const;
  it.each(authorityWaits.flatMap(operation => ["membership", "archive"].map(change => [operation, change] as const)))(
    "SEC-NATIVE-02 refuses %s after %s changes during a real PostgreSQL wait", async (operation, change) => {
      const s = services();
      const model = await s.repository.createModelForUser(user,project,{ name: `Authority barrier ${randomUUID()}`, model: MODEL });
      const revision = model.latestRevision!, generation = { strategy: "edge_coverage", maxPaths: 10, maxDepth: 8 };
      if (operation !== "approval") await s.repository.approveRevisionForUser(user,project,model.id,revision.id,
        { expectedHash: revision.contentHash },{ kind: "human_session" });
      const proposed = await s.repository.generateForUser(user,project,model.id,revision.id,generation);
      const body = { ...generation, digests: [proposed.paths[0].digest] };
      const nativeState = async () => ({
        ...await candidateRows(),
        approvals: (await admin.query("SELECT * FROM mbt_model_approvals WHERE model_id=$1 ORDER BY id",[model.id])).rows,
        revisions: (await admin.query("SELECT * FROM mbt_model_revisions WHERE model_id=$1 ORDER BY id",[model.id])).rows
      });
      const before = await nativeState(), blocker = new Client({ connectionString: url });
      await blocker.connect();
      let attempt: Promise<unknown> | undefined;
      try {
        await blocker.query("BEGIN");
        if (operation === "approval") await blocker.query("SELECT id FROM mbt_model_revisions WHERE id=$1 FOR UPDATE",[revision.id]);
        else await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",[
          operation === "candidate-digest" ? `model-candidates:${project}:${revision.id}` : `suite-tree:${project}`
        ]);
        attempt = (operation === "approval"
          ? s.repository.approveRevisionForUser(user,project,model.id,revision.id,{ expectedHash: revision.contentHash },{ kind: "human_session" })
          : s.repository.createCasesFromPathsForUser(user,project,model.id,revision.id,body,{ kind: "human_session" })
        ).then(() => null,error => error);
        // Admission has succeeded and the actual domain statement is blocked; no timing sleep
        // or mocked access check stands in for the permission change racing the native owner.
        await waitForLock(operation === "approval" ? "FOR UPDATE OF r" : "pg_advisory_xact_lock");
        if (change === "membership") await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,user]);
        else await admin.query("UPDATE projects SET archived_at=now() WHERE id=$1",[project]);
        await blocker.query("COMMIT");
        expect(await attempt).toMatchObject({ status: 403, response: { error: "Current project and workspace membership are required" } });
        expect(await nativeState()).toEqual(before);
        expect(s.embedding).not.toHaveBeenCalled();
      } finally {
        await blocker.query("ROLLBACK"); await attempt; await blocker.end();
        if (change === "membership") await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING",[project,user]);
        else await admin.query("UPDATE projects SET archived_at=NULL WHERE id=$1",[project]);
      }
    },15000
  );

  it.each(["approval", "candidate"] as const)("SEC-NATIVE-02 holds current authority until an authorized %s commits", async operation => {
    const s = services(), model = await s.repository.createModelForUser(user,project,{ name: `Authority held ${randomUUID()}`, model: MODEL });
    const settings = (await admin.query("SELECT settings FROM projects WHERE id=$1",[project])).rows[0].settings;
    // Model publication has its own current native authority; Zyra's proposal-storage feature
    // flag must not silently become an additional Model Studio permission.
    if (operation === "candidate") await admin.query("UPDATE projects SET settings=settings || $2::jsonb WHERE id=$1",[
      project, JSON.stringify({ zyraAgent: { capabilities: { testcaseStorage: false } } })
    ]);
    const revision = model.latestRevision!, generation = { strategy: "edge_coverage", maxPaths: 10, maxDepth: 8 };
    if (operation === "candidate") await s.repository.approveRevisionForUser(user,project,model.id,revision.id,
      { expectedHash: revision.contentHash },{ kind: "human_session" });
    const proposed = await s.repository.generateForUser(user,project,model.id,revision.id,generation);
    const entered = latch(), release = latch(), transaction = s.db.transaction.bind(s.db);
    jest.spyOn(s.db,"transaction").mockImplementation(fn => transaction(async client => {
      const result = await fn(client); entered.release(); await release.promise; return result;
    }));
    const attempt = operation === "approval"
      ? s.repository.approveRevisionForUser(user,project,model.id,revision.id,{ expectedHash: revision.contentHash },{ kind: "human_session" })
      : s.repository.createCasesFromPathsForUser(user,project,model.id,revision.id,
        { ...generation, digests: [proposed.paths[0].digest] },{ kind: "human_session" });
    let revoke: Promise<unknown> | undefined;
    try {
      await Promise.race([entered.promise,attempt.then(() => { throw new Error("Publication escaped its commit barrier"); })]);
      revoke = pool.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,user]);
      await waitForLock("DELETE FROM project_members");
      release.release();
      const result = await attempt; await revoke;
      expect(result).toMatchObject(operation === "approval" ? { alreadyApproved: false } : { created: 1, skipped: 0 });
      expect((await admin.query("SELECT count(*)::int AS n FROM mbt_model_approvals WHERE model_revision_id=$1",[revision.id])).rows[0].n).toBe(1);
    } finally {
      release.release(); await Promise.allSettled([attempt,revoke]);
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING",[project,user]);
      if (operation === "candidate") await admin.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1",[project,JSON.stringify(settings)]);
    }
  },15000);

  it("rolls back run, items and executions on manifest failure, then permits governed and ordinary native runs", async () => {
    const basis = await ready(), s = services(), before = await runRows();
    const compensation = jest.spyOn(s.legacy,"deleteCycle").mockRejectedValue(new Error("Deletion unavailable"));
    const fault = failProvenance(s.db,"mbt_model_runs");
    await expect(dispatch(s,basis)).rejects.toMatchObject({ code: "22012" });
    expect(await runRows()).toEqual(before);
    expect(compensation).not.toHaveBeenCalled();
    fault.mockRestore();
    const governed = await dispatch(s,basis);
    expect(governed).toMatchObject({ added: 1, skipped: 0, contentHash: basis.hash,
      manifest: { cases: [{ testcaseId: basis.testcaseId, sources: ["linked"] }] } });
    const ordinary = await s.legacy.createCycleWithTestcasesForUser(user,project,{ name: "Ordinary native neighbor", testcaseIds: [basis.testcaseId] });
    const after = await runRows();
    expect(after.cycles).toHaveLength(before.cycles.length+2);
    expect(after.items).toHaveLength(before.items.length+2);
    expect(after.executions).toHaveLength(before.executions.length+2);
    expect(after.manifests).toHaveLength(before.manifests.length+1);
    expect(after.manifests.some(row => row.cycle_id === ordinary.cycle.id)).toBe(false);
    const item = after.items.find(row => row.cycle_id === governed.cycleId)!;
    expect(item.snapshot_approval_revision).toMatch(/^[a-f0-9]{64}$/);
    expect(item.snapshot_reviewed_content.case.title).toBe(governed.manifest.cases[0].title);
  });

  it("keeps model evidence on the original occurrence after native remove, edit, reapproval and re-add", async () => {
    const basis = await ready(), s = services();
    const originalCase = await s.legacy.getTestCaseForUser(user,project,basis.testcaseId);
    await s.repository.unlinkCaseForUser(user,project,basis.modelId,basis.revisionId,basis.linkId);
    await s.repository.linkCaseForUser(user,project,basis.modelId,basis.revisionId,{
      testcaseId: basis.testcaseId, testcaseRevision: originalCase.editRevision, elementIds: ["finish"]
    });
    const run = await dispatch(s,basis), pin = run.manifest.cases[0].nativeOccurrence!;
    expect(pin).toEqual({ cycleItemId: expect.any(String), executionId: expect.any(String),
      snapshotApprovalRevision: originalCase.approvalRevision });
    const originalManifest = (await admin.query("SELECT * FROM mbt_model_runs WHERE id=$1",[run.id])).rows[0];
    const snapshot = () => admin.query(
      "SELECT id, cycle_id, testcase_id, snapshot_title, snapshot_approval_revision, snapshot_reviewed_content FROM cycle_items WHERE id=$1",
      [pin.cycleItemId]
    );
    const originalSnapshot = (await snapshot()).rows[0];
    expect(originalSnapshot).toMatchObject({ cycle_id: run.cycleId, testcase_id: basis.testcaseId,
      snapshot_approval_revision: pin.snapshotApprovalRevision, snapshot_reviewed_content: originalCase.approvalSnapshot });
    expect((await admin.query("SELECT cycle_item_id FROM executions WHERE id=$1",[pin.executionId])).rows[0])
      .toEqual({ cycle_item_id: pin.cycleItemId });

    await s.legacy.updateExecution(pin.executionId,user,{ status: "Passed" },{ expectedCycleId: run.cycleId });
    const positive = await s.repository.coverageForUser(user,project,basis.modelId);
    expect(positive.observedByElement).toEqual([{ elementId: "finish", runs: 1, results: 1, statusCounts: { Passed: 1 } }]);
    expect(positive.governedRuns).toEqual([expect.objectContaining({ caseCount: 1, attributedCaseCount: 1,
      unavailableCaseCount: 0, unknownCaseCount: 0, occurrenceBasis: "PINNED", statusCounts: { Passed: 1 } })]);

    await s.legacy.removeCycleTestCase(run.cycleId,user,basis.testcaseId);
    const removed = await s.repository.coverageForUser(user,project,basis.modelId);
    expect(removed.observedByElement).toEqual([]);
    expect(removed.governedRuns).toEqual([expect.objectContaining({ caseCount: 1, attributedCaseCount: 0,
      unavailableCaseCount: 1, unknownCaseCount: 0, statusCounts: {} })]);
    await s.legacy.updateTestCaseForUser(user,project,basis.testcaseId,{
      title: "A different approved definition after dispatch", expectedRevision: originalCase.editRevision
    });
    const changed = await s.legacy.getTestCaseForUser(user,project,basis.testcaseId);
    await s.legacy.approveTestCaseForUser(user,project,basis.testcaseId,{
      expectedRevision: changed.editRevision, expectedApprovalRevision: changed.approvalRevision
    },{ kind: "human_session" });
    const reviewed = await s.legacy.getTestCaseForUser(user,project,basis.testcaseId);
    expect(reviewed.approvalRevision).not.toBe(pin.snapshotApprovalRevision);
    const unrelated = await s.legacy.createTestCase(project,user,{ title: "Unrelated later native member", status: "Draft" });
    const unrelatedReview = await s.legacy.getTestCaseForUser(user,project,unrelated.id);
    await s.legacy.approveTestCaseForUser(user,project,unrelated.id,{
      expectedRevision: unrelatedReview.editRevision, expectedApprovalRevision: unrelatedReview.approvalRevision
    },{ kind: "human_session" });
    expect(await s.legacy.addCycleTestCases(run.cycleId,user,{ testcaseIds: [basis.testcaseId, unrelated.id] }))
      .toEqual({ requested: 2, added: 2, skipped: 0 });
    const current = await s.legacy.executionsForUser(run.cycleId,user);
    expect(current).toHaveLength(2);
    const replacement = current.find(row => row.testcaseId === basis.testcaseId)!;
    expect(replacement.id).not.toBe(pin.executionId);
    expect(replacement.cycleItemId).not.toBe(pin.cycleItemId);
    for (const row of current) await s.legacy.updateExecution(row.id,user,{ status: "Passed" },{ expectedCycleId: run.cycleId });
    const persisted = (await admin.query(
      `SELECT ci.id, ci.testcase_id, ci.snapshot_approval_revision, e.id AS execution_id, e.status
       FROM cycle_items ci JOIN executions e ON e.cycle_item_id=ci.id
       WHERE ci.cycle_id=$1 AND ci.deleted_at IS NULL AND e.deleted_at IS NULL`,[run.cycleId]
    )).rows;
    expect(persisted).toHaveLength(2);
    expect(persisted.every(row => row.status === "Passed")).toBe(true);
    expect(persisted.find(row => row.testcase_id === basis.testcaseId)).toMatchObject({
      id: replacement.cycleItemId, execution_id: replacement.id, snapshot_approval_revision: reviewed.approvalRevision
    });

    const coverage = await s.repository.coverageForUser(user,project,basis.modelId);
    expect(coverage.observedByElement).toEqual([]);
    expect(coverage.governedRuns).toEqual([expect.objectContaining({ caseCount: 1, occurrenceBasis: "PINNED",
      attributedCaseCount: 0, unavailableCaseCount: 1, unknownCaseCount: 0, statusCounts: {} })]);
    expect(coverage.caseEvidence).toEqual([expect.objectContaining({ testcaseId: basis.testcaseId, statusCounts: { Passed: 2 } })]);
    expect(coverage.evidenceNote).toMatch(/across native runs, separate from the original occurrences/i);
    expect(await s.repository.runProvenanceForUser(user,project,run.cycleId)).toMatchObject({
      caseCount: 1, occurrenceBasis: "PINNED", pinnedCaseCount: 1, unknownCaseCount: 0
    });
    expect((await admin.query("SELECT * FROM mbt_model_runs WHERE id=$1",[run.id])).rows[0]).toEqual(originalManifest);
    expect((await snapshot()).rows[0]).toEqual(originalSnapshot);
    expect((await admin.query(
      `SELECT ci.deleted_at IS NOT NULL AS item_removed, e.deleted_at IS NOT NULL AS execution_removed, e.status
       FROM cycle_items ci JOIN executions e ON e.cycle_item_id=ci.id WHERE ci.id=$1 AND e.id=$2`,
      [pin.cycleItemId,pin.executionId]
    )).rows[0]).toEqual({ item_removed: true, execution_removed: true, status: "Passed" });
  });

  it("counts each native result once when one case has multiple valid model mappings", async () => {
    const basis = await ready(), s = services();
    // The original link maps start/finish/done; the additional distinct link is legitimate.
    await s.repository.linkCaseForUser(user,project,basis.modelId,basis.revisionId,{
      testcaseId: basis.testcaseId, elementIds: ["finish"]
    });

    const createPassedOccurrence = async (name: string) => {
      const run = await s.legacy.createCycleWithTestcasesForUser(user,project,{
        name, testcaseIds: [basis.testcaseId]
      });
      const executions = await s.legacy.executionsForUser(run.cycle.id,user);
      expect(executions).toHaveLength(1);
      await s.legacy.updateExecution(executions[0].id,user,{ status: "Passed" },{
        expectedCycleId: run.cycle.id
      });
    };

    await createPassedOccurrence("Distinct source observation one");
    const first = await s.repository.coverageForUser(user,project,basis.modelId);
    expect(first.links).toHaveLength(2);
    expect(first.elements.find((row: Body) => row.id === "finish")?.linkedCases).toBe(1);
    expect(first.caseEvidence).toEqual([expect.objectContaining({
      testcaseId: basis.testcaseId, statusCounts: { Passed: 1 }
    })]);

    await createPassedOccurrence("Distinct source observation two");
    const second = await s.repository.coverageForUser(user,project,basis.modelId);
    expect(second.links).toHaveLength(2);
    expect(second.caseEvidence).toEqual([expect.objectContaining({
      testcaseId: basis.testcaseId, statusCounts: { Passed: 2 }
    })]);
    // Two native executions legitimately count twice. A second model link does not.
  });

  it("keeps a legacy manifest UNKNOWN even when today's native occurrence has a passing result", async () => {
    const basis = await ready(), s = services(), original = await dispatch(s,basis);
    const native = await s.legacy.createCycleWithTestcasesForUser(user,project,{
      name: "Legacy model dispatch fixture", testcaseIds: [basis.testcaseId]
    });
    const [result] = await s.legacy.executionsForUser(native.cycle.id,user);
    await s.legacy.updateExecution(result.id,user,{ status: "Passed" },{ expectedCycleId: native.cycle.id });
    // Historical JSON fixture, not a product backfill or alteration of the genuine new manifest.
    const legacyManifest = { ...original.manifest, cases: original.manifest.cases.map((entry: Body) => {
      const historical = { ...entry }; delete historical.nativeOccurrence; return historical;
    }) };
    await admin.query(
      `INSERT INTO mbt_model_runs(project_id,model_id,model_revision_id,approval_id,content_hash,cycle_id,created_by,manifest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [project,basis.modelId,basis.revisionId,original.approvalId,basis.hash,native.cycle.id,user,JSON.stringify(legacyManifest)]
    );
    const coverage = await s.repository.coverageForUser(user,project,basis.modelId);
    expect(coverage.governedRuns.find(row => row.cycleId === native.cycle.id)).toMatchObject({
      caseCount: 1, occurrenceBasis: "UNKNOWN", attributedCaseCount: 0, unavailableCaseCount: 0,
      unknownCaseCount: 1, statusCounts: {}
    });
    for (const row of coverage.observedByElement) expect(row.statusCounts).toEqual({ Untested: 1 });
    expect(coverage.observedByElement).toHaveLength(3);
    expect(await s.repository.runProvenanceForUser(user,project,native.cycle.id)).toMatchObject({
      caseCount: 1, occurrenceBasis: "UNKNOWN", pinnedCaseCount: 0, unknownCaseCount: 1
    });
    expect((await admin.query("SELECT manifest FROM mbt_model_runs WHERE id=$1",[original.id])).rows[0].manifest)
      .toEqual(original.manifest);
  });

  it("rolls back a failed candidate mapping, its Draft and audit; concurrent retries create one native Draft", async () => {
    const basis = await newModel(), s = services(), generation = { strategy: "edge_coverage", maxPaths: 10, maxDepth: 8 };
    const proposed = await s.repository.generateForUser(user,project,basis.modelId,basis.revisionId,generation);
    const body = { ...generation, digests: [proposed.paths[0].digest] }, before = await candidateRows();
    const fault = failProvenance(s.db,"mbt_generated_cases");
    await expect(s.repository.createCasesFromPathsForUser(user,project,basis.modelId,basis.revisionId,body,{ kind: "human_session" })).rejects.toMatchObject({ code: "22012" });
    expect(await candidateRows()).toEqual(before);
    expect(s.embedding).not.toHaveBeenCalled();
    expect(s.suitesCache).not.toHaveBeenCalled();
    expect(s.listCache).not.toHaveBeenCalled();
    fault.mockRestore();
    const repeated = await Promise.all([1,2].map(() =>
      s.repository.createCasesFromPathsForUser(user,project,basis.modelId,basis.revisionId,body,{ kind: "human_session" })));
    expect(repeated.reduce((sum,row) => sum+row.created,0)).toBe(1);
    expect(repeated.reduce((sum,row) => sum+row.skipped,0)).toBe(1);
    expect(repeated[0].cases[0].testcaseId).toBe(repeated[1].cases[0].testcaseId);
    const after = await candidateRows();
    expect(after.cases).toHaveLength(before.cases.length+1);
    expect(after.cases.find(row => row.id === repeated[0].cases[0].testcaseId)).toMatchObject({ status: "Draft", created_by: user });
    expect(after.mappings).toHaveLength(before.mappings.length+1);
    expect(after.audits.filter(row => row.action === "testcase_created")).toHaveLength(before.audits.filter(row => row.action === "testcase_created").length+1);
    expect(s.embedding).toHaveBeenCalledTimes(1);
  });

  it.each(["revision", "archive"] as const)("waits for an earlier %s owner and refuses the obsolete basis without a run", async kind => {
    const basis = await ready(), s = services(), writer = services(), entered = latch(), release = latch();
    const before = await runRows();
    let write: Promise<unknown>;
    if (kind === "revision") {
      const transaction = writer.db.transaction.bind(writer.db);
      jest.spyOn(writer.db,"transaction").mockImplementation(fn => transaction(async client => {
        const result = await fn(client); entered.release(); await release.promise; return result;
      }));
      write = writer.repository.saveRevisionForUser(user,project,basis.modelId,{ baseRevisionId: basis.revisionId, model: NEXT });
    } else {
      write = writer.db.transaction(async client => {
        const boundDb = { query: (sql: string, values: unknown[]) => client.query(sql,values) } as DatabaseService;
        const repository = new ModelStudioRepository(boundDb,writer.legacy);
        const result = await repository.archiveModelForUser(user,project,basis.modelId);
        entered.release(); await release.promise; return result;
      });
    }
    let attempt: Promise<unknown> | undefined;
    try {
      await Promise.race([entered.promise,write.then(() => { throw new Error("Owner finished before its commit barrier"); })]);
      attempt = dispatch(s,basis).then(() => null,error => error);
      await waitForLock("FROM mbt_models");
      release.release(); await write;
      expect(await attempt).toMatchObject({ status: kind === "revision" ? 409 : 404 });
      expect(await runRows()).toEqual(before);
    } finally { release.release(); await Promise.allSettled([write,attempt]); }
  },15000);

  it.each(["revision", "archive"] as const)("holds the valid dispatch basis until commit against a later %s owner", async kind => {
    const basis = await ready(), s = services(), writer = services(), entered = latch(), release = latch();
    const create = s.legacy.createCycleWithTestcasesForUser.bind(s.legacy);
    jest.spyOn(s.legacy,"createCycleWithTestcasesForUser").mockImplementation(async (...args) => {
      const result = await create(...args); entered.release(); await release.promise; return result;
    });
    const before = await runRows(), attempt = dispatch(s,basis);
    let write: Promise<unknown> | undefined;
    try {
      await Promise.race([entered.promise,attempt.then(() => { throw new Error("Dispatch escaped its commit barrier"); })]);
      expect(await runRows()).toEqual(before); // Native records remain invisible until their manifest can commit.
      write = kind === "revision"
        ? writer.repository.saveRevisionForUser(user,project,basis.modelId,{ baseRevisionId: basis.revisionId, model: NEXT })
        : writer.repository.archiveModelForUser(user,project,basis.modelId);
      await waitForLock("mbt_models");
      release.release();
      const run = await attempt; await write;
      const persisted = (await admin.query("SELECT * FROM mbt_model_runs WHERE cycle_id=$1",[run.cycleId])).rows[0];
      expect(persisted).toMatchObject({ model_revision_id: basis.revisionId, content_hash: basis.hash });
      expect(persisted.manifest.cases).toEqual([expect.objectContaining({ testcaseId: basis.testcaseId })]);
      await expect(dispatch(writer,basis)).rejects.toMatchObject({ status: kind === "revision" ? 409 : 404 });
      expect((await admin.query("SELECT * FROM mbt_model_runs WHERE cycle_id=$1",[run.cycleId])).rows[0]).toEqual(persisted);
    } finally { release.release(); await Promise.allSettled([attempt,write]); }
  },15000);

  it("refreshes a case after waiting for a live demotion and leaves no partial run", async () => {
    const basis = await ready(), s = services(), before = await runRows();
    const blocker = new Client({ connectionString: url }); await blocker.connect();
    let attempt: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("UPDATE testcases SET status='Draft' WHERE id=$1",[basis.testcaseId]);
      attempt = dispatch(s,basis).then(() => null,error => error);
      await waitForLock("FROM testcases");
      await blocker.query("COMMIT");
      expect(await attempt).toMatchObject({ status: 409, response: { code: "CASE_NOT_APPROVED" } });
      expect(await runRows()).toEqual(before);
    } finally { await blocker.query("ROLLBACK"); await attempt; await blocker.end(); }
  },15000);

  it("blocks a changed explicit mapping after case reapproval and preserves the earlier run until fresh relinking", async () => {
    const basis = await ready(), s = services();
    await s.repository.unlinkCaseForUser(user,project,basis.modelId,basis.revisionId,basis.linkId);
    const originalCase = await s.legacy.getTestCaseForUser(user,project,basis.testcaseId);
    const mapping = await s.repository.linkCaseForUser(user,project,basis.modelId,basis.revisionId,{
      testcaseId: basis.testcaseId, testcaseRevision: originalCase.editRevision, elementIds: ["finish"]
    });
    const originalRun = await dispatch(s,basis);
    const history = (await admin.query("SELECT * FROM mbt_model_runs WHERE cycle_id=$1",[originalRun.cycleId])).rows[0];
    expect(history.manifest.cases).toEqual([expect.objectContaining({
      mappings: [{ id: mapping.id, testcaseRevision: originalCase.editRevision, basis: "CURRENT" }]
    })]);

    await s.legacy.updateTestCaseForUser(user,project,basis.testcaseId,{
      title: "Changed expected behavior", expectedRevision: originalCase.editRevision
    });
    const changed = await s.legacy.getTestCaseForUser(user,project,basis.testcaseId);
    await s.legacy.approveTestCaseForUser(user,project,basis.testcaseId,{
      expectedRevision: changed.editRevision, expectedApprovalRevision: changed.approvalRevision
    },{ kind: "human_session" });
    const reviewed = await s.legacy.getTestCaseForUser(user,project,basis.testcaseId);
    expect(reviewed.status).toBe("Approved");
    expect(reviewed.editRevision).not.toBe(originalCase.editRevision);
    const before = await runRows();
    const linksBefore = (await admin.query("SELECT * FROM mbt_model_case_links WHERE model_id=$1 ORDER BY id",[basis.modelId])).rows;
    await expect(dispatch(s,basis)).rejects.toMatchObject({ response: { code: "MAPPING_CHANGED" } });
    for (const testcaseRevision of [originalCase.editRevision, reviewed.editRevision]) {
      await expect(s.repository.linkCaseForUser(user,project,basis.modelId,basis.revisionId,{
        testcaseId: basis.testcaseId, testcaseRevision, elementIds: ["finish"]
      })).rejects.toMatchObject({ response: { code: "MAPPING_CHANGED" } });
    }
    expect(await runRows()).toEqual(before);
    expect((await admin.query("SELECT * FROM mbt_model_case_links WHERE model_id=$1 ORDER BY id",[basis.modelId])).rows).toEqual(linksBefore);

    await s.repository.unlinkCaseForUser(user,project,basis.modelId,basis.revisionId,mapping.id);
    const fresh = await s.repository.linkCaseForUser(user,project,basis.modelId,basis.revisionId,{
      testcaseId: basis.testcaseId, testcaseRevision: reviewed.editRevision, elementIds: ["finish"]
    });
    const nextRun = await dispatch(s,basis);
    expect(nextRun.manifest.cases).toEqual([expect.objectContaining({
      mappings: [{ id: fresh.id, testcaseRevision: reviewed.editRevision, basis: "CURRENT" }]
    })]);
    expect((await admin.query("SELECT * FROM mbt_model_runs WHERE cycle_id=$1",[originalRun.cycleId])).rows[0]).toEqual(history);
  });

  it("pins a relied-on link until dispatch commits and preserves its historical manifest after unlink", async () => {
    const basis = await ready(), s = services(), writer = services(), entered = latch(), release = latch();
    const create = s.legacy.createCycleWithTestcasesForUser.bind(s.legacy);
    jest.spyOn(s.legacy,"createCycleWithTestcasesForUser").mockImplementation(async (...args) => {
      const result = await create(...args); entered.release(); await release.promise; return result;
    });
    const attempt = dispatch(s,basis);
    let unlink: Promise<unknown> | undefined;
    try {
      await Promise.race([entered.promise,attempt.then(() => { throw new Error("Dispatch escaped its commit barrier"); })]);
      unlink = writer.repository.unlinkCaseForUser(user,project,basis.modelId,basis.revisionId,basis.linkId);
      await waitForLock("DELETE FROM mbt_model_case_links");
      release.release();
      const run = await attempt; await unlink;
      expect((await admin.query("SELECT manifest FROM mbt_model_runs WHERE cycle_id=$1",[run.cycleId])).rows[0].manifest.cases)
        .toEqual([expect.objectContaining({ testcaseId: basis.testcaseId, sources: ["linked"] })]);
      await expect(dispatch(writer,basis)).rejects.toMatchObject({ status: 400, response: { code: "CASE_NOT_IN_MODEL" } });
    } finally { release.release(); await Promise.allSettled([attempt,unlink]); }
  },15000);

  it.each(["link", "unlink"] as const)("refuses a %s after an earlier archive commits without changing mappings", async kind => {
    const basis = await ready(), s = services(), writer = services(), entered = latch(), release = latch();
    const links = () => admin.query("SELECT * FROM mbt_model_case_links WHERE model_id=$1 ORDER BY id",[basis.modelId]);
    const before = (await links()).rows;
    const archive = writer.db.transaction(async client => {
      const boundDb = { query: (sql: string, values: unknown[]) => client.query(sql,values) } as DatabaseService;
      const repository = new ModelStudioRepository(boundDb,writer.legacy);
      const result = await repository.archiveModelForUser(user,project,basis.modelId);
      entered.release(); await release.promise; return result;
    });
    let attempt: Promise<unknown> | undefined;
    try {
      await Promise.race([entered.promise,archive.then(() => { throw new Error("Archive escaped its commit barrier"); })]);
      const mutation = kind === "link"
        ? s.repository.linkCaseForUser(user,project,basis.modelId,basis.revisionId,{ testcaseId: basis.testcaseId, elementIds: ["done"] })
        : s.repository.unlinkCaseForUser(user,project,basis.modelId,basis.revisionId,basis.linkId);
      attempt = mutation.then(() => null,error => error);
      await waitForLock("FROM mbt_models");
      release.release(); await archive;
      expect(await attempt).toMatchObject({ status: 404 });
      expect((await links()).rows).toEqual(before);
    } finally { release.release(); await Promise.allSettled([archive,attempt]); }
  },15000);
});
