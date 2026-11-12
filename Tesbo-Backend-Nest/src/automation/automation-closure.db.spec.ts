import { Client, Pool } from "pg";
import type { PoolClient, QueryResult } from "pg";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
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
    function bugService(db = new DatabaseService(pool), mockAuthorization = true) {
      const legacy = makeLegacy(db);
      if (mockAuthorization) jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({} as never);
      const activity = jest.spyOn(legacy, "logProjectActivity").mockResolvedValue(undefined);
      const notification = jest.spyOn(legacy as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange")
        .mockResolvedValue(undefined);
      const bugNotification = jest.spyOn(legacy as unknown as { notifyBugChange: () => Promise<void> }, "notifyBugChange").mockResolvedValue(undefined);
      return { legacy, activity, notification, bugNotification };
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

    it("authorizes bug creation before domain writes using actual migrated membership/workspace queries", async () => {
      await resetRun("Passed", "manual");
      const otherOrg = (await setup.query<{ id: string }>(
        "INSERT INTO organizations (name, slug) VALUES ('Bug auth other workspace', $1) RETURNING id",
        [`bug-auth-other-${Date.now()}`]
      )).rows[0].id;
      const outsider = (await setup.query<{ id: string }>(
        "INSERT INTO users (email, name) VALUES ($1, 'Bug auth nonmember') RETURNING id",
        [`bug-auth-${Date.now()}@tesbo.invalid`]
      )).rows[0].id;
      try {
        await setup.query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1,$2,'owner'),($3,$2,'owner'),($1,$4,'qa_engineer')",
          [orgId, userId, otherOrg, outsider]);
        await setup.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner')", [projectId, userId]);
        await setup.query("UPDATE users SET active_organization_id = $1 WHERE id = ANY($2::uuid[])", [orgId, [userId, outsider]]);
        const persisted = async () => ({
          execution: await executionRow(),
          run: (await setup.query("SELECT * FROM cycles WHERE id = $1", [runId])).rows,
          bugs: (await setup.query("SELECT * FROM bugs WHERE project_id = $1 ORDER BY id", [projectId])).rows,
          links: (await setup.query("SELECT bl.* FROM bug_links bl JOIN bugs b ON b.id = bl.bug_id WHERE b.project_id = $1 ORDER BY bl.id", [projectId])).rows
        });
        const denied = async (actor: string | null | undefined, expected: typeof BadRequestException | typeof NotFoundException, targetProject = projectId) => {
          const before = await persisted();
          const f = bugService(undefined, false); // Do NOT stub authorization in this regression.
          await expect(f.legacy.createBug(targetProject, actor, { title: "Refused bug", links: [link()] })).rejects.toBeInstanceOf(expected);
          expect(await persisted()).toEqual(before);
          expect(f.activity).not.toHaveBeenCalled();
          expect(f.notification).not.toHaveBeenCalled();
        };
        await denied(null, BadRequestException);
        await denied(undefined, BadRequestException);
        await denied(outsider, NotFoundException); // Same workspace, no project membership.
        await denied(userId, NotFoundException, "not-a-project-id");
        await denied(userId, NotFoundException, "00000000-0000-4000-8000-000000000001");

        await setup.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, userId]);
        await denied(userId, NotFoundException); // Previously valid member, now revoked.
        await setup.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner')", [projectId, userId]);
        await setup.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [otherOrg, userId]);
        await denied(userId, NotFoundException); // Real membership, wrong currently active workspace.
        await setup.query("UPDATE users SET active_organization_id = $1 WHERE id = $2", [orgId, userId]);
        await setup.query("UPDATE projects SET archived_at = now() WHERE id = $1", [projectId]);
        await denied(userId, NotFoundException);
        await setup.query("UPDATE projects SET archived_at = NULL WHERE id = $1", [projectId]);

        const f = bugService(undefined, false);
        const created = await f.legacy.createBug(projectId, userId, { title: "Authorized member bug", links: [link()] });
        expect(created).toMatchObject({ reportedBy: userId });
        expect(created.links).toEqual(expect.arrayContaining([expect.objectContaining(link())]));
        expect((await executionRow()).status).toBe("Failed"); // Existing open/manual behavior is retained.
      } finally {
        await setup.query("UPDATE projects SET archived_at = NULL WHERE id = $1", [projectId]);
        await setup.query("UPDATE users SET active_organization_id = NULL WHERE id = ANY($1::uuid[])", [[userId, outsider]]);
        await setup.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, userId]);
        await setup.query("DELETE FROM organization_members WHERE user_id = ANY($1::uuid[]) AND organization_id = ANY($2::uuid[])", [[userId, outsider], [orgId, otherOrg]]);
        await setup.query("DELETE FROM users WHERE id = $1", [outsider]);
        await setup.query("DELETE FROM organizations WHERE id = $1", [otherOrg]);
      }
    });

    describe("atomic bug-link relationship changes", () => {
      type Target = { testcaseId: string; cycleId: string; executionId: string };
      let sibling: Target;
      let foreign: Target;
      let foreignProject: string;
      let createdCases: string[];
      let createdRuns: string[];
      let f: ReturnType<typeof bugService>;

      async function seedTarget(project: string, suffix: string): Promise<Target> {
        const testcaseId = (await setup.query<{ id: string }>(
          "INSERT INTO testcases (project_id, external_id, title) VALUES ($1,$2,$3) RETURNING id", [project, `${suffix}-TC-1`, `Relationship ${suffix}`]
        )).rows[0].id;
        createdCases.push(testcaseId);
        const cycleId = (await setup.query<{ id: string }>(
          "INSERT INTO cycles (project_id, name) VALUES ($1,$2) RETURNING id", [project, `Relationship ${suffix}`]
        )).rows[0].id;
        createdRuns.push(cycleId);
        const item = (await setup.query<{ id: string }>(
          "INSERT INTO cycle_items (cycle_id, testcase_id, snapshot_title) VALUES ($1,$2,$3) RETURNING id", [cycleId, testcaseId, suffix]
        )).rows[0].id;
        const id = (await setup.query<{ id: string }>("INSERT INTO executions (cycle_item_id, status) VALUES ($1,'Passed') RETURNING id", [item])).rows[0].id;
        return { testcaseId, cycleId, executionId: id };
      }

      beforeEach(async () => {
        createdCases = []; createdRuns = []; foreignProject = "";
        await resetRun();
        foreignProject = (await setup.query<{ id: string }>(
          "INSERT INTO projects (organization_id, key, name) VALUES ($1,'BLFOREIGN','Foreign relationship fixture') RETURNING id", [orgId]
        )).rows[0].id;
        sibling = await seedTarget(projectId, "BLLOCAL");
        foreign = await seedTarget(foreignProject, "BLFOREIGN");
        f = bugService(); // Authorization is covered separately; do not claim this is an HTTP test.
      });

      afterEach(async () => {
        const projects = [projectId, foreignProject].filter(Boolean);
        await setup.query("DELETE FROM bug_links WHERE bug_id IN (SELECT id FROM bugs WHERE project_id = ANY($1::uuid[]))", [projects]);
        await setup.query("DELETE FROM bugs WHERE project_id = ANY($1::uuid[])", [projects]);
        await setup.query("DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id = ANY($1::uuid[]))", [createdRuns]);
        await setup.query("DELETE FROM cycle_items WHERE cycle_id = ANY($1::uuid[])", [createdRuns]);
        await setup.query("DELETE FROM cycles WHERE id = ANY($1::uuid[])", [createdRuns]);
        await setup.query("DELETE FROM testcases WHERE id = ANY($1::uuid[])", [createdCases]);
        if (foreignProject) await setup.query("DELETE FROM projects WHERE id = $1", [foreignProject]);
        await setup.query("UPDATE cycles SET deleted_at = NULL, deleted_by = NULL WHERE id = $1", [runId]);
        await setup.query("UPDATE cycle_items SET deleted_at = NULL, deleted_by = NULL WHERE cycle_id = $1", [runId]);
        await setup.query("UPDATE executions SET deleted_at = NULL, deleted_by = NULL WHERE id = $1", [executionId]);
        await setup.query("UPDATE testcases SET deleted_at = NULL, deleted_by = NULL WHERE id = $1", [caseId]);
      });

      async function state() {
        const projects = [projectId, foreignProject];
        const runs = [runId, ...createdRuns];
        return {
          bugs: (await setup.query("SELECT * FROM bugs WHERE project_id = ANY($1::uuid[]) ORDER BY id", [projects])).rows,
          testcases: (await setup.query("SELECT * FROM testcases WHERE project_id = ANY($1::uuid[]) ORDER BY id", [projects])).rows,
          links: (await setup.query("SELECT bl.* FROM bug_links bl JOIN bugs b ON b.id = bl.bug_id WHERE b.project_id = ANY($1::uuid[]) ORDER BY bl.id", [projects])).rows,
          runs: (await setup.query("SELECT * FROM cycles WHERE id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
          items: (await setup.query("SELECT * FROM cycle_items WHERE cycle_id = ANY($1::uuid[]) ORDER BY id", [runs])).rows,
          executions: (await setup.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = ANY($1::uuid[]) ORDER BY e.id", [runs])).rows
        };
      }

      it.each(["active", "deleted"])("does not resolve %s foreign metadata from preexisting invalid links on detail/list reads", async (status) => {
        const bug = await f.legacy.createBug(projectId, userId, { title: "Legacy invalid association read", links: [link()] });
        // Simulate preexisting corruption through scoped fixture SQL, not the now-guarded writer.
        // The fix must not rewrite, soft-delete or silently omit these historical relationship rows.
        for (const target of [foreign, { ...foreign, cycleId: runId }, { ...link(), cycleId: foreign.cycleId }]) {
          await setup.query("INSERT INTO bug_links (bug_id, testcase_id, cycle_id, execution_id) VALUES ($1,$2,$3,$4)",
            [bug.id, target.testcaseId, target.cycleId, target.executionId]);
        }
        if (status === "deleted") {
          await setup.query("UPDATE testcases SET deleted_at = now() WHERE id = $1", [foreign.testcaseId]);
          await setup.query("UPDATE cycles SET deleted_at = now() WHERE id = $1", [foreign.cycleId]);
        }
        const before = await state();
        const reads = [
          await f.legacy.getBug(String(bug.id)),
          ...(await f.legacy.listBugs(projectId)),
          ...(await f.legacy.listBugs(projectId, { testcaseId: caseId, cycleId: runId }))
        ];
        expect(reads).toHaveLength(3);
        for (const saved of reads) {
          expect(saved.links).toHaveLength(4);
          expect(saved.links).toEqual(expect.arrayContaining([expect.objectContaining({ ...link(), testcaseTitle: "Closure case", cycleName: expect.any(String) })]));
          for (const association of saved.links) {
            if (association.testcaseId === foreign.testcaseId) {
              expect(association.testcaseTitle).toBeNull();
              expect(association.testcaseExternalId).toBeNull();
            }
            if (association.cycleId === foreign.cycleId) expect(association.cycleName).toBeNull();
          }
        }
        expect(await state()).toEqual(before);
      });

      function gate() {
        let resolve!: () => void;
        const promise = new Promise<void>((done) => { resolve = done; });
        return {
          resolve,
          wait: async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              await Promise.race([promise, new Promise<never>((_done, reject) => {
                timer = setTimeout(() => reject(new Error("Database concurrency gate was not reached/released")), 5_000);
              })]);
            } finally {
              if (timer) clearTimeout(timer);
            }
          }
        };
      }

      function observedDatabase(afterQuery: (sql: string, client: PoolClient) => Promise<void>) {
        return new DatabaseService({
          query: pool.query.bind(pool),
          connect: async () => {
            const client = await pool.connect();
            return {
              query: async (sql: string, values?: unknown[]) => {
                const result = await client.query(sql, values);
                if (sql === "BEGIN") await client.query("SET LOCAL statement_timeout = '8s'");
                await afterQuery(sql, client);
                return result;
              },
              release: () => client.release()
            };
          }
        } as unknown as Pool);
      }

      it("commits a link first, then lets deletion preserve its historical association", async () => {
        const bug = await f.legacy.createBug(projectId, userId, { title: "Link before deletion" });
        const locked = gate();
        const resume = gate();
        let pid = 0;
        const writer = bugService(observedDatabase(async (sql, client) => {
          if (!sql.includes("SELECT id, deleted_at FROM cycles")) return;
          pid = (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
          locked.resolve();
          await resume.wait();
        }));
        const linking = writer.legacy.updateBug(userId, String(bug.id), { title: "Linked before deletion", links: [link()] });
        let deleting: Promise<unknown> | undefined;
        try {
          await Promise.race([locked.wait(), linking]);
          deleting = f.legacy.deleteCycle(runId, userId);
          await expectBlockedBy(pid);
          resume.resolve();
          await linking;
          await deleting;
          const saved = await f.legacy.getBug(String(bug.id));
          expect(saved).toMatchObject({ title: "Linked before deletion", links: [{ ...link(), cycleName: expect.stringContaining("(deleted)") }] });
          expect((await setup.query("SELECT deleted_at FROM cycles WHERE id = $1", [runId])).rows[0].deleted_at).not.toBeNull();
        } finally {
          resume.resolve();
          await Promise.allSettled([linking, ...(deleting ? [deleting] : [])]);
        }
      }, 20_000);

      it("does not deadlock association edits with manual writes and member cleanup", async () => {
        await resetRun("Passed", "manual");
        const member = (await setup.query<{ id: string }>(
          "INSERT INTO users (email, name) VALUES ($1,'Relationship cleanup member') RETURNING id", [`bug-lock-${Date.now()}@tesbo.invalid`]
        )).rows[0].id;
        const cleanupLocked = gate(); const resumeCleanup = gate();
        const manualLocked = gate(); const resumeManual = gate();
        let cleanupPid = 0; let manualPid = 0;
        let cleanup: Promise<unknown> | undefined; let manual: Promise<unknown> | undefined; let linking: Promise<unknown> | undefined;
        try {
          await setup.query("INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'qa_engineer')", [projectId, member]);
          const bug = await f.legacy.createBug(projectId, userId, { title: "Three writers" });
          await setup.query("UPDATE bugs SET assignee_id = $2 WHERE id = $1", [bug.id, member]);
          await setup.query("UPDATE executions SET assignee_id = $2 WHERE id = $1", [executionId, member]);
          const cleaner = bugService(observedDatabase(async (sql, client) => {
            if (!sql.includes("UPDATE executions e SET assignee_id = NULL")) return;
            cleanupPid = (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
            cleanupLocked.resolve();
            await resumeCleanup.wait();
          }));
          jest.spyOn(cleaner.legacy, "requireProjectAccess").mockResolvedValue({ caller_role: "owner" } as never);
          jest.spyOn(cleaner.legacy as unknown as { notifyUsers: () => Promise<void> }, "notifyUsers").mockResolvedValue(undefined);
          cleanup = cleaner.legacy.removeProjectMember(userId, projectId, member);
          await Promise.race([cleanupLocked.wait(), cleanup]);
          const editor = bugService(observedDatabase(async (sql, client) => {
            if (!/FROM cycles.*FOR UPDATE/s.test(sql)) return;
            manualPid = (await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
            manualLocked.resolve();
            await resumeManual.wait();
          }));
          manual = editor.legacy.updateExecution(executionId, userId, { status: "Passed" });
          await Promise.race([manualLocked.wait(), manual]);
          resumeManual.resolve();
          await expectBlockedBy(cleanupPid);
          linking = f.legacy.updateBug(userId, String(bug.id), { title: "Concurrent association saved", links: [link()] });
          await expectBlockedBy(manualPid);
          // If linking held the bug before waiting for the cycle, this is the third edge of
          // cleanup(execution -> bug) -> linking(bug -> cycle) -> manual(cycle -> execution).
          resumeCleanup.resolve();
          await Promise.all([cleanup, manual, linking]);
          expect((await f.legacy.getBug(String(bug.id)))).toMatchObject({ title: "Concurrent association saved", assigneeId: null, links: [expect.objectContaining(link())] });
          expect(await executionRow()).toMatchObject({ status: "Passed", assignee_id: null });
          expect((await setup.query("SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, member])).rowCount).toBe(0);
        } finally {
          resumeCleanup.resolve(); resumeManual.resolve();
          await Promise.allSettled([cleanup, manual, linking].filter((promise): promise is Promise<unknown> => !!promise));
          await setup.query("UPDATE bugs SET assignee_id = NULL WHERE project_id = $1 AND assignee_id = $2", [projectId, member]);
          await setup.query("UPDATE executions SET assignee_id = NULL WHERE id = $1 AND assignee_id = $2", [executionId, member]);
          await setup.query("DELETE FROM project_members WHERE project_id = $1 AND user_id = $2", [projectId, member]);
          await setup.query("DELETE FROM users WHERE id = $1", [member]);
        }
      }, 20_000);

      it("does not grant a stale historical exemption after concurrent unlink", async () => {
        const bug = await f.legacy.createBug(projectId, userId, { title: "Before historical unlink", links: [link()] });
        await f.legacy.deleteCycle(runId, userId);
        const locked = gate(); const resume = gate();
        const editor = bugService(observedDatabase(async (sql) => {
          if (!sql.includes("FOR KEY SHARE OF e")) return;
          locked.resolve();
          await resume.wait();
        }));
        const editing = editor.legacy.updateBug(userId, String(bug.id), { title: "Must not persist stale edit", links: bug.links })
          .then(() => ({ error: undefined }), (error: unknown) => ({ error }));
        try {
          await Promise.race([locked.wait(), editing]);
          await f.legacy.removeBugLink(userId, String(bug.id), String(bug.links[0].id));
          const before = await state();
          resume.resolve();
          expect((await editing).error).toBeInstanceOf(NotFoundException);
          expect(await state()).toEqual(before);
        } finally {
          resume.resolve();
          await editing;
        }
      }, 20_000);

      it.each(["foreign case", "foreign run", "foreign execution", "wrong case", "wrong run", "unknown execution", "malformed UUID"])(
        "rejects %s across create/add/edit without any persisted prefix", async (kind) => {
          const invalid = kind === "foreign case" ? { ...link(), testcaseId: foreign.testcaseId }
            : kind === "foreign run" ? { cycleId: foreign.cycleId }
            : kind === "foreign execution" ? { ...link(), executionId: foreign.executionId }
            : kind === "wrong case" ? { ...link(), testcaseId: sibling.testcaseId }
            : kind === "wrong run" ? { cycleId: sibling.cycleId, executionId }
            : { ...link(), executionId: kind === "malformed UUID" ? "invalid" : "00000000-0000-4000-8000-000000000001" };
          const expected = kind.startsWith("wrong") || kind === "malformed UUID" ? BadRequestException : NotFoundException;
          const bug = await f.legacy.createBug(projectId, userId, { title: "Before rejected edit" });
          for (const operation of [
            () => f.legacy.createBug(projectId, userId, { title: "Rejected create", links: [{ testcaseId: caseId }, invalid] }),
            () => f.legacy.addBugLink(userId, String(bug.id), invalid),
            () => f.legacy.updateBug(userId, String(bug.id), { title: "Must not persist", links: [{ testcaseId: caseId }, invalid] })
          ]) {
            const before = await state();
            f.activity.mockClear(); f.notification.mockClear(); f.bugNotification.mockClear();
            await expect(operation()).rejects.toBeInstanceOf(expected);
            expect(await state()).toEqual(before);
            expect(f.activity).not.toHaveBeenCalled();
            expect(f.notification).not.toHaveBeenCalled();
            expect(f.bugNotification).not.toHaveBeenCalled();
          }
        }
      );

      it("retains exact historical tuples/IDs during metadata edits, but refuses a new link after removal", async () => {
        const bug = await f.legacy.createBug(projectId, userId, { title: "Historical association", links: [link()] });
        const original = bug.links[0];
        await f.legacy.deleteCycle(runId, userId);
        const beforeExecution = await executionRow();
        const updated = await f.legacy.updateBug(userId, String(bug.id), { title: "Metadata corrected", links: bug.links });
        expect(updated.links).toMatchObject([{ id: original.id, ...link(), cycleName: expect.stringContaining("(deleted)") }]);
        expect(await executionRow()).toEqual(beforeExecution);
        const removed = await f.legacy.updateBug(userId, String(bug.id), { links: [] });
        expect(removed.links).toEqual([]);
        const before = await state();
        await expect(f.legacy.addBugLink(userId, String(bug.id), { ...link(), id: original.id })).rejects.toBeInstanceOf(NotFoundException);
        expect(await state()).toEqual(before);
      });

      it.each(["case", "run", "execution", "membership"])("rejects an individually inactive %s across create/add/edit", async (target) => {
        const bug = await f.legacy.createBug(projectId, userId, { title: "Before inactive-target edit" });
        if (target === "case") await setup.query("UPDATE testcases SET deleted_at = now() WHERE id = $1", [caseId]);
        else if (target === "run") await setup.query("UPDATE cycles SET deleted_at = now() WHERE id = $1", [runId]);
        else if (target === "execution") await setup.query("UPDATE executions SET deleted_at = now() WHERE id = $1", [executionId]);
        else await setup.query("UPDATE cycle_items SET deleted_at = now() WHERE cycle_id = $1", [runId]);
        // Omitting the explicit run must not bypass the execution's actual membership/parent check.
        const invalid = target === "membership" ? { testcaseId: caseId, executionId } : link();
        for (const operation of [
          () => f.legacy.createBug(projectId, userId, { title: "Refused inactive target", links: [sibling, invalid] }),
          () => f.legacy.addBugLink(userId, String(bug.id), invalid),
          () => f.legacy.updateBug(userId, String(bug.id), { title: "Must not persist", links: [sibling, invalid] })
        ]) {
          const before = await state();
          f.activity.mockClear(); f.notification.mockClear(); f.bugNotification.mockClear();
          await expect(operation()).rejects.toBeInstanceOf(NotFoundException);
          expect(await state()).toEqual(before);
          expect(f.activity).not.toHaveBeenCalled();
          expect(f.notification).not.toHaveBeenCalled();
          expect(f.bugNotification).not.toHaveBeenCalled();
        }
      });

      it("serializes concurrent nullable-key adds and reversed multi-run replacements", async () => {
        const first = await f.legacy.createBug(projectId, userId, { title: "Concurrent first" });
        const second = await f.legacy.createBug(projectId, userId, { title: "Concurrent second" });
        await Promise.all([
          f.legacy.addBugLink(userId, String(first.id), { testcaseId: caseId }),
          f.legacy.addBugLink(userId, String(first.id), { testcaseId: caseId })
        ]);
        expect((await f.legacy.getBug(String(first.id))).links).toHaveLength(1);
        await Promise.all([
          f.legacy.updateBug(userId, String(first.id), { links: [link(), sibling] }),
          f.legacy.updateBug(userId, String(second.id), { links: [sibling, link()] })
        ]);
        expect((await f.legacy.getBug(String(first.id))).links).toHaveLength(2);
        expect((await f.legacy.getBug(String(second.id))).links).toHaveLength(2);
      });

      it("rolls back completed metadata and link writes after a later real PostgreSQL error", async () => {
        const bug = await f.legacy.createBug(projectId, userId, { title: "Before rollback", links: [{ testcaseId: caseId }] });
        const before = await state();
        const mutationPool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 2_000 });
        const checkedOut = new Set<PoolClient>();
        mutationPool.on("acquire", (client) => { checkedOut.add(client); });
        mutationPool.on("release", (_error, client) => { checkedOut.delete(client); });
        let inject = true;
        let completedMetadata = 0;
        let completedLink = 0;
        let pendingTitle: unknown;
        const observing = {
          query: pool.query.bind(pool),
          connect: async () => {
            const client = await mutationPool.connect();
            return {
              query: async (sql: string, values?: unknown[]) => {
                const result = await client.query(sql, values);
                if (inject && /^\s*UPDATE bugs SET/.test(sql)) {
                  completedMetadata += result.rowCount ?? 0;
                  pendingTitle = (await client.query("SELECT title FROM bugs WHERE id = $1", [bug.id])).rows[0].title;
                }
                if (inject && /^\s*INSERT INTO bug_links/.test(sql)) {
                  completedLink += result.rowCount ?? 0;
                  expect((await client.query("SELECT COUNT(*)::int AS count FROM bug_links WHERE bug_id = $1 AND deleted_at IS NULL", [bug.id])).rows[0].count).toBe(2);
                  await client.query("SELECT 1 / 0"); // Native SQLSTATE 22012, after both completed writes.
                }
                return result;
              },
              release: () => client.release()
            };
          }
        } as unknown as Pool;
        const updater = bugService(new DatabaseService(observing));
        const edit = { title: "Pending rollback title", links: [{ testcaseId: caseId }, { testcaseId: sibling.testcaseId }] };
        try {
          await expect(updater.legacy.updateBug(userId, String(bug.id), edit)).rejects.toMatchObject({ code: "22012" });
          expect(completedMetadata).toBe(1);
          expect(completedLink).toBe(1);
          expect(pendingTitle).toBe(edit.title);
          expect(await state()).toEqual(before);
          expect(updater.activity).not.toHaveBeenCalled();
          expect(updater.bugNotification).not.toHaveBeenCalled();
          expect(checkedOut.size).toBe(0);
          inject = false;
          const retry = await updater.legacy.updateBug(userId, String(bug.id), edit);
          expect(retry.links).toHaveLength(2);
          expect((await setup.query("SELECT title FROM bugs WHERE id = $1", [bug.id])).rows[0].title).toBe(edit.title);
          expect(checkedOut.size).toBe(0);
        } finally {
          for (const client of checkedOut) client.release(true);
          await mutationPool.end();
        }
      });

      it("waits for deletion and rejects a newly inactive target without a link or metadata prefix", async () => {
        const bug = await f.legacy.createBug(projectId, userId, { title: "Delete first" });
        const holder = await pool.connect();
        let open = false;
        let outcome: Promise<{ error?: unknown }> | undefined;
        try {
          await holder.query("BEGIN"); open = true;
          await holder.query("SELECT id FROM cycles WHERE id = $1 FOR UPDATE", [runId]);
          const pid = (await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
          outcome = f.legacy.updateBug(userId, String(bug.id), { title: "Rejected rename", links: [link()] }).then(
            () => ({}), (error: unknown) => ({ error })
          );
          await expectBlockedBy(pid);
          await holder.query("UPDATE cycles SET deleted_at = now() WHERE id = $1", [runId]);
          await holder.query("UPDATE cycle_items SET deleted_at = now() WHERE cycle_id = $1", [runId]);
          await holder.query("UPDATE executions SET deleted_at = now() WHERE id = $1", [executionId]);
          await holder.query("COMMIT"); open = false;
          const expected = await state();
          expect((await outcome).error).toBeInstanceOf(NotFoundException);
          expect(await state()).toEqual(expected);
        } finally {
          if (open) await holder.query("ROLLBACK");
          holder.release();
          if (outcome) await outcome;
        }
      });
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

  const rejectedHistoryText: Array<{ label: string; run?: Record<string, unknown>; result?: Record<string, unknown> }> = [
    { label: "run.tags[1]", run: { tags: ["valid", "bad\u0000tag"] } },
    { label: "results[1].actualResult", result: { actualResult: "bad\u0000result" } },
    { label: "results[1].errorMessage", result: { errorMessage: "bad\u0000message" } },
    { label: "results[1].errorStack", result: { errorStack: "bad\u0000stack" } },
    { label: "results[1].stepResults[0].comment", result: { stepResults: [{ position: 1, status: "Failed", comment: "bad\u0000step" }] } },
    { label: "results[1].history[0].comment", result: { history: [{ status: "Passed", comment: "bad\u0000history" }] } },
    { label: "results[1].history[0].errorStack", result: { history: [{ status: "Passed", errorStack: "bad\u0000stack" }] } }
  ];

  it.each(rejectedHistoryText)("refuses U+0000 at $label with a field-specific 400 and persisted domain state unchanged", async (invalid) => {
    await setup.query("UPDATE cycles SET source = 'automation', closed_at = NULL, close_status = NULL, status = 'In Progress' WHERE id = $1", [runId]);
    const state = async () => ({
      run: (await setup.query("SELECT * FROM cycles WHERE id = $1", [runId])).rows,
      executions: (await setup.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1 ORDER BY e.id", [runId])).rows,
      snapshots: (await setup.query("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [runId])).rows,
      audit: (await setup.query("SELECT * FROM audit_logs WHERE project_id = $1 ORDER BY id", [projectId])).rows,
      attachments: (await setup.query("SELECT * FROM attachments WHERE project_id = $1 ORDER BY id", [projectId])).rows
    });
    const before = await state();
    const legacy = makeLegacy(new DatabaseService(pool));
    // Authorization is owned separately by genuine-session smoke; this oracle observes real persistence.
    jest.spyOn(legacy as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> }, "requireCycleAccess").mockResolvedValue(projectId);
    jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({ caller_role: "owner" } as never);
    const activity = jest.spyOn(legacy, "logProjectActivity").mockResolvedValue(undefined);
    const error = await legacy.importRunHistory(userId, runId, {
      run: { tags: ["Must not persist"], timeSpentMs: 321, ...invalid.run },
      results: [
        { testcaseId: caseId, status: "Failed", actualResult: "Valid preceding row must not persist" },
        { testcaseId: "66666666-6666-4666-8666-666666666666", ...invalid.result }
      ],
      refreshSnapshots: true
    }).then(() => null, (failure: unknown) => failure);
    expect(await state()).toEqual(before);
    expect(activity).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({ error: `${invalid.label} must not contain U+0000` });
  });

  it.each(["run", "execution", "snapshot"])("rolls back historical import after the completed %s write and a later native PostgreSQL failure", async (failureStage) => {
    // Committed, dedicated fixtures: the independent setup connection must be
    // able to observe any accidentally committed prefix of the import.
    await setup.query(
      "UPDATE cycles SET status = 'In Progress', closed_at = NULL, close_status = NULL, ended_at = NULL, time_spent_ms = 10, tags = ARRAY['rollback-baseline'] WHERE id = $1",
      [runId]
    );
    await setup.query("UPDATE executions SET status = 'Passed', actual_result = 'Before failed import' WHERE id = $1", [executionId]);
    await setup.query("UPDATE cycle_items SET snapshot_title = 'Before snapshot refresh' WHERE cycle_id = $1", [runId]);

    type Read = (sql: string, values?: unknown[]) => Promise<QueryResult<Record<string, unknown>>>;
    const readPersisted = async (read: Read = (sql, values) => setup.query(sql, values)) => ({
      run: (await read("SELECT * FROM cycles WHERE id = $1", [runId])).rows,
      executions: (await read(
        "SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1 ORDER BY e.id", [runId]
      )).rows,
      snapshots: (await read("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [runId])).rows,
      audit: (await read("SELECT * FROM audit_logs WHERE project_id = $1 ORDER BY id", [projectId])).rows,
      attachments: (await read("SELECT * FROM attachments WHERE project_id = $1 ORDER BY id", [projectId])).rows
    });
    const before = await readPersisted();
    expect(before.run).toHaveLength(1);
    expect(before.executions).toHaveLength(1);
    expect(before.snapshots).toHaveLength(1);

    const completedWrites: { stage: string; rowCount: number | null; pending: Awaited<ReturnType<typeof readPersisted>> }[] = [];
    let inject = true;
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
        const stage = /^\s*UPDATE cycles SET\b/i.test(sql) ? "run"
          : /^\s*WITH input AS\b/i.test(sql) && /UPDATE executions e SET/.test(sql) ? "execution"
          : /^\s*UPDATE cycle_items ci SET\b/i.test(sql) ? "snapshot" : null;
        if (inject && stage) {
          completedWrites.push({ stage, rowCount: result.rowCount, pending: await readPersisted(execute) });
          // Reuse the existing bug-link rollback owner's native SQL fault pattern.
          // Forward each production write first, then fail on this same transaction client.
          // Invalid user text is a separate validation oracle, not this rollback trigger.
          if (stage === failureStage) await execute("SELECT 1 / 0");
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
      await expect(legacy.importRunHistory(userId, runId, {
        run: runUpdate,
        results: [resultUpdate],
        refreshSnapshots: true
      })).rejects.toMatchObject({ code: "22012" });

      expect(completedWrites.map((write) => write.stage)).toEqual(["run", "execution", "snapshot"].slice(0, ["run", "execution", "snapshot"].indexOf(failureStage) + 1));
      for (const write of completedWrites) {
        expect(write.rowCount).toBe(1);
        expect(write.pending.run[0]).toMatchObject({
          tags: ["rollback-pending"], status: "In Progress", source: "automation", closed_at: null, close_status: null
        });
        expect(Number(write.pending.run[0].time_spent_ms)).toBe(123);
        if (write.stage !== "run") expect(write.pending.executions[0]).toMatchObject({
          status: "Failed", actual_result: resultUpdate.actualResult, duration_ms: resultUpdate.durationMs,
          history: resultUpdate.history, step_results: resultUpdate.stepResults
        });
        if (write.stage === "snapshot") expect(write.pending.snapshots[0].snapshot_title).toBe("Closure case");
      }
      // Full persisted rows include lifecycle fields, result/history/step data,
      // snapshots and timestamps; inspect them outside the failed transaction.
      expect(await readPersisted()).toEqual(before);
      expect(activity).not.toHaveBeenCalled();
      expect(checkedOut.size).toBe(0);

      inject = false;
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
