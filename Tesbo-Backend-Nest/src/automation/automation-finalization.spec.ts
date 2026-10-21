import { ConflictException } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

describe("automation finalized-run write barriers", () => {
  const user = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const run = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const execution = "0c4de6af-61f3-453c-8a4b-6173eb7658cd";
  const caseId = "f899e70f-58c6-4c11-819b-c76590126ae1";

  function setup(opts: { closeDuringUpload?: boolean; closed?: boolean } = {}) {
    let closed = Boolean(opts.closed);
    const saved: string[] = [];
    const deleted: string[] = [];
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM actors a")) return { rows: [{ id: user }] };
      if (sql.includes("FROM cycles WHERE project_id = $1 AND external_id")) return { rows: [{ id: run }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: run, closed_at: closed ? new Date() : null }] };
      }
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id")) {
        return { rows: [{ id: run, name: "CI", closed_at: closed ? new Date() : null }] };
      }
      if (sql.includes("FROM testcases")) return { rows: [{ id: caseId, external_id: "CI-TC-1", title: "Case", status: "Approved" }] };
      if (sql.includes("FROM cycle_items WHERE cycle_id")) return { rows: [{ testcase_id: caseId }] };
      if (sql.includes("SELECT e.id FROM executions e")) return { rows: [{ id: execution }] };
      if (sql.includes("INSERT INTO attachments")) return { rows: [{ id: "evidence-id" }] };
      if (sql.includes("SELECT id, name, status, source, triggered_by")) return { rows: [{ id: run, name: "CI" }] };
      if (sql.includes("COUNT(*)::int")) return { rows: [{ total: 1, passed: 1, failed: 0, skipped: 0, blocked: 0, untested: 0 }] };
      return { rows: [] };
    });
    const db = {
      query,
      transaction: async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query })
    } as unknown as DatabaseService;
    const legacy = { requireProjectAccess: async () => ({ organization_id: project }), logProjectActivity: async () => undefined } as unknown as LegacyService;
    const storage = {
      put: async (key: string) => { saved.push(key); if (opts.closeDuringUpload) closed = true; },
      delete: async (key: string) => { deleted.push(key); }
    } as unknown as StorageService;
    const limits = { checkStorageAvailable: async () => ({ allowed: true }) } as unknown as PlanLimitsService;
    const svc = new AutomationService(db, legacy, limits, storage);
    return { svc, query, saved, deleted };
  }

  it("accepts an idempotent closed-run reuse only for existing cases", async () => {
    const { svc } = setup({ closed: true });
    const reused = await svc.createRun(user, project, { name: "Existing", externalId: "ci-123", caseIds: ["CI-TC-1"] });
    expect(reused.alreadyClosed).toBe(true);
    expect(reused.casesAttached).toBe(0);
  });

  it("rejects evidence once the run is closed without storing files", async () => {
    const { svc, saved } = setup({ closed: true });
    await expect(svc.uploadEvidence(user, project, run, "CI-TC-1", "screenshot", [{
      buffer: Buffer.from("abc"), originalname: "screen.png", mimetype: "image/png", size: 3
    }])).rejects.toBeInstanceOf(ConflictException);
    expect(saved).toHaveLength(0);
  });

  it("removes uploaded evidence when closure wins before its metadata commit", async () => {
    const { svc, saved, deleted, query } = setup({ closeDuringUpload: true });
    await expect(svc.uploadEvidence(user, project, run, "CI-TC-1", "screenshot", [{
      buffer: Buffer.from("abc"), originalname: "screen.png", mimetype: "image/png", size: 3
    }])).rejects.toBeInstanceOf(ConflictException);
    expect(saved).toHaveLength(1);
    expect(deleted).toEqual(saved);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO attachments"))).toBe(false);
  });
});
