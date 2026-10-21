import { ConflictException } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

describe("automation Run closure boundary", () => {
  const user = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const run = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  function setup() {
    let closed = false;
    let results = 0;
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM actors a")) return { rows: [{ id: user }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id") && !sql.includes("FOR UPDATE"))
        return { rows: [{ id: run, name: "CI", closed_at: closed ? "2026-10-21" : null }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id") && sql.includes("FOR UPDATE"))
        return { rows: [{ id: run, closed_at: closed ? "2026-10-21" : null }] };
      if (sql.includes("FROM testcases")) return { rows: [{ id: user, external_id: "CI-TC-1", title: "Case", status: "Approved" }] };
      if (sql.includes("COUNT(*)::int AS total")) return { rows: [{ total: results, passed: results, failed: 0, skipped: 0, blocked: 0, untested: 0 }] };
      if (sql.includes("UPDATE executions e SET")) { results++; return { rows: [{ id: user, status: "Passed", retry_count: 0 }] }; }
      if (sql.includes("UPDATE cycles SET status = 'Completed'")) closed = true;
      if (sql.includes("SELECT id, name, status, source, triggered_by")) return { rows: [{ id: run, status: "Completed", name: "CI" }] };
      return { rows: [] };
    });
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const legacy = { requireProjectAccess: jest.fn().mockResolvedValue({}), logProjectActivity: jest.fn() } as unknown as LegacyService;
    const svc = new AutomationService({ query, transaction } as unknown as DatabaseService, legacy, {} as PlanLimitsService, {} as StorageService);
    jest.spyOn(svc as unknown as { attachCases: (...args: unknown[]) => Promise<{ attached: number; unknown: string[] }> }, "attachCases")
      .mockResolvedValue({ attached: 0, unknown: [] });
    return { svc, query, getResults: () => results, getClosed: () => closed };
  }

  it("rejects result submission after closure without changing the execution", async () => {
    const { svc, getResults } = setup();
    await svc.closeRun(user, project, run, { status: "completed" });
    await expect(svc.recordResult(user, project, run, { caseId: "CI-TC-1", status: "pass", retryCount: 0 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(getResults()).toBe(0);
  });

  it("commits a result before closure and returns idempotent close on replay", async () => {
    const { svc, getResults } = setup();
    await svc.recordResult(user, project, run, { caseId: "CI-TC-1", status: "pass", retryCount: 0 });
    expect(getResults()).toBe(1);
    const first = await svc.closeRun(user, project, run, { status: "completed", summary: { passed: 1 } });
    expect(first.alreadyClosed).toBe(false);
    const duplicate = await svc.closeRun(user, project, run, { status: "completed" });
    expect(duplicate.alreadyClosed).toBe(true);
    expect(getResults()).toBe(1);
  });

  it("uses the same locked cycle query in both transaction paths", async () => {
    const { svc, query } = setup();
    await svc.recordResult(user, project, run, { caseId: "CI-TC-1", status: "pass", retryCount: 0 });
    await svc.closeRun(user, project, run, {});
    expect(query.mock.calls.filter(([sql]) => sql.includes("FOR UPDATE") && sql.includes("FROM cycles"))).toHaveLength(2);
  });
});
