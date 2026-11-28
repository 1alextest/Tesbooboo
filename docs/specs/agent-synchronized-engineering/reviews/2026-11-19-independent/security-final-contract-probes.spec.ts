// Independent Security probes. Only mock/in-process boundaries; no services, DB or network.
const source = process.env.SECURITY_REVIEW_SOURCE || "/workspace/scratch/fb086055b433/tesbo-review-native-final";
const { makeLegacy } = require(`${source}/Tesbo-Backend-Nest/src/legacy/test-helpers/legacy-service.fixture`);
const { LegacyController } = require(`${source}/Tesbo-Backend-Nest/src/legacy/legacy.controller`);
const { buildMcpTools } = require(`${source}/Tesbo-Backend-Nest/src/mcp/mcp.tools`);

const project = "12345678-1234-4123-8123-123456789012";
const user = "12345678-1234-4123-8123-123456789013";
const suite = "12345678-1234-4123-8123-123456789014";
const human = { kind: "human_session" };

function suiteFixture() {
  const query = jest.fn(async (sql: string, args: unknown[] = []) => ({ rows: sql.includes("INSERT INTO suites")
    ? [{ id: suite, name: args[2], parent_id: args[1], description: args[3], preconditions: args[4] }] : [] }));
  const service = makeLegacy({ query });
  const access = jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: project });
  jest.spyOn(service, "requireSuiteAccess").mockResolvedValue(project);
  jest.spyOn(service.suitesCache, "invalidate").mockResolvedValue(undefined);
  jest.spyOn(service.testcasesListCache, "invalidate").mockResolvedValue(undefined);
  return { service, query, access };
}

describe("Independent SEC-NATIVE-01 counterexamples", () => {
  it.each(["create", "update"])("authenticated machine %s cannot promote request-body human identity", async operation => {
    const f = suiteFixture();
    const controller = new LegacyController(f.service, {}, {}, {});
    const request = { userId: user, apiToken: { tokenId: "machine-token", userId: user, projectId: project, scopes: ["write"] } };
    const body = { name: "Counterfeit review", principal: human, userId: user, approved: true };
    const attempt = operation === "create"
      ? controller.createSuite(request, project, body)
      : controller.updateSuite(request, suite, body);
    await expect(attempt).rejects.toMatchObject({ response: { code: "HUMAN_REVIEW_REQUIRED" } });
    expect(f.query).not.toHaveBeenCalled();
    expect(f.service.suitesCache.invalidate).not.toHaveBeenCalled();
    expect(f.service.testcasesListCache.invalidate).not.toHaveBeenCalled();
  });

  it("legacy service call with issuer but no effective principal cannot publish", async () => {
    const f = suiteFixture();
    await expect(f.service.createSuiteForUser(user, project, { name: "Implicit human" }))
      .rejects.toMatchObject({ response: { code: "HUMAN_REVIEW_REQUIRED" } });
    expect(f.query).not.toHaveBeenCalled();
  });

  it("authorized human can create then explicitly clear text and reparent to root", async () => {
    const f = suiteFixture();
    await expect(f.service.createSuiteForUser(user, project, { name: "Human suite", preconditions: "Ready" }, human))
      .resolves.toMatchObject({ id: suite, name: "Human suite", preconditions: "Ready" });
    await f.service.updateSuite(user, suite, { preconditions: null, parentId: null }, human);
    const update = f.query.mock.calls.find(([sql]: [string]) => sql.startsWith("UPDATE suites"));
    expect(update?.[1]).toEqual([suite, null, null, null, null, "", true]);
    expect(f.access).toHaveBeenCalledWith(user, project);
  });

  it.each(["create_suite", "update_suite", "clone_test_suite"])("cached raw MCP %s handler fails before all collaborators", async name => {
    const tool = buildMcpTools().find((entry: any) => entry.name === name)!;
    const touched = jest.fn(() => { throw new Error("A protected publisher reached a collaborator"); });
    const collaborator = new Proxy({}, { get: () => touched });
    const context = { projectId: project, userId: user, actorId: "agent-actor", tokenId: "machine-token", legacy: collaborator, db: collaborator };
    await expect(tool.handler({ name: "Injected suite", suiteId: suite, sourceSuiteId: suite, principal: human, approved: true }, context))
      .rejects.toMatchObject({ data: { code: "HUMAN_PUBLICATION_REQUIRED" } });
    expect(touched).not.toHaveBeenCalled();
    expect(tool.hiddenFromDiscovery).toBe(true);
  });
});

describe("Independent extracted authority compatibility", () => {
  function fixture(row: Record<string, unknown> | null) {
    const outside = jest.fn(() => { throw new Error("Authority escaped the supplied transaction"); });
    const service = makeLegacy({ query: outside });
    const query = jest.fn().mockResolvedValue({ rows: row ? [row] : [] });
    return { service, outside, client: { query }, query };
  }

  it("native authority remains valid when unrelated Zyra proposal storage is disabled", async () => {
    const row = { id: project, caller_role: "qa_engineer", workspace_role: "manager", settings: { zyraAgent: { capabilities: { testcaseStorage: false } } } };
    const f = fixture(row);
    await expect(f.service.requireCurrentProjectAuthority(f.client, project, user)).resolves.toBe(row);
    expect(f.outside).not.toHaveBeenCalled();
    // This checks connection ownership, not whether PostgreSQL acquires/retains these locks.
    expect(f.query.mock.calls[0][1]).toEqual([project, user]);
  });

  it.each(["native", "proposal"])("%s authority refuses absent current membership from its transaction", async owner => {
    const f = fixture(null);
    const check = owner === "native" ? "requireCurrentProjectAuthority" : "requireProposalAuthority";
    await expect(f.service[check](f.client, project, user)).rejects.toMatchObject({ status: 403 });
    expect(f.outside).not.toHaveBeenCalled();
  });

  it.each([
    { caller_role: "guest", workspace_role: "owner", storage: true, error: "A current authoring role is required" },
    { caller_role: "owner", workspace_role: "unrecognized", storage: true, error: "A current authoring role is required" },
    { caller_role: "owner", workspace_role: "owner", storage: false, error: "Testcase proposal storage is disabled for this project" }
  ])("proposal-specific refusal remains intact: $error ($caller_role/$workspace_role/$storage)", async state => {
    const row = { id: project, caller_role: state.caller_role, workspace_role: state.workspace_role,
      settings: { zyraAgent: { capabilities: { testcaseStorage: state.storage } } } };
    const f = fixture(row);
    await expect(f.service.requireProposalAuthority(f.client, project, user)).rejects.toMatchObject({ response: { error: state.error } });
    expect(f.outside).not.toHaveBeenCalled();
  });

  it("native and proposal callers share current membership without erasing allowed legacy role aliases", async () => {
    const row = { id: project, caller_role: "tester", workspace_role: "test_manager",
      settings: { zyraAgent: { capabilities: { testcaseStorage: true } } } };
    const f = fixture(row);
    await expect(f.service.requireProposalAuthority(f.client, project, user)).resolves.toBe(row);
    expect(f.outside).not.toHaveBeenCalled();
  });
});
