import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Client, Pool, type QueryResult } from "pg";
import { DatabaseService } from "../database/database.service";
import { summarizeDocumentChange } from "../common/text-diff.util";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { RagRetrievalService } from "../rag/rag-retrieval.service";
import * as ragAiAllocation from "../rag/rag-ai-allocation";
import { RAG_EMBEDDING_DIMENSION } from "../rag/rag.constants";

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
    await setup.query("INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'owner')", [orgId, actor]);
    await setup.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [actor, orgId]);
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
      } finally {
        await blocker.query("ROLLBACK"); await writing;
        // The committed out-of-band rename above is the evidence this test needs, but the title is
        // how Zyra identifies its memory document: leaving it in place would hand every later test
        // in this shared project a second, newer "Zyra AI Memory" holding this fixture's body.
        if (policy === "managed memory") await setup.query("UPDATE knowledge_documents SET title = 'Concurrent managed-memory control' WHERE id = $1", [documentId]);
        await blocker.end();
      }
    }, 15_000);
  });

  it.each(["malformed", "foreign"])("rejects a %s restore target with full persisted state unchanged", async (kind) => {
    const versionId = kind === "foreign" ? await seedVersion(otherDocumentId) : "not-a-uuid";
    const f = service(), before = await state();
    await expect(f.svc.restoreKnowledgeDocumentVersion(projectId, actor, documentId, { versionId })).rejects.toBeInstanceOf(NotFoundException);
    expect(await state()).toEqual(before); expect(f.activity).not.toHaveBeenCalled();
  });

  it("snapshots a JSON-only body edit and resets existing AI approval; key reordering alone does neither", async () => {
    await setup.query("UPDATE knowledge_documents SET document_type = 'ai_memory', content_json = $2::jsonb WHERE id = $1", [documentId, JSON.stringify({ type: "doc", content: [] })]);
    // Model a retained legacy review after the content exists. V155 correctly invalidates a
    // review if the same write also changes the content/type it purports to approve.
    await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [documentId, actor]);
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
    await setup.query("UPDATE knowledge_documents SET document_type = 'ai_memory' WHERE id = $1", [documentId]);
    await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [documentId, actor]);
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

  describe("exact submitted and reviewed versions", () => {
    const human = { kind: "human_session" as const };
    const machine = { kind: "api_token" as const };
    async function detail(svc: ReturnType<typeof service>["svc"]) {
      return svc.getKnowledgeDocument(projectId, actor, documentId);
    }
    async function memory() {
      await setup.query("UPDATE knowledge_documents SET document_type = 'ai_memory' WHERE id = $1", [documentId]);
    }

    it("preserves two submitted bodies within the ordinary snapshot window and exactly replays an older submission", async () => {
      const f = service(), firstDoc = await detail(f.svc), submissionKey = randomUUID();
      const first = await f.svc.submitKnowledgeDocument(projectId, actor, documentId, { expectedRevision: firstDoc.editRevision, submissionKey }, machine);
      await update(f.svc, "Second submission");
      const secondDoc = await detail(f.svc);
      const second = await f.svc.submitKnowledgeDocument(projectId, actor, documentId, { expectedRevision: secondDoc.editRevision, submissionKey: randomUUID() }, machine);
      expect(first.id).not.toBe(second.id);
      expect(first.contentText).toBe("Initial body");
      expect(second.contentText).toBe("Second submission");
      expect(await f.svc.submitKnowledgeDocument(projectId, actor, documentId, { expectedRevision: firstDoc.editRevision, submissionKey }, machine)).toEqual(first);
      await expect(f.svc.submitKnowledgeDocument(projectId, actor, documentId, { expectedRevision: secondDoc.editRevision, submissionKey }, machine)).rejects.toBeInstanceOf(ConflictException);
      expect((await state()).versions.filter((v) => v.snapshot_kind === "submitted")).toHaveLength(2);
      expect((await state()).doc.status).toBe("draft");
    });

    it("refuses semantic, diff and attribution mutation of a submitted native version", async () => {
      const f = service(), doc = await detail(f.svc);
      const snapshot = await f.svc.submitKnowledgeDocument(projectId, actor, documentId, { expectedRevision: doc.editRevision, submissionKey: randomUUID() }, machine);
      const before = await state();
      for (const assignment of ["content_text = 'rewritten'", "changed_summary = 'new meaning'", "snapshot_kind = 'autosave'", `created_by = '${other}'::uuid`]) {
        await expect(setup.query(`UPDATE knowledge_document_versions SET ${assignment} WHERE id = $1`, [snapshot.id])).rejects.toMatchObject({ code: "23514" });
      }
      expect(await state()).toEqual(before);
    });

    it("records an immutable human-reviewed version, and editing resets current reliance without rewriting history", async () => {
      await memory();
      const f = service(), before = await detail(f.svc);
      const approved = await f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: before.editRevision }, human);
      expect(approved.reviewedVersionId).toBeTruthy();
      const receipt = await f.svc.getKnowledgeDocumentVersion(projectId, actor, documentId, approved.reviewedVersionId);
      expect(receipt).toMatchObject({ snapshotKind: "approved", contentText: "Initial body", createdBy: actor });
      expect(receipt.snapshotMetadata).toMatchObject({ expectedRevision: before.editRevision, actorKind: "human_session", authority: "ai_memory_review" });
      await update(f.svc, "New unreviewed content");
      expect((await state()).doc).toMatchObject({ status: "draft", reviewed_by: null, reviewed_at: null, reviewed_version_id: null });
      expect(await f.svc.getKnowledgeDocumentVersion(projectId, actor, documentId, approved.reviewedVersionId)).toEqual(receipt);
      const history = await f.svc.getKnowledgeDocumentHistory(projectId, actor, documentId);
      expect(history.events.some((entry) => /^Approved exact version /.test(entry.changedSummary ?? ""))).toBe(true);
    });

    it("uses one receipt and one mandatory audit for concurrent exact duplicate human decisions", async () => {
      await memory();
      const f = service(); f.activity.mockRestore();
      const before = await detail(f.svc);
      const decide = () => f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: before.editRevision }, human);
      const [first, second] = await Promise.all([decide(), decide()]);
      expect(second.reviewedVersionId).toBe(first.reviewedVersionId);
      expect((await state()).versions.filter((v) => v.snapshot_kind === "approved")).toHaveLength(1);
      const audits = await setup.query("SELECT diff FROM audit_logs WHERE project_id = $1 AND entity_id = $2 AND action = 'approved'", [projectId, documentId]);
      expect(audits.rows).toHaveLength(1);
      expect(audits.rows[0].diff.versionId).toBe(first.reviewedVersionId);
    });

    it("rejects a stale review and machine review with every native row unchanged", async () => {
      await memory();
      const f = service(), old = await detail(f.svc);
      await update(f.svc, "Changed before decision");
      const before = await state();
      await expect(f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: old.editRevision }, human)).rejects.toBeInstanceOf(ConflictException);
      await expect(f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: old.editRevision }, machine)).rejects.toBeInstanceOf(ForbiddenException);
      expect(await state()).toEqual(before);
    });

    it("rolls back snapshot, current review and audit together if the mandatory audit fails", async () => {
      await memory();
      let reachedAudit = false;
      const observed = observedPool(async (sql, _values, _result, raw) => {
        if (/INSERT INTO audit_logs/.test(sql)) { reachedAudit = true; await raw("SELECT 1 / 0"); }
      });
      const f = service(observed); f.activity.mockRestore();
      const current = await detail(f.svc), before = await state();
      try {
        await expect(f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: current.editRevision }, human)).rejects.toMatchObject({ code: "22012" });
        expect(reachedAudit).toBe(true);
        expect(await state()).toEqual(before);
        expect((await setup.query("SELECT id FROM audit_logs WHERE entity_id = $1 AND action = 'approved'", [documentId])).rows).toHaveLength(0);
        expect(f.embedding).not.toHaveBeenCalled();
      } finally { await observed.end(); }
    });

    it("rechecks a revoked review role after waiting on the real document lock", async () => {
      await memory();
      const f = service(), current = await detail(f.svc), blocker = new Client({ connectionString: url });
      await blocker.connect(); await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [`kb-doc-version:${documentId}`]);
      const pid = (await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      const decision = f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: current.editRevision }, human).then(() => null, (error: unknown) => error);
      try {
        await waitForBlocker(pid);
        await blocker.query("UPDATE project_members SET role = 'qa_engineer' WHERE project_id = $1 AND user_id = $2", [projectId, actor]);
        const before = await state();
        await blocker.query("COMMIT");
        expect(await decision).toBeInstanceOf(ForbiddenException);
        expect(await state()).toEqual(before);
      } finally { await blocker.query("ROLLBACK"); await decision; await blocker.end(); }
    });

    it("separates legacy approval provenance from exact snapshots and denies type/status bypass", async () => {
      await memory();
      await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [documentId, actor]);
      const f = service();
      expect(await detail(f.svc)).toMatchObject({ reviewBinding: "legacy_unverified", reviewedVersionId: null });
      await expect(f.svc.updateKnowledgeDocument(projectId, actor, documentId, { documentType: "general" })).rejects.toBeInstanceOf(BadRequestException);
      await expect(setup.query("UPDATE knowledge_documents SET document_type = 'general' WHERE id = $1", [documentId])).rejects.toMatchObject({ code: "23514" });
      const candidateId = await seedDocument("General candidate");
      await f.svc.updateKnowledgeDocument(projectId, actor, candidateId, { documentType: "ai_memory", status: "approved" });
      expect((await setup.query("SELECT document_type, status, reviewed_version_id FROM knowledge_documents WHERE id = $1", [candidateId])).rows[0]).toMatchObject({ document_type: "ai_memory", status: "draft", reviewed_version_id: null });
    });

    it("keeps legacy, candidate, foreign-bound and stale memory readable but excludes it from native and keyword AI context", async () => {
      const f = service();
      const marker = `governancereader${randomUUID().replace(/-/g, "")}`;
      await f.svc.updateKnowledgeDocument(projectId, actor, documentId, { contentText: marker });
      const rag = new RagRetrievalService(new DatabaseService(pool));
      const native = f.svc as unknown as {
        ragRetrieval: RagRetrievalService;
        knowledgeSnapshot(project: string, ids?: string[], query?: string): Promise<Array<{ citation: { sourceId: string } }>>;
        knowledgeFolderSnapshot(project: string, message: string, keys: string[]): Promise<Array<{ title: string; content: string; citation?: { sourceType: string; sourceId: string } }>>;
        zyraMemoryText(project: string): Promise<string>;
      };
      native.ragRetrieval = rag;
      async function newMemory(title: string) {
        const id = await seedDocument(title);
        await setup.query("UPDATE knowledge_documents SET document_type = 'ai_memory', content_text = $2 WHERE id = $1", [id, marker]);
        return id;
      }
      async function approve(id: string) {
        const current = await f.svc.getKnowledgeDocument(projectId, actor, id);
        return f.svc.approveAiMemory(projectId, actor, id, { expectedRevision: current.editRevision }, human);
      }
      const legacyId = await newMemory("Zyra AI Memory");
      await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [legacyId, actor]);
      const candidateId = await newMemory("Submitted memory");
      const candidate = await f.svc.getKnowledgeDocument(projectId, actor, candidateId);
      const submission = await f.svc.submitKnowledgeDocument(projectId, actor, candidateId, { expectedRevision: candidate.editRevision, submissionKey: randomUUID() }, machine);
      // A corrupt historical flag/pointer is not a human approval, even with identical content.
      await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now(), reviewed_version_id = $3 WHERE id = $1", [candidateId, actor, submission.id]);
      const exactId = await newMemory("Exactly reviewed memory");
      const exact = await approve(exactId);
      const foreignBoundId = await newMemory("Wrong document binding");
      // V159's lineage constraint now makes the historical corrupt pointer impossible; a document
      // carrying an approval flag but no bound pointer is still readable-as-unverified and excluded.
      await expect(setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now(), reviewed_version_id = $3 WHERE id = $1", [foreignBoundId, actor, exact.reviewedVersionId]))
        .rejects.toMatchObject({ code: "23503" });
      await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now() WHERE id = $1", [foreignBoundId, actor]);
      const staleId = await newMemory("Stale review binding");
      const stale = await approve(staleId);
      await f.svc.updateKnowledgeDocument(projectId, actor, staleId, { contentText: `${marker} changed after review` });
      await setup.query("UPDATE knowledge_documents SET status = 'approved', reviewed_by = $2, reviewed_at = now(), reviewed_version_id = $3 WHERE id = $1", [staleId, actor, stale.reviewedVersionId]);
      const ids = [documentId, legacyId, candidateId, exactId, foreignBoundId, staleId];
      const expected = [documentId, exactId].sort(); // The ordinary draft remains a contextual input.
      const selected = await native.knowledgeSnapshot(projectId, ids, marker);
      const folder = await native.knowledgeFolderSnapshot(projectId, 'Read "Knowledge base"', []);
      const keyword = await (rag as unknown as {
        ftsSearch(project: string, table: "knowledge_documents", column: string, query: { terms: string[]; tsquery: string; minMatchedTerms: number }): Promise<Array<{ source_id: string }>>;
      }).ftsSearch(projectId, "knowledge_documents", "content_text", { terms: [marker], tsquery: `'${marker}'`, minMatchedTerms: 1 });
      expect(selected.map((row) => row.citation.sourceId).filter((id) => ids.includes(id)).sort()).toEqual(expected);
      // The folder reader deliberately starts with an id-less heading, not a source citation.
      // Assert that marker separately so a missing citation on an actual document still fails.
      expect(folder[0]).toEqual({ title: "Knowledge base folder: Knowledge base", content: "" });
      const folderDocuments = folder.slice(1);
      for (const row of folderDocuments) expect(row.citation).toEqual({ sourceType: "document", sourceId: expect.any(String) });
      expect(folderDocuments.map((row) => row.citation!.sourceId).filter((id) => ids.includes(id)).sort()).toEqual(expected);
      expect(keyword.map((row) => row.source_id).filter((id) => ids.includes(id)).sort()).toEqual(expected);
      expect(await native.zyraMemoryText(projectId)).toBe("");
      expect(await f.svc.getKnowledgeDocument(projectId, actor, legacyId)).toMatchObject({ contentText: marker, status: "approved", reviewBinding: "legacy_unverified" });
      expect(await f.svc.getKnowledgeDocument(projectId, actor, staleId)).toMatchObject({ contentText: `${marker} changed after review` });
    });

    it("rejects stale ANN chunks after a new exact approval and admits only the matching reviewed text hash", async () => {
      await memory();
      const f = service(), before = await detail(f.svc);
      await f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: before.editRevision }, human);
      const vector = Array.from({ length: RAG_EMBEDDING_DIMENSION }, (_, i) => i === 0 ? 1 : 0);
      const embed = jest.spyOn(ragAiAllocation, "embedTexts").mockResolvedValue([vector]);
      const rag = new RagRetrievalService(new DatabaseService(pool)) as unknown as {
        annSearch(project: string, allocation: ragAiAllocation.EmbeddingKeyAllocation, query: string): Promise<Array<{ source_id: string; content: string }>>;
      };
      const allocation: ragAiAllocation.EmbeddingKeyAllocation = { provider: "openai", api_key: "isolated-stub", base_url: null, auth_header_name: null, auth_scheme: null, model: "text-embedding-3-small", dimension: RAG_EMBEDDING_DIMENSION, sendDimensionParam: true };
      const ann = () => rag.annSearch(projectId, allocation, "current memory");
      const chunkId = randomUUID();
      const hash = (text: string) => createHash("sha256").update(text.trim()).digest("hex");
      try {
        await setup.query(`INSERT INTO knowledge_document_chunks (id,organization_id,project_id,source_type,source_id,chunk_index,content,token_count,content_hash,embedding_model,embedding)
          VALUES ($1,$2,$3,'document',$4,0,'Initial body',3,$5,'isolated-stub',$6::vector)`, [chunkId, orgId, projectId, documentId, hash("Initial body"), `[${vector.join(",")}]`]);
        expect((await ann()).find((row) => row.source_id === documentId)?.content).toBe("Initial body");
        const newText = "\u00a0\nCurrent reviewed content\u2029\ufeff";
        await f.svc.updateKnowledgeDocument(projectId, actor, documentId, { contentText: newText });
        const changed = await detail(f.svc);
        expect(changed).toMatchObject({ status: "draft", reviewedVersionId: null });
        expect((await ann()).some((row) => row.source_id === documentId)).toBe(false);
        await f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: changed.editRevision }, human);
        expect((await ann()).some((row) => row.source_id === documentId)).toBe(false); // Index still carries the earlier bytes.
        await setup.query("UPDATE knowledge_document_chunks SET content = $2, content_hash = $3 WHERE id = $1 AND project_id = $4", [chunkId, newText.trim(), hash(newText), projectId]);
        expect((await ann()).find((row) => row.source_id === documentId)?.content).toBe(newText.trim());
      } finally { embed.mockRestore(); }
    });

    it("keeps the human edit/review revision stable across embedding bookkeeping but invalidates actual content changes", async () => {
      await memory();
      const f = service(), before = await detail(f.svc);
      await setup.query("UPDATE knowledge_documents SET embedding_status = 'processing', embedding_content_hash = 'operational-index-state' WHERE id = $1", [documentId]);
      expect((await detail(f.svc)).editRevision).toBe(before.editRevision);
      const approved = await f.svc.approveAiMemory(projectId, actor, documentId, { expectedRevision: before.editRevision }, human);
      await setup.query("UPDATE knowledge_documents SET embedding_status = 'ready', embedding_content_hash = 'new-operational-index-state' WHERE id = $1", [documentId]);
      expect(await detail(f.svc)).toMatchObject({ editRevision: approved.editRevision, status: "approved", reviewedVersionId: approved.reviewedVersionId });
      await update(f.svc, "Actually changed content");
      const changed = await detail(f.svc);
      expect(changed.editRevision).not.toBe(approved.editRevision);
      expect(changed).toMatchObject({ status: "draft", reviewedVersionId: null });
    });
  });

  it("rechecks a folder under a lock so a concurrent delete cannot strand a newly created document", async () => {
    const target = (await setup.query<{ id: string }>(
      "INSERT INTO knowledge_folders (organization_id,project_id,name) VALUES ($1,$2,$3) RETURNING id",
      [orgId, projectId, `Race folder ${randomUUID()}`]
    )).rows[0].id;
    const blocker = new Client({ connectionString: url });
    const f = service();
    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      const pid = (await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      await blocker.query("SELECT id FROM knowledge_folders WHERE id = $1 FOR UPDATE", [target]);
      // The preflight read has already passed; only the locked recheck in the create transaction
      // can see the folder being deleted underneath it.
      const create = f.svc.createKnowledgeDocument(projectId, actor, {
        folderId: target, title: `Race create ${randomUUID()}`,
        contentText: "Body", contentHtml: "<p>Body</p>", contentJson: json("Body")
      });
      await waitForBlocker(pid);
      await blocker.query("UPDATE knowledge_folders SET is_deleted = true WHERE id = $1", [target]);
      await blocker.query("COMMIT");
      await expect(create).rejects.toMatchObject({ status: 404 });
      expect((await setup.query("SELECT COUNT(*)::int AS n FROM knowledge_documents WHERE folder_id = $1", [target])).rows[0].n).toBe(0);
      expect(f.activity).not.toHaveBeenCalled();
    } finally {
      await blocker.query("ROLLBACK").catch(() => undefined);
      await blocker.end();
      await setup.query("DELETE FROM knowledge_folders WHERE id = $1", [target]);
    }
  });
});
