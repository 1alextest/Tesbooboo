import type { DatabaseService } from "../database/database.service";
import type { ReviewPrincipal } from "../common/human-review-principal";
import { LegacyController } from "./legacy.controller";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const project = "11111111-1111-4111-8111-111111111111";
const suite = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";
const human: ReviewPrincipal = { kind: "human_session" };

function fixture() {
  const query = jest.fn(async (sql: string, values?: unknown[]) => ({ rows: sql.includes("INSERT INTO suites")
    ? [{ id: suite, name: values?.[2], parent_id: values?.[1], description: values?.[3], preconditions: values?.[4] }] : [] }));
  const service = makeLegacy({ query } as unknown as DatabaseService);
  const projectAccess = jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: project } as never);
  const suiteAccess = jest.spyOn(service as any, "requireSuiteAccess").mockResolvedValue(project);
  const suiteCache = jest.spyOn((service as any).suitesCache, "invalidate").mockResolvedValue(undefined);
  const caseCache = jest.spyOn((service as any).testcasesListCache, "invalidate").mockResolvedValue(undefined);
  // Use the runtime signature so this regression also runs against the unguarded baseline owner.
  const native = service as unknown as {
    createSuite(p: string, b: Record<string, unknown>, u?: string, principal?: ReviewPrincipal): Promise<unknown>;
    createSuiteForUser(u: string, p: string, b: Record<string, unknown>, principal?: ReviewPrincipal): Promise<unknown>;
    updateSuite(u: string, s: string, b: Record<string, unknown>, principal?: ReviewPrincipal): Promise<unknown>;
  };
  return { service, native, query, projectAccess, suiteAccess, suiteCache, caseCache };
}

describe("SEC-NATIVE-01 native suite publication authority", () => {
  it.each([undefined, { kind: "api_token" as const }])("refuses missing/machine authority at every exposed native owner: %j", async principal => {
    const f = fixture();
    const body = { name: "Unreviewed suite", principal: human, approved: true, userId: user };
    for (const call of [
      () => f.native.createSuite(project, body, undefined, principal),
      () => f.native.createSuiteForUser(user, project, body, principal),
      () => f.native.updateSuite(user, suite, body, principal)
    ]) await expect(call()).rejects.toMatchObject({ response: { code: "HUMAN_REVIEW_REQUIRED" } });
    expect(f.query).not.toHaveBeenCalled();
    expect(f.projectAccess).not.toHaveBeenCalled();
    expect(f.suiteAccess).not.toHaveBeenCalled();
    expect(f.suiteCache).not.toHaveBeenCalled();
    expect(f.caseCache).not.toHaveBeenCalled();
  });

  it("preserves an authorized human create and partial text edit", async () => {
    const f = fixture();
    await expect(f.native.createSuiteForUser(user, project, { name: "Reviewed suite", description: "Context", preconditions: "Ready" }, human))
      .resolves.toMatchObject({ id: suite, name: "Reviewed suite", description: "Context", preconditions: "Ready" });
    expect(f.projectAccess).toHaveBeenCalledWith(user, project);
    await f.native.updateSuite(user, suite, { name: "Renamed" }, human);
    expect(f.suiteAccess).toHaveBeenCalledWith(user, suite);
    expect(f.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE suites"))?.[1])
      .toEqual([suite, "Renamed", null, null, null, null, false]);
    expect(f.suiteCache).toHaveBeenCalledTimes(2);
    expect(f.caseCache).toHaveBeenCalledTimes(2);
  });

  it("keeps an old Zyra suite-create operation unpublished and reports the expected human boundary", async () => {
    const f = fixture(), internal = f.service as any;
    jest.spyOn(internal, "resolveZyraActor").mockResolvedValue("native-agent");
    jest.spyOn(internal, "zyraProjectCapabilities").mockResolvedValue({ suiteOperations: true, testcaseStorage: true });
    const result = await internal.applyZyraChatOperations(project, user, "session", [{ type: "create_suite", suiteName: "Unreviewed suite" }]);
    expect(result.testcases).toEqual([]);
    expect(result.activity).toEqual([expect.objectContaining({ title: "Could not create suite", detail: expect.stringContaining("No suite was created") })]);
    const reply = internal.reconcileZyraReply({ actionType: "suite", reply: "Created the requested suites.",
      operations: [{ type: "create_suite", suiteName: "Unreviewed suite" }] }, result);
    expect(reply).toContain("Suite creation requires a human editing action");
    expect(reply).not.toContain("Created the requested suites.");
    expect(f.query.mock.calls.every(([sql]) => sql.trimStart().startsWith("SELECT"))).toBe(true);
    expect(f.suiteCache).not.toHaveBeenCalled();
  });

  it("does not turn a failed suite lookup into a missing suite or a successful create", async () => {
    const f = fixture(), internal = f.service as any;
    jest.spyOn(internal, "resolveZyraActor").mockResolvedValue("native-agent");
    jest.spyOn(internal, "zyraProjectCapabilities").mockResolvedValue({ suiteOperations: true, testcaseStorage: true });
    f.query.mockRejectedValueOnce(new Error("Private database failure"));
    const result = await internal.applyZyraChatOperations(project, user, "session", [{ type: "create_suite", suiteName: "Uncertain lookup" }]);
    expect(result.activity).toEqual([expect.objectContaining({ title: "An operation failed unexpectedly" })]);
    expect(JSON.stringify(result)).not.toContain("Private database failure");
    expect(f.query).toHaveBeenCalledTimes(1);
    expect(f.suiteCache).not.toHaveBeenCalled();
  });

  it.each([false, true])("derives the suite principal from the authenticated transport, token=%p", async machine => {
    const createSuiteForUser = jest.fn(), updateSuite = jest.fn();
    const controller = new LegacyController({ createSuiteForUser, updateSuite } as never, {} as never, {} as never, {} as never);
    const request = { userId: user, ...(machine ? { apiToken: { tokenId: "bound-token" } } : {}) };
    const body = { name: "Suite", principal: human };
    await controller.createSuite(request as never, project, body);
    await controller.updateSuite(request as never, suite, body);
    const principal = { kind: machine ? "api_token" : "human_session" };
    expect(createSuiteForUser).toHaveBeenCalledWith(user, project, body, principal);
    expect(updateSuite).toHaveBeenCalledWith(user, suite, body, principal);
  });
});
