"use strict";

// Exercise Tesbo's compiled issuer mount and the locked provider. A fresh synthetic
// browser request stops at the login redirect; no real account, DB or remote URL is used.
const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync, randomBytes, randomUUID } = require("node:crypto");
const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const request = require("supertest");
const { McpOAuthServer } = require("../../dist/auth/mcp-oauth-server");
const { decryptSecret } = require("../../dist/common/crypto.util");

async function main() {
  const origin = "https://tesbo.example";
  const clientId = "https://client.example/qa";
  const redirect = "https://client.example/complete";
  const project = randomUUID();
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  Object.assign(process.env, {
    TESBO_MCP_OAUTH_ENABLED: "true",
    TESBO_MCP_OAUTH_CIMD_ENABLED: "false",
    TESBO_MCP_OAUTH_ISSUER: origin + "/oauth",
    TESBO_MCP_OAUTH_RESOURCE_ORIGIN: origin,
    TESBO_MCP_OAUTH_PRIVATE_JWKS: JSON.stringify({ keys: [
      { ...privateKey.export({ format: "jwk" }), use: "sig", alg: "RS256", kid: "fixture" }
    ] }),
    TESBO_MCP_OAUTH_COOKIE_KEYS_JSON: JSON.stringify([randomBytes(32), randomBytes(32)].map(k => k.toString("base64url"))),
    TESBO_MCP_OAUTH_REGISTERED_CLIENTS: JSON.stringify([{ client_id: clientId, redirect_uris: [redirect] }]),
    SECRETS_ENCRYPTION_KEY: randomBytes(32).toString("base64")
  });
  let interaction;
  const db = {
    async query(sql, args) {
      if (sql.startsWith("SELECT settings FROM projects")) {
        assert.equal(args[0], project);
        return { rows: [{ settings: { externalMcpAccess: { enabled: true, revision: 1, clients: [
          { kind: "oauth_client", oauthClientId: clientId, clientName: "Fixture reader",
            scopes: ["read"], allowedTools: null, expiresAt: null }
        ] } } }] };
      }
      if (sql.startsWith("INSERT INTO mcp_oauth_provider_artifacts")) {
        assert.ok(["Interaction", "Session"].includes(args[0]), "Unexpected provider model at login");
        if (args[0] === "Interaction") interaction = JSON.parse(decryptSecret(args[2]));
        return { rows: [{ id_fingerprint: args[1] }] };
      }
      throw new Error("Unexpected database operation during initial OAuth redirect");
    }
  };
  class RedirectFixture {}
  Module({})(RedirectFixture);
  const app = await NestFactory.create(RedirectFixture, { logger: false });
  try {
    const issuer = new McpOAuthServer(db);
    await issuer.mount(app);
    await app.init();
    const verifier = randomBytes(32).toString("base64url");
    const response = await request(app.getHttpServer()).get("/oauth/auth")
      .set("Host", new URL(origin).host).set("X-Forwarded-Proto", "https")
      .query({ client_id: clientId, redirect_uri: redirect, response_type: "code",
        scope: "openid mcp:read", resource: issuer.resource(project), state: randomUUID(),
        code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" })
      .redirects(0);
    assert.equal(response.status, 303, "A valid authorization request must redirect to login");
    assert.equal(interaction?.prompt?.name, "login");
    assert.ok(typeof interaction.jti === "string" && interaction.jti.length > 0);
    const destination = new URL(response.headers.location, origin);
    assert.equal(destination.origin, origin);
    assert.ok(destination.pathname === "/api/oauth/interactions/" + encodeURIComponent(interaction.jti),
      "Valid authorization request did not reach Tesbo's login and consent route");
    process.stdout.write("Compiled Tesbo issuer redirected the valid PKCE request to its saved login interaction.\n");
  } finally {
    await app.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
