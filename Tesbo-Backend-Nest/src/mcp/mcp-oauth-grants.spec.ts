import { McpService } from "./mcp.service";
import { randomBytes } from "node:crypto";
import { LegacyService } from "../legacy/legacy.service";
import { DatabaseService } from "../database/database.service";
import { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { McpError, RpcCode } from "./mcp.types";
import type { OAuthMachineContext } from "../common/request.types";
import {
  isOAuthMcpGrant, mcpGrantKey, onlyReducesMcpAccess, readMcpAccess,
  validateMcpAccess, type ProjectMcpAccess
} from "./mcp-access";

const P = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const clientId = "https://chatgpt.example/oauth/client.json";
const grant = {
  kind: "oauth_client" as const, oauthClientId: clientId, clientName: "Authorized QA read client",
  scopes: ["read" as const], allowedTools: null, expiresAt: null
};
const apiGrant = {
  tokenId: "33333333-3333-4333-8333-333333333333",
  clientName: "Unchanged API token client",
  scopes: ["read" as const, "write" as const], allowedTools: null, expiresAt: null
};
const settings = (enabled = true): ProjectMcpAccess => ({
  enabled, revision: 3, clients: [apiGrant, grant]
});
const oauth = (changes: Partial<OAuthMachineContext> = {}): OAuthMachineContext => ({
  kind: "oauth_access",
  issuer: "https://issuer.example/oidc",
  subject: "user-subject",
  clientId, grantId: "oauth-grant",
  userId: "tesbo-user", projectId: P, scopes: ["mcp:read"],
  resource: `https://tesbo.example/api/projects/${P}/mcp`,
  ...changes
});
const rpc = (method: string, params: Record<string, unknown> = {}) => ({
  jsonrpc: "2.0", id: 1, method, params
});

describe("MCP revisioned owner grants — API token and OAuth client identity", () => {
  it("keeps existing API token grants byte-shaped while accepting explicit read-only OAuth preapproval", () => {
    const result = validateMcpAccess(settings());
    expect(result.clients).toHaveLength(2);
    expect(result.clients[0]).toEqual(apiGrant);
    expect(result.clients[1]).toEqual(grant);
    expect(mcpGrantKey(result.clients[0])).toBe(`api:${apiGrant.tokenId}`);
    expect(mcpGrantKey(result.clients[1])).toBe(`oauth:${clientId}`);
    expect(isOAuthMcpGrant(result.clients[0])).toBe(false);
    expect(isOAuthMcpGrant(result.clients[1])).toBe(true);
    expect(readMcpAccess({ externalMcpAccess: result })).toEqual(result);
  });

  it("does not silently enable OAuth for an existing project or API-only client", () => {
    expect(readMcpAccess({}).enabled).toBe(false);
    expect(readMcpAccess({ externalMcpAccess: { enabled: true, revision: 1, clients: [apiGrant] } }).clients)
      .toEqual([apiGrant]);
  });

  it.each([
    { ...grant, scopes: ["write"] },
    { ...grant, scopes: ["read", "write"] },
    { ...grant, kind: "api_token" },
    { ...grant, tokenId: apiGrant.tokenId },
    { ...grant, oauthClientId: "http://chatgpt.example/client.json" },
    { ...grant, oauthClientId: "https://user:pass@chatgpt.example/client.json" },
    { ...grant, oauthClientId: "https://chatgpt.example/client.json#fragment" },
    { ...grant, oauthClientId: "https://chatgpt.example/client.json?next=admin" },
    { ...grant, oauthClientId: "https://localhost/client.json" },
    { ...grant, oauthClientId: "https://localhost:8443/client.json" }
  ])("refuses invalid, ambiguous or write-enabled OAuth client approvals: %j", candidate => {
    expect(() => validateMcpAccess({ enabled: true, revision: 0, clients: [candidate] })).toThrow();
  });

  it("refuses duplicate OAuth client identities even under different names", () => {
    expect(() => validateMcpAccess({ enabled: true, revision: 2,
      clients: [grant, { ...grant, clientName: "Conflicting claim" }] })).toThrow();
  });

  it("preserves reduction-only rules on billing-locked projects", () => {
    const before = settings();
    expect(onlyReducesMcpAccess(before, { ...before, clients: [apiGrant] })).toBe(true);
    expect(onlyReducesMcpAccess(before, { ...before, clients: [apiGrant, { ...grant, scopes: ["read"] }] })).toBe(true);
    expect(onlyReducesMcpAccess({ ...before, clients: [apiGrant] }, before)).toBe(false);
    expect(onlyReducesMcpAccess(before, { ...before, enabled: false })).toBe(true);
    expect(onlyReducesMcpAccess(before, { ...before, clients: [{ ...grant, allowedTools: ["list_suites"] }, apiGrant] })).toBe(true);
    expect(onlyReducesMcpAccess({ ...before, clients: [{ ...grant, allowedTools: ["list_suites"] }] }, before)).toBe(false);
  });
});

describe("MCP read-only OAuth authorization uses the existing member/grant/tool owner", () => {
  const originalKey = process.env.SECRETS_ENCRYPTION_KEY;
  beforeAll(() => { process.env.SECRETS_ENCRYPTION_KEY ||= randomBytes(32).toString("base64"); });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
    else process.env.SECRETS_ENCRYPTION_KEY = originalKey;
  });
  const simulatedBinding = () => ({
    project_id: P, account_id: oauth().userId, client_id: clientId,
    resource: oauth().resource, approval_revision: settings().revision,
    settings: { externalMcpAccess: settings() }
  });
  const rows = (sql: string) => ({
    rows: sql.includes("mcp_oauth_grant_approval_bindings")
      ? [simulatedBinding()] : [{ settings: { externalMcpAccess: settings() } }]
  });
  const listTestCases = jest.fn().mockResolvedValue([{ id: "case-1", title: "Existing test case" }]);
  const requireProjectAccess = jest.fn().mockResolvedValue({ organization_id: "org-1" });
  const query = jest.fn().mockImplementation(async (sql: string) => rows(sql));
  const assertProjectWritable = jest.fn().mockResolvedValue(undefined);
  const service = new McpService(
    { requireProjectAccess, listTestCases } as unknown as LegacyService,
    { query } as unknown as DatabaseService,
    { assertProjectWritable } as unknown as PlanLimitsService
  );

  beforeEach(() => {
    listTestCases.mockClear();
    requireProjectAccess.mockClear();
    assertProjectWritable.mockClear();
    query.mockReset().mockImplementation(async (sql: string) => rows(sql));
  });

  it("discovers only permitted read tools and calls a real existing QA read handler", async () => {
    const target = oauth();
    const access = await service.authorizeVerifiedOAuthReadOnly(
      target, P, target.issuer, target.resource
    );
    expect(access.organizationId).toBe("org-1");
    expect(access.grant).toEqual(grant);
    const catalog = await service.handleVerifiedOAuthReadOnlyRequest(
      rpc("tools/list"), target, P, target.issuer, target.resource
    );
    expect(catalog).toHaveProperty("result");
    const names = ((catalog as { result: { tools: { name: string }[] } }).result.tools).map(item => item.name);
    expect(names).toContain("list_testcases");
    expect(names).toContain("list_suites");
    expect(names).not.toContain("create_testcase");
    expect(names).not.toContain("stage_testcase_changes");

    const call = await service.handleVerifiedOAuthReadOnlyRequest(
      rpc("tools/call", { name: "list_testcases", arguments: { limit: 3 } }),
      target, P, target.issuer, target.resource
    );
    expect(call).toHaveProperty("result");
    expect(JSON.stringify(call)).toContain("Existing test case");
    expect(listTestCases).toHaveBeenCalledWith(P, { limit: 3 });
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining("actors"), expect.anything());
    expect(assertProjectWritable).not.toHaveBeenCalled();
  });

  it("never executes write, publication or staging tools even with read-only owner approval", async () => {
    for (const name of ["create_testcase", "stage_testcase_changes", "record_execution_result", "create_suite"]) {
      const result = await service.handleVerifiedOAuthReadOnlyRequest(
        rpc("tools/call", { name, arguments: {} }), oauth(), P, oauth().issuer, oauth().resource
      );
      expect(result).toHaveProperty("error");
      expect((result as { error: { code: number } }).error.code).toBe(RpcCode.ScopeDenied);
    }
    expect(listTestCases).not.toHaveBeenCalled();
    expect(assertProjectWritable).not.toHaveBeenCalled();
  });

  it.each([
    ["wrong project", { projectId: OTHER }, P],
    ["wrong resource", { resource: "https://tesbo.example/api/mcp" }, P],
    ["wrong issuer", { issuer: "https://forged.example" }, P],
    ["missing subject", { subject: "" }, P],
    ["missing grant", { grantId: "" }, P],
    ["write scope", { scopes: ["mcp:read", "mcp:write"] }, P],
    ["wrong scope", { scopes: ["read"] }, P]
  ])("refuses %s before reading project settings or calling tools", async (_case, changes, projectId) => {
    const target = oauth(changes);
    await expect(service.authorizeVerifiedOAuthReadOnly(target, projectId, oauth().issuer, oauth().resource))
      .rejects.toMatchObject({ code: RpcCode.ProjectScopeDenied });
    expect(listTestCases).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("refuses a valid-looking OAuth subject without the live owner grant", async () => {
    query.mockResolvedValueOnce({ rows: [{ settings: { externalMcpAccess: { enabled: true, revision: 3, clients: [apiGrant] } } }] });
    await expect(service.authorizeVerifiedOAuthReadOnly(oauth(), P, oauth().issuer, oauth().resource))
      .rejects.toBeInstanceOf(McpError);
  });

  it("refuses disconnected project consent, expired OAuth approval and revoked project membership", async () => {
    query.mockResolvedValueOnce({ rows: [{ settings: { externalMcpAccess: settings(false) } }] });
    await expect(service.authorizeVerifiedOAuthReadOnly(oauth(), P, oauth().issuer, oauth().resource))
      .rejects.toMatchObject({ code: RpcCode.ProjectScopeDenied });

    query.mockResolvedValueOnce({ rows: [{ settings: { externalMcpAccess: {
      enabled: true, revision: 4, clients: [{ ...grant, expiresAt: "2020-01-01T00:00:00.000Z" }]
    } } }] });
    await expect(service.authorizeVerifiedOAuthReadOnly(oauth(), P, oauth().issuer, oauth().resource))
      .rejects.toMatchObject({ code: RpcCode.ProjectScopeDenied });

    requireProjectAccess.mockRejectedValueOnce(new (require("@nestjs/common").ForbiddenException)());
    await expect(service.authorizeVerifiedOAuthReadOnly(oauth(), P, oauth().issuer, oauth().resource))
      .rejects.toMatchObject({ code: RpcCode.ProjectScopeDenied });
  });
});
