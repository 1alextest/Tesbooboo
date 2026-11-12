import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";
import { NotFoundException } from "@nestjs/common";

process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

describe("execution attribution", () => {
  const actor = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const execution = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const run = "0c4de6af-61f3-453c-8a4b-6173eb7658cd";
  const original = "f899e70f-58c6-4c11-819b-c76590126ae1";

  function setup(missingAtUpdate = false) {
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM executions e") && sql.includes("WHERE e.id = $1"))
        return { rows: [{ id: execution, project_id: project, status: "Passed", executed_by: original, assignee_id: null, testcase_title: "Search results", cycle_id: run }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE")) 
        return { rows: [{ source: "manual", closed_at: null }] };
      if (sql.includes("UPDATE executions SET")) return { rows: missingAtUpdate ? [] : [{ id: execution, status: params[1] ?? "Passed", executed_by: params[1] ? actor : original, assignee_id: null }] };
      return { rows: [] };
    });
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const svc = makeLegacy({ query, transaction } as unknown as DatabaseService);
    jest.spyOn(svc as unknown as { requireProjectAccess: (...args: unknown[]) => Promise<unknown> }, "requireProjectAccess").mockResolvedValue(undefined);
    const activity = jest.spyOn(svc as unknown as { logProjectActivity: (...args: unknown[]) => Promise<unknown> }, "logProjectActivity").mockResolvedValue(undefined);
    const notify = jest.spyOn(svc as unknown as { notifyExecutionChange: (...args: unknown[]) => Promise<unknown> }, "notifyExecutionChange").mockResolvedValue(undefined);
    return { svc, query, activity, notify };
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
    expect(params[9]).toBe(run);
    expect(sql).toContain("cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id = $10::uuid AND deleted_at IS NULL)");
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

  it("rejects an unavailable/rebound child at UPDATE without emitting a success event", async () => {
    const { svc, activity, notify } = setup(true);
    await expect(svc.updateExecution(execution, actor, { status: "Blocked" }, { expectedCycleId: run })).rejects.toBeInstanceOf(NotFoundException);
    expect(activity).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  describe("bulk transaction orchestration", () => {
    const second = "92b4ec73-5fea-49b3-a59e-3cd4a4d90c46";
    function bulkFixture(failSecond = false) {
      let inside = false;
      let committed = false;
      const writes: string[] = [];
      const selected = [execution, second].map((id) => ({ id, project_id: project, cycle_id: run, status: "Passed", assignee_id: original, testcase_title: "Case", tc_label: "CASE-1" }));
      const query = jest.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes("FROM cycles") && sql.includes("FOR UPDATE")) return { rows: [{ source: "manual", closed_at: null }] };
        if (sql.includes("FOR UPDATE OF ci, e")) return { rows: selected.map((row) => ({ ...row })) };
        if (sql.includes("UPDATE executions SET")) {
          expect(inside).toBe(true);
          writes.push(String(params[0]));
          if (failSecond && writes.length === 2) throw new Error("Native fault surrogate (unit only)");
          return { rows: [{ ...selected.find((row) => row.id === params[0]), status: params[1] ?? "Passed", assignee_id: params[8] ? null : original }] };
        }
        return { rows: [] };
      });
      const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => {
        inside = true;
        try { const result = await fn({ query }); committed = true; return result; }
        finally { inside = false; }
      });
      const svc = makeLegacy({ query, transaction } as unknown as DatabaseService);
      const access = jest.spyOn(svc as unknown as { requireCycleAccess: () => Promise<string> }, "requireCycleAccess").mockResolvedValue(project);
      const single = jest.spyOn(svc, "updateExecution");
      const assertCommitted = async () => { expect(inside).toBe(false); expect(committed).toBe(true); expect(writes).toHaveLength(2); };
      const activity = jest.spyOn(svc, "logProjectActivity").mockImplementation(assertCommitted);
      const notify = jest.spyOn(svc as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange").mockImplementation(assertCommitted);
      const summary = jest.spyOn(svc as unknown as { notifyBulkStatusChange: () => Promise<void> }, "notifyBulkStatusChange").mockImplementation(assertCommitted);
      const call = (kind: string) => kind === "status"
        ? svc.bulkUpdateExecutionStatus(run, actor, { executionIds: [execution, second], status: "Skipped" })
        : svc.bulkAssignExecutions(run, actor, { executionIds: [execution, second], assigneeId: null });
      return { query, transaction, access, single, activity, notify, summary, call };
    }

    it.each(["status", "assignment"])("uses one %s transaction/shared row writer and publishes only after commit", async (kind) => {
      const f = bulkFixture();
      expect(await f.call(kind)).toMatchObject({ updated: 2 });
      expect(f.transaction).toHaveBeenCalledTimes(1);
      expect(f.access).toHaveBeenCalledTimes(1);
      expect(f.single).not.toHaveBeenCalled(); // No per-item authorization/BEGIN/COMMIT loop.
      expect(f.activity).toHaveBeenCalledTimes(2);
      expect(f.notify).toHaveBeenCalledTimes(2);
      expect(f.summary).toHaveBeenCalledTimes(kind === "status" ? 1 : 0);
    });

    it.each(["status", "assignment"])("emits no success effects after a later %s writer rejects", async (kind) => {
      const f = bulkFixture(true);
      await expect(f.call(kind)).rejects.toThrow("Native fault surrogate (unit only)");
      expect(f.transaction).toHaveBeenCalledTimes(1);
      expect(f.activity).not.toHaveBeenCalled(); expect(f.notify).not.toHaveBeenCalled(); expect(f.summary).not.toHaveBeenCalled();
    });

    it.each(["status", "assignment"])("authorizes the %s parent before transaction entry", async (kind) => {
      const f = bulkFixture();
      f.access.mockRejectedValue(new NotFoundException({ error: "Cycle not found" }));
      await expect(f.call(kind)).rejects.toBeInstanceOf(NotFoundException);
      expect(f.transaction).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled();
    });
  });
});
