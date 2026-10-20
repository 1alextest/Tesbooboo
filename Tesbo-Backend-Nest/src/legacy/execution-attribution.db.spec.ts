import { Client } from "pg";
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
  });

  afterAll(async () => {
    if (client) {
      try { await client.query("ROLLBACK"); } finally { await client.end(); }
    }
  });

  it("retains the persisted executor across metadata updates, but attributes an explicit status write", async () => {
    const svc = makeLegacy({ query: (sql: string, args?: unknown[]) => client.query(sql, args) } as unknown as DatabaseService);
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
});
