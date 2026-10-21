import { Client, Pool } from "pg";
import { ConflictException } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { DatabaseService } from "../database/database.service";
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

  it("reuses a closed run for known cases but rejects an additional case on PostgreSQL", async () => {
    await setup.query("UPDATE cycles SET external_id = 'closure-replay-ci', closed_at = now(), status = 'Completed' WHERE id = $1", [runId]);
    const repeated = await svc.createRun(userId, projectId, {
      name: "Replayed closure",
      externalId: "closure-replay-ci",
      caseIds: ["CLCI-TC-1"]
    });
    expect(repeated.reused).toBe(true);
    expect(repeated.alreadyClosed).toBe(true);
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

});
