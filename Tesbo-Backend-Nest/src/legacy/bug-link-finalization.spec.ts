import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const projectId = "11111111-1111-4111-8111-111111111111";
const executionId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const bugId = "44444444-4444-4444-8444-444444444444";

function fixture(source: string, closed_at: Date | null, status = "Passed") {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("SELECT c.id, c.source")) return { rows: [{ id: runId, source, closed_at }] };
    if (sql.includes("SELECT e.id, e.status")) return { rows: [{ id: executionId, status, assignee_id: null, testcase_title: "Case" }] };
    return { rows: [], rowCount: 1 };
  });
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const service = makeLegacy({ transaction } as unknown as DatabaseService);
  const activity = jest.spyOn(service, "logProjectActivity").mockResolvedValue(undefined);
  const notifications = jest.spyOn(service as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange")
    .mockResolvedValue(undefined);
  const link = (links = [{ executionId }]) => (service as unknown as {
    failLinkedExecutions: (project: string, actor: string, bug: string, links: unknown[]) => Promise<void>;
  }).failLinkedExecutions(projectId, "actor", bugId, links);
  return { query, transaction, activity, notifications, link };
}

describe("bug-link result finalization", () => {
  it.each(["Passed", "Failed"])("does not touch a finalized automated %s execution", async (status) => {
    const f = fixture("automation", new Date(), status);
    await f.link();
    expect(f.query).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls[0][0]).toContain("ORDER BY c.id FOR UPDATE");
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it.each([
    ["manual", null],
    ["manual", new Date()],
    ["automation", null]
  ])("retains auto-failure for source=%s / closed_at=%s", async (source, closedAt) => {
    const f = fixture(source as string, closedAt as Date | null);
    await f.link();
    expect(f.query.mock.calls.map(([sql]) => sql.trim().split(/\s+/)[0])).toEqual(["SELECT", "SELECT", "UPDATE"]);
    expect(f.query.mock.calls[1][0]).toContain("bl.bug_id = $3");
    expect(f.query.mock.calls[1][0]).toContain("ci.deleted_at IS NULL");
    expect(f.query.mock.calls[1][0]).toContain("FOR UPDATE OF e");
    expect(f.activity).toHaveBeenCalledWith(projectId, "actor", "execution_updated", "execution", executionId, "Case", {
      reason: "bug_linked", before: { status: "Passed" }, after: { status: "Failed" }
    });
    expect(f.notifications).toHaveBeenCalledTimes(1);
  });

  it("does not churn an already-Failed open execution", async () => {
    const f = fixture("automation", null, "Failed");
    await f.link();
    expect(f.query).toHaveBeenCalledTimes(2);
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it("does not start result work for an association without an execution", async () => {
    const f = fixture("automation", null);
    await f.link([]);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it("does not publish result events when the result transaction fails", async () => {
    const f = fixture("automation", null);
    f.transaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(f.link()).rejects.toThrow("database unavailable");
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });
});
