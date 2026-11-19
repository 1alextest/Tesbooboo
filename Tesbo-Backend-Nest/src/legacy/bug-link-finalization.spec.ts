import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const projectId = "11111111-1111-4111-8111-111111111111";
const executionId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const bugId = "44444444-4444-4444-8444-444444444444";
const caseId = "55555555-5555-4555-8555-555555555555";

/**
 * Bug associations and execution results.
 *
 * Decided 2026-11-19: an observation is not a verdict correction for a sealed run, but the reverse
 * path from the two Basecamp reports (a bug filed against a case in an open run) must still mark
 * that case Failed. So a manual/open run transitions once, with activity and one notification; a
 * finalized automated run keeps its result. The API/DB suite proves persistence; this boundary
 * regression pins the public service's decision.
 */
function fixture(status = "Passed", run: { source: string; closedAt: Date | null } = { source: "manual", closedAt: null }) {
  let currentStatus = status;
  const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const service = makeLegacy({ query, transaction } as unknown as DatabaseService);
  jest.spyOn(service as never, "requireBugAccess" as never).mockResolvedValue(projectId as never);
  jest.spyOn(service as never, "lockBugLinkTargets" as never).mockResolvedValue((() => undefined) as never);
  jest.spyOn(service as never, "lockBugLinksOwner" as never).mockResolvedValue([] as never);
  const links = jest.spyOn(service as never, "replaceBugLinks" as never).mockResolvedValue(undefined as never);
  jest.spyOn(service, "getBug").mockResolvedValue({ id: bugId, links: [{ executionId }] } as never);
  const activity = jest.spyOn(service, "logProjectActivity").mockResolvedValue(undefined);
  const notifications = jest
    .spyOn(service as never, "notifyExecutionChange" as never)
    .mockResolvedValue(undefined as never);
  query.mockImplementation(async (sql: string) => {
    // Parent lock read for the reverse path.
    if (/SELECT c\.id, c\.source, c\.closed_at FROM cycles/.test(sql)) {
      return { rows: [{ id: runId, source: run.source, closed_at: run.closedAt }], rowCount: 1 };
    }
    // Selected executions for a transition (status mutates so a repeat is a no-op).
    if (/SELECT e\.id, e\.status, e\.assignee_id/.test(sql)) {
      return {
        rows: [{ id: executionId, status: currentStatus, assignee_id: null, testcase_title: "Case" }],
        rowCount: 1
      };
    }
    if (/UPDATE executions SET status = 'Failed'/.test(sql)) currentStatus = "Failed";
    return { rows: [], rowCount: 1 };
  });
  const link = () => service.addBugLink("actor", bugId, { testcaseId: caseId, cycleId: runId, executionId });
  return { query, transaction, activity, notifications, links, link, status: () => currentStatus };
}

const transitioned = (query: jest.Mock) =>
  query.mock.calls.some(([sql]) => /UPDATE executions SET status = 'Failed'/.test(String(sql)));

describe("bug associations and execution verdicts", () => {
  it.each(["Passed", "Untested", "Blocked"])(
    "marks an open %s execution Failed and publishes the result transition",
    async (status) => {
      const f = fixture(status);
      await expect(f.link()).resolves.toMatchObject({ id: bugId });
      expect(f.links).toHaveBeenCalledTimes(1);
      expect(transitioned(f.query)).toBe(true);
      expect(f.status()).toBe("Failed");
      expect(f.activity).toHaveBeenCalledWith(
        projectId,
        "actor",
        "execution_updated",
        "execution",
        executionId,
        "Case",
        expect.objectContaining({ reason: "bug_linked" })
      );
      expect(f.notifications).toHaveBeenCalledTimes(1);
    }
  );

  it("does not manufacture a second transition for an already-Failed execution", async () => {
    const f = fixture("Failed");
    await f.link();
    expect(transitioned(f.query)).toBe(false);
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it.each(["Passed", "Failed", "Untested", "Blocked"])(
    "leaves a finalized automated execution's %s result sealed",
    async (status) => {
      const f = fixture(status, { source: "automation", closedAt: new Date("2026-01-01T00:00:00Z") });
      await expect(f.link()).resolves.toMatchObject({ id: bugId });
      // The association is still stored; only the result is untouched.
      expect(f.links).toHaveBeenCalledTimes(1);
      expect(transitioned(f.query)).toBe(false);
      expect(f.status()).toBe(status);
      expect(f.activity).not.toHaveBeenCalled();
      expect(f.notifications).not.toHaveBeenCalled();
    }
  );

  it("does not publish effects or read back success when the association transaction fails", async () => {
    const f = fixture();
    f.transaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(f.link()).rejects.toThrow("database unavailable");
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it("a repeated link transitions once, because the first commit already made it Failed", async () => {
    const f = fixture("Passed");
    await f.link();
    await f.link();
    expect(f.query.mock.calls.filter(([sql]) => /UPDATE executions SET status = 'Failed'/.test(String(sql)))).toHaveLength(1);
    expect(f.activity).toHaveBeenCalledTimes(1);
    expect(f.notifications).toHaveBeenCalledTimes(1);
  });
});
