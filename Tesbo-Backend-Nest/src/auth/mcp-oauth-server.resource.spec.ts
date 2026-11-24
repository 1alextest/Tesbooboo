import type { DatabaseService } from "../database/database.service";
import { McpOAuthServer } from "./mcp-oauth-server";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const CLIENT = "https://chatgpt.com/oauth/client.json";
const ISSUER = "https://tesbo.example/oauth";
const RESOURCE = `https://tesbo.example/api/projects/${PROJECT}/mcp`;

/**
 * Active, encrypted provider token/Grant verification must NEVER be enough
 * to authorize Tesbo MCP data without today's project-owner grant.
 *
 * Synthetic opaque AS objects only; no real user/token or production project.
 */
describe("OAuth access-token read-only resource and live revocation", () => {
  function fixture() {
    const settings: {
      externalMcpAccess: {
        enabled: boolean;
        revision: number;
        clients: Array<{
          kind: "oauth_client"; oauthClientId: string; clientName: string;
          scopes: Array<"read" | "write">; allowedTools: string[] | null;
          expiresAt: string | null
        }>;
      }
    } = { externalMcpAccess: {
      enabled: true, revision: 1,
      clients: [{ kind: "oauth_client", oauthClientId: CLIENT,
        clientName: "Read-only QA ChatGPT", scopes: ["read"],
        allowedTools: ["list_testcases"], expiresAt: null }]
    } };
    const token = {
      isValid: true, accountId: "tesbo-member",
      clientId: CLIENT, grantId: "oidc-grant-1",
      scope: "mcp:read", aud: RESOURCE
    };
    const grant = {
      accountId: "tesbo-member", clientId: CLIENT,
      getResourceScope: jest.fn((resource: string): string =>
        resource === RESOURCE ? "mcp:read" : "")
    };
    const findAccess = jest.fn(async () => token);
    const findGrant = jest.fn(async () => grant);
    const query = jest.fn(async () => ({ rows: [{ settings }] }));
    const svc = new McpOAuthServer({ query } as unknown as DatabaseService);
    // Inject test-only *verified-model* responses. Never enable a real
    // provider, mount an endpoint, or modify production OAuth configuration.
    Object.assign(svc, {
      provider: { AccessToken: { find: findAccess }, Grant: { find: findGrant } },
      policy: { issuer: ISSUER, resourceOrigin: "https://tesbo.example", scopes: ["mcp:read"] }
    });
    return { svc, token, grant, settings, findAccess, findGrant, query };
  }

  it("authenticates a current exact-audience token only as an OAuth machine principal", async () => {
    const f = fixture();
    await expect(f.svc.verifyAccessToken("opaque-test-only-token")).resolves.toEqual({
      kind: "oauth_access",
      issuer: ISSUER,
      subject: "tesbo-member",
      clientId: CLIENT,
      grantId: "oidc-grant-1",
      userId: "tesbo-member",
      projectId: PROJECT,
      resource: RESOURCE,
      scopes: ["mcp:read"]
    });
    expect(f.findAccess).toHaveBeenCalledWith("opaque-test-only-token");
    expect(f.grant.getResourceScope).toHaveBeenCalledWith(RESOURCE);
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT settings FROM projects"),
      [PROJECT]
    );
  });

  it("immediately rejects the SAME unexpired token when owner disables external MCP access", async () => {
    const f = fixture();
    expect(await f.svc.verifyAccessToken("valid-opaque-token")).not.toBeNull();
    f.settings.externalMcpAccess.enabled = false;
    expect(await f.svc.verifyAccessToken("valid-opaque-token")).toBeNull();
    expect(f.findAccess).toHaveBeenCalledTimes(2);
  });

  it("immediately rejects the SAME unexpired token when owner removes the client preapproval", async () => {
    const f = fixture();
    expect(await f.svc.verifyAccessToken("valid-opaque-token")).not.toBeNull();
    f.settings.externalMcpAccess.clients = [];
    expect(await f.svc.verifyAccessToken("valid-opaque-token")).toBeNull();
  });

  it("refuses wrong audience, wrong issuer origin and a different project resource", async () => {
    const f = fixture();
    for (const aud of [
      "https://evil.example/api/projects/" + PROJECT + "/mcp",
      "https://tesbo.example/api/projects/22222222-2222-4222-8222-222222222222/mcp",
      "https://tesbo.example/api/mcp",
      "https://tesbo.example/api/projects/" + PROJECT + "/mcp/",
      ""
    ]) {
      f.token.aud = aud;
      expect(await f.svc.verifyAccessToken("opaque-test")).toBeNull();
    }
    expect(f.query).not.toHaveBeenCalledWith(
      expect.stringContaining("SELECT settings FROM projects"), [PROJECT]
    );
  });

  it("rejects invalid, overbroad or expired token and mismatched grant identities", async () => {
    const cases: Array<(f: ReturnType<typeof fixture>) => void> = [
      f => { f.token.isValid = false; },
      f => { f.token.scope = "mcp:read mcp:write"; },
      f => { f.token.scope = "mcp:write"; },
      f => { f.token.clientId = "https://other.example/oauth/client.json"; },
      f => { f.token.clientId = ""; },
      f => { f.token.grantId = ""; },
      f => { f.grant.accountId = "somebody-else"; },
      f => { f.grant.clientId = "https://other.example/oauth/client.json"; },
      f => { f.grant.getResourceScope.mockReturnValue("mcp:write"); }
    ];
    for (const mutate of cases) {
      const f = fixture();
      mutate(f);
      expect(await f.svc.verifyAccessToken("test-only-opaque")).toBeNull();
    }
  });

  it("fails closed when the current project grant cannot be read", async () => {
    const f = fixture();
    f.query.mockRejectedValue(new Error("Database connection unavailable"));
    expect(await f.svc.verifyAccessToken("valid-opaque-token")).toBeNull();
  });
});
