import { Client, Pool } from "pg";
import type { PoolClient, QueryResult } from "pg";
import { ConflictException } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

const url = process.env.DATABASE_URL ?? "";
const enabled = /\/tesbo_ci(?:\?|$)/.test(url);

(enabled ? describe : describe.skip)("automation Run closure — migrated PostgreSQL", () => {
  let setup: Client;
  let pool: Pool;
  let svc: AutomationService;
  let projectId: string;
  let runId: string;
  let executionId: string;
  let orgId: string;
  let caseId: string;
  const userId = "11a6df91-7f69-4aa1-b999-568091409401";

  beforeAll(async () => {
    setup = new Client({ connectionString: url });
    pool = new Pool({ connectionString: url, max: 4 });
    await setup.connect();
    await setup.query("INSERT INTO users (id, email, name) VALUES ($1, 'ci-run-closure@tesbo.invalid', 'Automation closure')", [userId]);
    const org = await setup.query<{ id: string }>("INSERT INTO organizations (name, slug) VALUES ('Closure CI', $1) RETURNING id", [`close-ci-${Date.now()}`]);
    orgId = org.rows[0].id;
    const project = await setup.query<{ id: string }>("INSERT INTO projects (organization_id, key, name) VALUES ($1, 'CLCI', 'Closure CI') RETURNING id", [orgId]);
    projectId = project.rows[0].id;
    const testcase = await setup.query<{ id: string }>("INSERT INTO testcases (project_id, external_id, title) VALUES ($1, 'CLCI-TC-1', 'Closure case') RETURNING id", [projectId]);
    caseId = testcase.rows[0].id;
    const run = await setup.query<{ id: string }>("INSERT INTO cycles (project_id, name, source, status) VALUES ($1, 'Closure CI run', 'automation', 'In Progress') RETURNING id", [projectId]);
    runId = run.rows[0].id;
    const item = await setup.query<{ id: string }>(
      "INSERT INTO cycle_items (cycle_id, testcase_id, snapshot_title, position) VALUES ($1, $2, 'Closure case', 1) RETURNING id", [runId, caseId]
    );
    const execution = await setup.query<{ id: string }>("INSERT INTO executions (cycle_item_id) VALUES ($1) RETURNING id", [item.rows[0].id]);
    executionId = execution.rows[0].id;
    const legacy = { requireProjectAccess: async () => ({}), logProjectActivity: async () => undefined } as unknown as LegacyService;
    svc = new AutomationService(new DatabaseService(pool), legacy, {} as PlanLimitsService, {} as StorageService);
  });

  afterAll(async () => {
    if (setup) {
      try {
        if (runId) {
          await setup.query("DELETE FROM executions WHERE id = $1", [executionId]);
          await setup.query("DELETE FROM cycle_items WHERE cycle_id = $1", [runId]);
          await setup.query("DELETE FROM cycles WHERE id = $1", [runId]);
        }
        if (caseId) await setup.query("DELETE FROM testcases WHERE id = $1", [caseId]);
        if (projectId) await setup.query("DELETE FROM projects WHERE id = $1", [projectId]);
        if (orgId) await setup.query("DELETE FROM organizations WHERE id = $1", [orgId]);
        await setup.query("DELETE FROM users WHERE id = $1", [userId]);
      } finally {
        await setup.end();
        await pool.end();
      }
    }
  });

  it("seals committed execution results and returns the same summary on repeated close", async () => {
    const result = await svc.recordResult(userId, projectId, runId, { caseId: "CLCI-TC-1", status: "pass", retryCount: 0, durationMs: 5 });
    expect(result.status).toBe("Passed");
    const closed = await svc.closeRun(userId, projectId, runId, { status: "completed", summary: { passed: 1, total: 1 } });
    expect(closed.alreadyClosed).toBe(false);
    expect(closed.mismatch).toBeNull();
    await expect(svc.recordResult(userId, projectId, runId, { caseId: "CLCI-TC-1", status: "fail", retryCount: 1 }))
      .rejects.toBeInstanceOf(ConflictException);
    const duplicate = await svc.closeRun(userId, projectId, runId, { status: "completed" });
    expect(duplicate.alreadyClosed).toBe(true);
    const stored = await setup.query<{ status: string; retry_count: number }>("SELECT status, retry_count FROM executions WHERE id = $1", [executionId]);
    expect(stored.rows[0]).toMatchObject({ status: "Passed", retry_count: 0 });
  });
  it("serializes close behind a locked result transaction, then rejects later results", async () => {
    await setup.query(
      "UPDATE cycles SET closed_at = NULL, close_status = NULL, status = 'In Progress', ended_at = NULL WHERE id = $1",
      [runId]
    );
    await setup.query("BEGIN");
    await setup.query("SELECT id FROM cycles WHERE id = $1 FOR UPDATE", [runId]);
    let resolved = false;
    const closePromise = svc.closeRun(userId, projectId, runId, { status: "completed" })
      .finally(() => { resolved = true; });
    try {
      // Bounded PostgreSQL lock wait: close cannot commit while another
      // transaction owns the cycle row. This uses a real independent pool client.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(resolved).toBe(false);
    } finally {
      await setup.query("COMMIT");
    }
    const closed = await closePromise;
    expect(closed.alreadyClosed).toBe(false);
    await expect(
      svc.recordResult(userId, projectId, runId, { caseId: "CLCI-TC-1", status: "fail", retryCount: 1 })
    ).rejects.toBeInstanceOf(ConflictException);
    const persisted = await setup.query<{ status: string; closed_at: Date | null }>(
      "SELECT status, closed_at FROM cycles WHERE id = $1", [runId]
    );
    expect(persisted.rows[0].status).toBe("Completed");
    expect(persisted.rows[0].closed_at).not.toBeNull();
  });

  it("replays a closed run with no attachments and rejects new case attachment on PostgreSQL", async () => {
    await setup.query("UPDATE cycles SET external_id = 'closure-replay-ci', closed_at = now(), status = 'Completed' WHERE id = $1", [runId]);
    const repeated = await svc.createRun(userId, projectId, {
      name: "Replayed closure",
      externalId: "closure-replay-ci"
    });
    expect(repeated.reused).toBe(true);
    expect(repeated.casesAttached).toBe(0);

    const second = await setup.query<{ id: string }>(
      "INSERT INTO testcases (project_id, external_id, title) VALUES ($1, 'CLCI-TC-2', 'Later case') RETURNING id",
      [projectId]
    );
    try {
      await expect(svc.createRun(userId, projectId, {
        name: "Replayed closure",
        externalId: "closure-replay-ci",
        caseIds: ["CLCI-TC-2"]
      })).rejects.toBeInstanceOf(ConflictException);
      const membership = await setup.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM cycle_items WHERE cycle_id = $1 AND deleted_at IS NULL",
        [runId]
      );
      expect(Number(membership.rows[0].count)).toBe(1);
    } finally {
      await setup.query("DELETE FROM testcases WHERE id = $1", [second.rows[0].id]);
    }
  });

  it("commits evidence metadata on an open run using the existing attachment table", async () => {
    await setup.query("UPDATE cycles SET status = 'In Progress', closed_at = NULL WHERE id = $1", [runId]);
    const staged: string[] = [];
    const removed: string[] = [];
    const storage = {
      put: async (key: string) => { staged.push(key); },
      delete: async (key: string) => { removed.push(key); }
    } as unknown as StorageService;
    const limits = { checkStorageAvailable: async () => ({ allowed: true }) } as unknown as PlanLimitsService;
    const legacy = { requireProjectAccess: async () => ({ organization_id: orgId }) } as unknown as LegacyService;
    const uploadService = new AutomationService(new DatabaseService(pool), legacy, limits, storage);
    try {
      const response = await uploadService.uploadEvidence(userId, projectId, runId, "CLCI-TC-1", "screenshot", [{
        buffer: Buffer.from("test-png-bytes"), originalname: "run-evidence.png", mimetype: "image/png", size: 14
      }]);
      expect(response.total).toBe(1);
      expect(staged).toHaveLength(1);
      expect(removed).toHaveLength(0);
      const persisted = await setup.query<{ storage_path: string; evidence_kind: string }>(
        "SELECT storage_path, evidence_kind FROM attachments WHERE project_id = $1 AND entity_type = 'execution' AND entity_id = $2",
        [projectId, executionId]
      );
      expect(persisted.rows).toMatchObject([{ storage_path: staged[0], evidence_kind: "screenshot" }]);
    } finally {
      await setup.query("DELETE FROM attachments WHERE project_id = $1 AND entity_type = 'execution' AND entity_id = $2", [projectId, executionId]);
    }
  });

  it("removes staged evidence if the run closes before its metadata transaction", async () => {
    await setup.query("UPDATE cycles SET status = 'In Progress', closed_at = NULL WHERE id = $1", [runId]);
    const staged: string[] = [];
    const removed: string[] = [];
    const storage = {
      put: async (key: string) => {
        staged.push(key);
        // Simulate a separate request finalizing the run while bytes upload.
        await setup.query("UPDATE cycles SET status = 'Completed', closed_at = now(), ended_at = now() WHERE id = $1", [runId]);
      },
      delete: async (key: string) => { removed.push(key); }
    } as unknown as StorageService;
    const limits = { checkStorageAvailable: async () => ({ allowed: true }) } as unknown as PlanLimitsService;
    const legacy = { requireProjectAccess: async () => ({ organization_id: orgId }) } as unknown as LegacyService;
    const uploadService = new AutomationService(new DatabaseService(pool), legacy, limits, storage);
    await expect(uploadService.uploadEvidence(userId, projectId, runId, "CLCI-TC-1", "screenshot", [{
      buffer: Buffer.from("test-png-bytes"), originalname: "late-evidence.png", mimetype: "image/png", size: 14
    }])).rejects.toBeInstanceOf(ConflictException);
    expect(staged).toHaveLength(1);
    expect(removed).toEqual(staged);
    const persisted = await setup.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM attachments WHERE project_id = $1 AND entity_type = 'execution' AND entity_id = $2",
      [projectId, executionId]
    );
    expect(Number(persisted.rows[0].count)).toBe(0);
  });

  it("serializes a manual result write behind run finalization on independent PostgreSQL clients", async () => {
    // Reset the dedicated automation fixture; no shared uncommitted test data.
    await setup.query(
      "UPDATE cycles SET status = 'In Progress', closed_at = NULL, ended_at = NULL WHERE id = $1",
      [runId]
    );
    await setup.query("UPDATE executions SET status = 'Passed' WHERE id = $1", [executionId]);

    const humanService = makeLegacy(new DatabaseService(pool));
    jest.spyOn(humanService, "requireProjectAccess").mockResolvedValue({} as never);
    jest.spyOn(humanService, "logProjectActivity").mockResolvedValue(undefined);
    jest.spyOn(
      humanService as unknown as { notifyExecutionChange: (...args: unknown[]) => Promise<void> },
      "notifyExecutionChange"
    ).mockResolvedValue(undefined);

    // The holder represents an automation close already holding the parent
    // run lock. The human service uses a separate pool connection.
    const holder = await pool.connect();
    let settled = false;
    let request: Promise<void> | undefined;
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM cycles WHERE id = $1 FOR UPDATE", [runId]);
      request = humanService.updateExecution(executionId, userId, { status: "Failed" })
        .then(() => { settled = true; }, (error: unknown) => { settled = true; throw error; });

      // Ensure the manual edit cannot commit until the lock holder ends.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(settled).toBe(false);

      await holder.query(
        "UPDATE cycles SET status = 'Completed', closed_at = now(), ended_at = now() WHERE id = $1",
        [runId]
      );
      await holder.query("COMMIT");
    } catch (error) {
      await holder.query("ROLLBACK");
      if (request) await request.catch(() => undefined);
      throw error;
    } finally {
      holder.release();
    }

    await expect(request).rejects.toBeInstanceOf(ConflictException);
    const persisted = await setup.query<{ status: string }>(
      "SELECT status FROM executions WHERE id = $1", [executionId]
    );
    expect(persisted.rows[0].status).toBe("Passed");
  });
  it("blocks a manual evidence upload behind a concurrent automation close and cleans staged files", async () => {
    // Use separate PostgreSQL connections through DatabaseService(pool). A
    // mock transaction sharing a client cannot prove inter-request locking.
    await setup.query(
      "UPDATE cycles SET status = 'In Progress', closed_at = NULL, ended_at = NULL WHERE id = $1",
      [runId]
    );
    await setup.query(
      "DELETE FROM attachments WHERE entity_type = 'execution' AND entity_id = $1",
      [executionId]
    );

    const staged: string[] = [];
    const cleaned: string[] = [];
    let signalStaged: () => void = () => undefined;
    const didStage = new Promise<void>((resolve) => { signalStaged = resolve; });
    const storage = {
      put: async (key: string) => { staged.push(key); signalStaged(); },
      delete: async (key: string) => { cleaned.push(key); }
    } as unknown as StorageService;
    const human = makeLegacy(new DatabaseService(pool));
    Object.assign(human, {
      storage,
      planLimits: { assertStorageAvailable: async () => undefined }
    });
    jest.spyOn(human, "requireProjectAccess").mockResolvedValue({} as never);
    jest.spyOn(human, "logProjectActivity").mockResolvedValue(undefined);

    const closer = await pool.connect();
    let transactionOpen = false;
    let uploadOutcome: Promise<{ error?: unknown; ok?: boolean }> | undefined;
    try {
      await closer.query("BEGIN");
      transactionOpen = true;
      await closer.query("SELECT id FROM cycles WHERE id = $1 FOR UPDATE", [runId]);

      let settled = false;
      uploadOutcome = human.uploadExecutionAttachments(runId, userId, executionId, [{
        buffer: Buffer.from("manual-evidence-bytes"),
        originalname: "manual-evidence.png",
        mimetype: "image/png",
        size: 21
      }]).then(
        () => { settled = true; return { ok: true }; },
        (error: unknown) => { settled = true; return { error }; }
      );

      await didStage;
      // The metadata transaction must wait for closer's cycle row lock.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(settled).toBe(false);

      await closer.query(
        "UPDATE cycles SET status = 'Completed', closed_at = now(), ended_at = now() WHERE id = $1",
        [runId]
      );
      await closer.query("COMMIT");
      transactionOpen = false;

      const outcome = await uploadOutcome;
      expect(outcome.error).toBeInstanceOf(ConflictException);
      expect(outcome.ok).toBeUndefined();
      expect(staged).toHaveLength(1);
      expect(cleaned).toEqual(staged);
      const saved = await setup.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM attachments WHERE entity_type = 'execution' AND entity_id = $1 AND deleted_at IS NULL",
        [executionId]
      );
      expect(Number(saved.rows[0].count)).toBe(0);
    } finally {
      if (transactionOpen) await closer.query("ROLLBACK");
      closer.release();
      if (uploadOutcome) await uploadOutcome;
    }
  });

  it("serializes historical import behind automation close and preserves finalized run fields", async () => {
    await setup.query(
      "UPDATE cycles SET status = 'In Progress', closed_at = NULL, close_status = NULL, ended_at = NULL WHERE id = $1",
      [runId]
    );
    const legacy = makeLegacy(new DatabaseService(pool));
    jest.spyOn(legacy as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> }, "requireCycleAccess")
      .mockResolvedValue(projectId);
    jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({ caller_role: "owner" } as never);
    jest.spyOn(legacy, "logProjectActivity").mockResolvedValue(undefined);

    const closer = await pool.connect();
    let transactionOpen = false;
    let importOutcome: Promise<{ error?: unknown; ok?: boolean }> | undefined;
    try {
      await closer.query("BEGIN");
      transactionOpen = true;
      await closer.query("SELECT id FROM cycles WHERE id = $1 FOR UPDATE", [runId]);
      let settled = false;
      importOutcome = legacy.importRunHistory(userId, runId, { run: { status: "In Progress" } }).then(
        () => { settled = true; return { ok: true }; },
        (error: unknown) => { settled = true; return { error }; }
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(settled).toBe(false);

      await closer.query(
        "UPDATE cycles SET status = 'Completed', closed_at = now(), ended_at = now(), close_status = 'completed' WHERE id = $1",
        [runId]
      );
      await closer.query("COMMIT");
      transactionOpen = false;

      const outcome = await importOutcome;
      expect(outcome.error).toBeInstanceOf(ConflictException);
      expect(outcome.ok).toBeUndefined();
      const persisted = await setup.query<{ status: string; closed_at: Date | null; close_status: string | null }>(
        "SELECT status, closed_at, close_status FROM cycles WHERE id = $1", [runId]
      );
      expect(persisted.rows[0].status).toBe("Completed");
      expect(persisted.rows[0].closed_at).not.toBeNull();
      expect(persisted.rows[0].close_status).toBe("completed");
    } finally {
      if (transactionOpen) await closer.query("ROLLBACK");
      closer.release();
      if (importOutcome) await importOutcome;
    }
  });

  it("accepts an import before closure and rejects it afterward", async () => {
    await setup.query("UPDATE cycles SET status = 'In Progress', closed_at = NULL, close_status = NULL WHERE id = $1", [runId]);
    const legacy = makeLegacy(new DatabaseService(pool));
    jest.spyOn(legacy as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> }, "requireCycleAccess").mockResolvedValue(projectId);
    jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({ caller_role: "owner" } as never);
    jest.spyOn(legacy, "logProjectActivity").mockResolvedValue(undefined);
    const imported = await legacy.importRunHistory(userId, runId, { run: { status: "In Progress" } });
    expect(imported.runFields).toContain("status");
    const closed = await svc.closeRun(userId, projectId, runId, { status: "completed" });
    expect(closed.alreadyClosed).toBe(false);
    await expect(legacy.importRunHistory(userId, runId, { run: { status: "In Progress" } })).rejects.toBeInstanceOf(ConflictException);
    const final = await setup.query("SELECT status, closed_at FROM cycles WHERE id = $1", [runId]);
    expect(final.rows[0].status).toBe("Completed");
    expect(final.rows[0].closed_at).not.toBeNull();
  });

  describe("bug associations and sealed verdicts", () => {
    function bugService(db = new DatabaseService(pool)) {
      const legacy = makeLegacy(db);
      jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({} as never);
      const activity = jest.spyOn(legacy, "logProjectActivity").mockResolvedValue(undefined);
      const notification = jest.spyOn(legacy as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange")
        .mockResolvedValue(undefined);
      jest.spyOn(legacy as unknown as { notifyBugChange: () => Promise<void> }, "notifyBugChange").mockResolvedValue(undefined);
      return { legacy, activity, notification };
    }

    const link = () => ({ testcaseId: caseId, cycleId: runId, executionId });
    const executionRow = async () => (await setup.query("SELECT * FROM executions WHERE id = $1", [executionId])).rows[0];

    async function resetRun(status = "Passed", source = "automation", runStatus = "In Progress") {
      await setup.query(
        "UPDATE cycles SET source = $2, status = $3, closed_at = NULL, close_status = NULL, ended_at = NULL WHERE id = $1",
        [runId, source, runStatus]
      );
      await setup.query(
        "UPDATE executions SET status = $2, executed_at = '2026-01-01T00:00:00Z', executed_by = $3, reported_by = 'automation', retry_count = 3 WHERE id = $1",
        [executionId, status, userId]
      );
    }

    async function expectBlockedBy(pid: number) {
      // Observe a real PostgreSQL lock wait, not just an unsettled JavaScript promise.
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const waiting = await setup.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND $1 = ANY(pg_blocking_pids(pid))",
          [pid]
        );
        if (waiting.rowCount) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`No PostgreSQL waiter observed behind backend ${pid}`);
    }

    afterEach(async () => {
      // This suite owns the dedicated project; never delete shared application fixtures.
      await setup.query("DELETE FROM bug_links WHERE bug_id IN (SELECT id FROM bugs WHERE project_id = $1)", [projectId]);
      await setup.query("DELETE FROM bugs WHERE project_id = $1", [projectId]);
    });

    it.each([
      ["Passed", "completed"], ["Failed", "completed"],
      ["Passed", "incomplete"], ["Failed", "incomplete"]
    ])("keeps create/add associations without changing sealed %s / %s results", async (status, closeStatus) => {
      await resetRun(status);
      const closed = await svc.closeRun(userId, projectId, runId, { status: closeStatus });
      const before = await executionRow();
      const runBefore = (await setup.query("SELECT * FROM cycles WHERE id = $1", [runId])).rows[0];
      const f = bugService();
      const created = await f.legacy.createBug(projectId, userId, { title: "Sealed create", links: [link()] });
      expect(created.links).toEqual(expect.arrayContaining([expect.objectContaining(link())]));
      const existing = await f.legacy.createBug(projectId, userId, { title: "Sealed late link" });
      const added = await f.legacy.addBugLink(userId, String(existing.id), link());
      expect(added.links).toEqual(expect.arrayContaining([expect.objectContaining(link())]));
      await f.legacy.addBugLink(userId, String(existing.id), link());
      expect(await executionRow()).toEqual(before);
      expect((await setup.query("SELECT * FROM cycles WHERE id = $1", [runId])).rows[0]).toEqual(runBefore);
      expect(await svc.closeRun(userId, projectId, runId, { status: closeStatus })).toEqual({ ...closed, alreadyClosed: true });
      expect(f.activity.mock.calls.filter((call) => call[2] === "execution_updated")).toHaveLength(0);
      expect(f.notification).not.toHaveBeenCalled();
    });

    it.each([
      ["manual", "Planning"], ["manual", "In Progress"], ["manual", "Completed"], ["automation", "In Progress"]
    ])("retains failure attribution and duplicate no-churn for %s / %s", async (source, runStatus) => {
      await resetRun("Passed", source, runStatus);
      if (source === "manual" && runStatus === "Completed") {
        await setup.query("UPDATE cycles SET closed_at = now() WHERE id = $1", [runId]);
      }
      const f = bugService();
      const created = await f.legacy.createBug(projectId, userId, { title: "Writable link", links: [link()] });
      const changed = await executionRow();
      expect(changed).toMatchObject({ status: "Failed", executed_by: userId });
      expect(changed.executed_at).not.toEqual(new Date("2026-01-01T00:00:00Z"));
      await Promise.all([
        f.legacy.addBugLink(userId, String(created.id), link()),
        f.legacy.addBugLink(userId, String(created.id), link())
      ]);
      expect(await executionRow()).toEqual(changed);
      expect(f.activity.mock.calls.filter((call) => call[2] === "execution_updated")).toHaveLength(1);
      expect(f.notification).toHaveBeenCalledTimes(1);
    });

    it("serializes simultaneous first-time links into one actual result transition", async () => {
      await resetRun();
      const f = bugService();
      const first = await f.legacy.createBug(projectId, userId, { title: "Concurrent first" });
      const second = await f.legacy.createBug(projectId, userId, { title: "Concurrent second" });
      await Promise.all([
        f.legacy.addBugLink(userId, String(first.id), link()),
        f.legacy.addBugLink(userId, String(second.id), link())
      ]);
      expect((await executionRow()).status).toBe("Failed");
      expect((await f.legacy.getBug(String(first.id))).links).toHaveLength(1);
      expect((await f.legacy.getBug(String(second.id))).links).toHaveLength(1);
      expect(f.activity.mock.calls.filter((call) => call[2] === "execution_updated")).toHaveLength(1);
      expect(f.notification).toHaveBeenCalledTimes(1);
    });

    it("waits behind close, then keeps the association without changing the verdict", async () => {
      await resetRun();
      const before = await executionRow();
      const f = bugService();
      const bug = await f.legacy.createBug(projectId, userId, { title: "Close first" });
      // Existing binding avoids an FK-insert wait masquerading as the helper's parent lock.
      await setup.query("INSERT INTO bug_links (bug_id, testcase_id, cycle_id, execution_id) VALUES ($1,$2,$3,$4)",
        [bug.id, caseId, runId, executionId]);
      const closer = await pool.connect();
      let request: Promise<unknown> | undefined;
      let open = false;
      try {
        await closer.query("BEGIN");
        open = true;
        await closer.query("SELECT id FROM cycles WHERE id = $1 FOR UPDATE", [runId]);
        let settled = false;
        request = f.legacy.addBugLink(userId, String(bug.id), link()).finally(() => { settled = true; });
        const holderPid = (await closer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
        await expectBlockedBy(holderPid);
        expect(settled).toBe(false);
        // A real earlier close writes while holding the production parent lock.
        await closer.query("UPDATE cycles SET status = 'Completed', closed_at = now(), close_status = 'completed' WHERE id = $1", [runId]);
        await closer.query("COMMIT");
        open = false;
        await request;
        expect(await executionRow()).toEqual(before);
        expect((await f.legacy.getBug(String(bug.id))).links).toHaveLength(1);
        expect(f.notification).not.toHaveBeenCalled();
      } finally {
        if (open) await closer.query("ROLLBACK");
        closer.release();
        if (request) await request.catch(() => undefined);
      }
    });

    it("makes close wait for the actual bug-result write and count its committed failure", async () => {
      await resetRun();
      let written!: () => void;
      const didWrite = new Promise<void>((resolve) => { written = resolve; });
      let resume!: () => void;
      let writerPid = 0;
      const mayCommit = new Promise<void>((resolve) => { resume = resolve; });
      const observedPool = new Pool({ connectionString: url, max: 1 });
      const connect = observedPool.connect.bind(observedPool);
      // Forward real queries, pausing only after the completed production result UPDATE.
      const observingPool = {
        query: observedPool.query.bind(observedPool),
        connect: async () => {
          const client = await connect();
          return {
            query: async (sql: string, params?: unknown[]) => {
              const result = await client.query(sql, params);
              if (/^\s*UPDATE executions SET status = 'Failed'/.test(sql)) {
                expect(result.rowCount).toBe(1);
                writerPid = (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
                written();
                await mayCommit;
              }
              return result;
            },
            release: () => client.release()
          };
        }
      } as unknown as Pool;
      const f = bugService(new DatabaseService(observingPool));
      let linked: Promise<unknown> | undefined;
      let closed: ReturnType<AutomationService["closeRun"]> | undefined;
      try {
        linked = f.legacy.createBug(projectId, userId, { title: "Link first", links: [link()] });
        // Race against request completion so an early failure cannot hang the latch.
        await Promise.race([didWrite, linked.then(() => { throw new Error("Expected a completed result write"); })]);
        expect((await executionRow()).status).toBe("Passed"); // UPDATE is still uncommitted.
        let settled = false;
        closed = svc.closeRun(userId, projectId, runId, { status: "completed" }).finally(() => { settled = true; });
        await expectBlockedBy(writerPid);
        expect(settled).toBe(false);
        resume();
        await linked;
        const result = await closed;
        expect(result).toMatchObject({ summary: { passed: 0, failed: 1, total: 1 } });
        expect((await executionRow()).status).toBe("Failed");
        expect(observedPool.idleCount).toBe(observedPool.totalCount);
      } finally {
        resume();
        if (linked) await linked.catch(() => undefined);
        if (closed) await closed.catch(() => undefined);
        await observedPool.end();
      }
    });
  });

  it("rolls back an already-written run when a later historical result fails in PostgreSQL", async () => {
    // Committed, dedicated fixtures: the independent setup connection must be
    // able to observe any accidentally committed prefix of the import.
    await setup.query(
      "UPDATE cycles SET status = 'In Progress', closed_at = NULL, close_status = NULL, ended_at = NULL, time_spent_ms = 10, tags = ARRAY['rollback-baseline'] WHERE id = $1",
      [runId]
    );
    await setup.query("UPDATE executions SET status = 'Passed', actual_result = 'Before failed import' WHERE id = $1", [executionId]);
    await setup.query("UPDATE cycle_items SET snapshot_title = 'Before snapshot refresh' WHERE cycle_id = $1", [runId]);

    const readPersisted = async () => ({
      run: (await setup.query<Record<string, unknown>>("SELECT * FROM cycles WHERE id = $1", [runId])).rows,
      executions: (await setup.query<Record<string, unknown>>(
        "SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1 ORDER BY e.id", [runId]
      )).rows,
      snapshots: (await setup.query<Record<string, unknown>>("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [runId])).rows,
      audit: (await setup.query<Record<string, unknown>>("SELECT * FROM audit_logs WHERE project_id = $1 ORDER BY id", [projectId])).rows,
      attachments: (await setup.query<Record<string, unknown>>("SELECT * FROM attachments WHERE project_id = $1 ORDER BY id", [projectId])).rows
    });
    const before = await readPersisted();
    expect(before.run).toHaveLength(1);
    expect(before.executions).toHaveLength(1);
    expect(before.snapshots).toHaveLength(1);

    const completedWrites: { rowCount: number | null; pendingRun: Record<string, unknown> }[] = [];
    // Keep the production transaction implementation, including BEGIN, ROLLBACK
    // and release. Observe actual completed SQL, never substitute a mock result.
    // This pool is used only by the importer's promise-based transaction queries.
    // One connection also makes a successful retry check for an aborted/leaked client.
    const importPool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 2000 });
    const checkedOut = new Set<PoolClient>();
    importPool.on("acquire", (client) => { checkedOut.add(client); });
    importPool.on("release", (_error, client) => { checkedOut.delete(client); });
    importPool.on("connect", (client) => {
      const execute = client.query.bind(client) as (sql: string, values?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
      client.query = (async (sql: string, values?: unknown[]) => {
        const result = await execute(sql, values);
        if (/^\s*UPDATE cycles SET\b/i.test(sql)) {
          const pending = await execute("SELECT * FROM cycles WHERE id = $1", [runId]);
          completedWrites.push({ rowCount: result.rowCount, pendingRun: pending.rows[0] });
        }
        return result;
      }) as typeof client.query;
    });
    const legacy = makeLegacy(new DatabaseService(importPool));
    jest.spyOn(legacy as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> }, "requireCycleAccess")
      .mockResolvedValue(projectId);
    jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({ caller_role: "owner" } as never);
    const activity = jest.spyOn(legacy, "logProjectActivity").mockResolvedValue(undefined);
    const runUpdate = { tags: ["rollback-pending"], timeSpentMs: 123 };
    const resultUpdate = {
      testcaseId: caseId, status: "Failed", actualResult: "Imported result", durationMs: 42,
      history: [{ status: "Passed", comment: "Prior attempt" }],
      stepResults: [{ position: 1, status: "Failed", comment: "Imported step" }]
    };

    try {
      // U+0000 passes today's text validation but PostgreSQL rejects its JSONB
      // escape (22P05) in the result UPDATE, after the run UPDATE has completed.
      // A validation-only rejection must fail the completed-write assertions below.
      await expect(legacy.importRunHistory(userId, runId, {
        run: runUpdate,
        results: [{ ...resultUpdate, actualResult: "Rejected\u0000result" }],
        refreshSnapshots: true
      })).rejects.toMatchObject({ code: "22P05" });

      expect(completedWrites).toHaveLength(1);
      expect(completedWrites[0].rowCount).toBe(1);
      expect(completedWrites[0].pendingRun).toMatchObject({
        tags: ["rollback-pending"], status: "In Progress", source: "automation", closed_at: null, close_status: null
      });
      expect(Number(completedWrites[0].pendingRun.time_spent_ms)).toBe(123);
      // Full persisted rows include lifecycle fields, result/history/step data,
      // snapshots and timestamps; inspect them outside the failed transaction.
      expect(await readPersisted()).toEqual(before);
      expect(activity).not.toHaveBeenCalled();
      expect(checkedOut.size).toBe(0);

      const retried = await legacy.importRunHistory(userId, runId, {
        run: runUpdate, results: [resultUpdate], refreshSnapshots: true
      });
      expect(retried).toMatchObject({ applied: 1, unmatched: [], refreshedSnapshots: 1 });
      expect(activity).toHaveBeenCalledTimes(1);
      const after = await readPersisted();
      expect(after.run[0]).toMatchObject({
        status: "In Progress", source: "automation", closed_at: null, close_status: null, ended_at: null,
        tags: ["rollback-pending"]
      });
      expect(Number(after.run[0].time_spent_ms)).toBe(123);
      expect(after.executions[0]).toMatchObject({
        status: "Failed", actual_result: resultUpdate.actualResult, duration_ms: resultUpdate.durationMs,
        history: resultUpdate.history, step_results: resultUpdate.stepResults
      });
      expect(after.snapshots[0].snapshot_title).toBe("Closure case");
      expect(checkedOut.size).toBe(0);
    } finally {
      // If the release behavior regresses, retry fails first; destroy the leaked
      // client afterward so pool.end() cannot hang and conceal that failure.
      for (const client of checkedOut) client.release(true);
      await importPool.end();
    }
  });

});
