import { ConflictException, ForbiddenException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { McpService } from "./mcp.service";
import { RpcCode } from "./mcp.types";

const projectId = "11111111-1111-4111-8111-111111111111";
const tokenId = "22222222-2222-4222-8222-222222222222";
const requirementId = "33333333-3333-4333-8333-333333333333";
const versionId = "44444444-4444-4444-8444-444444444444";
const testcaseId = "55555555-5555-4555-8555-555555555555";
const linkId = "66666666-6666-4666-8666-666666666666";
const submissionKey = "77777777-7777-4777-8777-777777777777";
const digest = "a".repeat(64);
const nativeTools = ["list_requirements", "get_requirement", "create_requirement", "add_requirement_revision",
  "link_requirement_case", "retire_requirement_case_link", "retire_requirement", "get_requirement_coverage", "stage_requirement_testcase_changes"];
const nativeMethods = ["listNativeRequirements", "getNativeRequirement", "createNativeRequirement", "addNativeRequirementRevision",
  "linkNativeRequirementCase", "retireNativeRequirementCaseLink", "retireNativeRequirement", "getNativeRequirementCoverage", "stageNativeRequirementTestcaseChanges"];
const who = (scopes = ["read", "write"]) => ({ tokenId, projectId, userId: "issuer", scopes });
const content = { submissionKey, title: "Sessions expire", criteria: [{ key: "AC-1", text: "An expired session cannot save changes" }] };
const basis = { requirementVersionId: versionId, requirementContentDigest: digest, criterionKeys: ["AC-1"] };
const pinnedPrincipal = { kind: "api_token", transport: "mcp", tokenId, actorId: "mcp-actor" };

function fixture(options: { actor?: boolean; consent?: boolean; writable?: boolean; allowedTools?: string[] | null } = {}) {
  const result = { publication: "unpublished", requirement: { id: requirementId, key: "REQ-PROP-1" },
    capability: { mode: "unpublished_proposals_only", skillResolution: "unavailable", canApprove: false, canPublishCases: false } };
  const legacy: Record<string, jest.Mock> = {
    requireProjectAccess: jest.fn().mockResolvedValue({ organization_id: "workspace" }),
    createTestCase: jest.fn(), updateTestCase: jest.fn(), stageTestcaseChanges: jest.fn()
  };
  for (const method of nativeMethods) legacy[method] = jest.fn().mockResolvedValue(result);
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("SELECT p.settings, t.scopes")) return { rows: [{ scopes: "read,write", settings: { externalMcpAccess: {
      enabled: options.consent !== false, revision: 1, clients: [{ tokenId, clientName: "Proposal author", scopes: ["read", "write"],
        allowedTools: options.allowedTools ?? null, expiresAt: null }]
    } } }] };
    if (sql.includes("FROM actors a JOIN agents g")) return { rows: options.actor === false ? [] : [{ id: "mcp-actor" }] };
    throw new Error(`Unexpected query: ${sql}`);
  });
  const limits = { assertProjectWritable: options.writable === false
    ? jest.fn().mockRejectedValue(new ForbiddenException({ error: "Project is read-only" })) : jest.fn().mockResolvedValue(undefined) };
  const service = new McpService(legacy as unknown as LegacyService, { query } as unknown as DatabaseService, limits as unknown as PlanLimitsService);
  const rpc = (method: string, params = {}, scopes = ["read", "write"], target = projectId) =>
    service.handleRequest({ jsonrpc: "2.0", id: 1, method, params }, who(scopes), target) as Promise<any>;
  const call = (name: string, args: Record<string, unknown> = {}, scopes = ["read", "write"], target = projectId) =>
    rpc("tools/call", { name, arguments: args }, scopes, target);
  return { legacy, query, limits, service, call, rpc, result };
}

describe("MCP native requirement proposals use one unpublished domain owner", () => {
  const savedNative = process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED;
  const savedProposals = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  beforeEach(() => {
    process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "1";
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = "1";
  });
  afterEach(() => {
    if (savedNative === undefined) delete process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED;
    else process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = savedNative;
    if (savedProposals === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = savedProposals;
  });

  it.each([undefined, "0", "true"])("omits and refuses native tools for setting %p before resolving actors or changing state", async value => {
    if (value === undefined) delete process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED;
    else process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = value;
    const f = fixture();
    const names = (await f.rpc("tools/list")).result.tools.map((tool: any) => tool.name);
    for (const name of nativeTools) {
      expect(names).not.toContain(name);
      const result = await f.call(name, { requirementId, enabled: true, governance: { approved: true } });
      expect(result.error).toMatchObject({ code: RpcCode.ToolExecutionError, data: { code: "capability_unavailable", httpStatus: 501 } });
    }
    for (const method of nativeMethods) expect(f.legacy[method]).not.toHaveBeenCalled();
    expect(f.query.mock.calls.every(([sql]) => sql.includes("SELECT p.settings, t.scopes"))).toBe(true);
  });

  it("requires both capabilities for staging but keeps requirement reads available when case staging is off", async () => {
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = "0";
    const f = fixture();
    const names = (await f.rpc("tools/list")).result.tools.map((tool: any) => tool.name);
    expect(names).toContain("get_requirement");
    expect(names).not.toContain("stage_requirement_testcase_changes");
    const result = await f.call("stage_requirement_testcase_changes", { requirementId, ...basis, requestKey: "prepare", operations: [] });
    expect(result.error.data.code).toBe("PROPOSAL_REVIEW_PREVIEW_DISABLED");
    expect(f.legacy.stageNativeRequirementTestcaseChanges).not.toHaveBeenCalled();
  });

  it("advertises closed schemas and an exact scoped catalog without an approval or apply tool", async () => {
    const f = fixture();
    const all = (await f.rpc("tools/list")).result.tools;
    expect(all).toHaveLength(58);
    for (const name of nativeTools) expect(all.find((tool: any) => tool.name === name).inputSchema.additionalProperties).toBe(false);
    expect(all.some((tool: any) => /approve|apply/.test(tool.name))).toBe(false);
    const reads = (await f.rpc("tools/list", {}, ["read"])).result.tools.map((tool: any) => tool.name);
    expect(reads).toEqual(expect.arrayContaining(["list_requirements", "get_requirement", "get_requirement_coverage"]));
    expect(reads).not.toContain("create_requirement");
    const init = (await f.rpc("initialize")).result;
    const fingerprint = createHash("sha256").update(JSON.stringify({ tools: all, instructions: init.instructions })).digest("hex").slice(0, 16);
    expect(init.serverInfo.version.split(".").at(-1)).toBe(fingerprint);
    expect(init.instructions).toContain("incomplete skill context blocks every publication route");
    const session = f.service.newSessionId(init.serverInfo.version);
    const { grant } = await f.service.authorizeRequest(who(), projectId);
    expect(f.service.isCurrentSession(session, who(), grant)).toBe(true);
    process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "0";
    expect(f.service.isCurrentSession(session, who(), grant)).toBe(false);
  });

  it("delegates each read and mutation with authenticated identity and exact revision fields", async () => {
    const f = fixture();
    const head = { expectedVersionId: versionId, expectedContentDigest: digest };
    const link = { submissionKey, ...basis, testcaseId, testcaseRevision: digest, testcaseApprovalRevision: null };
    const cases: [string, Record<string, unknown>, string, unknown[]][] = [
      ["list_requirements", { limit: 10, offset: 5, includeRetired: true }, "listNativeRequirements", [projectId, "issuer", { limit: 10, offset: 5, includeRetired: true }]],
      ["get_requirement", { requirementId }, "getNativeRequirement", [projectId, "issuer", requirementId]],
      ["create_requirement", content, "createNativeRequirement", [projectId, "issuer", content, pinnedPrincipal]],
      ["add_requirement_revision", { requirementId, ...content, ...head }, "addNativeRequirementRevision", [projectId, "issuer", requirementId, { ...content, ...head }, pinnedPrincipal]],
      ["link_requirement_case", { requirementId, ...link }, "linkNativeRequirementCase", [projectId, "issuer", requirementId, link, pinnedPrincipal]],
      ["retire_requirement_case_link", { requirementId, linkId }, "retireNativeRequirementCaseLink", [projectId, "issuer", requirementId, linkId, pinnedPrincipal]],
      ["retire_requirement", { requirementId, ...head }, "retireNativeRequirement", [projectId, "issuer", requirementId, head, pinnedPrincipal]],
      ["get_requirement_coverage", { requirementId }, "getNativeRequirementCoverage", [projectId, "issuer", requirementId]]
    ];
    for (const [name, args, method, expected] of cases) {
      const result = await f.call(name, args);
      expect(result.error).toBeUndefined();
      expect(f.legacy[method]).toHaveBeenCalledWith(...expected);
      expect(JSON.parse(result.result.content[0].text)).toEqual(f.result);
    }
    expect(f.legacy.createTestCase).not.toHaveBeenCalled();
    expect(f.legacy.updateTestCase).not.toHaveBeenCalled();
  });

  it("stages the same case fields while retaining exact native requirement context", async () => {
    const f = fixture();
    const draft = { title: "Expired session", severity: "high", attachments: "Notes\n✓", sourceRefs: [{ type: "testcase", id: testcaseId }] };
    const args = { requirementId, ...basis, requestKey: "case-proposal", operations: [{ opType: "create", draft }] };
    expect((await f.call("stage_requirement_testcase_changes", args)).error).toBeUndefined();
    expect(f.legacy.stageNativeRequirementTestcaseChanges).toHaveBeenCalledWith(projectId, "issuer", requirementId,
      { ...basis, requestKey: "case-proposal", operations: [{ opType: "create", draft: { ...draft, severity: "High" } }] }, pinnedPrincipal);
    expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
    expect(f.legacy.createTestCase).not.toHaveBeenCalled();
  });

  it.each(["principal", "projectId", "tokenId", "governance", "skillContext"])("refuses client-owned %s claims before reaching the writer", async key => {
    const f = fixture();
    expect((await f.call("create_requirement", { ...content, [key]: "forged" })).error.code).toBe(RpcCode.InvalidParams);
    expect(f.legacy.createNativeRequirement).not.toHaveBeenCalled();
  });

  it("keeps stale and unavailable owner errors attributable and without a fallback write", async () => {
    const f = fixture();
    f.legacy.addNativeRequirementRevision.mockRejectedValue(new ConflictException({ code: "REQUIREMENT_STALE_REVISION", error: "Proposal changed" }));
    const result = await f.call("add_requirement_revision", { requirementId, ...content, expectedVersionId: versionId, expectedContentDigest: digest });
    expect(result.error.data).toEqual({ httpStatus: 409, code: "REQUIREMENT_STALE_REVISION" });
    expect(f.legacy.createNativeRequirement).not.toHaveBeenCalled();
    expect(f.legacy.stageTestcaseChanges).not.toHaveBeenCalled();
  });

  it("honors token scope, named consent, project identity and plan lock before any native mutation", async () => {
    const f = fixture();
    expect((await f.call("create_requirement", content, ["read"])).error.code).toBe(RpcCode.ScopeDenied);
    expect((await f.call("create_requirement", content, ["read", "write"], testcaseId)).error.code).toBe(RpcCode.ProjectScopeDenied);
    expect(f.legacy.createNativeRequirement).not.toHaveBeenCalled();
    for (const options of [{ consent: false }, { writable: false }, { allowedTools: ["get_requirement"] }, { actor: false }]) {
      const denied = fixture(options);
      expect((await denied.call("create_requirement", content)).error).toBeDefined();
      expect(denied.legacy.createNativeRequirement).not.toHaveBeenCalled();
    }
  });
});
