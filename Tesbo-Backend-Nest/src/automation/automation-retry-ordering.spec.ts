import { ConflictException } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

describe("automation retry ordering", () => {
  const actor = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const run = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const testcase = "f899e70f-58c6-4c11-819b-c76590126ae1";
  const execution = "0c4de6af-61f3-453c-8a4b-6173eb7658cd";

  function setup() {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    let current = {
      id: execution, status: "Untested", retry_count: 0,
      executed_at: null as string | null,
      duration_ms: null as number | null,
      error_message: null as string | null,
      error_stack: null as string | null,
      reported_by: "human" as string | null
    };
    let timestampUpdates = 0;
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes("FROM actors a")) return { rows: [{ id: actor }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id")) return { rows: [{ id: run, name: "CI", closed_at: null, source: "automation" }] };
      if (sql.includes("FROM testcases")) return { rows: [{ id: testcase, external_id: "TES-TC-1", title: "Retry test", status: "Approved" }] };
      if (sql.includes("UPDATE executions e SET")) {
        const incoming = params[5] as number | null;
        if (incoming !== null && incoming <= current.retry_count &&
          !(current.status === "Untested" && current.executed_at === null && current.reported_by === "human" && current.retry_count === 0 && incoming === 0))
          return { rows: [] };
        current = {
          id: execution, status: String(params[2]),
          retry_count: incoming ?? (current.status === "Untested" ? current.retry_count : current.retry_count + 1),
          duration_ms: params[4] as number | null,
          error_message: params[6] as string | null,
          error_stack: params[7] as string | null,
          reported_by: "automation", executed_at: "2026-10-22T05:00:00Z"
        };
        return { rows: [current] };
      }
      if (sql.includes("SELECT e.id, e.status, e.retry_count")) return { rows: [{ ...current }] };
      if (sql.includes("UPDATE cycles SET last_result_at")) timestampUpdates++;
      return { rows: [] };
    });
    const legacy = { requireProjectAccess: jest.fn().mockResolvedValue({}) } as unknown as LegacyService;
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const svc = new AutomationService({ query, transaction } as unknown as DatabaseService, legacy, {} as PlanLimitsService, {} as StorageService);
    jest.spyOn(svc as unknown as { attachCases: (...args: unknown[]) => Promise<{ attached: number; unknown: string[] }> }, "attachCases")
      .mockResolvedValue({ attached: 0, unknown: [] });
    return { svc, query, queries, current: () => current, updated: () => timestampUpdates };
  }

  it("keeps retry 2 Passed when retry 1 Failed arrives late", async () => {
    const { svc, current, updated, queries } = setup();
    await svc.recordResult(actor, project, run, { caseId: "TES-TC-1", status: "pass", retryCount: 2 });
    await expect(svc.recordResult(actor, project, run, { caseId: "TES-TC-1", status: "fail", retryCount: 1 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(current().status).toBe("Passed");
    expect(current().retry_count).toBe(2);
    expect(updated()).toBe(1);
    expect(queries.find(q => q.sql.includes("UPDATE executions e SET"))?.sql)
      .toContain("$6::int > e.retry_count");
  });

  it("treats an identical transport replay as a no-op", async () => {
    const { svc, current, updated } = setup();
    const body = { caseId: "TES-TC-1", status: "pass", retryCount: 0, durationMs: 125 };
    await svc.recordResult(actor, project, run, body);
    const duplicate = await svc.recordResult(actor, project, run, body);
    expect(duplicate.retryCount).toBe(0);
    expect(current().status).toBe("Passed");
    expect(updated()).toBe(1);
  });

  it("rejects contradictory outcomes for the same retry index", async () => {
    const { svc, current } = setup();
    await svc.recordResult(actor, project, run, { caseId: "TES-TC-1", status: "pass", retryCount: 0 });
    await expect(svc.recordResult(actor, project, run, { caseId: "TES-TC-1", status: "fail", retryCount: 0 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(current().status).toBe("Passed");
  });
  it("blocks stale retry after manual reset to Untested", async () => {
    const { svc, current, updated, query } = setup();
    await svc.recordResult(actor, project, run, { caseId: "TES-TC-1", status: "pass", retryCount: 2 });
    // Simulate manual reset while retaining last attempt watermark/provenance.
    const currentRow = current();
    currentRow.status = "Untested";
    await expect(svc.recordResult(actor, project, run, { caseId: "TES-TC-1", status: "fail", retryCount: 1 }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(current().status).toBe("Untested");
    expect(current().retry_count).toBe(2);
    expect(updated()).toBe(1);
    expect(query.mock.calls.find(([sql]) => sql.includes("UPDATE executions e SET"))?.[0])
      .toContain("e.executed_at IS NULL");
  });

});
