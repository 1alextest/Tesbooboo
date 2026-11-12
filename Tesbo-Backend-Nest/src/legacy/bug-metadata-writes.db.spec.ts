import { randomUUID } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { Client, Pool, type QueryResult } from "pg";
import { DatabaseService } from "../database/database.service";
import { buildMcpTools } from "../mcp/mcp.tools";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const url = process.env.DATABASE_URL ?? "";
type RawQuery = (sql: string, values?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
const fields = [
  ["description", "description"], ["externalUrl", "external_url"],
  ["integrationProvider", "integration_provider"], ["integrationIssueKey", "integration_issue_key"], ["betterbugsUrl", "betterbugs_url"],
] as const;

(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("bug metadata writes — migrated PostgreSQL", () => {
  let setup: Client, pool: Pool, projectId: string, testcaseId: string, bugId: string, controlId: string;
  const owner = randomUUID(), other = randomUUID(), stamp = randomUUID();
  beforeAll(async () => {
    setup = new Client({ connectionString: url }); await setup.connect();
    pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
    await setup.query("INSERT INTO users (id,email,name) VALUES ($1,$2,'Bug editor'),($3,$4,'Other editor')", [owner, `bug-edit-${stamp}@tesbo.invalid`, other, `bug-other-${stamp}@tesbo.invalid`]);
    const org = (await setup.query<{ id: string }>("INSERT INTO organizations (name,slug) VALUES ('Bug edit CI',$1) RETURNING id", [`bug-edit-${stamp}`])).rows[0].id;
    projectId = (await setup.query<{ id: string }>("INSERT INTO projects (organization_id,key,name) VALUES ($1,'BUGEDIT','Bug edit CI') RETURNING id", [org])).rows[0].id;
    await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner'),($1,$3,'qa_engineer')", [projectId, owner, other]);
    testcaseId = (await setup.query<{ id: string }>("INSERT INTO testcases (project_id,external_id,title) VALUES ($1,'BUGEDIT-TC-1','Linked case') RETURNING id", [projectId])).rows[0].id;
    controlId = await seed("Unselected bug");
  });
  beforeEach(async () => {
    bugId = await seed("Original bug");
    await setup.query("INSERT INTO bug_links (bug_id,testcase_id) VALUES ($1,$2)", [bugId, testcaseId]);
    await setup.query("INSERT INTO bug_comments (project_id,bug_id,author_id,body) VALUES ($1,$2,$3,'Keep discussion')", [projectId, bugId, owner]);
    await setup.query("INSERT INTO attachments (project_id,entity_type,entity_id,file_name,content_type,file_size,storage_path,uploaded_by) VALUES ($1,'bug',$2,'keep.txt','text/plain',4,'ci/bug-edit/keep',$3)", [projectId, bugId, owner]);
  });
  afterAll(async () => { await pool?.end(); await setup?.end(); }); // Preserve fixture/audit provenance until CI teardown.
  async function seed(title: string) {
    return (await setup.query<{ id: string }>(
      `INSERT INTO bugs (project_id,title,description,external_url,integration_provider,integration_issue_key,betterbugs_url,reported_by,assignee_id,priority,severity)
       VALUES ($1,$2,'Original description','https://example.invalid/BUG-1','JIRA','BUG-1','https://example.invalid/session',$3,$3,'P2','Medium') RETURNING id`, [projectId, title, owner]
    )).rows[0].id;
  }
  const state = async () => ({
    bug: (await setup.query("SELECT * FROM bugs WHERE id = $1", [bugId])).rows[0],
    links: (await setup.query("SELECT * FROM bug_links WHERE bug_id = $1 ORDER BY id", [bugId])).rows,
    comments: (await setup.query("SELECT * FROM bug_comments WHERE bug_id = $1 ORDER BY id", [bugId])).rows,
    attachments: (await setup.query("SELECT * FROM attachments WHERE entity_id = $1 ORDER BY id", [bugId])).rows,
    audit: (await setup.query("SELECT * FROM audit_logs WHERE entity_id = $1 ORDER BY created_at,id", [bugId])).rows,
    control: (await setup.query("SELECT * FROM bugs WHERE id = $1", [controlId])).rows[0],
    testcase: (await setup.query("SELECT * FROM testcases WHERE id = $1", [testcaseId])).rows[0],
  });
  function service(dbPool = pool) {
    const db = new DatabaseService(dbPool), svc = makeLegacy(db);
    // Access is stubbed here, NOT HTTP authorization; activity INSERTs and all bug/link reads/writes are real.
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const notice = jest.spyOn(svc as unknown as { notifyBugChange: (...args: unknown[]) => Promise<void> }, "notifyBugChange").mockResolvedValue(undefined);
    const tool = (args: Record<string, unknown>) => buildMcpTools().find((item) => item.name === "update_bug")!.handler({ bugId, ...args }, { db, legacy: svc, projectId, userId: owner, actorId: owner, scopes: ["read", "write"] });
    return { svc, notice, tool };
  }
  function observedPool(hook: (sql: string, result: QueryResult<Record<string, unknown>>, raw: RawQuery) => Promise<void>) {
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
  async function blockedBy(pid: number) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if ((await setup.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))", [pid])).rowCount) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Bug edit did not wait behind PostgreSQL backend ${pid}`);
  }
  function unchangedAssociations(before: Awaited<ReturnType<typeof state>>, after: Awaited<ReturnType<typeof state>>) {
    for (const key of ["links", "comments", "attachments", "control", "testcase"] as const) expect(after[key]).toEqual(before[key]);
    expect(after.audit.slice(0, before.audit.length)).toEqual(before.audit);
  }
  function gate() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return {
      resolve,
      wait: async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([promise, new Promise<never>((_done, reject) => {
            timer = setTimeout(() => reject(new Error("Bug edit database barrier was not reached/released")), 5_000);
          })]);
        } finally { if (timer) clearTimeout(timer); }
      }
    };
  }

  describe.each(fields)("%s", (field, column) => {
    it.each([null, "", "Replacement text"])("persists explicit %j without changing omitted metadata, links, comments or evidence", async (value) => {
      const before = await state(), f = service();
      const result = await f.svc.updateBug(owner, bugId, { [field]: value });
      const after = await state();
      expect(result).toMatchObject({ [field]: value });
      expect(after.bug).toEqual({ ...before.bug, [column]: value, updated_at: expect.any(Date) });
      unchangedAssociations(before, after);
      expect(after.audit.slice(before.audit.length)).toEqual([expect.objectContaining({ action: "bug_updated", actor_id: owner, diff: { fields: [field] } })]);
    });
  });

  it("preserves undefined and omitted fields and does not create false activity on a no-op", async () => {
    const f = service(), before = await state();
    await f.svc.updateBug(owner, bugId, Object.fromEntries(fields.map(([field]) => [field, undefined])));
    const after = await state();
    expect(after.bug).toEqual({ ...before.bug, updated_at: expect.any(Date) }); unchangedAssociations(before, after);
    expect(after.audit).toEqual(before.audit);
  });

  it.each(["service", "MCP registry"])("%s preserves concurrently committed metadata and attributes only its own change after a real row-lock wait", async (transport) => {
    const blocker = new Client({ connectionString: url }); await blocker.connect(); await blocker.query("BEGIN");
    await blocker.query("UPDATE bugs SET title='Concurrent title',status='In Progress',assignee_id=$2,external_url='https://example.invalid/new' WHERE id=$1", [bugId, other]);
    const pid = (await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const before = await state(), f = service();
    const writing = (transport === "service" ? f.svc.updateBug(owner, bugId, { description: "" }) : f.tool({ description: "" })).then((result) => ({ result }), (error: unknown) => ({ error }));
    try {
      await blockedBy(pid); expect(await state()).toEqual(before); expect(f.notice).not.toHaveBeenCalled();
      await blocker.query("COMMIT");
      const outcome = await writing; expect(outcome).not.toHaveProperty("error");
      const after = await state();
      expect(after.bug).toMatchObject({ title: "Concurrent title", status: "In Progress", assignee_id: other, external_url: "https://example.invalid/new", description: "" });
      unchangedAssociations(before, after);
      expect(after.audit).toEqual([expect.objectContaining({ action: "bug_updated", diff: { fields: ["description"] } })]);
      expect(f.notice).toHaveBeenCalledWith(projectId, owner, expect.objectContaining({ title: "Concurrent title", status: "In Progress", assigneeId: other }), expect.objectContaining({ description: "", assigneeId: other }));
    } finally { await blocker.query("ROLLBACK"); await writing; await blocker.end(); }
  }, 15_000);

  it.each(["metadata update", "post-link readback"])("rolls back the actual %s and links after a late native SQL fault, with audit/effects unchanged", async (stage) => {
    let injected = false, reads = 0;
    const observed = observedPool(async (sql, result, raw) => {
      if (/SELECT b\.\*/.test(sql)) reads++;
      if (!injected && (stage === "metadata update" ? /UPDATE bugs SET/.test(sql) : /SELECT b\.\*/.test(sql) && reads === 2)) {
        injected = true; if (stage === "metadata update") expect(result.rowCount).toBe(1);
        expect((await raw("SELECT description,external_url FROM bugs WHERE id=$1", [bugId])).rows[0]).toMatchObject({ description: null, external_url: null });
        if (stage === "post-link readback") expect((await raw("SELECT * FROM bug_links WHERE bug_id=$1 AND deleted_at IS NULL", [bugId])).rowCount).toBe(0);
        await raw("SELECT 1 / 0");
      }
    });
    const f = service(observed), before = await state(), body = { description: null, externalUrl: null, links: [] };
    try {
      await expect(f.svc.updateBug(owner, bugId, body)).rejects.toMatchObject({ code: "22012" });
      expect(injected).toBe(true); expect(await state()).toEqual(before); expect(f.notice).not.toHaveBeenCalled();
      await f.svc.updateBug(owner, bugId, body);
      const after = await state(); expect(after.bug).toMatchObject({ description: null, external_url: null });
      expect(after.links[0].deleted_at).not.toBeNull(); expect(after.comments).toEqual(before.comments); expect(after.attachments).toEqual(before.attachments);
      expect(observed.idleCount).toBe(observed.totalCount);
    } finally { await observed.end(); }
  });

  it("keeps pending metadata/link changes invisible until COMMIT and starts effects afterward", async () => {
    const ready = gate(), release = gate(); let paused = false;
    const observed = observedPool(async (sql) => { if (!paused && /UPDATE bugs SET/.test(sql)) { paused = true; ready.resolve(); await release.wait(); } });
    const before = await state(), f = service(observed);
    const writing = f.svc.updateBug(owner, bugId, { betterbugsUrl: null, links: [] });
    try {
      await Promise.race([ready.wait(), writing.then(() => { throw new Error("No update barrier reached"); })]);
      expect(await state()).toEqual(before); expect(f.notice).not.toHaveBeenCalled();
      release.resolve(); await writing;
      const after = await state(); expect(after.bug.betterbugs_url).toBeNull(); expect(after.links[0].deleted_at).not.toBeNull();
      expect(after.audit).toHaveLength(1); expect(f.notice).toHaveBeenCalledTimes(1);
    } finally { release.resolve(); await writing.catch(() => undefined); await observed.end(); }
  });

  it("captures its own return value and activity before a later committed writer can contaminate the readback", async () => {
    const committed = gate(), release = gate(); let paused = false;
    const observed = observedPool(async (sql) => { if (!paused && sql === "COMMIT") { paused = true; committed.resolve(); await release.wait(); } });
    const f = service(observed), writing = f.svc.updateBug(owner, bugId, { description: "First committed body" });
    try {
      await Promise.race([committed.wait(), writing.then(() => { throw new Error("No commit barrier reached"); })]);
      await service().svc.updateBug(other, bugId, { title: "Later title", status: "Closed" });
      release.resolve(); const result = await writing;
      expect(result).toMatchObject({ title: "Original bug", status: "Open", description: "First committed body" });
      expect((await state()).bug).toMatchObject({ title: "Later title", status: "Closed", description: "First committed body" });
      expect((await state()).audit.filter((row) => row.actor_id === owner)).toEqual([expect.objectContaining({ action: "bug_updated", diff: { fields: ["description"] } })]);
      expect(f.notice).toHaveBeenCalledWith(projectId, owner, expect.objectContaining({ title: "Original bug", status: "Open" }), expect.objectContaining({ title: "Original bug", status: "Open" }));
    } finally { release.resolve(); await writing.catch(() => undefined); await observed.end(); }
  });

  it.each([{ externalUrl: "x".repeat(1025) }, { description: null, links: [{ testcaseId: "malformed" }] }])("refuses invalid edits without a metadata/audit prefix: %j", async (body) => {
    const before = await state(); await expect(service().svc.updateBug(owner, bugId, body)).rejects.toBeInstanceOf(BadRequestException); expect(await state()).toEqual(before);
  });
});
