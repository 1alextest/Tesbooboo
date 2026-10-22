import { ConflictException } from "@nestjs/common";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";

describe("manual execution evidence — automation finalization boundary", () => {
  const user = "11a6df91-7f69-4aa1-b999-568091409401";
  const project = "96b4c52b-66cb-4c41-bf57-86c1e5550888";
  const runId = "b528478c-c26a-4a4c-af3b-13cb10e4f1f0";
  const executionId = "f899e70f-58c6-4c11-819b-c76590126ae1";
  const file = { buffer: Buffer.from("png"), originalname: "proof.png", mimetype: "image/png", size: 3 };

  function setup(options: { closed?: boolean; closeDuringUpload?: boolean; source?: string } = {}) {
    let closed = options.closed ?? false;
    const stored: string[] = [];
    const removed: string[] = [];
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM executions e") && sql.includes("JOIN projects p"))
        return { rows: [{ id: executionId, project_id: project, organization_id: project }] };
      if (sql.includes("FROM cycles WHERE id = $1") && sql.includes("FOR UPDATE"))
        return { rows: [{ id: runId, source: options.source ?? "automation", closed_at: closed ? new Date() : null }] };
      if (sql.includes("SELECT e.id FROM executions e JOIN cycle_items ci"))
        return { rows: [{ id: executionId }] };
      if (sql.includes("INSERT INTO attachments"))
        return { rows: [{ id: "evidence-1", file_name: file.originalname }] };
      return { rows: [] };
    });
    const db = {
      query,
      transaction: async <T>(fn: (client: { query: typeof query }) => Promise<T>) => fn({ query })
    } as unknown as DatabaseService;
    const svc = makeLegacy(db);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    Object.assign(svc, {
      planLimits: { assertStorageAvailable: async () => undefined },
      storage: {
        put: async (key: string) => { stored.push(key); if (options.closeDuringUpload) closed = true; },
        delete: async (key: string) => { removed.push(key); }
      }
    });
    return { svc, stored, removed, query };
  }

  it("rejects evidence for finalized automated runs and compensates staged storage", async () => {
    const { svc, stored, removed, query } = setup({ closed: true });
    await expect(svc.uploadExecutionAttachments(runId, user, executionId, [file]))
      .rejects.toBeInstanceOf(ConflictException);
    expect(removed).toEqual(stored);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO attachments"))).toBe(false);
  });

  it("rejects upload racing a run close and removes the uploaded object", async () => {
    const { svc, stored, removed, query } = setup({ closeDuringUpload: true });
    await expect(svc.uploadExecutionAttachments(runId, user, executionId, [file]))
      .rejects.toBeInstanceOf(ConflictException);
    expect(stored).toHaveLength(1);
    expect(removed).toEqual(stored);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO attachments"))).toBe(false);
  });

  it("preserves evidence uploads for manual runs, even when completed", async () => {
    const { svc, stored, removed, query } = setup({ source: "manual", closed: true });
    const result = await svc.uploadExecutionAttachments(runId, user, executionId, [file]);
    expect(result.total).toBe(1);
    expect(stored).toHaveLength(1);
    expect(removed).toHaveLength(0);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO attachments"))).toBe(true);
  });
});
