import { randomBytes } from "node:crypto";
import { encryptSecret } from "../common/crypto.util";
import type { DatabaseService } from "../database/database.service";
import { createMcpOAuthPostgresAdapter } from "./mcp-oauth-postgres.adapter";
import { bindOAuthGrantToApproval, currentOAuthGrantBinding } from "./mcp-oauth-grant-binding";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const CLIENT = "https://chatgpt.com/oauth/client.json";
const ACCOUNT = "tesbo-member";
const RESOURCE = `https://tesbo.example/api/projects/${PROJECT}/mcp`;
const GRANT = "test-only-provider-grant";

describe("OAuth consent binding: same-client reapproval never revives old grant families", () => {
  const priorKey = process.env.SECRETS_ENCRYPTION_KEY;
  beforeAll(() => { process.env.SECRETS_ENCRYPTION_KEY ||= randomBytes(32).toString("base64"); });
  afterAll(() => {
    if (priorKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
    else process.env.SECRETS_ENCRYPTION_KEY = priorKey;
  });

  function fixture() {
    const state = {
      enabled: true, revision: 3, clients: [{
        kind: "oauth_client", oauthClientId: CLIENT, clientName: "Consent client",
        scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
      }]
    };
    const binding = { project_id: PROJECT, account_id: ACCOUNT,
      client_id: CLIENT, resource: RESOURCE, approval_revision: 3, revoked_at: null as string | null };
    const encoded = encryptSecret(JSON.stringify({
      grantId: GRANT, accountId: ACCOUNT, clientId: CLIENT
    }));
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("mcp_oauth_grant_approval_bindings")) {
        return { rows: binding.revoked_at ? [] : [{ ...binding, settings: { externalMcpAccess: state } }] };
      }
      if (sql.includes("mcp_oauth_provider_artifacts")) {
        return { rows: [{ encrypted_payload: encoded, consumed_at: null }] };
      }
      return { rows: [] };
    });
    return { state, binding, query };
  }

  it("requires the exact account, project, resource, client and approval revision", async () => {
    const f = fixture();
    const db = { query: f.query } as unknown as DatabaseService;
    expect(await currentOAuthGrantBinding(db, GRANT, {
      projectId: PROJECT, accountId: ACCOUNT, clientId: CLIENT, resource: RESOURCE, approvalRevision: 3
    })).toBe(true);
    for (const wrong of [
      { accountId: "another-user" }, { clientId: "https://attacker.example/client.json" },
      { projectId: "22222222-2222-4222-8222-222222222222" },
      { resource: "https://tesbo.example/api/mcp" }, { approvalRevision: 4 }
    ]) {
      expect(await currentOAuthGrantBinding(db, GRANT, wrong)).toBe(false);
    }
  });

  it("fails closed after revocation and stays revoked after the same client is reapproved", async () => {
    const f = fixture();
    const db = { query: f.query } as unknown as DatabaseService;
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(true);
    f.state.clients = [];
    f.state.revision = 4;
    f.binding.revoked_at = "2026-11-24T00:00:00.000Z";
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
    f.state.clients = [{
      kind: "oauth_client", oauthClientId: CLIENT, clientName: "Consent client",
      scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
    }];
    f.state.revision = 5;
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
    f.binding.approval_revision = 5; // Tampering with epoch cannot clear the tombstone.
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
    const fresh = fixture();
    fresh.state.revision = 5;
    fresh.binding.approval_revision = 5;
    expect(await currentOAuthGrantBinding({ query: fresh.query } as unknown as DatabaseService, GRANT)).toBe(true);
    f.query.mockRejectedValueOnce(new Error("Postgres unavailable"));
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
  });

  it("strict provider adapter refuses old Grant and RefreshToken reads after owner reapproval", async () => {
    const f = fixture();
    const db = { query: f.query } as unknown as DatabaseService;
    const adapter = createMcpOAuthPostgresAdapter(db, { requireLiveGrantBinding: true });
    const grants = new adapter("Grant");
    const refresh = new adapter("RefreshToken");
    const codes = new adapter("AuthorizationCode");
    const access = new adapter("AccessToken");
    expect(await grants.find(GRANT)).toBeDefined();
    expect(await refresh.find("synthetic-refresh")).toBeDefined();
    expect(await codes.find("synthetic-authorization-code")).toBeDefined();
    expect(await access.find("synthetic-access-token")).toBeDefined();
    f.state.revision = 4;
    f.state.clients = [];
    f.binding.revoked_at = "2026-11-24T00:00:00.000Z";
    for (const item of [grants, refresh, codes, access]) {
      expect(await item.find("synthetic-token")).toBeUndefined();
    }
    f.state.revision = 5;
    f.state.clients = [{
      kind: "oauth_client", oauthClientId: CLIENT, clientName: "Consent client",
      scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
    }];
    for (const item of [grants, refresh, codes, access]) {
      expect(await item.find("synthetic-token")).toBeUndefined();
    }
  });

  it("binds a new consent only under a locked matching owner revision and membership", async () => {
    const f = fixture();
    let inserted = 0;
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("SELECT p.settings")) return { rows: [{ settings: { externalMcpAccess: f.state } }] };
      if (sql.includes("INSERT INTO mcp_oauth_grant_approval_bindings")) {
        inserted++;
        return { rows: [{ grant_fingerprint: "x" }] };
      }
      return { rows: [] };
    });
    const db = { transaction: jest.fn(async (work: (client: { query: typeof query }) => Promise<void>) =>
      work({ query })) } as unknown as DatabaseService;
    const basis = { projectId: PROJECT, accountId: ACCOUNT, clientId: CLIENT,
      resource: RESOURCE, approvalRevision: 3 };
    await expect(bindOAuthGrantToApproval(db, GRANT, basis)).resolves.toBeUndefined();
    expect(inserted).toBe(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("FOR SHARE OF p,pm,om"), [PROJECT, ACCOUNT]);
    f.state.revision = 4;
    await expect(bindOAuthGrantToApproval(db, "late-grant", basis)).rejects.toThrow(/changed/);
    expect(inserted).toBe(1);
  });
});
