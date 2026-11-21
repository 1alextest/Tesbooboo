import { ConflictException } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

describe("closed automation Run reuse", () => {
  const user = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const runId = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  function setup(closed: boolean) {
    const query = jest.fn(async (sql: string, _args: unknown[] = []) => {
      if (sql.includes("FROM actors a")) return { rows: [{ id: user }] };
      if (sql.includes("SELECT id FROM cycles WHERE project_id = $1 AND external_id"))
        return { rows: [{ id: runId }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR UPDATE"))
        return { rows: [{ id: runId, closed_at: closed ? new Date() : null }] };
      if (sql.includes("SELECT id, name, status, source, triggered_by"))
        return { rows: [{ id: runId, name: "Run", status: "Completed", closed_at: closed ? new Date() : null }] };
      if (sql.includes("COUNT(*)::int AS total"))
        return { rows: [{ total: 1, passed: 1, failed: 0, skipped: 0, blocked: 0, untested: 0 }] };
      return { rows: [] };
    });
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const legacy = { requireProjectAccess: jest.fn().mockResolvedValue({}) } as unknown as LegacyService;
    const svc = new AutomationService({ query, transaction } as unknown as DatabaseService, legacy, {} as PlanLimitsService, {} as StorageService);
    const attach = jest.spyOn(svc as unknown as { attachCases: (...args: unknown[]) => Promise<{ attached: number; unknown: string[] }> }, "attachCases")
      .mockResolvedValue({ attached: 1, unknown: [] });
    return { svc, attach, transaction };
  }

  it("returns an unchanged closed Run when replay sends no cases", async () => {
    const { svc, attach, transaction } = setup(true);
    const result = await svc.createRun(user, project, { name: "Run", externalId: "CI-123" });
    expect(result.reused).toBe(true);
    expect(result.casesAttached).toBe(0);
    expect(attach).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects case attachment to closed Run before mutation", async () => {
    const { svc, attach } = setup(true);
    await expect(svc.createRun(user, project, { name: "Run", externalId: "CI-123", caseIds: ["CI-TC-1"] }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(attach).not.toHaveBeenCalled();
  });

  it("continues to attach cases for open reused Runs", async () => {
    const { svc, attach } = setup(false);
    const result = await svc.createRun(user, project, { name: "Run", externalId: "CI-123", caseIds: ["CI-TC-1"] });
    expect(result.casesAttached).toBe(1);
    expect(attach).toHaveBeenCalledTimes(1);
  });
});
