import type { AuthenticatedRequest } from "../common/request.types";
import type { AppConfigService } from "../config/app-config.service";
import type { McpService } from "./mcp.service";
import type { McpOAuthServer } from "../auth/mcp-oauth-server";
import type { Response } from "express";
import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { McpOAuthInteractionController } from "./mcp-oauth-interaction.controller";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const RESOURCE = "https://tesbo.example/api/projects/" + PROJECT + "/mcp";
const CLIENT = "https://chatgpt.com/oauth/client.json";
const UID = "interaction-1";
const USER = "user-session-id";

/** Only a local disposable cryptographic test key; no production grant or key. */
beforeAll(() => {
  if (!process.env.SECRETS_ENCRYPTION_KEY) {
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 37).toString("base64");
  }
});

function fixture() {
  const grantCalls: Array<{ accountId: string; clientId: string }> = [];
  const addResourceScope = jest.fn();
  const addOIDCScope = jest.fn();
  const save = jest.fn().mockResolvedValue("retained-consent-grant");
  class FakeGrant {
    constructor(input: { accountId: string; clientId: string }) { grantCalls.push(input); }
    addResourceScope(resource: string, scope: string) { addResourceScope(resource, scope); }
    addOIDCScope(scope: string) { addOIDCScope(scope); }
    save() { return save(); }
  }
  const details = {
    prompt: { name: "consent" },
    params: { client_id: CLIENT, resource: RESOURCE, scope: "openid mcp:read offline_access" }
  };
  const provider = {
    interactionDetails: jest.fn().mockResolvedValue(details),
    interactionFinished: jest.fn().mockResolvedValue(undefined),
    Grant: FakeGrant
  };
  const oauth = {
    enabled: true, issuer: "https://tesbo.example/oauth",
    requireActive: jest.fn().mockReturnValue(provider),
    projectIdFromResource: jest.fn((value: string) => {
      if (value !== RESOURCE) throw new Error("invalid project resource");
      return PROJECT;
    }),
    approvedClient: jest.fn().mockResolvedValue({
      kind: "oauth_client", clientName: "QA <Reviewer> & Co",
      scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
    })
  };
  const mcp = {
    requireOAuthConsentProject: jest.fn().mockResolvedValue({ name: "QA Project", key: "QA" })
  };
  const req = {
    userId: USER, apiToken: null, oauthAccess: null, headers: {},
    cookies: { session: "human-cookie-value" },
    get: jest.fn((key: string) => key.toLowerCase() === "origin" ? "https://tesbo.example" : undefined)
  } as unknown as AuthenticatedRequest;
  const res = {
    setHeader: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
  const ctrl = new McpOAuthInteractionController(oauth as unknown as McpOAuthServer,
    mcp as unknown as McpService,
    { sessionCookieName: "session" } as unknown as AppConfigService);
  const tokenFromPage = async () => {
    await ctrl.consentPage(req, res as unknown as Response, UID);
    const output = String(res.send.mock.calls.at(-1)?.[0] ?? "");
    const csrf = /name="csrf" value="([a-f0-9]{64})"/.exec(output)?.[1];
    expect(csrf).toBeDefined();
    return { csrf: csrf!, output };
  };
  return {
    ctrl, req, res, oauth, provider, mcp, grantCalls, addResourceScope,
    addOIDCScope, save, details, tokenFromPage
  };
}

describe("Tesbo OAuth human login and read-only consent ownership", () => {
  it("is invisible when the embedded AS is disabled and cannot consume a human session", async () => {
    const f = fixture();
    f.oauth.enabled = false;
    await expect(f.ctrl.consentPage(f.req, f.res as unknown as Response, UID))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(f.oauth.requireActive).not.toHaveBeenCalled();
    expect(f.provider.interactionFinished).not.toHaveBeenCalled();
  });

  it.each([
    ["no signed-in user", { userId: null }],
    ["a token client impersonating a human", { apiToken: { tokenId: "token" } }],
    ["an OAuth machine identity", { oauthAccess: { kind: "oauth_access" } }],
    ["bearer header even with a signed-in cookie", { headers: { authorization: "Bearer machine" } }]
  ])("refuses %s without invoking issuer consent", async (_label, change) => {
    const f = fixture();
    Object.assign(f.req, change);
    await expect(f.ctrl.consentPage(f.req, f.res as unknown as Response, UID))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.provider.interactionDetails).not.toHaveBeenCalled();
    expect(f.provider.interactionFinished).not.toHaveBeenCalled();
  });

  it("renders only escaped reviewed client and project facts with a session-bound CSRF value", async () => {
    const f = fixture();
    const { output, csrf } = await f.tokenFromPage();
    expect(output).toContain("QA &lt;Reviewer&gt; &amp; Co");
    expect(output).not.toContain("QA <Reviewer> & Co");
    expect(output).toContain("list_testcases");
    expect(output).toContain("offline read-only access until revoked");
    expect(output).toContain('value="' + csrf + '"');
    expect(f.mcp.requireOAuthConsentProject).toHaveBeenCalledWith(USER, PROJECT);
    expect(f.oauth.approvedClient).toHaveBeenCalledWith(CLIENT, RESOURCE);
    expect(f.provider.interactionFinished).not.toHaveBeenCalled();
    expect(f.res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });

  it("denies unapproved clients, invalid resources and removed project members before rendering consent", async () => {
    for (const mode of ["unapproved", "foreign-resource", "removed-member"]) {
      const f = fixture();
      if (mode === "unapproved") f.oauth.approvedClient.mockResolvedValue(null);
      if (mode === "foreign-resource") f.details.params.resource = "https://evil.example/mcp";
      if (mode === "removed-member") f.mcp.requireOAuthConsentProject.mockRejectedValue(new ForbiddenException());
      await expect(f.ctrl.consentPage(f.req, f.res as unknown as Response, UID)).rejects.toThrow();
      expect(f.res.send).not.toHaveBeenCalled();
      expect(f.provider.interactionFinished).not.toHaveBeenCalled();
      expect(f.grantCalls).toHaveLength(0);
    }
  });

  it("rejects unsupported write scope, missing resource and misleading interaction prompts", async () => {
    for (const change of [
      { params: { client_id: CLIENT, resource: RESOURCE, scope: "mcp:read mcp:write" } },
      { params: { client_id: CLIENT, scope: "mcp:read" } },
      { prompt: { name: "register" } }
    ]) {
      const f = fixture();
      f.provider.interactionDetails.mockResolvedValue({ ...f.details, ...change });
      await expect(f.ctrl.consentPage(f.req, f.res as unknown as Response, UID))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(f.provider.interactionFinished).not.toHaveBeenCalled();
    }
  });

  it("refuses cross-origin, invalid CSRF and invalid action before any grant is created", async () => {
    const f = fixture();
    const { csrf } = await f.tokenFromPage();
    const submit = (action: string, token: string) =>
      f.ctrl.submitConsent(f.req, f.res as unknown as Response, UID, { action, csrf: token });
    f.req.get = jest.fn(() => "https://evil.example") as unknown as typeof f.req.get;
    await expect(submit("approve", csrf)).rejects.toBeInstanceOf(ForbiddenException);
    f.req.get = jest.fn(() => "https://tesbo.example") as unknown as typeof f.req.get;
    await expect(submit("approve", "f".repeat(64))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(submit("approve", "malformed")).rejects.toBeInstanceOf(ForbiddenException);
    await expect(submit("unknown", csrf)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.grantCalls).toHaveLength(0);
    expect(f.provider.interactionFinished).not.toHaveBeenCalled();
  });

  it("allows explicit cancellation without creating a consent grant", async () => {
    const f = fixture();
    const { csrf } = await f.tokenFromPage();
    await f.ctrl.submitConsent(f.req, f.res as unknown as Response, UID, { action: "deny", csrf });
    expect(f.provider.interactionFinished).toHaveBeenCalledWith(f.req, f.res,
      { error: "access_denied" }, { mergeWithLastSubmission: false });
    expect(f.grantCalls).toHaveLength(0);
    expect(f.save).not.toHaveBeenCalled();
  });

  it("continues the existing human login, but does not grant tools or create OAuth consent", async () => {
    const f = fixture();
    f.details.prompt.name = "login";
    const { csrf, output } = await f.tokenFromPage();
    expect(output).toContain("You will still review the permissions");
    await f.ctrl.submitConsent(f.req, f.res as unknown as Response, UID, { action: "approve", csrf });
    expect(f.provider.interactionFinished).toHaveBeenCalledWith(f.req, f.res,
      { login: { accountId: USER, remember: false } }, { mergeWithLastSubmission: false });
    expect(f.grantCalls).toHaveLength(0);
  });

  it("commits only the approved project resource and mcp:read in an explicit consent grant", async () => {
    const f = fixture();
    const { csrf } = await f.tokenFromPage();
    await f.ctrl.submitConsent(f.req, f.res as unknown as Response, UID, { action: "approve", csrf });
    expect(f.grantCalls).toEqual([{ accountId: USER, clientId: CLIENT }]);
    expect(f.addResourceScope).toHaveBeenCalledTimes(1);
    expect(f.addResourceScope).toHaveBeenCalledWith(RESOURCE, "mcp:read");
    expect(f.addOIDCScope).toHaveBeenCalledWith("openid offline_access");
    expect(f.save).toHaveBeenCalledTimes(1);
    expect(f.provider.interactionFinished).toHaveBeenCalledWith(f.req, f.res,
      { consent: { grantId: "retained-consent-grant" } }, { mergeWithLastSubmission: false });
  });

  it("refuses a revoked owner grant or removed project membership at submission time", async () => {
    for (const revoke of ["grant", "membership"]) {
      const f = fixture();
      const { csrf } = await f.tokenFromPage();
      if (revoke === "grant") f.oauth.approvedClient.mockResolvedValue(null);
      else f.mcp.requireOAuthConsentProject.mockRejectedValue(new ForbiddenException());
      await expect(f.ctrl.submitConsent(f.req, f.res as unknown as Response, UID,
        { action: "approve", csrf })).rejects.toThrow();
      expect(f.save).not.toHaveBeenCalled();
      expect(f.provider.interactionFinished).not.toHaveBeenCalled();
    }
  });
});
