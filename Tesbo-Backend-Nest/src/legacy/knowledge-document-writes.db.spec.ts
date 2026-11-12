import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Client, Pool, type QueryResult } from "pg";
import { DatabaseService } from "../database/database.service";
import { summarizeDocumentChange } from "../common/text-diff.util";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const url = process.env.DATABASE_URL ?? "";
const enabled = /\/tesbo_ci(?:\?|$)/.test(url);
const json = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
type RawQuery = (sql: string, values?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
type Hook = (sql: string, values: unknown[], result: QueryResult<Record<string, unknown>>, raw: RawQuery) => Promise<void>;

(enabled ? describe : describe.skip)("knowledge document writes — migrated PostgreSQL", () => {
  let setup: Client;
  let pool: Pool;
  let projectId: string;
  let orgId: string;
  let folderId: string;
  let documentId: string;
  let otherDocumentId: string;
  const actor = randomUUID();
  const other = randomUUID();
  const stamp = randomUUID();

  beforeAll(async () => {
    setup = new Client({ connectionString: url });
    await setup.connect();
    pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
    await setup.query("INSERT INTO users (id, email, name) VALUES ($1,$2,'KB writer'),($3,$4,'Other KB author')", [actor, `kb-writer-${stamp}@tesbo.invalid`, other, `kb-other-${stamp}@tesbo.invalid`]);
    orgId = (await setup.query<{ id: string }>("INSERT INTO organizations (name, slug) VALUES ('KB writer CI',$1) RETURNING id", [`kb-writer-${stamp}`])).rows[0].id;
    projectId = (await setup.query<{ id: string }>("INSERT INTO projects (organization_id, key, name) VALUES ($1,'KBWRITE','KB writer CI') RETURNING id", [orgId])).rows[0].id;
    await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [projectId, actor]);
    folderId = (await setup.query<{ id: string }>("INSERT INTO knowledge_folders (organization_id,project_id,name,is_root) VALUES ($1,$2,'Knowledge base',true) RETURNING id", [orgId, projectId])).rows[0].id;
    otherDocumentId = await seedDocument("Unselected document");
  });
  afterAll(async () => {
    // Keep these isolated synthetic records and audit provenance until the disposable service's
    // teardown. No historical cleanup or immutable-audit deletion is part of these regressions.
    await pool?.end();
    await setup?.end();
  });
  beforeEach(async () => {
    documentId = await seedDocument("Initial title");
    await setup.query("UPDATE project_members SET role = 'owner' WHERE project_id = $1 AND user_id = $2", [projectId, actor]);
  });

  async function seedDocument(title: string) {
    return (await setup.query<{ id: string }>(
      `INSERT INTO knowledge_documents (organization_id,project_id,folder_id,title,content_json,content_html,content_text,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,'<p>Initial body</p>','Initial body',$6,$6) RETURNING id`,
      [orgId, projectId, folderId, title, JSON.stringify(json("Initial body")), actor]
    )).rows[0].id;
  }
  async function seedVersion(id = documentId, title = "Earlier title", text = "Earlier body") {
    return (await setup.query<{ id: string }>(
      `INSERT INTO knowledge_document_versions (document_id,version_number,title,content_json,content_html,content_text,created_by)
       VALUES ($1,1,$2,$3::jsonb,$4,$5,$6) RETURNING id`, [id, title, JSON.stringify(json(text)), `<p>${text}</p>`, text, actor]
    )).rows[0].id;
  }
  const state = async () => ({
    doc: (await setup.query("SELECT * FROM knowledge_documents WHERE id = $1", [documentId])).rows[0],
    versions: (await setup.query("SELECT * FROM knowledge_document_versions WHERE document_id = $1 ORDER BY version_number", [documentId])).rows,
    other: (await setup.query("SELECT * FROM knowledge_documents WHERE id = $1", [otherDocumentId])).rows[0]
  });
  function service(dbPool = pool) {
    const svc = makeLegacy(new DatabaseService(dbPool));
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const activity = jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    const internals = svc as unknown as { enqueueEmbedding: (...args: unknown[]) => void; notifyKnowledgeItem: (...args: unknown[]) => Promise<void> };
    const embedding = jest.spyOn(internals, "enqueueEmbedding").mockReturnValue(undefined);
    const notice = jest.spyOn(internals, "notifyKnowledgeItem").mockResolvedValue(undefined);
    return { svc, activity, embedding, notice };
  }
  function observedPool(hook: Hook) {
    const observed = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 3000 });
    observed.on("connect", (client) => {
      const raw = client.query.bind(client) as RawQuery;
      type Callback = (error: Error | null, result?: QueryResult) => void;
      client.query = ((sql: string, valuesOrCallback?: unknown[] | Callback, callback?: Callback) => {
        const values = Array.isArray(valuesOrCallback) ? valuesOrCallback : [];
        const done = typeof valuesOrCallback === "function" ? valuesOrCallback : callback;
        const pending = raw(sql, values).then(async (result) => { await hook(sql, values, result, raw); return result; });
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
    throw new Error(`No PostgreSQL writer waited behind ${pid}`);
  }
  const update = (svc: ReturnType<typeof service>["svc"], text = "Saved body") => svc.updateKnowledgeDocument(projectId, actor, documentId, { contentJson: json(text), contentHtml: `<p>${text}</p>`, contentText: text });

  it.each(["new snapshot", "coalesced diff", "restore"])("rolls back the complete %s and actual document UPDATE after a late native SQL fault", async (kind) => {
    const versionId = kind === "new snapshot" ? "" : await seedVersion();
    const before = await state();
    let completedUpdate = false, failed = false;
    const observed = observedPool(async (sql, _values, _result, raw) => {
      if (!failed && /UPDATE knowledge_documents SET title/.test(sql)) {
        completedUpdate = true; failed = true;
        await raw("SELECT 1 / 0"); // A real PG error AFTER the production row write completed.
      }
    });
    const f = service(observed);
    try {
      const call = () => kind === "restore" ? f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId }) : update(f.svc);
      await expect(call()).rejects.toMatchObject({ code: "22012" });
      expect(completedUpdate).toBe(true);
      expect(await state()).toEqual(before); // Includes the prior diff, JSON and every timestamp.
      expect(f.activity).not.toHaveBeenCalled(); expect(f.embedding).not.toHaveBeenCalled(); expect(f.notice).not.toHaveBeenCalled();
      const result = await call();
      expect(result.contentText).toBe(kind === "restore" ? "Earlier body" : "Saved body");
      expect(f.activity).toHaveBeenCalledTimes(1);
      expect(f.embedding).toHaveBeenCalledTimes(1);
      expect(observed.idleCount).toBe(observed.totalCount);
    } finally { await observed.end(); }
  });

  it("keeps snapshot and live row invisible to independent readers until the same COMMIT, then starts effects", async () => {
    let reached!: () => void, resume!: () => void;
    const didWrite = new Promise<void>((resolve) => { reached = resolve; });
    const mayCommit = new Promise<void>((resolve) => { resume = resolve; });
    let paused = false;
    const observed = observedPool(async (sql) => {
      if (!paused && /UPDATE knowledge_documents SET title/.test(sql)) { paused = true; reached(); await mayCommit; }
    });
    const f = service(observed), before = await state();
    f.activity.mockImplementation(async () => {
      const committed = await state();
      expect(committed.doc.content_text).toBe("Saved body");
      expect(committed.versions).toHaveLength(1);
    });
    const writing = update(f.svc);
    try {
      await Promise.race([didWrite, writing.then(() => { throw new Error("No write barrier reached"); })]);
      expect(await state()).toEqual(before);
      expect(f.activity).not.toHaveBeenCalled(); expect(f.embedding).not.toHaveBeenCalled();
      resume(); await writing;
      expect(f.activity).toHaveBeenCalledTimes(1);
    } finally { resume(); await writing.catch(() => undefined); await observed.end(); }
  });

  it.each(["edit/edit", "edit/restore", "restore/edit", "restore/restore"])("serializes actual %s writers using fresh locked content and the existing version sequence", async (kind) => {
    const versionId = kind === "edit/edit" ? "" : await seedVersion();
    const [firstKind, secondKind] = kind.split("/");
    let reached!: () => void, resume!: () => void;
    const didLock = new Promise<void>((resolve) => { reached = resolve; });
    const mayWrite = new Promise<void>((resolve) => { resume = resolve; });
    let pid = 0, paused = false;
    const observed = observedPool(async (sql, _values, _result, raw) => {
      if (!paused && /FROM knowledge_documents/.test(sql) && /FOR UPDATE/.test(sql)) {
        paused = true; pid = Number((await raw("SELECT pg_backend_pid() AS pid")).rows[0].pid); reached(); await mayWrite;
      }
    });
    const f = service(observed), g = service(), before = await state();
    const first = firstKind === "restore" ? f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId }) : update(f.svc, "First saved body");
    let second: Promise<unknown> | undefined;
    try {
      await Promise.race([didLock, first.then(() => { throw new Error("No lock barrier reached"); })]);
      second = secondKind === "restore" ? g.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId }) : g.svc.updateKnowledgeDocument(projectId, actor, documentId, { title: "Latest title" });
      await waitForBlocker(pid);
      expect(await state()).toEqual(before);
      resume(); await first; await second;
      const after = await state();
      expect(after.other).toEqual(before.other);
      expect(after.doc.content_text).toBe(secondKind === "restore" || firstKind === "restore" ? "Earlier body" : "First saved body");
      expect(after.doc.title).toBe(secondKind === "restore" ? "Earlier title" : "Latest title");
      expect(after.versions.map((row) => row.version_number)).toEqual(kind === "edit/edit" ? [1] : [1, 2]);
      if (kind === "edit/edit") {
        expect(after.versions[0].content_text).toBe("Initial body");
        const diff = summarizeDocumentChange({ title: "Initial title", contentText: "Initial body" }, { title: "Latest title", contentText: "First saved body" });
        expect(after.versions[0]).toMatchObject({ changed_summary: diff.summary, changed_fields: diff.fields });
      }
      if (kind === "edit/restore") expect(after.versions[1].content_text).toBe("First saved body");
      if (kind === "restore/edit") expect(after.versions[1].content_text).toBe("Initial body");
      if (kind === "restore/restore") expect(g.embedding).not.toHaveBeenCalled();
    } finally { resume(); await first.catch(() => undefined); if (second) await second.catch(() => undefined); await observed.end(); }
  }, 15_000);

  it.each(["edit", "restore"])("refuses read-only mirrors for %s without changing document/history or emitting effects", async (kind) => {
    const versionId = await seedVersion();
    await setup.query("UPDATE knowledge_documents SET is_read_only = true, source_provider = 'notion' WHERE id = $1", [documentId]);
    const f = service(), before = await state();
    await expect(kind === "restore" ? f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId }) : update(f.svc)).rejects.toBeInstanceOf(BadRequestException);
    expect(await state()).toEqual(before);
    expect(f.activity).not.toHaveBeenCalled(); expect(f.embedding).not.toHaveBeenCalled();
  });

  describe.each(["edit", "restore"])("locked %s policy", (kind) => {
    it.each(["read-only", "deleted", "changed author", "managed memory"])("rechecks %s after waiting on the real lock", async (policy) => {
      const versionId = await seedVersion();
      if (policy === "changed author") await setup.query("UPDATE project_members SET role = 'qa_engineer' WHERE project_id = $1 AND user_id = $2", [projectId, actor]);
      const blocker = new Client({ connectionString: url }); await blocker.connect();
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`kb-doc-version:${documentId}`]);
      const pid = (await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const f = service();
      const writing = (kind === "restore" ? f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId }) : update(f.svc)).then(() => null, (error: unknown) => error);
      try {
        await waitForBlocker(pid);
        const assignments = policy === "read-only" ? "is_read_only = true" : policy === "deleted" ? "is_deleted = true" : policy === "managed memory" ? "title = 'Zyra AI Memory'" : "created_by = $2";
        await blocker.query(`UPDATE knowledge_documents SET ${assignments} WHERE id = $1`, policy === "changed author" ? [documentId, other] : [documentId]);
        const expected = (await blocker.query("SELECT * FROM knowledge_documents WHERE id = $1", [documentId])).rows[0];
        const before = await state();
        await blocker.query("COMMIT");
        expect(await writing).toBeInstanceOf(policy === "read-only" || policy === "managed memory" ? BadRequestException : policy === "deleted" ? NotFoundException : ForbiddenException);
        expect(await state()).toEqual({ ...before, doc: expected });
        expect(f.activity).not.toHaveBeenCalled(); expect(f.embedding).not.toHaveBeenCalled(); expect(f.notice).not.toHaveBeenCalled();
      } finally { await blocker.query("ROLLBACK"); await writing; await blocker.end(); }
    }, 15_000);
  });

  it.each(["malformed", "foreign"])("rejects a %s restore target with full persisted state unchanged", async (kind) => {
    const versionId = kind === "foreign" ? await seedVersion(otherDocumentId) : "not-a-uuid";
    const f = service(), before = await state();
    await expect(f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId })).rejects.toBeInstanceOf(NotFoundException);
    expect(await state()).toEqual(before); expect(f.activity).not.toHaveBeenCalled();
  });

  it("snapshots a JSON-only body edit and resets existing AI approval; key reordering alone does neither", async () => {
    await setup.query("UPDATE knowledge_documents SET document_type = 'ai_memory', status = 'approved', reviewed_by = $2, reviewed_at = now(), content_json = $3::jsonb WHERE id = $1", [documentId, actor, JSON.stringify({ type: "doc", content: [] })]);
    const f = service(), initial = await state();
    await f.svc.updateKnowledgeDocument(projectId, actor, documentId, { contentJson: { content: [], type: "doc" } });
    expect((await state()).versions).toHaveLength(0);
    expect((await state()).doc).toMatchObject({ status: "approved", reviewed_by: actor, reviewed_at: initial.doc.reviewed_at });
    await f.svc.updateKnowledgeDocument(projectId, actor, documentId, { contentJson: json("JSON-only change") });
    const changed = await state();
    expect(changed.doc).toMatchObject({ status: "draft", reviewed_by: null, reviewed_at: null, content_text: "Initial body" });
    expect(changed.versions).toHaveLength(1);
    expect(changed.versions[0].content_json).toEqual({ type: "doc", content: [] });
    expect(f.embedding).toHaveBeenCalledTimes(1);
  });

  it("applies the same approved-AI body-change rule to restores, while preserving explicit no-op restore behavior", async () => {
    const versionId = await seedVersion();
    await setup.query("UPDATE knowledge_documents SET document_type = 'ai_memory', status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [documentId, actor]);
    const f = service();
    await f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId });
    expect((await state()).doc).toMatchObject({ status: "draft", reviewed_by: null, reviewed_at: null, content_text: "Earlier body" });
    await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [documentId, actor]);
    await f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId });
    expect((await state()).doc).toMatchObject({ status: "approved", reviewed_by: actor });
    expect((await state()).versions).toHaveLength(2);
    expect(f.embedding).toHaveBeenCalledTimes(1);
  });

  it("preserves existing JSON false values rather than silently replacing them with null", async () => {
    await setup.query("UPDATE knowledge_documents SET content_json = 'false'::jsonb WHERE id = $1", [documentId]);
    const f = service();
    await f.svc.updateKnowledgeDocument(projectId, actor, documentId, { title: "Renamed" });
    const first = await state();
    expect(first.doc.content_json).toBe(false); expect(first.versions[0].content_json).toBe(false);
    await update(f.svc);
    await f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId: first.versions[0].id });
    expect((await state()).doc.content_json).toBe(false);
  });

  it("retains the existing snapshot window and starts a new version only when that window is stale", async () => {
    const f = service(); await update(f.svc, "First edit");
    await update(f.svc, "Coalesced edit");
    expect((await state()).versions).toHaveLength(1);
    await setup.query("UPDATE knowledge_document_versions SET created_at = now() - interval '1 day' WHERE document_id = $1", [documentId]);
    await update(f.svc, "New window");
    const after = await state();
    expect(after.versions.map((row) => row.version_number)).toEqual([1, 2]);
    expect(after.versions[1].content_text).toBe("Coalesced edit");
  });
});
