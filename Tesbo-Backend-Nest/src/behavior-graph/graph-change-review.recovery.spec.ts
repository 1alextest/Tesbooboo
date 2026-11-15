import { GraphChangeReviewRecovery, GRAPH_QA_RECOVERY_BATCH } from "./graph-change-review.recovery";
import { GraphReviewRecoveryProcessor, GRAPH_QA_RECOVERY_JOB } from "./graph-change-review.recovery.processor";

const PROJECT = "00000000-0000-4000-8000-000000000001";

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
    expect(query.mock.calls[0][1]).toEqual([GRAPH_QA_RECOVERY_BATCH]);
    const sql = query.mock.calls[0][0] as string;
    for (const fragment of ["h.review_receipt_json IS NOT NULL", "48 hours", "organization_members",
      "project_members", "pm.role IN", "LEFT JOIN notifications", "n.id IS NULL",
      "ORDER BY h.id ASC", "LIMIT $1"]) expect(sql).toContain(fragment);
    expect(recoverCommittedForSystem.mock.calls).toEqual([[PROJECT, "12"], [PROJECT, "13"]]);
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

  it("dispatches only the registered recovery job", async () => {
    const recovery = { runOnce: jest.fn().mockResolvedValue({ eligible: 0 }) };
    const processor = new GraphReviewRecoveryProcessor(recovery as never);
    expect(await processor.process({ name: "unexpected" } as never)).toBeNull();
    expect(recovery.runOnce).not.toHaveBeenCalled();
    const previous = process.env.TESBO_GRAPH_QA_RECOVERY_ENABLED;
    try {
      delete process.env.TESBO_GRAPH_QA_RECOVERY_ENABLED;
      expect(await processor.process({ name: GRAPH_QA_RECOVERY_JOB } as never)).toBeNull();
      expect(recovery.runOnce).not.toHaveBeenCalled();
      process.env.TESBO_GRAPH_QA_RECOVERY_ENABLED = "1";
      await processor.process({ name: GRAPH_QA_RECOVERY_JOB } as never);
      expect(recovery.runOnce).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.TESBO_GRAPH_QA_RECOVERY_ENABLED;
      else process.env.TESBO_GRAPH_QA_RECOVERY_ENABLED = previous;
    }
  });
});
