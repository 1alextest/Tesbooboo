import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";

process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("execution attribution", () => {
  const actor = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const execution = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const run = "0c4de6af-61f3-453c-8a4b-6173eb7658cd";
  const original = "f899e70f-58c6-4c11-819b-c76590126ae1";

  function setup() {
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM executions e") && sql.includes("WHERE e.id = $1"))
        return { rows: [{ id: execution, project_id: project, status: "Passed", executed_by: original, assignee_id: null, testcase_title: "Search results", cycle_id: run }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE")) 
        return { rows: [{ source: "manual", closed_at: null }] };
      if (sql.includes("UPDATE executions SET")) return { rows: [{ id: execution, status: params[1] ?? "Passed", executed_by: params[1] ? actor : original, assignee_id: null }] };
      return { rows: [] };
    });
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const svc = makeLegacy({ query, transaction } as unknown as DatabaseService);
    jest.spyOn(svc as unknown as { requireProjectAccess: (...args: unknown[]) => Promise<unknown> }, "requireProjectAccess").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as { logProjectActivity: (...args: unknown[]) => Promise<unknown> }, "logProjectActivity").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as { notifyExecutionChange: (...args: unknown[]) => Promise<unknown> }, "notifyExecutionChange").mockResolvedValue(undefined);
    return { svc, query };
  }

  it("keeps the original executor when changing only actual result", async () => {
    const { svc, query } = setup();
    await svc.updateExecution(execution, actor, { actualResult: "Added clarification" });
    const update = query.mock.calls.find(([sql]) => sql.includes("UPDATE executions SET"));
    if (!update || !update[1]) throw new Error("Expected execution UPDATE with SQL parameters");
    const [sql, params] = update;
    expect(sql).toContain("executed_by=CASE WHEN $2 IS NULL THEN executed_by ELSE $7 END");
    expect(params[1]).toBeNull();
    expect(params[6]).toBe(actor);
  });

  it("attributes an explicit execution status write to the acting user", async () => {
    const { svc, query } = setup();
    await svc.updateExecution(execution, actor, { status: "Failed" });
    const update = query.mock.calls.find(([sql]) => sql.includes("UPDATE executions SET"));
    if (!update || !update[1]) throw new Error("Expected execution UPDATE with SQL parameters");
    const [, params] = update;
    expect(params[1]).toBe("Failed");
    expect(params[6]).toBe(actor);
  });
});
