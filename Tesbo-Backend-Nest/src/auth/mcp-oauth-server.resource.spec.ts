import type { DatabaseService } from "../database/database.service";
import { randomBytes } from "node:crypto";
import { oauthReferenceFingerprint } from "../common/crypto.util";
import { McpOAuthServer } from "./mcp-oauth-server";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const CLIENT = "https://chatgpt.com/oauth/client.json";
const ORIGINAL_TOKEN = "synthetic-original-opaque-token";
const ISSUER = "https://tesbo.example/oauth";
const RESOURCE = `https://tesbo.example/api/projects/${PROJECT}/mcp`;

/**
 * Active, encrypted provider token/Grant verification must NEVER be enough
 * to authorize Tesbo MCP data without today's project-owner grant.
 *
 * Synthetic opaque AS objects only; no real user/token or production project.
 */
describe("OAuth access-token read-only resource and live revocation", () => {
  const existingKey = process.env.SECRETS_ENCRYPTION_KEY;
  beforeAll(() => { process.env.SECRETS_ENCRYPTION_KEY ||= randomBytes(32).toString("base64"); });
  afterAll(() => {
    if (existingKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
    else process.env.SECRETS_ENCRYPTION_KEY = existingKey;
  });
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
    const binding = {
      project_id: PROJECT, account_id: "tesbo-member", client_id: CLIENT,
      resource: RESOURCE, approval_revision: 1, revoked_at: null as string | null
    };
    const key = (id: string) => oauthReferenceFingerprint("oauth:Grant:id", id);
    const tokens = new Map([[ORIGINAL_TOKEN, token]]);
    const grants = new Map([[token.grantId, grant]]);
    const bindings = new Map([[key(token.grantId), binding]]);
    const findAccess = jest.fn(async (raw: string) => tokens.get(raw));
    const findGrant = jest.fn(async (id: string) => grants.get(id));
    const query = jest.fn(async (sql: string, params: string[]) => {
      if (!sql.includes("mcp_oauth_grant_approval_bindings")) return { rows: [{ settings }] };
      const row = bindings.get(params[0]);
      const live = row && !(sql.includes("b.revoked_at IS NULL") && row.revoked_at);
      return { rows: live ? [{ ...row, settings }] : [] };
    });
    const svc = new McpOAuthServer({ query } as unknown as DatabaseService);
    // Inject test-only *verified-model* responses. Never enable a real
    // provider, mount an endpoint, or modify production OAuth configuration.
    Object.assign(svc, {
      provider: { AccessToken: { find: findAccess }, Grant: { find: findGrant } },
      policy: { issuer: ISSUER, resourceOrigin: "https://tesbo.example", scopes: ["mcp:read"] }
    });
    return { svc, token, grant, binding, tokens, grants, bindings, key, settings, findAccess, findGrant, query };
  }

  it("authenticates a current exact-audience token only as an OAuth machine principal", async () => {
    const f = fixture();
    await expect(f.svc.verifyAccessToken(ORIGINAL_TOKEN)).resolves.toEqual({
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
    expect(f.findAccess).toHaveBeenCalledWith(ORIGINAL_TOKEN);
    expect(f.grant.getResourceScope).toHaveBeenCalledWith(RESOURCE);
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT settings FROM projects"),
      [PROJECT]
    );
  });

  it("immediately rejects the SAME unexpired token when owner disables external MCP access", async () => {
    const f = fixture();
    expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).not.toBeNull();
    f.settings.externalMcpAccess.enabled = false;
    expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).toBeNull();
    expect(f.findAccess).toHaveBeenCalledTimes(2);
  });

  it("immediately rejects the SAME unexpired token when owner removes the client preapproval", async () => {
    const f = fixture();
    expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).not.toBeNull();
    f.settings.externalMcpAccess.clients = [];
    expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).toBeNull();
  });

  // OA-T18 failing-first resource regression. Synthetic provider models do
  // not prove authorization-code exchange or refresh-family invalidation.
  it("never resurrects a prior consent after the same client ID is reapproved", async () => {
    const f = fixture();
    const priorApproval = f.settings.externalMcpAccess.clients[0]!;
    const priorToken = ORIGINAL_TOKEN;
    expect(await f.svc.verifyAccessToken(priorToken)).not.toBeNull();

    f.settings.externalMcpAccess.clients = [];
    f.settings.externalMcpAccess.revision++;
    f.binding.revoked_at = "2026-11-24T00:00:00.000Z";
    expect(await f.svc.verifyAccessToken(priorToken)).toBeNull();

    // Restore identical owner-visible facts, but as a later approval.
    // The old provider token and Grant intentionally remain unchanged.
    f.settings.externalMcpAccess.clients = [{ ...priorApproval }];
    f.settings.externalMcpAccess.revision++;
    expect(await f.svc.verifyAccessToken(priorToken)).toBeNull();

    // A separate fresh human consent is bound to the NEW approval revision.
    const freshGrant = "new-consent-grant-2";
    const freshToken = "new-opaque-credential";
    f.tokens.set(freshToken, { ...f.token, grantId: freshGrant });
    f.grants.set(freshGrant, { ...f.grant });
    f.bindings.set(f.key(freshGrant), { ...f.binding, revoked_at: null, approval_revision: f.settings.externalMcpAccess.revision });
    expect(await f.svc.verifyAccessToken(priorToken)).toBeNull();
    expect(await f.svc.verifyAccessToken(freshToken)).toMatchObject({ grantId: freshGrant });
    expect(await f.svc.verifyAccessToken(priorToken)).toBeNull();
  });

  it("rejects a grant bound to a different account, resource or approval epoch", async () => {
    for (const mismatch of [
      { account_id: "other-subject" },
      { client_id: "https://unapproved.example/client.json" },
      { resource: "https://tesbo.example/api/projects/22222222-2222-4222-8222-222222222222/mcp" },
      { approval_revision: 0 }
    ]) {
      const f = fixture();
      Object.assign(f.binding, mismatch);
      expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).toBeNull();
    }
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
      expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).toBeNull();
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
      expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).toBeNull();
    }
  });

  it("fails closed when the current project grant cannot be read", async () => {
    const f = fixture();
    f.query.mockRejectedValue(new Error("Database connection unavailable"));
    expect(await f.svc.verifyAccessToken(ORIGINAL_TOKEN)).toBeNull();
  });
});
