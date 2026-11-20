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
