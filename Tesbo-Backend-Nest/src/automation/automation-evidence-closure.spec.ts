import { AutomationService } from "./automation.service";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

describe("automation evidence storage compensation", () => {
  const user = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const run = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const execution = "0c4de6af-61f3-453c-8a4b-6173eb7658cd";
  const file = (name: string) => ({
    originalname: name, buffer: Buffer.from("test-image"), mimetype: "image/png", size: 10
  });

  function setup(failAt: number, cleanupFails = false) {
    const staged: string[] = [];
    const deleted: string[] = [];
    let attachmentInserts = 0;
    let writes = 0;
    const query = jest.fn(async (sql: string, _params: unknown[] = []) => {
      if (sql.includes("FROM actors a")) return { rows: [{ id: user }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id"))
        return { rows: [{ id: run, name: "CI", closed_at: null }] };
      if (sql.includes("SELECT e.id FROM executions e")) return { rows: [{ id: execution }] };
      if (sql.includes("INSERT INTO attachments")) {
        attachmentInserts++;
        return { rows: [{ id: execution }] };
      }
      return { rows: [] };
    });
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const legacy = { requireProjectAccess: jest.fn().mockResolvedValue({ organization_id: project }) };
    const limits = { checkStorageAvailable: jest.fn().mockResolvedValue({ allowed: true }) };
    const uploadError = new Error("storage confirmation failed after bytes were written");
    const cleanupError = new Error("storage cleanup unavailable");
    const storage = {
      put: jest.fn(async (key: string) => {
        // Deliberately simulate a storage operation that creates the object,
        // then throws before responding to the caller.
        staged.push(key);
        writes++;
        if (writes === failAt) throw uploadError;
      }),
      delete: jest.fn(async (key: string) => {
        deleted.push(key);
        if (cleanupFails) throw cleanupError;
      })
    };
    const svc = new AutomationService(
      { query, transaction } as unknown as DatabaseService,
      legacy as unknown as LegacyService,
      limits as unknown as PlanLimitsService,
      storage as unknown as StorageService
    );
    return { svc, staged, deleted, storage, uploadError, attachmentInserts: () => attachmentInserts };
  }

  it("cleans an object whose put wrote bytes then threw before confirmation", async () => {
    const { svc, staged, deleted, storage, uploadError, attachmentInserts } = setup(1);
    await expect(svc.uploadEvidence(user, project, run, "CI-TC-1", "screenshot", [file("proof.png")]))
      .rejects.toBe(uploadError);
    expect(staged).toHaveLength(1);
    expect(deleted).toEqual(staged);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(attachmentInserts()).toBe(0);
  });

  it("compensates earlier successful objects and the final partly written object", async () => {
    const { svc, staged, deleted, uploadError, attachmentInserts } = setup(2);
    await expect(svc.uploadEvidence(user, project, run, "CI-TC-1", "screenshot", [file("one.png"), file("two.png")]))
      .rejects.toBe(uploadError);
    expect(staged).toHaveLength(2);
    expect(deleted).toEqual(staged);
    expect(attachmentInserts()).toBe(0);
  });

  it("preserves the original upload failure when best-effort cleanup also fails", async () => {
    const { svc, storage, uploadError, attachmentInserts } = setup(1, true);
    await expect(svc.uploadEvidence(user, project, run, "CI-TC-1", "screenshot", [file("proof.png")]))
      .rejects.toBe(uploadError);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(attachmentInserts()).toBe(0);
  });
});
