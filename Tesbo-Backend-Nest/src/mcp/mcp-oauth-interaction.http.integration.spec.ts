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
      projectIdFromResource: (value: string) => {
        if (value !== RESOURCE) throw new Error("Wrong resource");
        return PROJECT;
      },
      approvedClient
    };
    const legacy = { requireProjectAccess: members };
    const config = { sessionCookieName: "tesbo_session" };
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
    members.mockResolvedValue({ name: "Existing project", key: "TES" });
    approvedClient.mockResolvedValue({
      kind: "oauth_client", clientName: "QA approved browser client",
      scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
    });
    details.mockResolvedValue({
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

  it("renders existing-account/project/read-only scope from a real GET, then processes an actual URL-encoded consent POST", async () => {
    const page = await request(UID);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Existing project");
    expect(html).toContain("QA approved browser client");
    expect(html).toContain("list_testcases");
    const csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(html)?.[1];
    expect(csrf).toBeDefined();
    const post = await request(UID, {
      method: "POST",
      headers: {
        "Origin": "https://tesbo.example",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ action: "approve", csrf: csrf! })
    });
    expect(post.status).toBe(200);
    expect(await post.json()).toEqual({ completedInteraction: { consent: { grantId: "ci-only-grant" } } });
    expect(addResourceScope).toHaveBeenCalledWith(RESOURCE, "mcp:read");
    expect(save).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(resolveSession).toHaveBeenCalledWith(SESSION);
  });

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
