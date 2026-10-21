import { Client } from "pg";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";
import { AutomationService } from "./automation.service";

const url = process.env.DATABASE_URL ?? "";
const enabled = /\/tesbo_ci(?:\?|$)/.test(url);

(enabled ? describe : describe.skip)("automation retry ordering — real PostgreSQL", () => {
  let db: Client;
  const actor = "11a6df91-7f69-4aa1-b999-568091409401";
  let projectId: string;
  let runId: string;
  let caseId: string;
  let executionId: string;

  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query("BEGIN");
    await db.query(
      "INSERT INTO users (id, email, name) VALUES ($1, 'ci-automation-retry@tesbo.invalid', 'Automation CI')",
      [actor]
    );
    const org = await db.query<{ id: string }>(
      "INSERT INTO organizations (name, slug) VALUES ('Retry CI', 'automation-retry-ci') RETURNING id"
    );
    const proj = await db.query<{ id: string }>(
      "INSERT INTO projects (organization_id, key, name) VALUES ($1, 'RTCI', 'Retry CI') RETURNING id",
      [org.rows[0].id]
    );
    projectId = proj.rows[0].id;
    const tc = await db.query<{ id: string }>(
      "INSERT INTO testcases (project_id, external_id, title) VALUES ($1, 'RTCI-TC-1', 'Retry ordering') RETURNING id",
      [projectId]
    );
    caseId = tc.rows[0].id;
    const run = await db.query<{ id: string }>(
      "INSERT INTO cycles (project_id, name, source, status) VALUES ($1, 'Retry ordering', 'automation', 'In Progress') RETURNING id",
      [projectId]
    );
    runId = run.rows[0].id;
    const item = await db.query<{ id: string }>(
      "INSERT INTO cycle_items (cycle_id, testcase_id, snapshot_title, position) VALUES ($1, $2, 'Retry ordering', 1) RETURNING id",
      [runId, caseId]
    );
    const execution = await db.query<{ id: string }>(
      "INSERT INTO executions (cycle_item_id) VALUES ($1) RETURNING id",
      [item.rows[0].id]
    );
    executionId = execution.rows[0].id;
  });

  afterAll(async () => {
    if (db) {
      try { await db.query("ROLLBACK"); } finally { await db.end(); }
    }
  });

  it("refuses late failed retry and preserves persisted newer Passed row", async () => {
    const legacy = { requireProjectAccess: async () => ({}) } as unknown as LegacyService;
    const svc = new AutomationService(
      { query: (sql: string, args?: unknown[]) => db.query(sql, args) } as unknown as DatabaseService,
      legacy,
      {} as PlanLimitsService,
      {} as StorageService
    );
    jest.spyOn(svc as unknown as { attachCases: (...args: unknown[]) => Promise<{ attached: number; unknown: string[] }> }, "attachCases")
      .mockResolvedValue({ attached: 0, unknown: [] });

    await svc.recordResult(actor, projectId, runId, { caseId: "RTCI-TC-1", status: "pass", retryCount: 2, durationMs: 123 });
    await expect(svc.recordResult(actor, projectId, runId, { caseId: "RTCI-TC-1", status: "fail", retryCount: 1 }))
      .rejects.toMatchObject({ status: 409 });
    await svc.recordResult(actor, projectId, runId, { caseId: "RTCI-TC-1", status: "pass", retryCount: 2, durationMs: 123 });
    const r = await db.query<{ status: string; retry_count: number; duration_ms: number }>(
      "SELECT status, retry_count, duration_ms FROM executions WHERE id = $1",
      [executionId]
    );
    expect(r.rows[0]).toMatchObject({ status: "Passed", retry_count: 2, duration_ms: 123 });
  });
});
