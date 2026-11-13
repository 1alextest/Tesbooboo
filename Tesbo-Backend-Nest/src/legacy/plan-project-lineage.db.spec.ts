import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { buildMcpTools } from "../mcp/mcp.tools";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("Plan/Run project lineage — migrated PostgreSQL", () => {
  let setup: Client, pool: Pool, project: string, other: string, plan: string, cycle: string;
  let localSuite: string, localCase: string, foreignSuite: string, foreignCase: string, foreignPlan: string;
  const owner = randomUUID(), stamp = randomUUID();
  beforeAll(async () => {
    setup = new Client({ connectionString: url }); await setup.connect();
    pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
    await setup.query("INSERT INTO users (id,email,name) VALUES ($1,$2,'Lineage owner')", [owner, `lineage-${stamp}@tesbo.invalid`]);
    const org = (await setup.query("INSERT INTO organizations (name,slug) VALUES ('Lineage CI',$1) RETURNING id", [`lineage-${stamp}`])).rows[0].id;
    project = (await setup.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'LNA','Lineage A') RETURNING id", [org])).rows[0].id;
    other = (await setup.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'LNB','Lineage B') RETURNING id", [org])).rows[0].id;
    localSuite = (await setup.query("INSERT INTO suites (project_id,name) VALUES ($1,'Local Suite') RETURNING id", [project])).rows[0].id;
    foreignSuite = (await setup.query("INSERT INTO suites (project_id,name) VALUES ($1,'Private foreign Suite') RETURNING id", [other])).rows[0].id;
    localCase = (await setup.query("INSERT INTO testcases (project_id,external_id,title) VALUES ($1,'LNA-TC-1','Local Case') RETURNING id", [project])).rows[0].id;
    foreignCase = (await setup.query("INSERT INTO testcases (project_id,external_id,title) VALUES ($1,'LNB-TC-1','Private foreign Case') RETURNING id", [other])).rows[0].id;
    foreignPlan = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'Private foreign Plan') RETURNING id", [other])).rows[0].id;
  });
  beforeEach(async () => {
    plan = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'Local Plan') RETURNING id", [project])).rows[0].id;
    cycle = (await setup.query("INSERT INTO cycles (project_id,name,plan_id) VALUES ($1,'Local Run',$2) RETURNING id", [project, plan])).rows[0].id;
  });
  afterAll(async () => { await pool?.end(); await setup?.end(); }); // Preserve synthetic provenance until disposable CI teardown.
  function fixture() {
    const db = new DatabaseService(pool), svc = makeLegacy(db);
    // Native relational/write tests, not HTTP authorization. Genuine HTTP/MCP auth is in smoke.
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const tool = (name: string, args: Record<string, unknown>) => buildMcpTools().find((item) => item.name === name)!.handler(args, {
      db, legacy: svc, projectId: project, userId: owner, actorId: owner, scopes: ["read", "write"]
    });
    return { svc, tool };
  }
  const state = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["plans", "suites", "testcases", "cycles"]) result[table] = (await setup.query(`SELECT * FROM ${table} WHERE project_id = ANY($1::uuid[]) ORDER BY id`, [[project, other]])).rows;
    result.items = (await setup.query("SELECT pi.* FROM plan_items pi JOIN plans p ON p.id=pi.plan_id WHERE p.project_id=ANY($1::uuid[]) ORDER BY pi.id", [[project, other]])).rows;
    return result;
  };
  it.each(["foreign", "missing", "malformed", "deleted"])("rejects %s Suite/Case references without a committed prefix or unrelated mutation", async (kind) => {
    const f = fixture();
    for (const field of ["suiteId", "testcaseId"] as const) {
      let id: unknown = kind === "foreign" ? (field === "suiteId" ? foreignSuite : foreignCase) : kind === "missing" ? randomUUID() : { invalid: true };
      if (kind === "deleted") {
        id = field === "suiteId"
          ? (await setup.query("INSERT INTO suites (project_id,name,deleted_at) VALUES ($1,'Deleted Suite',now()) RETURNING id", [project])).rows[0].id
          : (await setup.query("INSERT INTO testcases (project_id,external_id,title,deleted_at) VALUES ($1,$2,'Deleted Case',now()) RETURNING id", [project, `DEL-${randomUUID().slice(0, 8)}`])).rows[0].id;
      }
      const before = await state();
      await expect(f.svc.addPlanItem(owner, plan, { [field]: id })).rejects.toMatchObject({ status: 404 });
      expect(await state()).toEqual(before);
    }
  });
  it("validates every supplied child but retains both-local and historical-deleted-name compatibility", async () => {
    const f = fixture(), before = await state();
    await expect(f.svc.addPlanItem(owner, plan, { suiteId: localSuite, testcaseId: foreignCase })).rejects.toMatchObject({ status: 404 });
    expect(await state()).toEqual(before);
    const item = await f.svc.addPlanItem(owner, plan, { suiteId: localSuite, testcaseId: localCase, position: 3 });
    expect(item).toMatchObject({ planId: plan, suiteId: localSuite, testcaseId: localCase, position: 3 });
    // A valid reference that later soft-deletes is still historical information, not a missing row.
    await setup.query("UPDATE suites SET deleted_at=now() WHERE id=$1", [localSuite]);
    expect(await f.svc.planItems(owner, plan)).toEqual([expect.objectContaining({ id: item.id, suiteName: "Local Suite (deleted)", tcTitle: "Local Case" })]);
    await setup.query("UPDATE suites SET deleted_at=NULL WHERE id=$1", [localSuite]);
  });
  it.each([{}, { suiteId: null }, { suiteId: "", testcaseId: "" }])("rejects an empty Plan item before SQL constraint failure: %j", async (body) => {
    const before = await state();
    await expect(fixture().svc.addPlanItem(owner, plan, body)).rejects.toMatchObject({ status: 400 });
    expect(await state()).toEqual(before);
  });
  describe.each(["create", "update", "MCP create"])("%s Run Plan binding", (kind) => {
    it.each(["foreign", "missing", "malformed", "deleted"])("rejects a %s Plan and preserves all prior rows", async (invalid) => {
      let id: unknown = invalid === "foreign" ? foreignPlan : invalid === "missing" ? randomUUID() : "not-a-uuid";
      if (invalid === "deleted") id = (await setup.query("INSERT INTO plans (project_id,name,deleted_at) VALUES ($1,'Deleted Plan',now()) RETURNING id", [project])).rows[0].id;
      const f = fixture(), before = await state();
      const pending = kind === "create" ? f.svc.createCycle(project, { name: "Must not persist", planId: id })
        : kind === "update" ? f.svc.updateCycle(cycle, owner, { name: "Must not persist", planId: id })
          : f.tool("create_cycle_from_plan", { name: "Must not persist", planId: id });
      await expect(pending).rejects.toMatchObject({ status: 404 });
      expect(await state()).toEqual(before);
    });
  });
  it("preserves local create, omitted association, reassignment and explicit unlink contracts", async () => {
    const f = fixture();
    expect(await f.tool("create_cycle_from_plan", { name: "Allowed", planId: plan })).toMatchObject({ projectId: project, planId: plan });
    expect(await f.svc.createCycle(project, { name: "Unassociated" })).toMatchObject({ projectId: project, planId: null });
    await f.svc.updateCycle(cycle, owner, { name: "Renamed without replaying Plan" });
    expect((await setup.query("SELECT plan_id,name FROM cycles WHERE id=$1", [cycle])).rows[0]).toEqual({ plan_id: plan, name: "Renamed without replaying Plan" });
    const next = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'Next local Plan') RETURNING id", [project])).rows[0].id;
    await f.svc.updateCycle(cycle, owner, { planId: next });
    expect((await setup.query("SELECT plan_id FROM cycles WHERE id=$1", [cycle])).rows[0].plan_id).toBe(next);
    await f.svc.updateCycle(cycle, owner, { clearPlan: true, planId: foreignPlan });
    expect((await setup.query("SELECT plan_id FROM cycles WHERE id=$1", [cycle])).rows[0].plan_id).toBeNull();
  });
  it("retains old invalid associations without exposing foreign display fields or Run rollups", async () => {
    const f = fixture();
    const invalid = (await setup.query("INSERT INTO plan_items (plan_id,suite_id,testcase_id) VALUES ($1,$2,$3) RETURNING id", [plan, foreignSuite, foreignCase])).rows[0].id;
    const foreignRun = (await setup.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'Private foreign Run') RETURNING id", [other, plan])).rows[0].id;
    const before = await state();
    expect(await f.svc.planItems(owner, plan)).toEqual([expect.objectContaining({ id: invalid, suiteId: foreignSuite, testcaseId: foreignCase, suiteName: null, tcTitle: null, tcExternalId: null, lastStatus: null })]);
    expect((await f.svc.planRuns(owner, plan)).map((row) => row.id)).toEqual([cycle]);
    expect(await f.svc.planProgress(owner, plan)).toMatchObject({ runCount: 1, totalCases: 0 });
    expect((await f.svc.listPlans(project)).find((row) => row.id === plan)).toMatchObject({ runCount: 1 });
    expect((await f.svc.planRuns(owner, plan)).some((row) => row.id === foreignRun)).toBe(false);
    expect(await state()).toEqual(before);
    const wrongPlanRun = (await setup.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'Local legacy inconsistent Run') RETURNING id", [project, foreignPlan])).rows[0].id;
    expect(await f.tool("get_test_cycle", { cycleId: wrongPlanRun })).toMatchObject({ id: wrongPlanRun, plan: null });
  });
  it.each(["plans", "suites", "testcases"] as const)("waits for a concurrent %s soft-delete, then refuses the stale reference", async (table) => {
    const id = table === "plans" ? plan : table === "suites" ? localSuite : localCase;
    const blocker = new Client({ connectionString: url }); await blocker.connect(); await blocker.query("BEGIN");
    await blocker.query(`UPDATE ${table} SET deleted_at=now() WHERE id=$1`, [id]);
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const f = fixture(), before = await state();
    const pending = (table === "plans" ? f.svc.createCycle(project, { name: "Deleted Plan race", planId: id }) : f.svc.addPlanItem(owner, plan, { [table === "suites" ? "suiteId" : "testcaseId"]: id })).then(() => null, (error: unknown) => error);
    try {
      const deadline = Date.now() + 5000;
      let blocked = false;
      while (Date.now() < deadline && !blocked) {
        blocked = (await setup.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))", [pid])).rowCount! > 0;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(blocked).toBe(true);
      expect(await state()).toEqual(before);
      await blocker.query("COMMIT");
      expect(await pending).toMatchObject({ status: 404 });
      // Only the independently committed soft-delete may change; no Plan item/Run was inserted.
      const after = await state();
      expect(after.items).toEqual(before.items); expect(after.cycles).toEqual(before.cycles);
    } finally {
      await blocker.query("ROLLBACK"); await pending; await blocker.end();
      if (table !== "plans") await setup.query(`UPDATE ${table} SET deleted_at=NULL WHERE id=$1`, [id]);
    }
  }, 15_000);
});
