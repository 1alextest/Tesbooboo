"use strict";

/**
 * Test-only experiment. Nothing in the Tesbo application imports this file.
 *
 * Installs no production dependency, publishes no public OAuth route, issues no
 * Tesbo OAuth credentials and does not connect to a live project. The CI job
 * provides an ISOLATED, pinned oidc-provider installation for this probe.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { pathToFileURL } = require("node:url");
const { NestFactory } = require("@nestjs/core");
const { Module } = require("@nestjs/common");

const PINNED_VERSION = "9.15.1";

async function unusedLocalPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function main() {
  const isolatedRoot = process.argv[2];
  assert.ok(path.isAbsolute(isolatedRoot || ""), "Pass the absolute isolated dependency root");
  const moduleDirectory = path.join(isolatedRoot, "node_modules", "oidc-provider");
  const pkg = JSON.parse(fs.readFileSync(path.join(moduleDirectory, "package.json"), "utf8"));
  assert.equal(pkg.version, PINNED_VERSION, "The tested provider version must stay pinned");
  assert.equal(pkg.type, "module", "The ESM/CommonJS compatibility premise changed");
  const entry = path.join(moduleDirectory, pkg.main);
  const { Provider } = await import(pathToFileURL(entry).href);
  assert.equal(typeof Provider, "function", "Expected a real Provider export");

  // This file is itself CommonJS; the provider must remain a separate ESM
  // package. Do not depend on TypeScript rewriting import() into require().
  const port = await unusedLocalPort();
  const issuer = `http://127.0.0.1:${port}/oidc`;
  const provider = new Provider(issuer, {
    clients: [{
      client_id: "tesbo-oauth-spike-public",
      redirect_uris: ["http://127.0.0.1/unused-callback"],
      token_endpoint_auth_method: "none",
      response_types: ["code"],
      grant_types: ["authorization_code"]
    }],
    pkce: { required: () => true },
    features: { resourceIndicators: { enabled: true } }
  });
  assert.equal(typeof provider.callback, "function");

  class SpikeNestModule {}
  Module({})(SpikeNestModule);
  const app = await NestFactory.create(SpikeNestModule, { logger: false, cors: false });
  try {
    // Same in-process Nest/Express mounting mechanism as the proposed design,
    // but an isolated localhost-only app, not Tesbo's real session or MCP owner.
    const express = app.getHttpAdapter().getInstance();
    express.use("/oidc", provider.callback());
    await app.listen(port, "127.0.0.1");

    const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      redirect: "manual", signal: AbortSignal.timeout(5000)
    });
    assert.equal(response.status, 200, `Nest/Express OAuth metadata returned ${response.status}`);
    const metadata = await response.json();
    assert.equal(metadata.issuer, issuer, "The provider's issuer must match its mounted route");
    assert.ok(Array.isArray(metadata.code_challenge_methods_supported) &&
      metadata.code_challenge_methods_supported.includes("S256"), "PKCE S256 not advertised");
    assert.ok(typeof metadata.authorization_endpoint === "string", "Missing authorization endpoint");
    assert.ok(typeof metadata.token_endpoint === "string", "Missing token endpoint");

    // A fake client must not obtain a token from an unissued authorization code.
    // No Tesbo user, login, consent or credential is configured by this fixture.
    const invalidExchange = await fetch(metadata.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "tesbo-oauth-spike-public",
        code: "code-never-issued-by-this-provider",
        code_verifier: "no-authorized-session",
        redirect_uri: "http://127.0.0.1/unused-callback"
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    assert.ok([400, 401].includes(invalidExchange.status),
      `An unissued code unexpectedly returned HTTP ${invalidExchange.status}`);


    process.stdout.write(JSON.stringify({
      result: "test_only_compatibility_pass",
      version: PINNED_VERSION,
      runtime: process.version,
      moduleSystem: "commonjs_host_to_esm_provider",
      nestExpressMounted: true,
      metadataIssuer: metadata.issuer,
      pkceS256Advertised: true,
      oauthTokensIssued: false,
      projectWrites: false
    }) + "\n");
  } finally {
    await app.close();
  }
}

main().catch(error => {
  process.stderr.write("OAuth compatibility spike FAILED: " + (error?.stack || String(error)) + "\n");
  process.exitCode = 1;
});
