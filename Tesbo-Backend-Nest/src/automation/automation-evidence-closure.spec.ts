import { ConflictException } from "@nestjs/common";
import { AutomationService } from "./automation.service";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

describe("automation evidence close boundary", () => {
  const user = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const run = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const execution = "f899e70f-58c6-4c11-819b-c76590126ae1";
  const file = { originalname: "proof.png", buffer: Buffer.from("png"), mimetype: "image/png", size: 3 };
  function setup(closeAtCommit = false) {
    let inserted = 0;
    const query = jest.fn(async (sql: string, _params: unknown[] = []) => {
      if (sql.includes("FROM actors a")) return { rows: [{ id: user }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id") && !sql.includes("FOR UPDATE"))
        return { rows: [{ id: run, closed_at: null, name: "CI" }] };
      if (sql.includes("FROM cycles WHERE id = $1 AND project_id") && sql.includes("FOR UPDATE"))
        return { rows: [{ id: run, closed_at: closeAtCommit ? new Date() : null }] };
      if (sql.includes("FROM executions e")) return { rows: [{ id: execution }] };
      if (sql.includes("INSERT INTO attachments")) { inserted++; return { rows: [{ id: execution }] }; }
      return { rows: [] };
    });
    const transaction = jest.fn(async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query }));
    const storage = { put: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined) };
    const planLimits = { checkStorageAvailable: jest.fn().mockResolvedValue({ allowed: true }) };
    const legacy = { requireProjectAccess: jest.fn().mockResolvedValue({ organization_id: project }) };
    const svc = new AutomationService(
      { query, transaction } as unknown as DatabaseService,
      legacy as unknown as LegacyService,
      planLimits as unknown as PlanLimitsService,
      storage as unknown as StorageService
    );
    return { svc, storage, inserted: () => inserted };
  }

  it("removes staged object when run closes before metadata commit", async () => {
    const { svc, storage, inserted } = setup(true);
    await expect(svc.uploadEvidence(user, project, run, "CI-TC-1", "screenshot", [file]))
      .rejects.toBeInstanceOf(ConflictException);
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(inserted()).toBe(0);
  });

  it("persists evidence metadata while run stays open", async () => {
    const { svc, storage, inserted } = setup(false);
    const result = await svc.uploadEvidence(user, project, run, "CI-TC-1", "screenshot", [file]);
    expect(result.total).toBe(1);
    expect(inserted()).toBe(1);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
