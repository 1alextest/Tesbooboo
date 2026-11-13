import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import type { SuitesCacheService } from "../cache/suites-cache.service";
import type { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("suite subtree project isolation — migrated PostgreSQL", () => {
  let db: Client, pool: Pool, project: string, other: string, root: string, child: string, foreignChild: string;
  let local: string[], foreign: string[], untouched: string[], run: string;
  const owner = randomUUID(), stamp = randomUUID(); let sequence = 0;
  beforeAll(async () => {
    db = new Client({ connectionString: url }); await db.connect();
    pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
    await db.query("INSERT INTO users (id,email,name) VALUES ($1,$2,'Suite isolation owner')", [owner, `suite-${stamp}@tesbo.invalid`]);
    const org = (await db.query("INSERT INTO organizations (name,slug) VALUES ('Suite isolation CI',$1) RETURNING id", [`suite-${stamp}`])).rows[0].id;
    project = (await db.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'SUA','Suite A') RETURNING id", [org])).rows[0].id;
    other = (await db.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'SUB','Suite B') RETURNING id", [org])).rows[0].id;
  });
  async function suite(projectId: string, name: string, parent: string | null = null) {
    return (await db.query("INSERT INTO suites (project_id,name,parent_id) VALUES ($1,$2,$3) RETURNING id", [projectId, name, parent])).rows[0].id as string;
  }
  async function testcase(projectId: string, suiteId: string | null, deleted = false) {
    return (await db.query("INSERT INTO testcases (project_id,suite_id,external_id,title,created_by,updated_by,deleted_at) VALUES ($1,$2,$3,'Suite isolation case',$4,$4,CASE WHEN $5::boolean THEN now() ELSE NULL END) RETURNING id", [projectId, suiteId, `SUITE-${++sequence}`, owner, deleted])).rows[0].id as string;
  }
  beforeEach(async () => {
    root = await suite(project, "Local root"); child = await suite(project, "Local child", root);
    foreignChild = await suite(other, "Foreign child with inconsistent parent", root);
    local = [await testcase(project, root), await testcase(project, child)];
    foreign = [await testcase(other, root), await testcase(other, child), await testcase(other, foreignChild)];
    untouched = [await testcase(project, null), await testcase(project, root, true)];
    run = (await db.query("INSERT INTO cycles (project_id,name,source,closed_at) VALUES ($1,'Sealed snapshot control','automation',now()) RETURNING id", [project])).rows[0].id;
    const item = (await db.query("INSERT INTO cycle_items (cycle_id,testcase_id,snapshot_title,snapshot_suite_id,position) VALUES ($1,$2,'Original run witness',$3,1) RETURNING id", [run, local[0], root])).rows[0].id;
    await db.query("INSERT INTO executions (cycle_item_id,status) VALUES ($1,'Passed')", [item]);
  });
  afterAll(async () => { await pool?.end(); await db?.end(); }); // Keep provenance for disposable CI teardown.
  function service() {
    const svc = makeLegacy(new DatabaseService(pool));
    // Relational/transaction proof only. Genuine sessions, bearer refusal and UI own auth proof.
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const internals = svc as unknown as { suitesCache: SuitesCacheService; testcasesListCache: TestcasesListCacheService; projectSuiteSummaries: (id: string) => Promise<Array<{ id: string; testCaseCount: number }>> };
    jest.spyOn(internals.suitesCache, "get").mockResolvedValue(undefined);
    jest.spyOn(internals.suitesCache, "set").mockResolvedValue(undefined);
    const suiteCache = jest.spyOn(internals.suitesCache, "invalidate").mockResolvedValue(undefined);
    const caseCache = jest.spyOn(internals.testcasesListCache, "invalidate").mockResolvedValue(undefined);
    return { svc, internals, suiteCache, caseCache };
  }
  const state = async () => ({
    cases: (await db.query("SELECT * FROM testcases WHERE id=ANY($1::uuid[]) ORDER BY id", [[...local, ...foreign, ...untouched]])).rows,
    versions: (await db.query("SELECT * FROM testcase_versions WHERE testcase_id=ANY($1::uuid[]) ORDER BY testcase_id,version", [[...local, ...foreign, ...untouched]])).rows,
    suites: (await db.query("SELECT * FROM suites WHERE id=ANY($1::uuid[]) ORDER BY id", [[root, child, foreignChild]])).rows,
    run: (await db.query("SELECT * FROM cycles WHERE id=$1", [run])).rows,
    items: (await db.query("SELECT * FROM cycle_items WHERE cycle_id=$1 ORDER BY id", [run])).rows,
    executions: (await db.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id WHERE ci.cycle_id=$1 ORDER BY e.id", [run])).rows,
  });
  it("excludes foreign cases from direct, recursive and agent-context counts without changing raw associations", async () => {
    const f = service(), before = await state(), rows = await f.svc.listSuites(project);
    expect(rows.find((row) => row.id === root)).toMatchObject({ testCaseCount: 1, recursiveTestCaseCount: 2 });
    expect(rows.find((row) => row.id === child)).toMatchObject({ testCaseCount: 1, recursiveTestCaseCount: 1 });
    expect(rows.some((row) => row.id === foreignChild)).toBe(false);
    expect((await f.internals.projectSuiteSummaries(project)).find((row) => row.id === root)).toMatchObject({ testCaseCount: 1 });
    expect(await state()).toEqual(before);
  });
  it.each(["moveToDefault", "deleteTestcases"])("%s changes the complete local subtree only; foreign history and sealed run witnesses survive", async (mode) => {
    const f = service(), before = await state(); await f.svc.deleteSuite(owner, root, mode); const after = await state();
    for (const row of before.cases) {
      const next = after.cases.find((entry) => entry.id === row.id), history = after.versions.filter((entry) => entry.testcase_id === row.id);
      if (local.includes(row.id)) {
        expect(next).toEqual({ ...row, ...(mode === "moveToDefault" ? { suite_id: null } : { deleted_at: expect.any(Date), deleted_by: owner, updated_by: owner }), updated_at: expect.any(Date) });
        expect(history).toHaveLength(1); expect(history[0].snapshot).toMatchObject({ id: row.id, suite_id: row.suite_id, deleted_at: null });
      } else { expect(next).toEqual(row); expect(history).toEqual(before.versions.filter((entry) => entry.testcase_id === row.id)); }
    }
    for (const row of before.suites) expect(after.suites.find((entry) => entry.id === row.id)).toEqual(row.id === foreignChild ? row : { ...row, deleted_at: expect.any(Date), deleted_by: owner, updated_at: expect.any(Date) });
    for (const key of ["run", "items", "executions"] as const) expect(after[key]).toEqual(before[key]);
    expect(f.suiteCache).toHaveBeenCalledWith(project); expect(f.caseCache).toHaveBeenCalledWith(project);
    await expect(f.svc.deleteSuite(owner, root, mode)).rejects.toMatchObject({ status: 404 });
    expect(await state()).toEqual(after);
  });
  it.each(["malformed", "missing"])("refuses a %s Suite without changing any row", async (kind) => {
    const before = await state(); await expect(service().svc.deleteSuite(owner, kind === "malformed" ? "bad-id" : randomUUID())).rejects.toMatchObject({ status: 404 });
    expect(await state()).toEqual(before);
  });
  it.each(["moveToDefault", "deleteTestcases"])("rolls back %s testcase/history writes if the later Suite update fails", async (mode) => {
    const name = `suite_fault_${randomUUID().replace(/-/g, "")}`, before = await state(), f = service();
    await db.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM testcase_versions WHERE testcase_id='${local[0]}'::uuid) THEN RAISE EXCEPTION 'expected testcase write before fault'; END IF;
      RAISE EXCEPTION 'controlled suite write fault'; END $$`);
    await db.query(`CREATE TRIGGER ${name} BEFORE UPDATE ON suites FOR EACH ROW WHEN (OLD.id='${root}'::uuid) EXECUTE FUNCTION ${name}()`);
    try {
      await expect(f.svc.deleteSuite(owner, root, mode)).rejects.toMatchObject({ code: "P0001", message: "controlled suite write fault" });
      expect(await state()).toEqual(before); expect(f.suiteCache).not.toHaveBeenCalled(); expect(f.caseCache).not.toHaveBeenCalled();
    } finally { await db.query(`DROP TRIGGER ${name} ON suites`); await db.query(`DROP FUNCTION ${name}()`); }
  });
});
