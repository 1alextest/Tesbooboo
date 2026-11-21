import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const projectId = "11111111-1111-4111-8111-111111111111";
const executionId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const bugId = "44444444-4444-4444-8444-444444444444";
const caseId = "55555555-5555-4555-8555-555555555555";
const actorId = "66666666-6666-4666-8666-666666666666";
type Operation = "create" | "add";

/** Association persistence is proven by the DB/API suites; this probes the public service boundary. */
function fixture(status: string, source: string, closed: boolean) {
  const execution = {
    id: executionId, status, executed_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    executed_by: "original-executor", assignee_id: null, reported_by: source, retry_count: 3,
    actual_result: "Original observation", duration_ms: 17,
    history: [{ status, retryCount: 2 }], step_results: [{ position: 1, status, comment: "Original step" }]
  };
  const run = { id: runId, source, closed_at: closed ? "2026-01-02T00:00:00Z" : null };
  const snapshot = { testcase_id: caseId, snapshot_title: "Original definition", snapshot_steps: [{ action: "Original action" }] };
  const query = jest.fn(async (sql: string, values: unknown[] = []) => {
    if (/SELECT c\.id, c\.source, c\.closed_at FROM cycles/.test(sql)) return { rows: [run], rowCount: 1 };
    if (/SELECT e\.id, e\.status, e\.assignee_id/.test(sql)) return { rows: [{ ...execution, testcase_title: "Case" }], rowCount: 1 };
    if (/UPDATE executions/.test(sql)) Object.assign(execution, { status: "Failed", executed_by: values[1], executed_at: "changed", updated_at: "changed" });
    if (/INSERT INTO bugs/.test(sql)) return { rows: [{ id: bugId }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const service = makeLegacy({ query, transaction } as unknown as DatabaseService);
  jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: projectId } as never);
  jest.spyOn(service as never, "requireBugAccess" as never).mockResolvedValue(projectId as never);
  jest.spyOn(service as never, "lockBugLinkTargets" as never).mockResolvedValue((() => undefined) as never);
  jest.spyOn(service as never, "lockBugLinksOwner" as never).mockResolvedValue([] as never);
  jest.spyOn(service as never, "nextBugExternalId" as never).mockResolvedValue("BUG-1" as never);
  const links = jest.spyOn(service as never, "replaceBugLinks" as never).mockResolvedValue(undefined as never);
  const readback = jest.spyOn(service, "getBug").mockResolvedValue({ id: bugId, links: [{ executionId }] } as never);
  const activity = jest.spyOn(service, "logProjectActivity").mockResolvedValue(undefined);
  const notifications = jest.spyOn(service as never, "notifyExecutionChange" as never).mockResolvedValue(undefined as never);
  jest.spyOn(service as never, "notifyBugChange" as never).mockResolvedValue(undefined as never);
  const target = { testcaseId: caseId, cycleId: runId, executionId };
  const write = (operation: Operation) => operation === "create"
    ? service.createBug(projectId, actorId, { title: "Observed side finding", links: [target] })
    : service.addBugLink(actorId, bugId, target);
  const evidence = () => JSON.parse(JSON.stringify({ execution, run, snapshot }));
  return { query, transaction, activity, notifications, links, readback, write, evidence };
}

const scenarios = ["create", "add"].flatMap(operation =>
  ["manual", "automation"].flatMap(source =>
    [false, true].flatMap(closed => ["Passed", "Failed", "Untested", "Blocked"].map(status => ({
      operation: operation as Operation, source, closed, status
    })))));

describe("bug associations preserve native execution evidence", () => {
  it.each(scenarios)("$operation preserves $status / $source / closed=$closed evidence", async ({ operation, source, closed, status }) => {
    const f = fixture(status,source,closed), before = f.evidence();
    await expect(f.write(operation)).resolves.toMatchObject({ id: bugId, links: [{ executionId }] });
    expect(f.links).toHaveBeenCalledTimes(1);
    expect(f.evidence()).toEqual(before);
    expect(f.query.mock.calls.some(([sql]) => /UPDATE executions/.test(sql))).toBe(false);
    expect(f.activity.mock.calls.filter(call => call[2] === "execution_updated")).toHaveLength(0);
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it.each(["create", "add"] as const)("does not announce %s success or result effects when the association transaction fails", async operation => {
    const f = fixture("Passed","manual",false), before = f.evidence();
    f.transaction.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(f.write(operation)).rejects.toThrow("database unavailable");
    expect(f.links).not.toHaveBeenCalled();
    expect(f.readback).not.toHaveBeenCalled();
    expect(f.evidence()).toEqual(before);
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });

  it("repeated links preserve the original result and its attribution", async () => {
    const f = fixture("Passed","automation",false), before = f.evidence();
    await f.write("add"); await f.write("add");
    expect(f.evidence()).toEqual(before);
    expect(f.query.mock.calls.some(([sql]) => /UPDATE executions/.test(sql))).toBe(false);
    expect(f.activity).not.toHaveBeenCalled();
    expect(f.notifications).not.toHaveBeenCalled();
  });
});
