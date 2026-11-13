import { randomUUID } from "node:crypto";
import { Client, Pool, type QueryResult } from "pg";
import { DatabaseService } from "../database/database.service";
import { buildMcpTools } from "../mcp/mcp.tools";
import type { McpToolContext } from "../mcp/mcp.types";
import type { CustomFieldsService } from "../custom-fields/custom-fields.service";
import type { CustomTagsService } from "../custom-tags/custom-tags.service";
import type { SuitesCacheService } from "../cache/suites-cache.service";
import type { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const url = process.env.DATABASE_URL ?? "";
const enabled = /\/tesbo_ci(?:\?|$)/.test(url);
type RawQuery = (sql: string, values?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
type Hook = (sql: string, result: QueryResult<Record<string, unknown>>, raw: RawQuery) => Promise<void>;

(enabled ? describe : describe.skip)("repository partial edits — migrated PostgreSQL", () => {
  let setup: Client, pool: Pool;
  let projectId: string, otherProjectId: string, root: string, nextRoot: string, child: string, testcaseId: string, control: string;
  const owner = randomUUID(), otherOwner = randomUUID(), stamp = randomUUID();
  let sequence = 0;

  beforeAll(async () => {
    setup = new Client({ connectionString: url }); await setup.connect();
    pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
    await setup.query("INSERT INTO users (id,email,name) VALUES ($1,$2,'Repository owner'),($3,$4,'New owner')", [owner, `repo-${stamp}@tesbo.invalid`, otherOwner, `repo-other-${stamp}@tesbo.invalid`]);
    const org = (await setup.query<{ id: string }>("INSERT INTO organizations (name,slug) VALUES ('Repository integrity',$1) RETURNING id", [`repo-${stamp}`])).rows[0].id;
    projectId = (await setup.query<{ id: string }>("INSERT INTO projects (organization_id,key,name) VALUES ($1,'REPO','Repository integrity') RETURNING id", [org])).rows[0].id;
    otherProjectId = (await setup.query<{ id: string }>("INSERT INTO projects (organization_id,key,name) VALUES ($1,'OTHER','Bulk isolation control') RETURNING id", [org])).rows[0].id;
    await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner'),($1,$3,'qa_engineer')", [projectId, owner, otherOwner]);
    root = await suite("Original parent"); nextRoot = await suite("Concurrent parent");
    control = await seedCase("Unselected control");
  });
  beforeEach(async () => { child = await suite("Child", root); testcaseId = await seedCase("Original case"); });
  afterAll(async () => {
    // Retain synthetic records, trigger history and identity/audit provenance until CI DB teardown.
    await pool?.end(); await setup?.end();
  });
  async function suite(name: string, parent: string | null = null) {
    return (await setup.query<{ id: string }>("INSERT INTO suites (project_id,parent_id,name,description,preconditions,position) VALUES ($1,$2,$3,'Original description','Original preconditions',2) RETURNING id", [projectId, parent, name])).rows[0].id;
  }
  async function seedCase(title: string) {
    return (await setup.query<{ id: string }>(
      `INSERT INTO testcases (project_id,suite_id,owner_id,external_id,title,description,steps,jira_issue_key,jira_url,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5,'Keep this body','[{"action":"Keep action","expectedResult":"Keep expectation"}]'::jsonb,'REPO-1','https://example.invalid/REPO-1',$3,$3) RETURNING id`,
      [projectId, root, owner, `REPO-TC-${++sequence}`, title]
    )).rows[0].id;
  }
  const state = async () => ({
    row: (await setup.query("SELECT * FROM testcases WHERE id = $1", [testcaseId])).rows[0],
    versions: (await setup.query("SELECT * FROM testcase_versions WHERE testcase_id = $1 ORDER BY version", [testcaseId])).rows,
    child: (await setup.query("SELECT * FROM suites WHERE id = $1", [child])).rows[0],
    control: (await setup.query("SELECT * FROM testcases WHERE id = $1", [control])).rows[0],
    controlHistory: (await setup.query("SELECT * FROM testcase_versions WHERE testcase_id = $1 ORDER BY version", [control])).rows,
  });
  function service(dbPool = pool) {
    const db = new DatabaseService(dbPool), svc = makeLegacy(db);
    // Native SQL/registry tests, NOT HTTP authorization or custom-field/cache integration proof.
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const internals = svc as unknown as {
      customFields: CustomFieldsService; customTags: CustomTagsService;
      suitesCache: SuitesCacheService; testcasesListCache: TestcasesListCacheService;
      enqueueTestcaseEmbedding: (...args: unknown[]) => void;
      notifyIssueLinked: (...args: unknown[]) => Promise<void>;
    };
    const fields = jest.fn().mockResolvedValue(undefined), tags = jest.fn().mockResolvedValue(undefined);
    internals.customFields.setValuesForTestCase = fields;
    internals.customTags.setTagsForTestCase = tags;
    jest.spyOn(internals.suitesCache, "get").mockResolvedValue(undefined);
    jest.spyOn(internals.suitesCache, "set").mockResolvedValue(undefined);
    const suitesInvalidation = jest.spyOn(internals.suitesCache, "invalidate").mockResolvedValue(undefined);
    const casesInvalidation = jest.spyOn(internals.testcasesListCache, "invalidate").mockResolvedValue(undefined);
    const activity = jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    const embedding = jest.spyOn(internals, "enqueueTestcaseEmbedding").mockReturnValue(undefined);
    const notice = jest.spyOn(internals, "notifyIssueLinked").mockResolvedValue(undefined);
    const ctx: McpToolContext = { db, legacy: svc, projectId, actorId: owner, userId: owner, scopes: ["read", "write"] };
    const tool = (name: string, args: Record<string, unknown>) => {
      const selected = buildMcpTools().find((item) => item.name === name);
      if (!selected) throw new Error(`Missing tool ${name}`);
      return selected.handler(args, ctx);
    };
    return { svc, tool, fields, tags, activity, embedding, notice, suitesInvalidation, casesInvalidation };
  }
  function observedPool(hook: Hook) {
    const observed = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 3000 });
    observed.on("connect", (client) => {
      const raw = client.query.bind(client) as RawQuery;
      type Callback = (error: Error | null, result?: QueryResult) => void;
      client.query = ((sql: string, valuesOrCallback?: unknown[] | Callback, callback?: Callback) => {
        const values = Array.isArray(valuesOrCallback) ? valuesOrCallback : [];
        const done = typeof valuesOrCallback === "function" ? valuesOrCallback : callback;
        const pending = raw(sql, values).then(async (result) => { await hook(sql, result, raw); return result; });
        if (done) { void pending.then((result) => done(null, result), (error: Error) => done(error)); return; }
        return pending;
      }) as typeof client.query;
    });
    return observed;
  }
  async function waitForBlocker(pid: number) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if ((await setup.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))", [pid])).rowCount) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`No repository writer waited behind PostgreSQL backend ${pid}`);
  }
  function unchangedOutsideCase(before: Awaited<ReturnType<typeof state>>, after: Awaited<ReturnType<typeof state>>) {
    expect(after.child).toEqual(before.child); expect(after.control).toEqual(before.control); expect(after.controlHistory).toEqual(before.controlHistory);
  }

  it.each(["Archived", "Draft"])("preserves omitted suite/owner on a %s status-only edit and records the real prior snapshot", async (status) => {
    if (status === "Draft") await setup.query("UPDATE testcases SET status = 'Archived' WHERE id = $1", [testcaseId]);
    const f = service(), before = await state();
    await f.svc.updateTestCase(testcaseId, owner, { status });
    const after = await state();
    expect(after.row).toEqual({ ...before.row, status, updated_at: expect.any(Date) });
    expect(after.versions).toHaveLength(before.versions.length + 1);
    expect(after.versions.at(-1)).toMatchObject({ snapshot: expect.objectContaining({ suite_id: root, owner_id: owner, status: before.row.status }), changed_by: owner });
    unchangedOutsideCase(before, after);
  });

  it.each(["suite set", "owner set", "suite null", "owner null", "both null", "undefined"])("retains the explicit %s contract without touching the omitted relationship", async (kind) => {
    const body = kind === "suite set" ? { suiteId: nextRoot } : kind === "owner set" ? { ownerId: otherOwner } : kind === "suite null" ? { suiteId: null } : kind === "owner null" ? { ownerId: null } : kind === "both null" ? { suiteId: null, ownerId: null } : { suiteId: undefined, ownerId: undefined, title: "Renamed" };
    const before = await state(); await service().svc.updateTestCase(testcaseId, owner, body);
    const after = await state();
    expect(after.row).toMatchObject({ suite_id: kind === "suite set" ? nextRoot : kind === "suite null" || kind === "both null" ? null : root, owner_id: kind === "owner set" ? otherOwner : kind === "owner null" || kind === "both null" ? null : owner });
    expect(after.versions).toHaveLength(1); unchangedOutsideCase(before, after);
  });

  describe.each(["service", "MCP registry"])("%s live-write omission", (transport) => {
    it.each(["status", "title", "link", "unlink"])("does not overwrite a real concurrent suite/owner change during a %s edit", async (kind) => {
      const blocker = new Client({ connectionString: url }); await blocker.connect(); await blocker.query("BEGIN");
      await blocker.query("UPDATE testcases SET suite_id = $2, owner_id = $3 WHERE id = $1", [testcaseId, nextRoot, otherOwner]);
      const pid = (await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const f = service(), before = await state();
      const body = kind === "status" ? { status: "Archived" } : kind === "title" ? { title: "Concurrent-safe title" } : kind === "link" ? { jiraIssueKey: "REPO-2", jiraUrl: "https://example.invalid/REPO-2" } : { jiraIssueKey: null, jiraUrl: null };
      const name = kind === "status" ? "archive_testcase" : kind === "link" ? "link_requirement_to_testcase" : kind === "unlink" ? "unlink_requirement_from_testcase" : "update_testcase";
      const writing = (transport === "service" ? f.svc.updateTestCase(testcaseId, owner, body) : f.tool(name, { testcaseId, ...body, ...(kind === "unlink" ? { provider: "jira" } : {}) })).then(() => null, (error: unknown) => error);
      try {
        await waitForBlocker(pid);
        expect(await state()).toEqual(before); expect(f.activity).not.toHaveBeenCalled();
        await blocker.query("COMMIT"); expect(await writing).toBeNull();
        const after = await state();
        expect(after.row).toMatchObject({ suite_id: nextRoot, owner_id: otherOwner, ...Object.fromEntries(Object.entries(body).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])) });
        expect(after.versions.map((row) => row.version)).toEqual([1, 2]);
        expect(after.versions[1].snapshot).toMatchObject({ suite_id: nextRoot, owner_id: otherOwner });
        unchangedOutsideCase(before, after);
      } finally { await blocker.query("ROLLBACK"); await writing; await blocker.end(); }
    }, 15_000);

    it.each(["name", "description", "position"])("preserves a concurrently committed suite parent during a %s-only edit", async (field) => {
      const blocker = new Client({ connectionString: url }); await blocker.connect(); await blocker.query("BEGIN");
      await blocker.query("UPDATE suites SET parent_id = $2 WHERE id = $1", [child, nextRoot]);
      const pid = (await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const f = service(), before = await state(), body = { [field]: field === "position" ? 8 : "Edited text" };
      const writing = (transport === "service" ? f.svc.updateSuite(owner, child, body) : f.tool("update_suite", { suiteId: child, ...body })).then(() => null, (error: unknown) => error);
      try {
        await waitForBlocker(pid); expect(await state()).toEqual(before);
        await blocker.query("COMMIT"); expect(await writing).toBeNull();
        const after = await state();
        expect(after.child).toEqual({ ...before.child, parent_id: nextRoot, ...body, updated_at: expect.any(Date) });
        expect(after.row).toEqual(before.row); expect(after.versions).toEqual(before.versions); expect(after.control).toEqual(before.control);
      } finally { await blocker.query("ROLLBACK"); await writing; await blocker.end(); }
    }, 15_000);
  });

  it("retains explicit reparent/root and text-clearing behavior", async () => {
    const f = service();
    await f.svc.updateSuite(owner, child, { parentId: nextRoot, description: "", preconditions: null });
    expect((await state()).child).toMatchObject({ parent_id: nextRoot, description: "", preconditions: "" });
    await f.tool("update_suite", { suiteId: child, parentId: null });
    expect((await state()).child).toMatchObject({ parent_id: null, description: "", preconditions: "" });
  });

  it("rolls back the completed native testcase write AND trigger history on a late PostgreSQL fault, without effects", async () => {
    let failed = false;
    const observed = observedPool(async (sql, result, raw) => {
      if (!failed && /UPDATE testcases SET/.test(sql)) {
        failed = true; expect(result.rowCount).toBe(1); await raw("SELECT 1 / 0");
      }
    });
    const f = service(observed), before = await state();
    try {
      await expect(f.svc.updateTestCase(testcaseId, owner, { title: "Must roll back", suiteId: null, ownerId: null })).rejects.toMatchObject({ code: "22012" });
      expect(failed).toBe(true); expect(await state()).toEqual(before);
      for (const effect of [f.activity, f.embedding, f.notice, f.suitesInvalidation, f.casesInvalidation]) expect(effect).not.toHaveBeenCalled();
      await f.svc.updateTestCase(testcaseId, owner, { title: "Recovered" });
      expect((await state()).row).toMatchObject({ title: "Recovered", suite_id: root, owner_id: owner });
      expect((await state()).versions).toHaveLength(1); expect(observed.idleCount).toBe(observed.totalCount);
    } finally { await observed.end(); }
  });

  it("rolls back the row and trigger snapshot when the explicit custom-tag collaborator fails late", async () => {
    const f = service(), before = await state();
    f.tags.mockRejectedValueOnce(new Error("Controlled custom-tag collaborator failure"));
    await expect(f.svc.updateTestCase(testcaseId, owner, { status: "Archived", customTagIds: [] })).rejects.toThrow("Controlled custom-tag");
    expect(f.fields).toHaveBeenCalledTimes(1); expect(f.tags).toHaveBeenCalledTimes(1);
    expect(await state()).toEqual(before); expect(f.activity).not.toHaveBeenCalled(); expect(f.embedding).not.toHaveBeenCalled();
  });

  describe.each(["update", "delete"])("bulk %s SQL project scope", (kind) => {
    const bulkState = async () => ({
      cases: (await setup.query("SELECT * FROM testcases WHERE project_id=ANY($1::uuid[]) ORDER BY id", [[projectId, otherProjectId]])).rows,
      versions: (await setup.query("SELECT v.* FROM testcase_versions v JOIN testcases t ON t.id=v.testcase_id WHERE t.project_id=ANY($1::uuid[]) ORDER BY v.testcase_id,v.version", [[projectId, otherProjectId]])).rows,
    });
    async function foreignCase() {
      return (await setup.query("INSERT INTO testcases (project_id,external_id,title) VALUES ($1,$2,'Foreign bulk control') RETURNING id", [otherProjectId, `FOREIGN-${++sequence}`])).rows[0].id as string;
    }
    const invoke = (f: ReturnType<typeof service>, ids: string[]) => kind === "update"
      ? f.svc.bulkUpdateTestCases(projectId, owner, { testcaseIds: ids, priority: "P0", severity: "High" })
      : f.svc.bulkDeleteTestCases(projectId, owner, ids);

    it("only changes active project-owned rows in a mixed, duplicated selection; history and activity use actual affected IDs", async () => {
      const foreign = await foreignCase(), deleted = await seedCase("Previously deleted control");
      await setup.query("UPDATE testcases SET deleted_at=now() WHERE id=$1", [deleted]);
      const before = await bulkState(), f = service();
      await invoke(f, [testcaseId, foreign, deleted, randomUUID(), testcaseId]);
      const after = await bulkState();
      for (const row of before.cases) {
        const actual = after.cases.find((item) => item.id === row.id);
        if (row.id !== testcaseId) expect(actual).toEqual(row);
        else expect(actual).toEqual({ ...row, ...(kind === "update" ? { priority: "P0", severity: "High" } : { deleted_at: expect.any(Date), deleted_by: owner }), updated_by: owner, updated_at: expect.any(Date) });
        const oldHistory = before.versions.filter((version) => version.testcase_id === row.id);
        const newHistory = after.versions.filter((version) => version.testcase_id === row.id);
        expect(newHistory.slice(0, oldHistory.length)).toEqual(oldHistory);
        expect(newHistory).toHaveLength(oldHistory.length + (row.id === testcaseId ? 1 : 0));
        if (row.id === testcaseId) expect(newHistory.at(-1)).toMatchObject({ changed_by: owner, snapshot: expect.objectContaining({ suite_id: root, owner_id: owner, title: row.title }) });
      }
      expect(f.activity.mock.calls[0][6]).toMatchObject({ testcaseIds: [testcaseId], requestedCount: 5 });
    });

    it.each(["foreign", "unknown", "deleted", "empty"])("keeps %s-only selections as non-disclosing no-ops", async (selection) => {
      const foreign = await foreignCase();
      if (selection === "deleted") await setup.query("UPDATE testcases SET deleted_at=now() WHERE id=$1", [testcaseId]);
      const ids = selection === "foreign" ? [foreign] : selection === "unknown" ? [randomUUID()] : selection === "deleted" ? [testcaseId] : [];
      const before = await bulkState(), f = service(); await invoke(f, ids);
      expect(await bulkState()).toEqual(before);
      if (!ids.length) expect(f.activity).not.toHaveBeenCalled();
      else expect(f.activity.mock.calls[0][6]).toMatchObject({ testcaseIds: [], requestedCount: 1 });
    });

    it("does not commit a prefix or produce activity when the existing UUID cast fails", async () => {
      const before = await bulkState(), f = service();
      await expect(invoke(f, [testcaseId, "not-a-uuid"])).rejects.toMatchObject({ code: "22P02" });
      expect(await bulkState()).toEqual(before); expect(f.activity).not.toHaveBeenCalled();
      expect(f.suitesInvalidation).not.toHaveBeenCalled(); expect(f.casesInvalidation).not.toHaveBeenCalled();
    });

    it("rolls back the completed SQL statement and its history when an AFTER-statement trigger fails", async () => {
      const name = `bulk_fault_${randomUUID().replace(/-/g, "")}`;
      const before = await bulkState(), f = service();
      // Disposable CI only. The AFTER STATEMENT trigger observes both row/history writes before
      // raising, so this is a late database fault, not a mock or a post-COMMIT exception.
      await setup.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM testcase_versions WHERE testcase_id='${testcaseId}'::uuid) THEN
            RAISE EXCEPTION 'bulk fault did not observe history';
          END IF;
          RAISE EXCEPTION 'controlled bulk statement fault';
        END $$`);
      await setup.query(`CREATE TRIGGER ${name} AFTER UPDATE ON testcases FOR EACH STATEMENT EXECUTE FUNCTION ${name}()`);
      try {
        await expect(invoke(f, [testcaseId, control])).rejects.toMatchObject({ code: "P0001", message: "controlled bulk statement fault" });
        expect(await bulkState()).toEqual(before); expect(f.activity).not.toHaveBeenCalled();
        expect(f.suitesInvalidation).not.toHaveBeenCalled(); expect(f.casesInvalidation).not.toHaveBeenCalled();
      } finally {
        await setup.query(`DROP TRIGGER ${name} ON testcases`); await setup.query(`DROP FUNCTION ${name}()`);
      }
    });
  });

  it("bulk update keeps blank-field omission and the existing explicit unassign sentinel", async () => {
    const f = service(), before = await state();
    await f.svc.bulkUpdateTestCases(projectId, owner, { testcaseIds: [testcaseId], suiteId: "none", priority: "", severity: "" });
    const after = await state();
    expect(after.row).toEqual({ ...before.row, suite_id: null, updated_by: owner, updated_at: expect.any(Date) });
    expect(after.versions).toHaveLength(before.versions.length + 1);
    unchangedOutsideCase(before, after);
  });

  it("authorized bulk-create retains two-row persistence, fields, attribution and unselected history", async () => {
    const f = service(), before = await state();
    const result = await f.svc.bulkCreateTestCases(projectId, owner, { testcases: [
      { title: "Native bulk first", externalId: `NB-${randomUUID().slice(0, 8)}`, suiteId: root, priority: "P0", customFieldValues: { retained: "value" } },
      { title: "Native bulk second", externalId: `NB-${randomUUID().slice(0, 8)}`, suiteId: nextRoot, priority: "P1" },
    ] });
    expect(result.createdCount).toBe(2); expect(result.created).toHaveLength(2);
    expect(result.created.map((row) => row.title).sort()).toEqual(["Native bulk first", "Native bulk second"]);
    const rows = (await setup.query("SELECT * FROM testcases WHERE id=ANY($1::uuid[]) ORDER BY title", [result.created.map((row) => row.id)])).rows;
    expect(rows.map((row) => [row.suite_id, row.priority, row.created_by, row.updated_by])).toEqual([[root, "P0", owner, owner], [nextRoot, "P1", owner, owner]]);
    expect(f.fields).toHaveBeenCalledTimes(1); expect(f.activity).toHaveBeenCalledTimes(1);
    expect(await state()).toEqual(before);
  });

  it("rolls back the completed native bulk INSERT if the later custom-field collaborator refuses", async () => {
    const f = service(), before = (await setup.query("SELECT * FROM testcases WHERE project_id=$1 ORDER BY id", [projectId])).rows;
    f.fields.mockRejectedValueOnce(new Error("Controlled bulk-create field fault"));
    await expect(f.svc.bulkCreateTestCases(projectId, owner, { testcases: [
      { title: "Must roll back first", suiteId: root, customFieldValues: { late: true } }, { title: "Must roll back second" },
    ] })).rejects.toThrow("Controlled bulk-create field fault");
    expect(f.fields).toHaveBeenCalledTimes(1); expect(f.activity).not.toHaveBeenCalled();
    expect(f.suitesInvalidation).not.toHaveBeenCalled(); expect(f.casesInvalidation).not.toHaveBeenCalled();
    expect((await setup.query("SELECT * FROM testcases WHERE project_id=$1 ORDER BY id", [projectId])).rows).toEqual(before);
  });

  it("authorized empty bulk-create remains a write/effect-free response", async () => {
    const f = service(), before = await state();
    expect(await f.svc.bulkCreateTestCases(projectId, owner, { testcases: [] })).toEqual({ created: [], createdCount: 0 });
    expect(await state()).toEqual(before); expect(f.activity).not.toHaveBeenCalled(); expect(f.fields).not.toHaveBeenCalled();
    expect(f.suitesInvalidation).not.toHaveBeenCalled(); expect(f.casesInvalidation).not.toHaveBeenCalled();
  });

  describe.each(["create", "update", "bulk-create", "bulk-update"])("%s suite reference boundary", (writer) => {
    it.each(["foreign", "deleted", "missing", "malformed"])("refuses a %s suite without changing records, history or effects", async (kind) => {
      const target = kind === "foreign"
        ? (await setup.query("INSERT INTO suites (project_id,name) VALUES ($1,'Private suite') RETURNING id", [otherProjectId])).rows[0].id
        : kind === "deleted"
          ? (await setup.query("INSERT INTO suites (project_id,name,deleted_at) VALUES ($1,'Deleted suite',now()) RETURNING id", [projectId])).rows[0].id
          : kind === "missing" ? randomUUID() : "not-a-suite-id";
      const snapshot = async () => ({
        cases: (await setup.query("SELECT * FROM testcases WHERE project_id=ANY($1::uuid[]) ORDER BY id", [[projectId, otherProjectId]])).rows,
        history: (await setup.query("SELECT v.* FROM testcase_versions v JOIN testcases t ON t.id=v.testcase_id WHERE t.project_id=ANY($1::uuid[]) ORDER BY v.testcase_id,v.version", [[projectId, otherProjectId]])).rows,
        suites: (await setup.query("SELECT * FROM suites WHERE project_id=ANY($1::uuid[]) ORDER BY id", [[projectId, otherProjectId]])).rows,
      });
      const before = await snapshot(), f = service();
      const body = { suiteId: target, title: "Must not write an invalid suite" };
      const writing = writer === "create" ? f.svc.createTestCase(projectId, owner, body)
        : writer === "update" ? f.svc.updateTestCase(testcaseId, owner, body)
          : writer === "bulk-create" ? f.svc.bulkCreateTestCases(projectId, owner, { testcases: [{ title: "Valid prefix", suiteId: root }, body] })
            : f.svc.bulkUpdateTestCases(projectId, owner, { testcaseIds: [testcaseId, control], suiteId: target, priority: "P0" });
      await expect(writing).rejects.toMatchObject({ response: { error: "suiteId must reference an active suite in this project" }, status: 400 });
      expect(await snapshot()).toEqual(before);
      for (const effect of [f.fields, f.tags, f.activity, f.embedding, f.notice, f.suitesInvalidation, f.casesInvalidation]) expect(effect).not.toHaveBeenCalled();
    });
  });
});
