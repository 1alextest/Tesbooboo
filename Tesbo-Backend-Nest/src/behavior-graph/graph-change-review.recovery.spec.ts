import { GraphChangeReviewRecovery, GRAPH_QA_RECOVERY_BATCH } from "./graph-change-review.recovery";
import {
  GraphReviewRecoveryProcessor,
  GraphReviewScopedRecoveryProcessor,
  GRAPH_QA_RECOVERY_JOB,
  GRAPH_QA_RECOVERY_SCOPED_JOB
} from "./graph-change-review.recovery.processor";
import { graphRecoveryRegistration } from "./graph-change-review.recovery.mode";

const PROJECT = "00000000-0000-4000-8000-000000000001";

function config(mode: "off" | "project" | "global", projectId: string | null = null) {
  return { graphQaRecoveryMode: mode, graphQaRecoveryProjectId: projectId } as never;
}

function setup(rows: Array<{ project_id: string; history_id: string }>) {
  const query = jest.fn().mockResolvedValue({ rows });
  const recoverCommittedForSystem = jest.fn();
  const recovery = new GraphChangeReviewRecovery({ query } as never, { recoverCommittedForSystem } as never);
  return { query, recoverCommittedForSystem, recovery };
}

describe("graph QA notification recovery from durable receipts", () => {
  it("scans a bounded, current-member, committed-receipt backlog with existing dedupe keys", async () => {
    const { recovery, query, recoverCommittedForSystem } = setup([
      { project_id: PROJECT, history_id: "12" }, { project_id: PROJECT, history_id: "13" }
    ]);
    recoverCommittedForSystem.mockResolvedValueOnce({ status: "delivered" })
      .mockResolvedValueOnce({ status: "pending" });
    expect(await recovery.runOnce()).toEqual({
      eligible: 2, delivered: 1, pending: 1, noRecipients: 0, failed: 0
    });
    expect(query.mock.calls[0][1]).toEqual([GRAPH_QA_RECOVERY_BATCH, null]);
    const sql = query.mock.calls[0][0] as string;
    for (const fragment of ["h.review_receipt_json IS NOT NULL", "48 hours", "organization_members",
      "project_members", "pm.role IN", "LEFT JOIN notifications", "n.id IS NULL",
      "ORDER BY h.id ASC", "LIMIT $1", "($2::uuid IS NULL OR h.project_id=$2::uuid)"]) expect(sql).toContain(fragment);
    expect(recoverCommittedForSystem.mock.calls).toEqual([[PROJECT, "12"], [PROJECT, "13"]]);
  });

  it("supports isolated project replay without changing the scheduler-wide default", async () => {
    const { recovery, query, recoverCommittedForSystem } = setup([
      { project_id: PROJECT, history_id: "21" }
    ]);
    recoverCommittedForSystem.mockResolvedValue({ status: "delivered" });
    expect(await recovery.runOnce(PROJECT)).toEqual({
      eligible: 1, delivered: 1, pending: 0, noRecipients: 0, failed: 0
    });
    expect(query.mock.calls[0][1]).toEqual([GRAPH_QA_RECOVERY_BATCH, PROJECT]);
    expect(query.mock.calls[0][0]).toContain("h.project_id=$2::uuid");
  });

  it("isolates failed deliveries without dropping later receipts", async () => {
    const { recovery, recoverCommittedForSystem } = setup([
      { project_id: PROJECT, history_id: "4" }, { project_id: PROJECT, history_id: "5" },
      { project_id: PROJECT, history_id: "6" }
    ]);
    recoverCommittedForSystem.mockRejectedValueOnce(new Error("temporary database fault"))
      .mockResolvedValueOnce({ status: "no_recipients" })
      .mockResolvedValueOnce({ status: "delivered" });
    expect(await recovery.runOnce()).toEqual({
      eligible: 3, delivered: 1, pending: 0, noRecipients: 1, failed: 1
    });
    expect(recoverCommittedForSystem).toHaveBeenCalledTimes(3);
  });

  it("does not write or invent notifications for an empty queue", async () => {
    const { recovery, recoverCommittedForSystem } = setup([]);
    expect(await recovery.runOnce()).toEqual({
      eligible: 0, delivered: 0, pending: 0, noRecipients: 0, failed: 0
    });
    expect(recoverCommittedForSystem).not.toHaveBeenCalled();
  });

  it("dispatches the legacy global job only in global mode", async () => {
    const recovery = { runOnce: jest.fn().mockResolvedValue({ eligible: 0 }) };
    expect(await new GraphReviewRecoveryProcessor(recovery as never, config("off")).process(
      { name: GRAPH_QA_RECOVERY_JOB } as never
    )).toBeNull();
    expect(await new GraphReviewRecoveryProcessor(recovery as never, config("project", PROJECT)).process(
      { name: GRAPH_QA_RECOVERY_JOB } as never
    )).toBeNull();
    expect(recovery.runOnce).not.toHaveBeenCalled();
    expect(await new GraphReviewRecoveryProcessor(recovery as never, config("global")).process(
      { name: "unexpected" } as never
    )).toBeNull();
    await new GraphReviewRecoveryProcessor(recovery as never, config("global")).process(
      { name: GRAPH_QA_RECOVERY_JOB } as never
    );
    expect(recovery.runOnce).toHaveBeenCalledTimes(1);
  });

  it("runs a project-scoped job only for the configured project", async () => {
    const recovery = { runOnce: jest.fn().mockResolvedValue({ eligible: 0 }) };
    const processor = new GraphReviewScopedRecoveryProcessor(recovery as never, config("project", PROJECT));
    expect(await processor.process({ name: "unexpected", data: { projectId: PROJECT } } as never)).toBeNull();
    expect(await processor.process({ name: GRAPH_QA_RECOVERY_SCOPED_JOB, data: { projectId: "00000000-0000-4000-8000-000000000002" } } as never)).toBeNull();
    expect(recovery.runOnce).not.toHaveBeenCalled();
    await processor.process({ name: GRAPH_QA_RECOVERY_SCOPED_JOB, data: { projectId: PROJECT } } as never);
    expect(recovery.runOnce).toHaveBeenCalledWith(PROJECT);
  });

  it("refuses a scoped job in global/off mode or with an invalid configured project", async () => {
    const recovery = { runOnce: jest.fn().mockResolvedValue({ eligible: 0 }) };
    const job = { name: GRAPH_QA_RECOVERY_SCOPED_JOB, data: { projectId: PROJECT } };
    for (const cfg of [config("off", PROJECT), config("global", PROJECT), config("project", null), config("project", "not-a-uuid")]) {
      expect(await new GraphReviewScopedRecoveryProcessor(recovery as never, cfg).process(job as never)).toBeNull();
    }
    expect(recovery.runOnce).not.toHaveBeenCalled();
  });

  it("registers a separate scoped queue and scheduler and fails project mode closed without a UUID", () => {
    expect(graphRecoveryRegistration("off", PROJECT)).toBeNull();
    expect(graphRecoveryRegistration("global", PROJECT)).toMatchObject({
      queue: "global", scheduler: "graph-qa-review-recovery-v1", job: "recover-committed-notifications", data: {}
    });
    expect(graphRecoveryRegistration("project", PROJECT)).toEqual({
      queue: "project",
      scheduler: "graph-qa-review-recovery-scoped-v1",
      job: "recover-committed-notifications-for-project",
      data: { projectId: PROJECT }
    });
    expect(graphRecoveryRegistration("project", null)).toMatchObject({ error: expect.stringContaining("UUID") });
    expect(graphRecoveryRegistration("project", "not-a-uuid")).toMatchObject({ error: expect.stringContaining("UUID") });
  });
});
