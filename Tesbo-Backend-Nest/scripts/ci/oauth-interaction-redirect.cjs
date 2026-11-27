"use strict";

// Exercise Tesbo's compiled issuer mount and the locked provider. A fresh synthetic
// browser request checks the first redirect. The disposable PostgreSQL job also drives
// both forms and reads a QA record with the issued token. Neither contacts external URLs.
const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync, randomBytes, randomUUID } = require("node:crypto");
const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const request = require("supertest");
const { McpOAuthServer } = require("../../dist/auth/mcp-oauth-server");
const { decryptSecret } = require("../../dist/common/crypto.util");

const origin = "https://tesbo.example";
const clientId = "https://client.example/qa";
const redirect = "https://client.example/complete";

function configureIssuer() {
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
    TESBO_MCP_OAUTH_REGISTERED_CLIENTS: JSON.stringify([{ client_id: clientId, redirect_uris: [redirect] }])
  });
  process.env.SECRETS_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
}

function authorization(resource, state, verifier) {
  return { client_id: clientId, redirect_uri: redirect, response_type: "code",
    scope: "openid mcp:read", resource, state, code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function main() {
  configureIssuer();
  const project = randomUUID();
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
      .query(authorization(issuer.resource(project), randomUUID(), verifier))
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

// The PostgreSQL job supplies an existing disposable member, project and current owner approval.
async function verifyBrowserConsentRead(db, accountId, projectId) {
  const { Test } = require("@nestjs/testing");
  const { APP_GUARD } = require("@nestjs/core");
  const { json, urlencoded } = require("express");
  const cookieParser = require("cookie-parser");
  const { CookieJar, CookieAccessInfo } = require("cookiejar"); // the jar used by supertest's HTTP client
  const { AuthMiddleware } = require("../../dist/auth/auth.middleware");
  const { ApiTokenRestGuard } = require("../../dist/auth/api-token-rest.guard");
  const { ApiTokenService } = require("../../dist/auth/api-token.service");
  const { OtpService } = require("../../dist/auth/otp.service");
  const { SessionCacheService } = require("../../dist/cache/session-cache.service");
  const { AppConfigService } = require("../../dist/config/app-config.service");
  const { DatabaseService } = require("../../dist/database/database.service");
  const { LegacyService } = require("../../dist/legacy/legacy.service");
  const { McpController } = require("../../dist/mcp/mcp.controller");
  const { McpOAuthInteractionController } = require("../../dist/mcp/mcp-oauth-interaction.controller");
  const { McpService } = require("../../dist/mcp/mcp.service");
  const { ProjectWriteLockGuard } = require("../../dist/plan-limits/project-write-lock.guard");
  const { RequestCacheService } = require("../../dist/request-cache/request-cache.service");

  configureIssuer();
  const frontendOrigin = "https://app.tesbo.example";
  process.env.FRONTEND_URL = frontendOrigin;
  process.env.SESSION_CACHE_ENABLED = "false"; // resolve the real, persisted Tesbo session directly
  const moduleRef = await Test.createTestingModule({
    controllers: [McpOAuthInteractionController, McpController],
    providers: [AppConfigService, AuthMiddleware, OtpService, ApiTokenService, SessionCacheService,
      McpOAuthServer, McpService, LegacyService, RequestCacheService,
      { provide: DatabaseService, useValue: db }, { provide: APP_GUARD, useClass: ApiTokenRestGuard },
      { provide: APP_GUARD, useClass: ProjectWriteLockGuard }]
  }).useMocker(() => ({})).compile(); // unused integrations (email, billing, workers) stay disconnected
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: false });
  try {
    const issuer = app.get(McpOAuthServer);
    const middleware = app.get(AuthMiddleware);
    app.set("trust proxy", 1);
    app.use(json(), urlencoded({ extended: true }), cookieParser());
    const cache = app.get(RequestCacheService);
    app.use((_req, _res, next) => cache.run(next));
    await issuer.mount(app);
    app.use((req, res, next) => middleware.use(req, res, next).catch(next));
    await app.listen(0, "127.0.0.1");
    const local = request(app.getHttpServer());
    const host = new URL(origin).hostname;
    const resource = issuer.resource(projectId);
    const state = randomUUID();
    const verifier = randomBytes(32).toString("base64url");
    const jar = new CookieJar();

    function localRequest(method, url) {
      assert.equal(url.origin, origin, "Only the test issuer may receive HTTP requests");
      return local[method](url.pathname + url.search).set("Host", host).set("X-Forwarded-Proto", "https").redirects(0);
    }
    async function navigate(method, url, form) {
      const call = localRequest(method, url).accept("html");
      const cookies = jar.getCookies(new CookieAccessInfo(host, url.pathname, true)).toValueString();
      if (cookies) call.set("Cookie", cookies);
      if (form) call.set("Origin", origin).type("form").send(form);
      const response = await call;
      for (const cookie of response.headers["set-cookie"] || []) jar.setCookie(cookie, host, url.pathname);
      return response;
    }
    function destination(response, stage) {
      assert.ok([302, 303].includes(response.status) && response.headers.location,
        stage + " must redirect (HTTP " + response.status + ")");
      return new URL(response.headers.location, origin);
    }

    const start = new URL("/oauth/auth", origin);
    start.search = new URLSearchParams(authorization(resource, state, verifier)).toString();
    let page = destination(await navigate("get", start), "Authorization");
    const signedOut = await navigate("get", page);
    assert.equal(signedOut.status, 303, "A signed-out browser must be sent to Tesbo sign-in");
    const login = destination(signedOut, "Tesbo sign-in");
    const returnPath = login.searchParams.get("redirect");
    assert.ok(login.origin === frontendOrigin && login.pathname === "/login" && !login.hash &&
      login.searchParams.size === 1 && returnPath === page.pathname && page.search === "" &&
      /^\/api\/oauth\/interactions\/[^/]+$/.test(returnPath), "Sign-in must retain exactly the provider-issued interaction path");
    // The frontend sign-in UI has separate browser coverage. Resume with a real saved session.
    const session = await app.get(OtpService).createSession(accountId);
    jar.setCookie(app.get(AppConfigService).sessionCookieName + "=" + session + "; Path=/; HttpOnly; Secure", host, "/");
    page = new URL(returnPath, origin);
    // Use the authoritative disposable fixture facts, not a page-wide substring.
    const context = (await db.query(
      `SELECT p.id AS project_id,p.key AS project_key,p.name AS project_name,
              o.id AS workspace_id,o.name AS workspace_name
         FROM projects p JOIN organizations o ON o.id=p.organization_id
        WHERE p.id=$1`, [projectId])).rows[0];
    assert.ok(context && context.project_name === "Disposable OAuth CI" &&
      context.workspace_name === "OAuth CI" && context.project_key === "OA18",
      "The review must use the dedicated OAuth fixture");
    function reviewField(document, label) {
      const fields = [...document.matchAll(/<dt>([^<]+)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)]
        .filter(match => match[1] === label);
      assert.equal(fields.length, 1, "Exactly one review field: " + label);
      return fields[0][2].replace(/<[^>]+>/g, "").trim();
    }
    async function reviewForm(label, workspaceName) {
      assert.ok(page.pathname.startsWith("/api/oauth/interactions/"), "Expected Tesbo's review page");
      const response = await navigate("get", page);
      assert.equal(response.status, 200, label + " page");
      assert.ok(response.text.includes(label), "The review must name the requested action");
      assert.equal(reviewField(response.text, "Client"), "Disposable reader");
      assert.equal(reviewField(response.text, "Client ID"), clientId);
      assert.equal(reviewField(response.text, "Callback origin"), new URL(redirect).origin);
      assert.equal(reviewField(response.text, "Workspace"), workspaceName + " (" + context.workspace_id + ")");
      assert.equal(reviewField(response.text, "Project"),
        context.project_name + " (" + context.project_key + " · " + context.project_id + ")");
      const action = /<form method="post" action="([^"]+)"/.exec(response.text)?.[1];
      const csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(response.text)?.[1];
      const review = /name="review" value="([a-f0-9]{64})"/.exec(response.text)?.[1];
      assert.ok(action === page.pathname && csrf && review, "Expected the session-bound approval form");
      return { action, csrf, review };
    }
    async function approve(form) {
      return navigate("post", new URL(form.action, page),
        { action: "approve", csrf: form.csrf, review: form.review });
    }
    async function bindingCount() {
      return (await db.query(
        "SELECT count(*)::int AS count FROM mcp_oauth_grant_approval_bindings WHERE project_id=$1 AND account_id=$2",
        [projectId, accountId])).rows[0].count;
    }
    for (const label of ["Continue as this Tesbo user", "Authorize read-only access"]) {
      const form = await reviewForm(label, context.workspace_name);
      let accepted;
      if (label === "Authorize read-only access") {
        // Only the existing disposable CI job may execute this controlled mutation.
        const dbTarget = new URL(process.env.DATABASE_URL || "");
        assert.equal(process.env.GITHUB_ACTIONS, "true");
        assert.ok(["localhost", "127.0.0.1"].includes(dbTarget.hostname) &&
          dbTarget.pathname === "/tesbo_ci" && !dbTarget.search,
          "Refuse workspace mutation outside the disposable CI database");
        const renamed = "OAuth CI renamed " + randomUUID();
        const before = await bindingCount();
        const changed = await db.query("UPDATE organizations SET name=$1 WHERE id=$2 AND name=$3",
          [renamed, context.workspace_id, context.workspace_name]);
        assert.equal(changed.rowCount, 1, "Rename only the identified disposable workspace");
        try {
          const stale = await approve(form);
          assert.equal(stale.status, 403, "A previously reviewed workspace name cannot authorize after it changes");
          assert.match(stale.text, /review context changed/i, "Refusal must be caused by stale review, not setup");
          assert.equal(await bindingCount(), before, "Stale review must not create an OAuth grant binding");
          const fresh = await reviewForm(label, renamed);
          assert.notEqual(fresh.review, form.review, "The review fingerprint must reflect the current workspace");
          accepted = await approve(fresh);
          assert.ok([302, 303].includes(accepted.status), "A fresh affirmative review must succeed");
          assert.equal(await bindingCount(), before + 1, "Only the fresh review may create a binding");
        } finally {
          const restored = await db.query("UPDATE organizations SET name=$1 WHERE id=$2 AND name=$3",
            [context.workspace_name, context.workspace_id, renamed]);
          assert.equal(restored.rowCount, 1, "Restore the disposable workspace name");
        }
      } else {
        accepted = await approve(form);
      }
      const resume = destination(accepted, label);
      page = destination(await navigate("get", resume), "Resume after " + label);
    }
    process.stdout.write("Verified exact consent fields and rejected stale workspace review before fresh approval.\n");
    assert.ok(page.origin + page.pathname === redirect, "Expected registered callback after consent");
    assert.ok(page.searchParams.get("state") === state && page.searchParams.get("code"), "Expected matching state and code");
    const exchange = await localRequest("post", new URL("/oauth/token", origin)).type("form").send({
      grant_type: "authorization_code", client_id: clientId, redirect_uri: redirect,
      code: page.searchParams.get("code"), code_verifier: verifier, resource
    });
    assert.equal(exchange.status, 200, "The browser-issued code and original verifier must exchange successfully");
    assert.ok(exchange.body.token_type?.toLowerCase() === "bearer" && exchange.body.access_token, "Expected a bearer token");

    const title = "Reviewed OAuth fixture " + randomUUID();
    const fixture = await db.query("INSERT INTO testcases(project_id,external_id,title) VALUES ($1,'OA18-1',$2) RETURNING id",
      [projectId, title]);
    const version = "2026-07-28";
    const read = await localRequest("post", new URL(resource)).set("Authorization", "Bearer " + exchange.body.access_token)
      .set("MCP-Protocol-Version", version).set("Mcp-Method", "tools/call").set("Mcp-Name", "list_testcases")
      .send({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_testcases", arguments: { search: title },
        _meta: { "io.modelcontextprotocol/protocolVersion": version, "io.modelcontextprotocol/clientCapabilities": {} } } });
    assert.equal(read.status, 200, "The issued bearer must authorize the project read without a session cookie");
    assert.equal(read.body.result?.resultType, "complete");
    const data = JSON.parse(read.body.result.content[0].text);
    assert.ok(data.rows.length === 1 && data.rows[0].id === fixture.rows[0].id && data.rows[0].title === title,
      "The read must return the QA case persisted for this project");
    process.stdout.write("Verified the sign-in return path. A persisted session resumed it, approved both forms, exchanged its PKCE code and read the matching disposable QA case.\n");
  } finally {
    await app.close();
  }
}

module.exports = { verifyBrowserConsentRead };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
