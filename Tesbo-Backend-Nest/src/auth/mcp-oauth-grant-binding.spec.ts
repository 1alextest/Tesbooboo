import { randomBytes } from "node:crypto";
import { encryptSecret, oauthReferenceFingerprint } from "../common/crypto.util";
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
    const bindings = new Map<string, typeof binding>();
    const artifacts = new Map<string, string>();
    function addFamily(grantId: string) {
      bindings.set(oauthReferenceFingerprint("oauth:Grant:id", grantId),
        { ...binding, approval_revision: state.revision });
      const ids = [
        ["Grant", grantId], ["RefreshToken", grantId + "-refresh"],
        ["AuthorizationCode", grantId + "-code"], ["AccessToken", grantId + "-access"]
      ] as const;
      for (const [model, id] of ids) {
        const payload = { jti: id, kind: model, accountId: ACCOUNT, clientId: CLIENT,
          ...(model === "Grant" ? {} : { grantId }) };
        artifacts.set(oauthReferenceFingerprint(`oauth:${model}:id`, id),
          encryptSecret(JSON.stringify(payload)));
      }
      return ids;
    }
    const original = addFamily(GRANT);
    const originalBinding = bindings.get(oauthReferenceFingerprint("oauth:Grant:id", GRANT))!;
    const query = jest.fn(async (sql: string, params: string[]) => {
      if (sql.includes("mcp_oauth_grant_approval_bindings")) {
        const row = bindings.get(params[0]);
        const live = row && !(sql.includes("b.revoked_at IS NULL") && row.revoked_at);
        return { rows: live ? [{ ...row, settings: { externalMcpAccess: state } }] : [] };
      }
      if (sql.includes("mcp_oauth_provider_artifacts")) {
        const encoded = artifacts.get(params[1]);
        return { rows: encoded ? [{ encrypted_payload: encoded, consumed_at: null }] : [] };
      }
      return { rows: [] };
    });
    return { state, original, originalBinding, addFamily, query };
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
    f.originalBinding.revoked_at = "2026-11-24T00:00:00.000Z";
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
    f.state.clients = [{
      kind: "oauth_client", oauthClientId: CLIENT, clientName: "Consent client",
      scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
    }];
    f.state.revision = 5;
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
    // Even a matching stored revision cannot restore a tombstoned consent.
    f.originalBinding.approval_revision = 5;
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
    const fresh = "fresh-consent-grant";
    f.addFamily(fresh);
    expect(await currentOAuthGrantBinding(db, fresh)).toBe(true);
    expect(await currentOAuthGrantBinding(db, GRANT)).toBe(false);
    f.query.mockRejectedValueOnce(new Error("Postgres unavailable"));
    expect(await currentOAuthGrantBinding(db, fresh)).toBe(false);
  });

  it("strict provider adapter refuses old Grant and RefreshToken reads after owner reapproval", async () => {
    const f = fixture();
    const db = { query: f.query } as unknown as DatabaseService;
    const adapter = createMcpOAuthPostgresAdapter(db, { requireLiveGrantBinding: true });
    const readFamily = (family: typeof f.original) =>
      Promise.all(family.map(([model, id]) => new adapter(model).find(id)));
    const originalIds = f.original.map(([model, id]) => expect.objectContaining({ kind: model, jti: id }));
    const denied = f.original.map(() => undefined);
    expect(await readFamily(f.original)).toEqual(originalIds);
    f.state.revision = 4;
    f.state.clients = [];
    f.originalBinding.revoked_at = "2026-11-24T00:00:00.000Z";
    expect(await readFamily(f.original)).toEqual(denied);
    f.state.revision = 5;
    f.state.clients = [{
      kind: "oauth_client", oauthClientId: CLIENT, clientName: "Consent client",
      scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
    }];
    expect(await readFamily(f.original)).toEqual(denied);
    const fresh = f.addFamily("fresh-consent-grant");
    expect(await readFamily(fresh)).toEqual(fresh.map(([model, id]) =>
      expect.objectContaining({ kind: model, jti: id })));
    expect(await readFamily(f.original)).toEqual(denied);
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
