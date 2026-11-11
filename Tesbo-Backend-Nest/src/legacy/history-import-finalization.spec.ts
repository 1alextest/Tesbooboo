import { ConflictException } from "@nestjs/common";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";

describe("historical imports respect finalized automation runs", () => {
  const user = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const run = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";

  const expectNoWrites = (query: jest.Mock) => {
    // Importer reads are direct SELECTs; writes include WITH ... UPDATE executions.
    // Match the leading command, not keywords in a locking clause (FOR UPDATE),
    // identifier, or selected value. Treat WITH as potentially mutating, and fail
    // closed on unknown shapes rather than pretending this is a general SQL parser.
    const commands = query.mock.calls.map(([sql]) => /^\s*([a-z]+)\b/i.exec(sql)?.[1].toUpperCase());
    for (const command of commands) {
      expect(command).toMatch(/^(?:SELECT|WITH|INSERT|UPDATE|DELETE|TRUNCATE|MERGE)$/);
    }
    expect(commands.filter((command) => command !== "SELECT")).toEqual([]);
  };

  it.each([
    "UPDATE cycles SET status = 'Failed' WHERE id = $1",
    "  update cycles\nSET status = 'Failed' WHERE id = $1",
    "INSERT INTO executions (cycle_item_id) VALUES ($1)",
    "INSERT INTO executions (cycle_item_id) VALUES ($1) ON CONFLICT DO NOTHING",
    "DELETE FROM executions WHERE id = $1",
    "WITH input AS (SELECT $1::uuid AS id), target AS (SELECT id FROM input) UPDATE executions SET status = 'Failed' FROM target WHERE executions.id = target.id",
    "WITH changed AS (UPDATE cycles SET status = 'Failed' RETURNING id) SELECT id FROM changed",
    "TRUNCATE TABLE executions",
    "MERGE INTO executions USING imported ON executions.id = imported.id WHEN MATCHED THEN DELETE"
  ])("detects attempted SQL writes: %s", (sql) => {
    const query = jest.fn();
    query(sql);
    expect(() => expectNoWrites(query)).toThrow();
  });

  it.each([
    "SELECT id FROM cycles WHERE id = $1",
    "SELECT status, name, external_id, owner_id, source, closed_at FROM cycles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE",
    "\n select id FROM cycles WHERE id = $1 for no key update",
    "SELECT 'UPDATE' AS command FROM cycles"
  ])("allows non-mutating reads: %s", (sql) => {
    const query = jest.fn();
    query(sql);
    expect(() => expectNoWrites(query)).not.toThrow();
  });

  it("does not silently accept unsupported SQL command structures", () => {
    const query = jest.fn();
    query("CALL update_run_history($1)");
    expect(() => expectNoWrites(query)).toThrow();
  });

  const setup = (source: string, closed: boolean) => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM cycles WHERE id = $1") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: run, source, closed_at: closed ? new Date() : null }] };
      }
      if (sql.includes("UPDATE cycles SET")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const svc = makeLegacy({ query, transaction } as unknown as DatabaseService);
    jest.spyOn(svc as unknown as { requireCycleAccess: (...args: unknown[]) => Promise<string> }, "requireCycleAccess")
      .mockResolvedValue(project);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({ caller_role: "owner" } as never);
    jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    return { svc, query, transaction };
  };

  it("rejects a history import after an automated run has closed, with no mutation", async () => {
    const { svc, query, transaction } = setup("automation", true);
    await expect(svc.importRunHistory(user, run, { run: { status: "In Progress" } }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(transaction).toHaveBeenCalledTimes(1);
    expectNoWrites(query);
  });

  it("rejects injecting closedAt through the history import of an open automated run", async () => {
    const { svc, query } = setup("automation", false);
    await expect(svc.importRunHistory(user, run, {
      run: { closedAt: "2026-10-22T12:00:00Z" }
    })).rejects.toBeInstanceOf(ConflictException);
    expectNoWrites(query);
  });

  it("preserves authorized historical import for manual runs", async () => {
    const { svc, query } = setup("manual", true);
    const result = await svc.importRunHistory(user, run, { run: { status: "Completed" } });
    expect(result.runFields).toEqual(["status"]);
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE cycles SET"))).toBe(true);
  });
});
