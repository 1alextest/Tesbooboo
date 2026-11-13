import { Client } from "pg";
import type { PoolClient } from "pg";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const url = process.env.DATABASE_URL ?? "";
const enabled = /\/tesbo_ci(?:\?|$)/.test(url);

(enabled ? describe : describe.skip)("Run lifecycle — concurrent final-case removal", () => {
  let setup: Client;
  let remover: Client;
  let updater: Client;
  let projectId: string;
  let cycleId: string;
  let testcaseId: string;
  let orgId: string;

  beforeAll(async () => {
    setup = new Client({ connectionString: url });
    remover = new Client({ connectionString: url });
    updater = new Client({ connectionString: url });
    await Promise.all([setup.connect(), remover.connect(), updater.connect()]);
    const org = await setup.query<{ id: string }>(
      "INSERT INTO organizations (name, slug) VALUES ('Atomic run CI', $1) RETURNING id",
      [`run-atomic-${Date.now()}`]
    );
    orgId = org.rows[0].id;
    const project = await setup.query<{ id: string }>(
      "INSERT INTO projects (organization_id, key, name) VALUES ($1, 'RAC', 'Run atomic CI') RETURNING id", [orgId]
    );
    projectId = project.rows[0].id;
    const tc = await setup.query<{ id: string }>(
      "INSERT INTO testcases (project_id, external_id, title) VALUES ($1, 'RAC-TC-1', 'Atomic run') RETURNING id",
      [projectId]
    );
    testcaseId = tc.rows[0].id;
    const cycle = await setup.query<{ id: string }>(
      "INSERT INTO cycles (project_id, name) VALUES ($1, 'Atomic lifecycle') RETURNING id", [projectId]
    );
    cycleId = cycle.rows[0].id;
    await setup.query(
      "INSERT INTO cycle_items (cycle_id, testcase_id, snapshot_title, position) VALUES ($1, $2, 'Atomic run', 1)",
      [cycleId, testcaseId]
    );
  });

  afterAll(async () => {
    // Disposable tesbo_ci only; remove every committed fixture even after failures.
    if (setup) {
      try {
        if (cycleId) {
          await setup.query("DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id = $1)", [cycleId]);
          await setup.query("DELETE FROM cycle_items WHERE cycle_id = $1", [cycleId]);
          await setup.query("DELETE FROM cycles WHERE id = $1", [cycleId]);
        }
        if (testcaseId) await setup.query("DELETE FROM testcases WHERE id = $1", [testcaseId]);
        if (projectId) await setup.query("DELETE FROM projects WHERE id = $1", [projectId]);
        if (orgId) await setup.query("DELETE FROM organizations WHERE id = $1", [orgId]);
      } finally { await Promise.all([setup.end(), remover.end(), updater.end()]); }
    }
  });

  it("waits for final-case removal, then rejects completion without changing run state", async () => {
    const actor = "11a6df91-7f69-4aa1-b999-568091409401";
    const svc = makeLegacy({
      query: (sql: string, args?: unknown[]) => updater.query(sql, args),
      transaction: async <T>(fn: (client: PoolClient) => Promise<T>) => {
        await updater.query("BEGIN");
        try { const r = await fn(updater as unknown as PoolClient); await updater.query("COMMIT"); return r; }
        catch (e) { await updater.query("ROLLBACK"); throw e; }
      }
    } as unknown as DatabaseService);
    jest.spyOn(svc, "requireCycleAccessForUser").mockResolvedValue(projectId);
    jest.spyOn(svc as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> }, "requireCycleAccess")
      .mockResolvedValue(projectId);
    jest.spyOn(svc as unknown as { notifyRunLifecycle: (...args: unknown[]) => Promise<void> }, "notifyRunLifecycle")
      .mockResolvedValue(undefined);

    await remover.query("BEGIN");
    // Mimic the real removal lock order: parent row first, then child.
    await remover.query("SELECT id FROM cycles WHERE id = $1 FOR UPDATE", [cycleId]);
    await remover.query("UPDATE cycle_items SET deleted_at = now() WHERE cycle_id = $1", [cycleId]);
    let settled = false;
    const pending = svc.updateCycle(cycleId, actor, { status: "Completed" }).finally(() => { settled = true; });
    // The UPDATE has to wait for remover's transaction. A short bounded delay
    // checks the lock, not a timer used to decide which transaction wins.
    await new Promise((r) => setTimeout(r, 100));
    expect(settled).toBe(false);
    await remover.query("COMMIT");
    await expect(pending).rejects.toMatchObject({ response: { error: "Add at least one test case before starting or completing a run" } });
    const state = await setup.query<{ status: string }>("SELECT status FROM cycles WHERE id = $1", [cycleId]);
    expect(state.rows[0].status).not.toBe("Completed");
  });

  // Reuse this migrated Run fixture and the shared service constructor, not a mocked SQL result.
  const publicReader = () => makeLegacy({
    query: (sql: string, args?: unknown[]) => setup.query(sql, args)
  } as unknown as DatabaseService);
  const stored = async () => ({
    run: (await setup.query("SELECT * FROM cycles WHERE id = $1", [cycleId])).rows,
    items: (await setup.query("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [cycleId])).rows,
    results: (await setup.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1 ORDER BY e.id", [cycleId])).rows,
    audit: (await setup.query("SELECT * FROM audit_logs WHERE project_id = $1 ORDER BY id", [projectId])).rows
  });

  it.each(["populated", "null"])("publishes only the approved eight Run fields, preserving %s values and stored rows", async (values) => {
    await setup.query("BEGIN");
    try {
      const populated = values === "populated";
      await setup.query(
        `UPDATE cycles SET share_token = $2, share_enabled = true,
           description = $3, environment = $4, build_version = $5, started_at = $6, ended_at = $7,
           release_name = 'internal release', branch_name = 'private/branch', commit_sha = 'internal-commit',
           build_url = 'https://ci.invalid/private', tags = ARRAY['internal-tag'] WHERE id = $1`,
        [cycleId, cycleId, populated ? "Published description" : null, populated ? "Staging" : null,
          populated ? "1.2.3" : null, populated ? "2026-11-01T10:00:00Z" : null, populated ? "2026-11-01T11:00:00Z" : null]
      );
      const before = await stored();
      const row = before.run[0];
      const result = await publicReader().publicCycle(cycleId);
      expect(await stored()).toEqual(before);
      expect(result).toEqual({
        name: row.name, status: row.status, description: row.description, environment: row.environment,
        buildVersion: row.build_version, createdAt: row.created_at, startedAt: row.started_at, endedAt: row.ended_at
      });
    } finally { await setup.query("ROLLBACK"); }
  });

  it.each(["disabled", "deleted", "unknown"])("refuses both public readers for a %s token without changing stored rows", async (state) => {
    await setup.query("BEGIN");
    try {
      await setup.query(
        "UPDATE cycles SET share_token = $2, share_enabled = $3, deleted_at = $4 WHERE id = $1",
        [cycleId, cycleId, state !== "disabled", state === "deleted" ? new Date() : null]
      );
      const before = await stored();
      const svc = publicReader();
      const token = state === "unknown" ? `unknown-${cycleId}` : cycleId;
      for (const read of [() => svc.publicCycle(token), () => svc.publicCycleExecutions(token)]) {
        await expect(read()).rejects.toMatchObject({ status: 404, response: { error: "Shared run not found" } });
      }
      expect(await stored()).toEqual(before);
    } finally { await setup.query("ROLLBACK"); }
  });
});
