import type { Request } from "express";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";
import { McpOAuthServer } from "../auth/mcp-oauth-server";
import { modernMcpResponse, validateModernMcpRequest } from "./mcp-oauth-modern";
import type { AuthenticatedRequest } from "../common/request.types";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const resource = `https://tesbo.example/api/projects/${PROJECT}/mcp`;
const issuer = "https://tesbo.example/oauth";
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "Test OAuth MCP client", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {}
};
const rpc = (method: string, params: Record<string, unknown> = {}, id: number = 1) =>
  ({ jsonrpc: "2.0", id, method, params: { ...params, _meta: meta } });

function incoming(method: string, extras: Record<string, string> = {}): Pick<Request, "header"> {
  const headers: Record<string, string> = {
    "mcp-protocol-version": "2026-07-28",
    "mcp-method": method,
    accept: "application/json, text/event-stream",
    ...extras
  };
  return { header: (name: string) => headers[name.toLowerCase()] } as Pick<Request, "header">;
}

describe("OAuth-only modern MCP 2026 stateless codec", () => {
  it("accepts modern server discovery with correct client and version headers", () => {
    expect(validateModernMcpRequest(incoming("server/discover"), rpc("server/discover"),
      "https://tesbo.example")).toEqual({ ok: true, method: "server/discover", id: 1 });
  });

  it("accepts read-only tools/list and correctly mirrored tools/call names", () => {
    expect(validateModernMcpRequest(incoming("tools/list"), rpc("tools/list"), "https://tesbo.example"))
      .toEqual({ ok: true, method: "tools/list", id: 1 });
    expect(validateModernMcpRequest(incoming("tools/call", { "mcp-name": "list_testcases" }),
      rpc("tools/call", { name: "list_testcases", arguments: { limit: 3 } }), "https://tesbo.example"))
      .toEqual({ ok: true, method: "tools/call", name: "list_testcases", id: 1 });
  });

  it.each([
    ["missing version", incoming("tools/list", { "mcp-protocol-version": "" }), rpc("tools/list"), -32020],
    ["wrong version", incoming("tools/list", { "mcp-protocol-version": "2025-06-18" }), rpc("tools/list"), -32020],
    ["unsupported version", incoming("tools/list", { "mcp-protocol-version": "2027-01-01" }),
      rpc("tools/list", { _meta: { ...meta, "io.modelcontextprotocol/protocolVersion": "2027-01-01" } }), -32022],
    ["method mismatch", incoming("tools/call", { "mcp-name": "list_testcases" }), rpc("tools/list"), -32020],
    ["name mismatch", incoming("tools/call", { "mcp-name": "create_testcase" }),
      rpc("tools/call", { name: "list_testcases" }), -32020],
    ["missing name", incoming("tools/call"), rpc("tools/call", { name: "list_testcases" }), -32020],
    ["invalid capabilities", incoming("tools/list"), rpc("tools/list", { _meta: { ...meta, "io.modelcontextprotocol/clientCapabilities": null } }), -32600],
    ["legacy initialize", incoming("initialize"), rpc("initialize"), -32601],
    ["unknown method", incoming("unknown"), rpc("unknown"), -32601]
  ])("refuses %s without tool dispatch", (_case, request, body, code) => {
    const result = validateModernMcpRequest(request, body, "https://tesbo.example");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.body).toHaveProperty("error", expect.objectContaining({ code }));
  });

  it("denies a foreign Origin even when the bearer has a valid project and scopes", () => {
    const result = validateModernMcpRequest(incoming("tools/list", { origin: "https://evil.example" }),
      rpc("tools/list"), "https://tesbo.example");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(403);
  });

  it("emits private non-cacheable catalog and complete tool results", () => {
    const info = { name: "tesbo-mcp", version: "0.1.0", instructions: "Read existing QA cases" };
    expect(modernMcpResponse({ jsonrpc: "2.0", id: 1, result: { tools: [] } }, "tools/list", info))
      .toMatchObject({ result: { resultType: "complete", ttlMs: 0, cacheScope: "private", tools: [] } });
    expect(modernMcpResponse({ jsonrpc: "2.0", id: 2, result: { content: [] } }, "tools/call", info))
      .toMatchObject({ result: { resultType: "complete", content: [] } });
    expect(modernMcpResponse({ jsonrpc: "2.0", id: 3, result: {} }, "server/discover", info))
      .toMatchObject({ result: { supportedVersions: ["2026-07-28"], capabilities: { tools: {} },
        resultType: "complete", ttlMs: 0, cacheScope: "private" } });
  });

  it("routes real verified OAuth requests through the shared owner before returning a catalog", async () => {
    const authorizeVerifiedOAuthReadOnly = jest.fn().mockResolvedValue({
      organizationId: "org-1", grant: { kind: "oauth_client", scopes: ["read"], allowedTools: null }
    });
    const handleVerifiedOAuthReadOnlyRequest = jest.fn().mockResolvedValue({
      jsonrpc: "2.0", id: 1, result: { tools: [{ name: "list_testcases" }] }
    });
    const mcp = {
      serverVersion: "0.1.0+test", authorizeVerifiedOAuthReadOnly,
      handleVerifiedOAuthReadOnlyRequest,
      toErrorResponse: jest.fn()
    } as unknown as McpService;
    const oauthServer = {
      enabled: true, issuer, resource: jest.fn().mockReturnValue(resource)
    } as unknown as McpOAuthServer;
    const ctrl = new McpController(mcp, oauthServer);
    const request: AuthenticatedRequest = {
      oauthAccess: {
        kind: "oauth_access", issuer, subject: "subject", userId: "user",
        clientId: "https://client.example/id", grantId: "grant", resource,
        projectId: PROJECT, scopes: ["mcp:read"]
      },
      header(name: string) {
        return (incoming("tools/list").header as (n: string) => string | undefined)(name);
      }
    } as AuthenticatedRequest;
    const status = jest.fn().mockReturnThis();
    const json = jest.fn().mockReturnThis();
    const response = { status, json } as any;
    await ctrl.handle(request, response, PROJECT, rpc("tools/list"));
    expect(status).toHaveBeenCalledWith(200);
    expect(handleVerifiedOAuthReadOnlyRequest).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      result: expect.objectContaining({ resultType: "complete", cacheScope: "private",
        ttlMs: 0, tools: [{ name: "list_testcases" }] })
    }));
  });

  it("cannot route a modern invalid header to any Tesbo MCP tool owner", async () => {
    const owner = { handleVerifiedOAuthReadOnlyRequest: jest.fn() } as unknown as McpService;
    const oauthServer = { enabled: true, issuer, resource: () => resource } as unknown as McpOAuthServer;
    const ctrl = new McpController(owner, oauthServer);
    const req = {
      oauthAccess: { kind: "oauth_access", projectId: PROJECT, scopes: ["mcp:read"] },
      header: (name: string) => (incoming("tools/call", { "mcp-name": "create_testcase" }).header as (n:string)=>string|undefined)(name)
    } as AuthenticatedRequest;
    const status = jest.fn().mockReturnThis();
    const json = jest.fn().mockReturnThis();
    await ctrl.handle(req, { status, json } as any, PROJECT,
      rpc("tools/call", { name: "list_testcases" }));
    expect(status).toHaveBeenCalledWith(400);
    expect((owner as any).handleVerifiedOAuthReadOnlyRequest).not.toHaveBeenCalled();
  });
});
