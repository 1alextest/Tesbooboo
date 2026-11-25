import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { type INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import type { NextFunction, Response } from "express";
import { AuthMiddleware } from "../auth/auth.middleware";
import { ApiTokenRestGuard } from "../auth/api-token-rest.guard";
import { ApiTokenService } from "../auth/api-token.service";
import { OtpService } from "../auth/otp.service";
import { McpOAuthServer } from "../auth/mcp-oauth-server";
import { AppConfigService } from "../config/app-config.service";
import { LegacyService } from "../legacy/legacy.service";
import { McpOAuthInteractionController } from "./mcp-oauth-interaction.controller";
import { McpService } from "./mcp.service";
import type { AuthenticatedRequest } from "../common/request.types";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const RESOURCE = `https://tesbo.example/api/projects/${PROJECT}/mcp`;
const CLIENT = "https://chatgpt.com/oauth/client.json";
const UID = "browser-flow-1";
const SESSION = "disposable-ci-human-cookie";

/**
 * Real HTTP form and middleware integration; synthetic AS interaction ONLY.
 * No OAuth token/code, production session, native case or external credential.
 */
describe("OAuth consent through the actual Nest HTTP/middleware boundary", () => {
  let app: INestApplication;
  let base: string;
  const members = jest.fn();
  const save = jest.fn();
  const finish = jest.fn();
  const addResourceScope = jest.fn();
  const resolveSession = jest.fn();
  const authenticate = jest.fn();
  const details = jest.fn();
  const approvedClient = jest.fn();

  beforeAll(async () => {
    process.env.SECRETS_ENCRYPTION_KEY ||= Buffer.alloc(32, 19).toString("base64");
    class TestGrant {
      constructor(public readonly input: { accountId: string; clientId: string }) {}
      addResourceScope(resource: string, scope: string) { addResourceScope(resource, scope); }
      addOIDCScope(_scope: string) {}
      save() { return save(); }
    }
    const provider = {
      interactionDetails: details,
      interactionFinished: finish,
      Grant: TestGrant
    };
    const oauth = {
      enabled: true,
      issuer: "https://tesbo.example/oauth",
      requireActive: jest.fn().mockReturnValue(provider),
      bindIssuedGrant: jest.fn().mockResolvedValue(undefined),
      discardUnboundGrant: jest.fn().mockResolvedValue(undefined),
      projectIdFromResource: (value: string) => {
        if (value !== RESOURCE) throw new Error("Wrong resource");
        return PROJECT;
      },
      approvedClient
    };
    const legacy = { requireProjectAccess: members };
    const config = { sessionCookieName: "tesbo_session", frontendUrl: "https://app.tesbo.example" };
    const module = await Test.createTestingModule({
      controllers: [McpOAuthInteractionController],
      providers: [
        { provide: McpOAuthServer, useValue: oauth },
        { provide: LegacyService, useValue: legacy },
        { provide: McpService, useValue: { requireOAuthConsentProject: members } },
        { provide: AppConfigService, useValue: config },
        { provide: APP_GUARD, useClass: ApiTokenRestGuard }
      ]
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    // Run the same credential-precedence implementation as the actual app,
    // rather than assigning req.userId with a fabricated test middleware.
    const auth = new AuthMiddleware(
      config as unknown as AppConfigService,
      { resolveSession } as unknown as OtpService,
      { authenticate } as unknown as ApiTokenService
    );
    app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      void auth.use(req, res, next).catch(next);
    });
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => { await app?.close(); });

  beforeEach(() => {
    jest.clearAllMocks();
    resolveSession.mockImplementation(async token => token === SESSION ? "test-member" : null);
    authenticate.mockResolvedValue(null);
    members.mockResolvedValue({
      name: "Existing project", key: "TES",
      project_membership_id: "11111111-1111-4111-8111-111111111111",
      organization_membership_id: "22222222-2222-4222-8222-222222222222"
    });
    approvedClient.mockResolvedValue({
      kind: "oauth_client", clientName: "QA approved browser client",
      scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null, accessRevision: 1
    });
    details.mockReset().mockResolvedValue({
      uid: UID,
      prompt: { name: "consent" },
      params: { client_id: CLIENT, resource: RESOURCE, scope: "mcp:read" }
    });
    save.mockResolvedValue("ci-only-grant");
    finish.mockImplementation(async (_req: unknown, res: Response, result: object) => {
      res.status(200).json({ completedInteraction: result });
    });
  });

  function request(path: string, init: RequestInit = {}, authenticated = true) {
    return fetch(`${base}/api/oauth/interactions/${path}`, {
      redirect: "manual",
      ...init,
      headers: {
        ...(authenticated ? { Cookie: `tesbo_session=${SESSION}` } : {}),
        ...(init.headers || {})
      }
    });
  }

  it("sends a signed-out browser with a current provider interaction to the configured Tesbo login", async () => {
    const response = await request(UID, { headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" } }, false);
    expect(response.status).toBe(303);
    const login = new URL(response.headers.get("location")!);
    expect(login.origin + login.pathname).toBe("https://app.tesbo.example/login");
    expect([...login.searchParams]).toEqual([["redirect", `/api/oauth/interactions/${UID}`]]);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(approvedClient).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { Accept: "application/json" },
    { Accept: "*/*" },
    { Accept: "text/html", Authorization: "Bearer invalid" }
  ])("requires a session for an API or credential-bearing GET", async headers => {
    const response = await request(UID, { headers }, false);
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(details).not.toHaveBeenCalled();
  });

  it("reports an expired interaction and does not send the user through login", async () => {
    details.mockRejectedValueOnce(Object.assign(new Error("invalid_request"), { name: "SessionNotFound" }));
    const response = await request(UID, { headers: { Accept: "text/html" } }, false);
    expect(response.status).toBe(410);
    expect(response.headers.get("location")).toBeNull();
    expect(finish).not.toHaveBeenCalled();
  });

  it("only resumes the interaction returned by the provider for this browser", async () => {
    const response = await request("different-interaction", { headers: { Accept: "text/html" } }, false);
    expect(response.status).toBe(410);
    expect(response.headers.get("location")).toBeNull();
    expect(finish).not.toHaveBeenCalled();
  });

  it("renders existing-account/project/read-only scope from a real GET, then processes an actual URL-encoded consent POST", async () => {
    const page = await request(UID);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Existing project");
    expect(html).toContain("QA approved browser client");
    expect(html).toContain("list_testcases");
    const csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(html)?.[1];
    expect(csrf).toBeDefined();
    const review = /name="review" value="([a-f0-9]{64})"/.exec(html)?.[1];
    expect(review).toBeDefined();
    const post = await request(UID, {
      method: "POST",
      headers: {
        "Origin": "https://tesbo.example",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ action: "approve", csrf: csrf!, review: review! })
    });
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ completedInteraction: { consent: { grantId: "ci-only-grant" } } });
    expect(addResourceScope).toHaveBeenCalledWith(RESOURCE, "mcp:read");
    expect(save).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(resolveSession).toHaveBeenCalledWith(SESSION);
  });

  it("rejects a stale displayed permission review through the real HTTP form", async () => {
    const page = await request(UID);
    expect(page.status).toBe(200);
    const html = await page.text();
    const csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(html)?.[1];
    const review = /name="review" value="([a-f0-9]{64})"/.exec(html)?.[1];
    expect(csrf).toBeDefined();
    expect(review).toBeDefined();
    approvedClient.mockResolvedValue({
      kind: "oauth_client", clientName: "QA approved browser client",
      scopes: ["read"], allowedTools: null, expiresAt: null, accessRevision: 2
    });
    const post = await request(UID, {
      method: "POST",
      headers: { Origin: "https://tesbo.example", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "approve", csrf: csrf!, review: review! })
    });
    expect(post.status).toBe(403);
    expect(save).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it.each(["project", "organization"] as const)(
    "refuses an HTTP approval after the %s membership generation changes", async membership => {
      const page = await request(UID);
      expect(page.status).toBe(200);
      const html = await page.text();
      const csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(html)?.[1];
      const review = /name="review" value="([a-f0-9]{64})"/.exec(html)?.[1];
      expect(csrf).toBeDefined();
      expect(review).toBeDefined();
      // Unchanged names, scope and owner revision must not authenticate a
      // browser's stale review when membership was removed and recreated.
      members.mockResolvedValue({
        name: "Existing project", key: "TES",
        project_membership_id: membership === "project"
          ? "33333333-3333-4333-8333-333333333333"
          : "11111111-1111-4111-8111-111111111111",
        organization_membership_id: membership === "organization"
          ? "33333333-3333-4333-8333-333333333333"
          : "22222222-2222-4222-8222-222222222222"
      });
      const post = await request(UID, {
        method: "POST",
        headers: { Origin: "https://tesbo.example",
          "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ action: "approve", csrf: csrf!, review: review! })
      });
      expect(post.status).toBe(403);
      expect(save).not.toHaveBeenCalled();
      expect(finish).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["no session", false, undefined, undefined],
    ["wrong Origin", true, "https://evil.example", "f".repeat(64)],
    ["missing Origin", true, undefined, "f".repeat(64)],
    ["missing CSRF", true, "https://tesbo.example", undefined]
  ])("fails closed before provider grant on %s", async (_label, authenticated, origin, csrf) => {
    const response = await request(UID, {
      method: "POST",
      headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "approve", ...(csrf ? { csrf } : {}) })
    }, authenticated);
    expect([401, 403]).toContain(response.status);
    expect(save).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });

  it("never lets bearer plus browser cookie approve OAuth consent", async () => {
    const res = await request(UID, {
      method: "POST",
      headers: { Authorization: "Bearer invalid-machine", Origin: "https://tesbo.example",
        "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "approve", csrf: "f".repeat(64) })
    });
    expect(res.status).toBe(401);
    expect(resolveSession).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
  });
});
