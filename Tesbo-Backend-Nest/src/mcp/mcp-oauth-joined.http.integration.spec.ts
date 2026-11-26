import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ForbiddenException, type INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import type { NextFunction, Response } from "express";
import { AuthMiddleware } from "../auth/auth.middleware";
import { ApiTokenRestGuard } from "../auth/api-token-rest.guard";
import type { ApiTokenService } from "../auth/api-token.service";
import type { OtpService } from "../auth/otp.service";
import { McpOAuthServer } from "../auth/mcp-oauth-server";
import { AppConfigService } from "../config/app-config.service";
import { LegacyService } from "../legacy/legacy.service";
import type { DatabaseService } from "../database/database.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { AuthenticatedRequest } from "../common/request.types";
import { McpOAuthInteractionController } from "./mcp-oauth-interaction.controller";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

const P = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://tesbo.example";
const RESOURCE = ORIGIN + "/api/projects/" + P + "/mcp";
const CLIENT = "https://chatgpt.com/oauth/client.json";
const SESSION = "synthetic-human-session";
const OPAQUE = "synthetic-token-never-issued";
const UID = "synthetic-consent-uid";
const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {}
};

describe("joined Tesbo OAuth consent -> verified read-only MCP over real Nest HTTP", () => {
  let app: INestApplication;
  let base: string;
  let enabled = true, clientApproved = true, consentSaved = false, memberActive = true;
  const listTestCases = jest.fn();
  const assertProjectWritable = jest.fn();
  const resolveSession = jest.fn();
  const authenticateApiToken = jest.fn();
  const query = jest.fn();
  const currentGrantRows = (sql: string) => ({
    rows: sql.includes("pm.id AS project_membership_id")
      ? memberActive ? [{
        name: "Existing QA project", key: "TES", organization_id: "ci-org", organization_name: "QA workspace",
        project_membership_id: P, organization_membership_id: OTHER
      }] : []
      : sql.includes("mcp_oauth_grant_approval_bindings")
      ? consentSaved ? [{
        project_id: P, account_id: "tesbo-human", client_id: CLIENT,
        resource: RESOURCE, approval_revision: 7, settings: ownerGrant()
      }] : []
      : [{ settings: ownerGrant() }]
  });
  const ownerGrant = () => ({
    externalMcpAccess: {
      enabled, revision: 7,
      clients: clientApproved ? [{
        kind: "oauth_client", oauthClientId: CLIENT,
        clientName: "Approved QA read client", scopes: ["read"],
        allowedTools: ["list_testcases"], expiresAt: null
      }] : []
    }
  });
  const storedGrant = {
    accountId: "tesbo-human", clientId: CLIENT,
    getResourceScope: (resource: string) => resource === RESOURCE ? "mcp:read" : ""
  };
  class SyntheticGrant {
    constructor(public input: { accountId: string; clientId: string }) {}
    addResourceScope(resource: string, scope: string) {
      if (resource !== RESOURCE || scope !== "mcp:read") throw Error("Wrong resource scope");
    }
    addOIDCScope(_scope: string) {}
    async save() {
      if (this.input.accountId !== "tesbo-human" || this.input.clientId !== CLIENT) {
        throw Error("Wrong consent subject");
      }
      consentSaved = true;
      return "test-grant-id";
    }
    static async find(id: string) {
      return consentSaved && id === "test-grant-id" ? storedGrant : undefined;
    }
  }

  beforeAll(async () => {
    process.env.SECRETS_ENCRYPTION_KEY ||= Buffer.alloc(32, 11).toString("base64");
    const legacy = {
      requireProjectAccess: jest.fn(async (userId: string, projectId: string) => {
        if (userId !== "tesbo-human" || projectId !== P || !memberActive) {
          throw new ForbiddenException("Project membership absent");
        }
        return { name: "Existing QA project", key: "TES", organization_id: "ci-org" };
      }),
      listTestCases
    };
    query.mockImplementation(async (sql: string) => currentGrantRows(sql));
    const oauth = new McpOAuthServer({ query } as unknown as DatabaseService);
    // This joined HTTP fixture has a synthetic issuer, not a disposable DB.
    // Real binding writes and owner-update invalidation are exercised separately.
    jest.spyOn(oauth, "bindIssuedGrant").mockResolvedValue(undefined);
    jest.spyOn(oauth, "discardUnboundGrant").mockResolvedValue(undefined);
    const provider = {
      interactionDetails: jest.fn().mockResolvedValue({
        uid: UID,
        prompt: { name: "consent" },
        params: { client_id: CLIENT, resource: RESOURCE, scope: "mcp:read", redirect_uri: "https://client.example/oauth/callback" }
      }),
      interactionFinished: jest.fn(async (_req: unknown, res: Response, result: object) => {
        res.status(200).json({ completedInteraction: result });
      }),
      Grant: SyntheticGrant,
      AccessToken: { find: jest.fn(async (raw: string) =>
        consentSaved && raw === OPAQUE ? {
          isValid: true, accountId: "tesbo-human", clientId: CLIENT,
          grantId: "test-grant-id", scope: "mcp:read", aud: RESOURCE
        } : undefined) }
    };
    // Only the external issuer's model is synthetic. The Tesbo verifier, owner
    // grant reader, middleware, Nest guards, controller and registry are real.
    Object.assign(oauth, {
      provider, policy: { issuer: ORIGIN + "/oauth",
        resourceOrigin: ORIGIN, scopes: ["mcp:read"] }
    });
    const mcp = new McpService(legacy as unknown as LegacyService,
      { query } as unknown as DatabaseService,
      { assertProjectWritable } as unknown as PlanLimitsService);
    const module = await Test.createTestingModule({
      controllers: [McpOAuthInteractionController, McpController],
      providers: [
        { provide: McpOAuthServer, useValue: oauth },
        { provide: McpService, useValue: mcp },
        { provide: LegacyService, useValue: legacy },
        { provide: AppConfigService, useValue: { sessionCookieName: "tesbo_session" } },
        { provide: APP_GUARD, useClass: ApiTokenRestGuard }
      ]
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    const auth = new AuthMiddleware(
      { sessionCookieName: "tesbo_session" } as AppConfigService,
      { resolveSession } as unknown as OtpService,
      { authenticate: authenticateApiToken } as unknown as ApiTokenService, oauth);
    app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      void auth.use(req, res, next).catch(next);
    });
    await app.listen(0, "127.0.0.1");
    base = "http://127.0.0.1:" +
      (app.getHttpServer().address() as AddressInfo).port;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    enabled = true; clientApproved = true; consentSaved = false; memberActive = true;
    jest.clearAllMocks();
    query.mockImplementation(async (sql: string) => currentGrantRows(sql));
    resolveSession.mockImplementation(async value => value === SESSION ? "tesbo-human" : null);
    authenticateApiToken.mockResolvedValue(null);
    listTestCases.mockResolvedValue([{ id: "case-1", title: "Existing regression" }]);
  });

  async function modern(method: string, token: string | null, projectId = P,
    params: Record<string, unknown> = {}, origin?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json", "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method
    };
    if (token) headers.Authorization = "Bearer " + token;
    if (origin) headers.Origin = origin;
    if (method === "tools/call") headers["Mcp-Name"] = String(params.name ?? "");
    return fetch(base + "/api/projects/" + projectId + "/mcp", {
      method: "POST", redirect: "manual", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 42, method,
        params: { ...params, _meta: META } })
    });
  }

  async function consentViaHumanSession() {
    const page = await fetch(base + "/api/oauth/interactions/" + UID, {
      redirect: "manual", headers: { Cookie: "tesbo_session=" + SESSION }
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Existing QA project");
    expect(html).toContain("Approved QA read client");
    const csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(html)?.[1];
    const review = /name="review" value="([a-f0-9]{64})"/.exec(html)?.[1];
    expect(csrf).toBeDefined(); expect(review).toBeDefined();
    const approved = await fetch(base + "/api/oauth/interactions/" + UID, {
      method: "POST", redirect: "manual",
      headers: { Cookie: "tesbo_session=" + SESSION, Origin: ORIGIN,
        "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "approve", csrf: csrf!, review: review! })
    });
    expect(approved.status).toBe(200);
    expect(await approved.json()).toEqual({
      completedInteraction: { consent: { grantId: "test-grant-id" } }
    });
    expect(consentSaved).toBe(true);
  }

  it("consents, discovers only approved tools, runs actual read, then revokes same bearer", async () => {
    expect((await modern("tools/list", OPAQUE)).status).toBe(401);
    await consentViaHumanSession();

    const discovery = await modern("server/discover", OPAQUE);
    expect(discovery.status).toBe(200);
    expect((await discovery.json()).result).toMatchObject({
      supportedVersions: ["2026-07-28"], resultType: "complete"
    });
    const listed = await modern("tools/list", OPAQUE);
    expect(listed.status).toBe(200);
    const catalog = await listed.json();
    expect(catalog.result.tools.map((tool: { name: string }) => tool.name))
      .toEqual(["list_testcases"]);

    const read = await modern("tools/call", OPAQUE, P,
      { name: "list_testcases", arguments: { limit: 2 } });
    expect(read.status).toBe(200);
    const outcome = await read.json();
    expect(outcome.result.resultType).toBe("complete");
    expect(JSON.parse(outcome.result.content[0].text))
      .toEqual([{ id: "case-1", title: "Existing regression" }]);
    expect(listTestCases).toHaveBeenCalledWith(P, { limit: 2 });

    const prohibited = await modern("tools/call", OPAQUE, P,
      { name: "create_testcase", arguments: { title: "Forbidden publish" } });
    expect(prohibited.status).toBe(403);
    expect((await prohibited.json()).error.code).toBe(-32002);
    expect(assertProjectWritable).not.toHaveBeenCalled();

    enabled = false;
    expect((await modern("tools/list", OPAQUE)).status).toBe(401);
    enabled = true; clientApproved = false;
    expect((await modern("tools/list", OPAQUE)).status).toBe(401);
    expect(listTestCases).toHaveBeenCalledTimes(1);
  });

  it("never substitutes a browser cookie or permits a foreign project, origin or removed member", async () => {
    await consentViaHumanSession();
    const cookieOnly = await fetch(base + "/api/projects/" + P + "/mcp", {
      method: "POST", headers: { Cookie: "tesbo_session=" + SESSION,
        "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    expect(cookieOnly.status).toBe(401);
    expect((await modern("tools/list", OPAQUE, OTHER)).status).toBe(403);
    expect((await modern("tools/list", OPAQUE, P, {}, "https://evil.example")).status).toBe(403);
    memberActive = false;
    expect((await modern("tools/list", OPAQUE)).status).toBe(403);
    expect(listTestCases).not.toHaveBeenCalled();
    expect(assertProjectWritable).not.toHaveBeenCalled();
  });
});
