import { ConflictException, ForbiddenException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DIRECT_TESTCASE_PUBLISHERS } from "../common/testcase-publication.policy";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { McpService } from "./mcp.service";
import { RpcCode } from "./mcp.types";

const projectId = "11111111-1111-4111-8111-111111111111";
const tokenId = "22222222-2222-4222-8222-222222222222";
const taskId = "33333333-3333-4333-8333-333333333333";
const testcaseId = "44444444-4444-4444-8444-444444444444";
const revision = "a".repeat(64);
const previewTools = ["stage_testcase_changes", "list_testcase_proposals", "get_testcase_proposal_task",
  "stage_requirement_change_bundle", "get_requirement_proposal_task", "list_requirement_proposals"];
const principal = (scopes = ["read", "write"]) => ({ tokenId, projectId, userId: "issuer-user", scopes });
const rpc = (name: string, args: Record<string, unknown> = {}) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });

function fixture(options: { actor?: string | null; consent?: boolean; writable?: boolean; allowedTools?: string[] | null } = {}) {
  const task = { id: taskId, proposalRevision: revision, proposalSnapshot: { operations: [] }, drafts: [], taskStatus: "in_review" };
  const legacy = {
    requireProjectAccess: jest.fn().mockResolvedValue({ organization_id: "workspace" }),
    stageTestcaseChanges: jest.fn().mockResolvedValue(task),
    listTestcaseProposals: jest.fn().mockResolvedValue({ list: [task] }),
    stageRequirementChangeBundle: jest.fn().mockResolvedValue({ ...task, requirementBundle: [], skillContext: { status: "unassigned" } }),
    requirementProposalTask: jest.fn().mockResolvedValue({ ...task, requirementBundle: [] }),
    listRequirementProposals: jest.fn().mockResolvedValue({ list: [] }),
    zyraTask: jest.fn().mockResolvedValue(task),
    createTestCase: jest.fn(), updateTestCase: jest.fn(), duplicateTestCase: jest.fn(),
    bulkUpdateTestCases: jest.fn(), createSuite: jest.fn(), updateSuite: jest.fn()
  };
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("SELECT p.settings, t.scopes")) return { rows: [{ scopes: "read,write", settings: { externalMcpAccess: {
      enabled: options.consent !== false, revision: 1,
      clients: [{ tokenId, clientName: "Explicit test client", scopes: ["read", "write"], allowedTools: options.allowedTools ?? null, expiresAt: null }]
    } } }] };
    if (sql.includes("FROM actors a JOIN agents g")) return { rows: options.actor === null ? [] : [{ id: options.actor ?? "mcp-actor" }] };
    throw new Error(`Unexpected database operation: ${sql}`);
  });
  const limits = { assertProjectWritable: options.writable === false
    ? jest.fn().mockRejectedValue(new ForbiddenException({ error: "Project is read-only" })) : jest.fn().mockResolvedValue(undefined) };
  const service = new McpService(legacy as unknown as LegacyService, { query } as unknown as DatabaseService, limits as unknown as PlanLimitsService);
  const call = (name: string, args: Record<string, unknown> = {}, scopes = ["read", "write"], target = projectId) => service.handleRequest(rpc(name, args), principal(scopes), target) as Promise<any>;
  const list = (scopes = ["read", "write"]) => service.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, principal(scopes), projectId) as Promise<any>;
  return { service, legacy, query, limits, call, list, task };
}

describe("MCP-P07 protected testcase publication and unpublished proposal preview", () => {
  const original = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  beforeEach(() => { process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = "1"; });
  afterEach(() => {
    if (original === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = original;
  });

  it.each([undefined, "0", "true"])("keeps the preview unavailable for server setting %p, regardless of client claims", async value => {
    if (value === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = value;
    const f = fixture();
    const tools = (await f.list()).result.tools;
    expect(tools).toHaveLength(46);
    for (const name of [...previewTools, ...DIRECT_TESTCASE_PUBLISHERS]) expect(tools.map((tool: any) => tool.name)).not.toContain(name);
    for (const name of previewTools) {
      const denied = await f.call(name, { taskId, requestKey: "forged-preview", operations: [], enabled: true,
        principal: { kind: "human_session" }, settings: { TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED: "1" } });
      expect(denied.error.data).toEqual({ code: "PROPOSAL_REVIEW_PREVIEW_DISABLED", stagingAvailable: false });
    }
    expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
    expect(f.legacy.listTestcaseProposals).not.toHaveBeenCalled();
    expect(f.legacy.zyraTask).not.toHaveBeenCalled();
    expect(f.query.mock.calls.every(([sql]) => sql.includes("SELECT p.settings, t.scopes"))).toBe(true);
  });

  it.each(Array.from(DIRECT_TESTCASE_PUBLISHERS).flatMap(name => [[name, false], [name, true]] as const))(
    "refuses cached %s with preview=%p before actor lookup or any native publication", async (name, enabled) => {
      process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = enabled ? "1" : "0";
      const f = fixture();
      const denied = await f.call(name, { title: "Never publish", testcaseId, status: "Draft", fields: { title: "Never update" },
        principal: { kind: "human_session" }, actorId: "issuer-user", approved: true });
      expect(denied.error.code).toBe(RpcCode.ToolExecutionError);
      expect(denied.error.data).toMatchObject({ code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: enabled,
        stageTool: enabled ? "stage_testcase_changes" : null });
      expect(denied.result).toBeUndefined();
      for (const method of [f.legacy.stageTestcaseChanges, f.legacy.createTestCase, f.legacy.updateTestCase,
        f.legacy.duplicateTestCase, f.legacy.bulkUpdateTestCases, f.legacy.createSuite, f.legacy.updateSuite]) expect(method).not.toHaveBeenCalled();
      expect(f.query.mock.calls.every(([sql]) => sql.includes("SELECT p.settings, t.scopes"))).toBe(true);
    }
  );

  it("advertises exactly 52 callable tools with preview on, with 26 read and 26 write tools", async () => {
    const f = fixture();
    const all = (await f.list()).result.tools;
    expect(all).toHaveLength(52);
    expect((await f.list(["read"])).result.tools).toHaveLength(26);
    expect((await f.list(["write"])).result.tools).toHaveLength(26);
    expect(all.map((tool: any) => tool.name)).toEqual(expect.arrayContaining(previewTools));
    for (const name of DIRECT_TESTCASE_PUBLISHERS) expect(all.map((tool: any) => tool.name)).not.toContain(name);
    expect(all.map((tool: any) => tool.name).some((name: string) => /approve|apply/.test(name))).toBe(false);
    const operationSchemas = all.find((tool: any) => tool.name === "stage_testcase_changes").inputSchema.properties.operations.items.oneOf;
    for (const schema of [operationSchemas[0].properties.draft, operationSchemas[1].properties.fields]) {
      for (const field of ["attachments", "postconditions", "estimatedDuration", "sourceRefs", "suiteId", "ownerId", "customTagIds", "customFieldValues"]) {
        expect(schema.properties).toHaveProperty(field);
      }
      expect(schema.properties.sourceRefs.items.properties.type.enum).toEqual(["knowledge_document", "knowledge_file", "jira_ticket", "testcase", "bug"]);
    }
    expect(operationSchemas[1].required).toContain("expectedRevision");
  });

  it("stages a requirement change bundle through the preview without exposing apply or approval", async () => {
    const f = fixture();
    const operations = [{ opType: "requirement_revision", operationId: "11111111-1111-4111-8111-111111111111",
      title: "Requirement", criteria: [{ key: "AC-1", text: "Obligation" }] }];
    const staged = await f.call("stage_requirement_change_bundle", { requestKey: "bundle-1", operations });
    expect(staged.error).toBeUndefined();
    expect(JSON.parse(staged.result.content[0].text)).toMatchObject({ publication: "unpublished", taskId, skillContext: { status: "unassigned" } });
    expect(f.legacy.stageRequirementChangeBundle).toHaveBeenCalledWith(projectId, "issuer-user",
      expect.objectContaining({ requestKey: "bundle-1", operations }), expect.objectContaining({ kind: "api_token", transport: "mcp" }));
    const forged = await f.call("stage_requirement_change_bundle", { requestKey: "bundle-2", operations, principal: { kind: "human_session" } });
    expect(forged.error.code).toBe(RpcCode.InvalidParams);
    expect(f.legacy.stageRequirementChangeBundle).toHaveBeenCalledTimes(1);
    const read = await f.call("get_requirement_proposal_task", { taskId });
    expect(read.error).toBeUndefined();
    expect(JSON.parse(read.result.content[0].text)).toMatchObject({ id: taskId });
  });

  it.each([false, true])("binds initialize/session fingerprints to the exact granted catalog with preview=%p", async enabled => {
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = enabled ? "1" : "0";
    for (const scopes of [["read"], ["read", "write"]]) {
      for (const allowedTools of [null, ["list_projects", "create_bug"]]) {
        const f = fixture({ allowedTools });
        const who = principal(scopes);
        const init: any = await f.service.handleRequest({ jsonrpc: "2.0", id: 1, method: "initialize" }, who, projectId);
        const list = await f.list(scopes);
        const fingerprint = createHash("sha256").update(JSON.stringify({ tools: list.result.tools, instructions: init.result.instructions })).digest("hex").slice(0, 16);
        expect(init.result.serverInfo.version.split(".").at(-1)).toBe(fingerprint);
        const session = f.service.newSessionId(init.result.serverInfo.version);
        expect(session.startsWith(`${fingerprint}.`)).toBe(true);
        const { grant } = await f.service.authorizeRequest(who, projectId);
        expect(f.service.isCurrentSession(session, who, grant)).toBe(true);
        const narrower = { ...grant, allowedTools: ["list_projects"] };
        if (list.result.tools.length > 1) expect(f.service.isCurrentSession(session, who, narrower)).toBe(false);
      }
    }
  });

  it("stages exact native fields with the actual credential and agent identity, without publishing a case", async () => {
    const f = fixture();
    const draft = { title: "Login", attachments: "Notes\nЮникод ✓", postconditions: "Session exists", estimatedDuration: "15m",
      sourceRefs: [{ type: "testcase", id: testcaseId, title: "Source" }], suiteId: null, ownerId: "owner", severity: "high",
      customFieldValues: {}, customTagIds: [] };
    const operations = [{ opType: "create", draft }, { opType: "update", testcaseId, expectedRevision: revision, fields: { attachments: "", jiraIssueKey: null } },
      { opType: "archive", testcaseId, expectedRevision: revision, fields: {} }];
    const result = await f.call("stage_testcase_changes", { requestKey: "fixture-request", title: "Review these changes", operations });
    expect(result.error).toBeUndefined();
    expect(f.legacy.stageTestcaseChanges).toHaveBeenCalledWith(projectId, "issuer-user",
      { requestKey: "fixture-request", title: "Review these changes", operations: [{ ...operations[0], draft: { ...draft, severity: "High" } }, ...operations.slice(1)] },
      { kind: "api_token", transport: "mcp", tokenId, actorId: "mcp-actor" });
    const staged = JSON.parse(result.result.content[0].text);
    expect(staged).toEqual({ publication: "unpublished", taskId, task: f.task, reviewPath: `/projects/${projectId}/agents/tasks/${taskId}` });
    expect(staged).not.toHaveProperty("testcaseId");
    expect(f.legacy.createTestCase).not.toHaveBeenCalled();
    expect(f.legacy.updateTestCase).not.toHaveBeenCalled();
  });

  it.each(["attachments", "postconditions"])("preserves omitted %s and an explicit empty clear in update proposals", async field => {
    const f = fixture();
    for (const fields of [{ title: "Changed" }, { [field]: "" }, { [field]: "Multiline\nЗначение" }]) {
      await f.call("stage_testcase_changes", { requestKey: "review", operations: [{ opType: "update", testcaseId, expectedRevision: revision, fields }] });
      expect(f.legacy.stageTestcaseChanges.mock.calls.at(-1)![2].operations[0].fields).toEqual(fields);
    }
  });

  it.each([null, 42, {}, []])("refuses malformed Notes or postconditions %p before staging any part of a batch", async bad => {
    for (const field of ["attachments", "postconditions"]) {
      const f = fixture();
      const response = await f.call("stage_testcase_changes", { requestKey: "invalid", operations: [
        { opType: "create", draft: { title: "Valid first" } }, { opType: "create", draft: { title: "Invalid", [field]: bad } }
      ] });
      expect(response.error.code).toBe(RpcCode.ToolExecutionError);
      expect(response.error.message).toContain(field);
      expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
    }
  });

  it.each([null, "citation", [{}], [{ type: "unknown", id: "x" }], [{ type: "testcase", id: "" }]])(
    "refuses invalid citations %p instead of silently discarding them", async sourceRefs => {
      const f = fixture();
      const result = await f.call("stage_testcase_changes", { requestKey: "citations", operations: [{ opType: "create", draft: { title: "Case", sourceRefs } }] });
      expect(result.error.message).toContain("sourceRefs");
      expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
    }
  );

  it("never accepts a caller-supplied principal or token identity", async () => {
    const f = fixture();
    const result = await f.call("stage_testcase_changes", { requestKey: "identity", operations: [], principal: { kind: "human_session" }, tokenId: "forged" });
    expect(result.error.code).toBe(RpcCode.InvalidParams);
    expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
  });

  it("fails closed when the actual MCP agent actor is unavailable", async () => {
    const f = fixture({ actor: null });
    const result = await f.call("stage_testcase_changes", { requestKey: "no-actor", operations: [] });
    expect(result.error.data.code).toBe("AGENT_IDENTITY_UNAVAILABLE");
    expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
  });

  it("keeps native conflict details and performs no direct publication on an owner refusal", async () => {
    const f = fixture();
    f.legacy.stageTestcaseChanges.mockRejectedValue(new ConflictException({ code: "PROPOSAL_TARGET_CONFLICT", error: "The testcase changed before this proposal was staged" }));
    const result = await f.call("stage_testcase_changes", { requestKey: "stale", operations: [{ opType: "update", testcaseId, expectedRevision: revision, fields: { title: "Candidate" } }] });
    expect(result.error.data).toEqual({ httpStatus: 409, code: "PROPOSAL_TARGET_CONFLICT" });
    expect(f.legacy.updateTestCase).not.toHaveBeenCalled();
  });

  it("uses the existing project task owner for list and detail reads", async () => {
    const f = fixture();
    expect((await f.call("list_testcase_proposals", { limit: 10, offset: 5 }, ["read"])).error).toBeUndefined();
    expect(f.legacy.listTestcaseProposals).toHaveBeenCalledWith(projectId, "issuer-user", { limit: 10, offset: 5 });
    expect((await f.call("get_testcase_proposal_task", { taskId }, ["read"])).error).toBeUndefined();
    expect(f.legacy.zyraTask).toHaveBeenCalledWith(projectId, "issuer-user", taskId);
    expect(f.query.mock.calls.every(([sql]) => sql.includes("SELECT p.settings, t.scopes"))).toBe(true);
  });

  it("keeps write/read scopes, project consent, project isolation and the plan lock ahead of staging", async () => {
    const args = { requestKey: "scoped", operations: [{ opType: "create", draft: { title: "Candidate" } }] };
    const f = fixture();
    expect((await f.call("stage_testcase_changes", args, ["read"])).error.code).toBe(RpcCode.ScopeDenied);
    expect((await f.call("get_testcase_proposal_task", { taskId }, ["write"])).error.code).toBe(RpcCode.ScopeDenied);
    expect((await f.call("stage_testcase_changes", args, ["read", "write"], testcaseId)).error.code).toBe(RpcCode.ProjectScopeDenied);
    expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
    const off = fixture({ consent: false });
    expect((await off.call("stage_testcase_changes", args)).error.code).toBe(RpcCode.ProjectScopeDenied);
    expect(off.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
    const locked = fixture({ writable: false });
    expect((await locked.call("stage_testcase_changes", args)).error.message).toContain("read-only");
    expect(locked.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
  });
});
