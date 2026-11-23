"use strict";

/**
 * Real oidc-provider v9 -> existing Tesbo encrypted PostgreSQL adapter ABI
 * integration. Test-only. This file is never loaded by AppModule or production.
 * Refuse every DB except disposable tesbo_ci and never use a real Tesbo account.
 */
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { pathToFileURL } = require("node:url");
const { Pool } = require("pg");
const { NestFactory } = require("@nestjs/core");
const { Module } = require("@nestjs/common");
const { DatabaseService } = require("../../dist/database/database.service");
const { createMcpOAuthPostgresAdapter } = require("../../dist/auth/mcp-oauth-postgres.adapter");
const { oauthReferenceFingerprint } = require("../../dist/common/crypto.util");

const PROVIDER_VERSION = "9.15.1";
const databaseUrl = process.env.DATABASE_URL || "";
assert.match(databaseUrl, /\/tesbo_ci(?:\?|$)/, "Refuse all non-disposable databases");
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
  const clientId = "tesbo-spike-public-client";
  const accountId = `disposable-test-account-${randomUUID()}`;
  const poolA = new Pool({ connectionString: databaseUrl, max: 3, application_name: "tesbo-oidc-provider-a" });
  const poolB = new Pool({ connectionString: databaseUrl, max: 3, application_name: "tesbo-oidc-provider-b" });
  let app;
  let grantId;
  try {
    const AdapterA = createMcpOAuthPostgresAdapter(new DatabaseService(poolA));
    const AdapterB = createMcpOAuthPostgresAdapter(new DatabaseService(poolB));
    function configuration(Adapter) {
      return {
        adapter: Adapter,
        clients: [{
          client_id: clientId,
          redirect_uris: ["http://127.0.0.1/never-used"],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code"],
          response_types: ["code"]
        }],
        async findAccount(_ctx, id) {
          return { accountId: id, async claims() { return { sub: id }; } };
        },
        pkce: { required: () => true },
        features: { resourceIndicators: { enabled: true } }
      };
    }

    // A real oidc-provider model must write via the adapter, not a hand-made
    // shape passed directly to Adapter.upsert().
    const providerA = new Provider(issuer, configuration(AdapterA));
    const grant = new providerA.Grant({ accountId, clientId });
    grantId = await grant.save();
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
    const remoteRead = await providerB.Grant.find(grantId);
    assert.equal(remoteRead?.accountId, accountId);
    assert.equal(remoteRead?.clientId, clientId);

    // Mount the same real-provider instance in a local Nest/Express app. The
    // public metadata is a test fixture; no Tesbo auth route or token issuer is
    // ever mounted by the actual product.
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

    // Revoke synthetic adapter state and prove a separate provider instance
    // cannot recover a stale grant. This does not replace live MCP grant checks.
    await new AdapterA("Grant").destroy(grantId);
    assert.equal(await providerB.Grant.find(grantId), undefined);
    grantId = undefined;
    process.stdout.write(JSON.stringify({
      result: "test_only_provider_postgres_abi_pass",
      provider: PROVIDER_VERSION,
      runtime: process.version,
      realGrantModel: true,
      encryptedAtRest: true,
      readableAcrossProviderInstances: true,
      revokedStateUnavailable: true,
      metadataPkceS256: true,
      realUsersOrTokensIssued: false,
      tesboProjectTouched: false
    }) + "\n");
  } finally {
    if (grantId) {
      await poolA.query(
        "DELETE FROM mcp_oauth_provider_artifacts WHERE model='Grant' AND id_fingerprint=$1",
        [oauthReferenceFingerprint("oauth:Grant:id", grantId)]
      ).catch(() => undefined);
    }
    if (app) await app.close();
    await Promise.all([poolA.end(), poolB.end()]);
  }
}

main().catch(error => {
  process.stderr.write("Test-only provider/PostgreSQL ABI FAILED: " + (error?.stack || String(error)) + "\n");
  process.exitCode = 1;
});
