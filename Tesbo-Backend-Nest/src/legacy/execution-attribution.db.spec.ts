import { Client } from "pg";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";

/**
 * Executes the production LegacyService against the migrated PostgreSQL schema.
 * This suite runs only in the disposable tesbo_ci database after migrations and
 * rolls back its own fixtures. It never connects to production.
 */
const databaseUrl = process.env.DATABASE_URL ?? "";
const canRun = /\/tesbo_ci(?:\?|$)/.test(databaseUrl);

(canRun ? describe : describe.skip)("execution attribution — PostgreSQL integration", () => {
  let client: Client;
  const actor = "11a6df91-7f69-4aa1-b999-568091409401";
  const original = "f899e70f-58c6-4c11-819b-c76590126ae1";
  let executionId: string;
  let projectId: string;
  let testcaseId: string;
  let runId: string;
  let otherRunId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query("BEGIN");
    // All records below remain within this transaction and are rolled back.
    await client.query("INSERT INTO users (id, email, name) VALUES ($1, $2, 'Original executor'), ($3, $4, 'Metadata editor')", [
      original, "ci-original-executor@tesbo.invalid", actor, "ci-metadata-editor@tesbo.invalid"
    ]);
    const org = await client.query<{ id: string }>(
      "INSERT INTO organizations (name, slug) VALUES ('Attribution CI', 'attribution-ci-regression') RETURNING id"
    );
    const project = await client.query<{ id: string }>(
      "INSERT INTO projects (organization_id, key, name) VALUES ($1, 'ATTRCI', 'Attribution CI') RETURNING id",
      [org.rows[0].id]
    );
    const tc = await client.query<{ id: string }>(
      "INSERT INTO testcases (project_id, external_id, title) VALUES ($1, 'ATTRCI-TC-1', 'Attribution regression') RETURNING id",
      [project.rows[0].id]
    );
    projectId = project.rows[0].id;
    testcaseId = tc.rows[0].id;
    const cycle = await client.query<{ id: string }>(
      "INSERT INTO cycles (project_id, name) VALUES ($1, 'Attribution integration') RETURNING id",
      [project.rows[0].id]
    );
    const item = await client.query<{ id: string }>(
      "INSERT INTO cycle_items (cycle_id, testcase_id, snapshot_title, position) VALUES ($1, $2, 'Attribution regression', 1) RETURNING id",
      [cycle.rows[0].id, tc.rows[0].id]
    );
    const e = await client.query<{ id: string }>(
      "INSERT INTO executions (cycle_item_id, status, executed_by) VALUES ($1, 'Passed', $2) RETURNING id",
      [item.rows[0].id, original]
    );
    executionId = e.rows[0].id;
    runId = cycle.rows[0].id;
    otherRunId = (await client.query<{ id: string }>(
      "INSERT INTO cycles (project_id, name) VALUES ($1, 'Other attribution run') RETURNING id", [projectId]
    )).rows[0].id;
  });

  afterAll(async () => {
    if (client) {
      try { await client.query("ROLLBACK"); } finally { await client.end(); }
    }
  });

  it("retains the persisted executor across metadata updates, but attributes an explicit status write", async () => {
    const svc = makeLegacy({
      query: (sql: string, args?: unknown[]) => client.query(sql, args),
      // Already within the test's BEGIN/ROLLBACK transaction. Keep both the
      // initial reads and the locked UPDATE on the same database connection.
      transaction: async <T>(fn: (locked: PoolClient) => Promise<T>) =>
        fn(client as unknown as PoolClient)
    } as unknown as DatabaseService);
    // This test isolates SQL persistence; separate tests cover project authorization.
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as { notifyExecutionChange: (...args: unknown[]) => Promise<void> }, "notifyExecutionChange").mockResolvedValue(undefined);

    await svc.updateExecution(executionId, actor, { actualResult: "Retested notes only" });
    let row = await client.query<{ executed_by: string; status: string; actual_result: string }>(
      "SELECT executed_by, status, actual_result FROM executions WHERE id = $1", [executionId]
    );
    expect(row.rows[0]).toMatchObject({ executed_by: original, status: "Passed", actual_result: "Retested notes only" });

    await svc.updateExecution(executionId, actor, { assigneeId: null });
    row = await client.query("SELECT executed_by, status, actual_result FROM executions WHERE id = $1", [executionId]);
    expect(row.rows[0].executed_by).toBe(original);

    await svc.updateExecution(executionId, actor, { status: "Failed" });
    row = await client.query("SELECT executed_by, status FROM executions WHERE id = $1", [executionId]);
    expect(row.rows[0]).toMatchObject({ executed_by: actor, status: "Failed" });
  });

  it.each(["other run", "unknown run", "malformed run"])("rejects %s context with persisted rows and provenance unchanged", async (kind) => {
    const svc = makeLegacy({
      query: (sql: string, args?: unknown[]) => client.query(sql, args),
      // Real SQL on this suite's rolled-back fixture transaction; not a new rollback-after-write claim.
      transaction: async <T>(fn: (locked: PoolClient) => Promise<T>) => fn(client as unknown as PoolClient)
    } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const activity = jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    const notify = jest.spyOn(svc as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange").mockResolvedValue(undefined);
    const state = async () => ({
      runs: (await client.query("SELECT * FROM cycles WHERE project_id = $1 ORDER BY id", [projectId])).rows,
      items: (await client.query("SELECT ci.* FROM cycle_items ci JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY ci.id", [projectId])).rows,
      executions: (await client.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY e.id", [projectId])).rows
    });
    const before = await state();
    const context = { quietStatus: false, expectedCycleId: kind === "other run" ? otherRunId : kind === "unknown run" ? "00000000-0000-4000-8000-000000000001" : "malformed" };
    await expect(svc.updateExecution(executionId, actor, { status: "Blocked", actualResult: "Must not persist" }, context)).rejects.toBeInstanceOf(NotFoundException);
    expect(await state()).toEqual(before);
    expect(activity).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  });

  it("accepts matching URL context without changing metadata-only executor attribution", async () => {
    const svc = makeLegacy({
      query: (sql: string, args?: unknown[]) => client.query(sql, args),
      transaction: async <T>(fn: (locked: PoolClient) => Promise<T>) => fn(client as unknown as PoolClient)
    } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange").mockResolvedValue(undefined);
    const before = (await client.query("SELECT executed_by FROM executions WHERE id = $1", [executionId])).rows[0];
    const context = { quietStatus: false, expectedCycleId: runId.toUpperCase() };
    await svc.updateExecution(executionId, actor, { actualResult: "Matching-context clarification" }, context);
    expect((await client.query("SELECT executed_by, actual_result FROM executions WHERE id = $1", [executionId])).rows[0])
      .toEqual({ executed_by: before.executed_by, actual_result: "Matching-context clarification" });
  });

  it.each(["inactive membership", "rebound execution"])("rechecks %s in real SQL after the initial read", async (kind) => {
    await client.query("SAVEPOINT execution_context_late_fixture");
    const originalItem = (await client.query<{ cycle_item_id: string }>("SELECT cycle_item_id FROM executions WHERE id = $1", [executionId])).rows[0].cycle_item_id;
    const otherItem = (await client.query<{ id: string }>(
      "INSERT INTO cycle_items (cycle_id, testcase_id, snapshot_title) VALUES ($1,$2,'Late binding fixture') RETURNING id", [otherRunId, testcaseId]
    )).rows[0].id;
    const state = async () => ({
      runs: (await client.query("SELECT * FROM cycles WHERE project_id = $1 ORDER BY id", [projectId])).rows,
      items: (await client.query("SELECT ci.* FROM cycle_items ci JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY ci.id", [projectId])).rows,
      executions: (await client.query("SELECT e.* FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id JOIN cycles c ON c.id = ci.cycle_id WHERE c.project_id = $1 ORDER BY e.id", [projectId])).rows
    });
    let pending: Awaited<ReturnType<typeof state>> | undefined;
    const svc = makeLegacy({
      query: (sql: string, args?: unknown[]) => client.query(sql, args),
      transaction: async <T>(fn: (locked: PoolClient) => Promise<T>) => {
        // An actual completed fixture write between service stages, not concurrent-client
        // evidence or a supported reparent API. Keep this suite's outer rollback intact.
        if (kind === "inactive membership") await client.query("UPDATE cycle_items SET deleted_at = now() WHERE id = $1", [originalItem]);
        else await client.query("UPDATE executions SET cycle_item_id = $2 WHERE id = $1", [executionId, otherItem]);
        pending = await state();
        return fn(client as unknown as PoolClient);
      }
    } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const activity = jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    const notify = jest.spyOn(svc as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange").mockResolvedValue(undefined);
    try {
      await expect(svc.updateExecution(executionId, actor, { status: "Blocked", actualResult: "Late write must not persist" }, { expectedCycleId: runId }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(pending).toBeDefined();
      expect(await state()).toEqual(pending);
      expect(activity).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
    } finally {
      await client.query("ROLLBACK TO SAVEPOINT execution_context_late_fixture");
      await client.query("RELEASE SAVEPOINT execution_context_late_fixture");
    }
  });
  it("rejects manual UI/MCP edits to finalized automated executions, while allowing open ones", async () => {
    // Reuse the existing test case in a distinct automation Run. All records
    // remain in this suite's disposable PostgreSQL transaction and roll back.
    const run = await client.query<{ id: string }>(
      "INSERT INTO cycles (project_id, name, source, status) VALUES ($1, 'Attribution automation guard', 'automation', 'In Progress') RETURNING id",
      [projectId]
    );
    const item = await client.query<{ id: string }>(
      "INSERT INTO cycle_items (cycle_id, testcase_id, snapshot_title, position) VALUES ($1, $2, 'Attribution regression', 1) RETURNING id",
      [run.rows[0].id, testcaseId]
    );
    const execution = await client.query<{ id: string }>(
      "INSERT INTO executions (cycle_item_id, status, executed_by) VALUES ($1, 'Passed', $2) RETURNING id",
      [item.rows[0].id, original]
    );

    const svc = makeLegacy({
      query: (sql: string, args?: unknown[]) => client.query(sql, args),
      transaction: async <T>(fn: (locked: PoolClient) => Promise<T>) =>
        fn(client as unknown as PoolClient)
    } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as { notifyExecutionChange: (...args: unknown[]) => Promise<void> }, "notifyExecutionChange")
      .mockResolvedValue(undefined);

    // An open automation Run still permits authorized manual edits.
    await svc.updateExecution(execution.rows[0].id, actor, { status: "Failed" });
    let stored = await client.query<{ status: string }>(
      "SELECT status FROM executions WHERE id = $1", [execution.rows[0].id]
    );
    expect(stored.rows[0].status).toBe("Failed");

    await client.query(
      "UPDATE cycles SET status = 'Completed', closed_at = now() WHERE id = $1", [run.rows[0].id]
    );
    await expect(svc.updateExecution(execution.rows[0].id, actor, { status: "Passed" }))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(svc.updateExecution(execution.rows[0].id, actor, { actualResult: "Late human correction" }))
      .rejects.toBeInstanceOf(ConflictException);
    await expect(svc.updateExecution(execution.rows[0].id, actor, { assigneeId: null }))
      .rejects.toBeInstanceOf(ConflictException);
    stored = await client.query(
      "SELECT status, executed_by, actual_result FROM executions WHERE id = $1",
      [execution.rows[0].id]
    );
    expect(stored.rows[0]).toMatchObject({
      status: "Failed", executed_by: actor, actual_result: null
    });
  });

});
