import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const projectId = "11111111-1111-4111-8111-111111111111";
const executionId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const bugId = "44444444-4444-4444-8444-444444444444";
const caseId = "55555555-5555-4555-8555-555555555555";

function fixture(status = "Passed") {
  const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const service = makeLegacy({ query, transaction } as unknown as DatabaseService);
  jest.spyOn(service as never, "requireBugAccess" as never).mockResolvedValue(projectId as never);
  jest.spyOn(service as never, "lockBugLinkTargets" as never).mockResolvedValue((() => undefined) as never);
  jest.spyOn(service as never, "lockBugLinksOwner" as never).mockResolvedValue([] as never);
  const links = jest.spyOn(service as never, "replaceBugLinks" as never).mockResolvedValue(undefined as never);
  jest.spyOn(service, "getBug").mockResolvedValue({ id: bugId, links: [{ executionId }] } as never);
  const activity = jest.spyOn(service, "logProjectActivity").mockResolvedValue(undefined);
  const notifications = jest.spyOn(service as never, "notifyExecutionChange" as never).mockResolvedValue(undefined as never);
  // Association owner is mocked here; the API/DB suite proves persistence. This boundary
  // regression verifies that the actual public service no longer invokes a result writer.
  query.mockImplementation(async (sql: string) => {
    if (/SELECT e.id, e.status/.test(sql)) return { rows: [{ id: executionId, status, assignee_id: null, testcase_title: "Case" }], rowCount: 1 };
    if (/SELECT c.id, c.source/.test(sql)) return { rows: [{ id: runId, source: "manual", closed_at: null }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const link = () => service.addBugLink("actor", bugId, { testcaseId: caseId, cycleId: runId, executionId });
  return { query, transaction, activity, notifications, links, link };
}

describe("bug associations preserve native execution evidence", () => {
  it.each(["Passed", "Failed", "Untested", "Blocked"])("linking an observation does not manufacture a %s result transition", async (status) => {
    const f = fixture(status);
    await expect(f.link()).resolves.toMatchObject({ id: bugId });
    expect(f.links).toHaveBeenCalledTimes(1);
    expect(f.query.mock.calls.some(([sql]) => /UPDATE executions/.test(sql))).toBe(false);
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it("does not publish effects or read back success when the association transaction fails", async () => {
    const f = fixture();
    f.transaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(f.link()).rejects.toThrow("database unavailable");
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it("repeated link requests do not rewrite a result or its attribution", async () => {
    const f = fixture();
    await f.link(); await f.link();
    expect(f.query.mock.calls.some(([sql]) => /UPDATE executions/.test(sql))).toBe(false);
    expect(f.notifications).not.toHaveBeenCalled();
  });
});
