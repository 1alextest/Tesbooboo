"use strict";

/**
 * Real oidc-provider v9 -> existing Tesbo encrypted PostgreSQL adapter ABI
 * integration. Test-only. This file is never loaded by AppModule or production.
 * Refuse every DB except disposable tesbo_ci and never use a real Tesbo account.
 */
const assert = require("node:assert/strict");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { pathToFileURL } = require("node:url");
const { Pool } = require("pg");
const { NestFactory } = require("@nestjs/core");
const { Module } = require("@nestjs/common");
const { DatabaseService } = require("../../dist/database/database.service");
const { McpOAuthServer } = require("../../dist/auth/mcp-oauth-server");
const { createMcpOAuthPostgresAdapter } = require("../../dist/auth/mcp-oauth-postgres.adapter");
const { McpService } = require("../../dist/mcp/mcp.service");
const { verifyBrowserConsentRead } = require("./oauth-interaction-redirect.cjs");
const { oauthReferenceFingerprint } = require("../../dist/common/crypto.util");

const PROVIDER_VERSION = "9.15.1";
const databaseUrl = process.env.DATABASE_URL || "";
const dbTarget = new URL(databaseUrl);
assert.equal(process.env.GITHUB_ACTIONS, "true", "Disposable GitHub Actions PostgreSQL job required");
assert.ok(["localhost", "127.0.0.1"].includes(dbTarget.hostname) && dbTarget.pathname === "/tesbo_ci",
  "Refuse all non-disposable databases");
const isolatedDir = process.argv[2];
assert.ok(path.isAbsolute(isolatedDir || ""), "Pass absolute isolated provider directory");

// The required key is synthetic, unique to this disposable CI database and
// never used for live Tesbo authentication or printed into the job output.
if (!process.env.SECRETS_ENCRYPTION_KEY) {
  process.env.SECRETS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
}

async function allocateLocalPort() {
  const s = net.createServer();
  await new Promise((resolve, reject) => s.once("error", reject).listen(0, "127.0.0.1", resolve));
  const addr = s.address();
  assert.ok(addr && typeof addr !== "string");
  await new Promise((resolve, reject) => s.close(error => error ? reject(error) : resolve()));
  return addr.port;
}

async function main() {
  const pkgDir = path.join(isolatedDir, "node_modules", "oidc-provider");
  const metadata = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  assert.equal(metadata.version, PROVIDER_VERSION);
  assert.equal(metadata.type, "module");
  const { Provider } = await import(pathToFileURL(path.join(pkgDir, metadata.main)).href);
  assert.equal(typeof Provider, "function");

  const port = await allocateLocalPort();
  const issuer = `http://127.0.0.1:${port}/oidc`;
  const clientId = "https://client.example/qa";
  const otherClientId = "https://client.example/support";
  let accountId;
  let projectId;
  const poolA = new Pool({ connectionString: databaseUrl, max: 3, application_name: "tesbo-oidc-provider-a" });
  const poolB = new Pool({ connectionString: databaseUrl, max: 3, application_name: "tesbo-oidc-provider-b" });
  let app;
  let fixtureOrg;
  const retainedGrants = [];
  try {
    fixtureOrg = (await poolA.query("INSERT INTO organizations(name,slug) VALUES ('OAuth CI', $1) RETURNING id",
      [`oauth-${randomUUID()}`])).rows[0].id;
    accountId = (await poolA.query("INSERT INTO users(email,name) VALUES ($1,'Disposable OAuth CI') RETURNING id",
      [`oauth-${randomUUID()}@tesbo.invalid`])).rows[0].id;
    projectId = (await poolA.query(
      "INSERT INTO projects(organization_id,key,name) VALUES ($1,'OA18','Disposable OAuth CI') RETURNING id",
      [fixtureOrg])).rows[0].id;
    await poolA.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner')", [projectId, accountId]);
    await poolA.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')", [fixtureOrg, accountId]);
    const dbA = new DatabaseService(poolA);
    const dbB = new DatabaseService(poolB);
    const authorityA = new McpOAuthServer(dbA);
    const authorityB = new McpOAuthServer(dbB);
    // The fixture supplies the canonical resource policy; both instances use production DB readers.
    const resourceOrigin = "https://tesbo.example";
    authorityA.policy = authorityB.policy = { issuer, resourceOrigin, scopes: ["mcp:read"] };
    const resource = authorityA.resource(projectId);
    const AdapterA = createMcpOAuthPostgresAdapter(dbA, { requireLiveGrantBinding: true });
    const AdapterB = createMcpOAuthPostgresAdapter(dbB, { requireLiveGrantBinding: true });
    // Only request preflight and billing are fixture collaborators. The real owner writer locks
    // the fixture project AND both memberships, checks its expected revision, and commits its
    // own invalidations and audit receipt in the same database transaction used in production.
    const ownerService = new McpService({
      requireProjectAccess: async (user, project) => {
        assert.equal(user, accountId);
        assert.equal(project, projectId);
        return { organization_id: fixtureOrg, caller_role: "owner" };
      },
      normalizeRole: role => role
    }, dbA, { assertProjectWritable: async () => {} });
    const owner = { userId: accountId };
    async function setOwnerClients(clientIds) {
      const before = await ownerService.getAccessSettings(owner, projectId);
      return ownerService.updateAccessSettings(owner, projectId, {
        enabled: true, revision: before.revision,
        clients: clientIds.map(id => ({ kind: "oauth_client", oauthClientId: id,
          clientName: "Disposable reader", scopes: ["read"], allowedTools: null, expiresAt: null }))
      });
    }
    await setOwnerClients([clientId, otherClientId]);
    await verifyBrowserConsentRead(dbA, accountId, projectId);
    function configuration(Adapter) {
      return {
        adapter: Adapter,
        clients: [clientId, otherClientId].map(id => ({
          client_id: id,
          redirect_uris: ["http://127.0.0.1/never-used"],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"]
        })),
        async findAccount(_ctx, id) {
          return { accountId: id, async claims() { return { sub: id }; } };
        },
        pkce: { required: () => true },
        features: { resourceIndicators: { enabled: true,
          getResourceServerInfo: async (_ctx, requested) => {
            assert.equal(requested, resource);
            return { scope: "mcp:read", audience: resource, accessTokenTTL: 600, accessTokenFormat: "opaque" };
          }
        } }
      };
    }

    // A real oidc-provider model must write via the adapter, not a hand-made
    // shape passed directly to Adapter.upsert().
    const providerA = new Provider(issuer, configuration(AdapterA));
    async function createReviewedGrant(id) {
      const approval = await authorityA.approvedClient(id, resource);
      assert.ok(approval);
      const grant = new providerA.Grant({ accountId, clientId: id });
      grant.addResourceScope(resource, "mcp:read");
      grant.addOIDCScope("openid offline_access");
      const jti = await grant.save();
      retainedGrants.push(jti);
      await authorityA.bindIssuedGrant(jti, { accountId, projectId, resource, clientId: id,
        approvalRevision: approval.accessRevision });
      return jti;
    }
    const grantId = await createReviewedGrant(clientId);
    const otherGrant = await createReviewedGrant(otherClientId);
    assert.equal(typeof grantId, "string");
    assert.ok(grantId.length > 8);
    const localRead = await providerA.Grant.find(grantId);
    assert.equal(localRead?.accountId, accountId);
    assert.equal(localRead?.clientId, clientId);

    const idFingerprint = oauthReferenceFingerprint("oauth:Grant:id", grantId);
    const row = (await poolA.query(
      "SELECT encrypted_payload, expires_at, id_fingerprint FROM mcp_oauth_provider_artifacts WHERE model='Grant' AND id_fingerprint=$1",
      [idFingerprint]
    )).rows[0];
    assert.ok(row, "Real provider Grant was not durably persisted");
    assert.match(row.encrypted_payload, /^enc:v1:/);
    assert.ok(!row.encrypted_payload.includes(accountId), "Account exposed at rest");
    assert.ok(!row.encrypted_payload.includes(grantId), "Grant ID exposed at rest");
    assert.equal(row.id_fingerprint, idFingerprint);

    // Simulate a second replica or a restart by creating a wholly new provider
    // and pool with the same issuer and shared PostgreSQL state.
    const providerB = new Provider(issuer, configuration(AdapterB));
    authorityB.provider = providerB;
    const controlToken = await new providerA.AccessToken({
      clientId: otherClientId, accountId, grantId: otherGrant, aud: resource, scope: "mcp:read", expiresIn: 600
    }).save();
    assert.ok((await authorityB.verifyAccessToken(controlToken))?.grantId === otherGrant);
    const remoteRead = await providerB.Grant.find(grantId);
    assert.equal(remoteRead?.accountId, accountId);
    assert.equal(remoteRead?.clientId, clientId);

    // Exercise a real short-lived AuthorizationCode model, not just a Grant.
    // The model must keep its PKCE S256 basis through encrypted persistence,
    // and two provider instances must NOT consume the same code twice.
    const verifier = randomBytes(36).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const code = new providerA.AuthorizationCode({
      accountId, clientId, grantId,
      redirectUri: "http://127.0.0.1/never-used",
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
      scope: "openid"
    });
    const rawCode = await code.save();
    assert.equal(typeof rawCode, "string");
    const codeA = await providerA.AuthorizationCode.find(rawCode);
    const codeB = await providerB.AuthorizationCode.find(rawCode);
    assert.equal(codeB?.codeChallenge, challenge);
    assert.equal(codeB?.codeChallengeMethod, "S256");
    assert.equal(codeA?.grantId, grantId);
    assert.ok(codeA && codeB, "A persisted code must be visible to both providers");
    const consumed = await Promise.allSettled([codeA.consume(), codeB.consume()]);
    assert.deepEqual(consumed.map(a => a.status).sort(), ["fulfilled", "rejected"],
      "Concurrent provider instances must have a single code-consumption winner");
    const consumedCode = await providerB.AuthorizationCode.find(rawCode);
    assert.ok(consumedCode?.consumed, "Consumed code must remain unusable on retry");
    await new AdapterB("AuthorizationCode").destroy(rawCode);


    // Use the provider on a separate loopback listener to test persistence
    // and credential rotation across the two replicas.
    class IsolatedNestModule {}
    Module({})(IsolatedNestModule);
    app = await NestFactory.create(IsolatedNestModule, { logger: false, cors: false });
    app.getHttpAdapter().getInstance().use("/oidc", providerB.callback());
    await app.listen(port, "127.0.0.1");
    const resp = await fetch(`${issuer}/.well-known/openid-configuration`, {
      redirect: "manual", signal: AbortSignal.timeout(5000)
    });
    assert.equal(resp.status, 200);
    const discovery = await resp.json();
    assert.equal(discovery.issuer, issuer);
    assert.ok(discovery.code_challenge_methods_supported?.includes("S256"));

    // An actual HTTP token exchange through the synthetic, loopback-only
    // authorization-server fixture. The code is minted internally from a
    // trusted test model; this does NOT test user login or user consent.
    async function freshCodeForm(id) {
      const httpCode = new providerB.AuthorizationCode({
        accountId, clientId, grantId: id, resource,
        redirectUri: "http://127.0.0.1/never-used",
        codeChallenge: challenge, codeChallengeMethod: "S256",
        authTime: Math.trunc(Date.now() / 1000), scope: "openid offline_access mcp:read"
      });
      return new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, resource,
        redirect_uri: "http://127.0.0.1/never-used", code: await httpCode.save(), code_verifier: verifier });
    }
    function requestToken(form) {
      return fetch(discovery.token_endpoint, { method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" }, body: form,
        redirect: "manual", signal: AbortSignal.timeout(5000) });
    }
    async function accepted(form) {
      const response = await requestToken(form);
      assert.equal(response.status, 200, "Synthetic token operation failed");
      const issued = await response.json();
      assert.ok(typeof issued.access_token === "string" && issued.access_token.length);
      assert.ok(typeof issued.refresh_token === "string" && issued.refresh_token.length);
      return issued;
    }
    const issued = await accepted(await freshCodeForm(grantId));
    assert.ok(await authorityB.verifyAccessToken(issued.access_token), "First approval must read its resource");
    const pendingCodeForm = await freshCodeForm(grantId);
    const pendingCode = await providerA.AuthorizationCode.find(pendingCodeForm.get("code"));
    const refresh = await providerB.RefreshToken.find(issued.refresh_token);
    assert.ok(pendingCode?.grantId === grantId && refresh?.grantId === grantId,
      "Retained code and refresh must use the exact Grant produced by consent");

    await setOwnerClients([otherClientId]);
    assert.equal(await authorityB.verifyAccessToken(issued.access_token), null);
    await setOwnerClients([otherClientId, clientId]);
    assert.equal(await authorityB.verifyAccessToken(issued.access_token), null);
    // Each provider must refuse the original references at the shared model-load boundary.
    // Two connections also check the same refresh reference concurrently.
    const protectedReads = await Promise.all([
      providerA.AuthorizationCode.find(pendingCodeForm.get("code"), { ignoreExpiration: true }),
      providerA.RefreshToken.find(issued.refresh_token, { ignoreExpiration: true }),
      providerB.RefreshToken.find(issued.refresh_token, { ignoreExpiration: true }),
      providerA.Grant.find(grantId, { ignoreExpiration: true }),
      providerB.AccessToken.find(issued.access_token)
    ]);
    assert.ok(protectedReads.every(result => result === undefined));
    // This candidate intentionally requires fresh consent from every client after a project policy edit.
    assert.equal(await providerB.Grant.find(otherGrant), undefined);
    assert.equal(await authorityB.verifyAccessToken(controlToken), null);

    const freshGrant = await createReviewedGrant(clientId);
    assert.ok(freshGrant !== grantId);
    const form = await freshCodeForm(freshGrant);
    const current = await accepted(form);
    const renewed = await accepted(new URLSearchParams({ grant_type: "refresh_token",
      client_id: clientId, resource, refresh_token: current.refresh_token }));
    assert.ok(renewed.refresh_token !== current.refresh_token, "Public client's refresh should rotate");
    assert.ok((await authorityB.verifyAccessToken(renewed.access_token))?.grantId === freshGrant);
    const replayResponse = await requestToken(form);
    assert.equal(replayResponse.status, 400, "Redeeming one code twice must be rejected");
    assert.equal((await replayResponse.json()).error, "invalid_grant");

    // Explicit storage removal independently invalidates the otherwise-current control.
    const freshControl = await createReviewedGrant(otherClientId);
    assert.ok(await providerB.Grant.find(freshControl));
    await new AdapterA("Grant").destroy(freshControl);
    assert.equal(await providerB.Grant.find(freshControl), undefined);
    process.stdout.write(JSON.stringify({
      result: "test_only_provider_postgres_abi_pass",
      provider: PROVIDER_VERSION,
      runtime: process.version,
      realGrantModel: true,
      realAuthorizationCodeModel: true,
      codePkceRetainedAcrossInstances: true,
      concurrentCodeConsumeWinner: true,
      syntheticHttpCodeExchangeAndReplayDenied: true,
      encryptedAtRest: true,
      readableAcrossProviderInstances: true,
      revokedStateUnavailable: true,
      metadataPkceS256: true,
      realTesboUsersOrProductionTokensIssued: false,
      previousConsentDeniedAcrossReplicas: true,
      projectPolicyChangeInvalidatesOtherClient: true,
      freshConsentRefreshRotation: true,
      disposableProjectOnly: true
    }) + "\n");
  } finally {
    // The disposable job owns this entire database. Keep audit receipts and their
    // referenced identities intact until the CI service is discarded.
    try {
      for (const id of retainedGrants) {
        for (const model of ["AccessToken", "RefreshToken", "AuthorizationCode"]) {
          await poolA.query("DELETE FROM mcp_oauth_provider_artifacts WHERE model=$1 AND grant_fingerprint=$2",
            [model, oauthReferenceFingerprint(`oauth:${model}:grant`, id)]);
        }
        await poolA.query("DELETE FROM mcp_oauth_provider_artifacts WHERE model='Grant' AND id_fingerprint=$1",
          [oauthReferenceFingerprint("oauth:Grant:id", id)]);
      }
    } finally {
      try {
        if (app) await app.close();
      } finally {
        await Promise.all([poolA.end(), poolB.end()]);
      }
    }
  }
}

main().catch(error => {
  process.stderr.write("Test-only provider/PostgreSQL ABI FAILED: " + (error?.stack || String(error)) + "\n");
  process.exitCode = 1;
});
