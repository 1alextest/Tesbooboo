import type { NextFunction, Response } from "express";
import { AuthMiddleware } from "./auth.middleware";
import { AppConfigService } from "../config/app-config.service";
import { ApiTokenService } from "./api-token.service";
import { OtpService } from "./otp.service";
import type { AuthenticatedRequest } from "../common/request.types";

function fixture(principal: object | null = { tokenId: "t", userId: "machine", projectId: "p", scopes: ["read"] }) {
  const otp = { resolveSession: jest.fn().mockResolvedValue("browser") };
  // Mirrors ApiTokenService.authenticate: an absent/empty token has no principal. A mock that
  // answered a bare "Bearer" with one would make the middleware look like it accepted an empty
  // credential, which is the opposite of what it does.
  const api = { authenticate: jest.fn(async (token: string | null) => (token ? principal : null)) };
  const mw = new AuthMiddleware(
    { sessionCookieName: "session" } as unknown as AppConfigService,
    otp as unknown as OtpService,
    api as unknown as ApiTokenService
  );
  return { mw, otp, api, next: jest.fn() as NextFunction };
}
describe("AuthMiddleware bearer precedence", () => {
  it("uses bearer token instead of more privileged browser session", async () => {
    const f = fixture();
    const req = { headers: { authorization: "Bearer tsbo_read" }, cookies: { session: "valid" } } as unknown as AuthenticatedRequest;
    await f.mw.use(req, {} as Response, f.next);
    expect(req.userId).toBe("machine");
    expect(req.apiToken?.scopes).toEqual(["read"]);
    expect(f.otp.resolveSession).not.toHaveBeenCalled();
    expect(f.api.authenticate).toHaveBeenCalledWith("tsbo_read");
  });
  it("does not fall back to cookie on invalid bearer", async () => {
    const f = fixture(null);
    const req = { headers: { authorization: "Bearer invalid" }, cookies: { session: "valid" } } as unknown as AuthenticatedRequest;
    await f.mw.use(req, {} as Response, f.next);
    expect(req.userId).toBeNull();
    expect(req.apiToken).toBeNull();
    expect(f.otp.resolveSession).not.toHaveBeenCalled();
  });
  it("does not fall back to cookie on empty bearer", async () => {
    const f = fixture();
    const req = { headers: { authorization: "Bearer " }, cookies: { session: "valid" } } as unknown as AuthenticatedRequest;
    await f.mw.use(req, {} as Response, f.next);
    expect(req.userId).toBeNull();
    expect(f.otp.resolveSession).not.toHaveBeenCalled();
  });
  it.each(["Bearer unverified-oauth", "Bearer ", ""])(
    "never carries forward an unverified OAuth machine identity for header %p", async authorization => {
      const f = fixture(null);
      const req = {
        headers: authorization ? { authorization } : {},
        cookies: { session: "valid" },
        oauthAccess: {
          kind: "oauth_access",
          issuer: "https://untrusted.example", subject: "s", clientId: "client",
          grantId: "grant", userId: "forged", projectId: "p",
          resource: "https://untrusted.example/api/mcp", scopes: ["write"]
        }
      } as unknown as AuthenticatedRequest;
      await f.mw.use(req, {} as Response, f.next);
      expect(req.oauthAccess).toBeNull();
      expect(req.apiToken).toBeNull();
      expect(req.userId).toBe(authorization ? null : "browser");
      if (authorization) expect(f.otp.resolveSession).not.toHaveBeenCalled();
    }
  );

  it("attaches a verified opaque OAuth principal without upgrading its Tesbo user into a browser session", async () => {
    const { McpOAuthServer } = await import("./mcp-oauth-server");
    const f = fixture(null);
    const verified = {
      kind: "oauth_access" as const, issuer: "https://tesbo.example/oauth", subject: "external-sub",
      clientId: "https://client.example/id", grantId: "grant-1", userId: "member-1",
      projectId: "project-1", resource: "https://tesbo.example/api/projects/project-1/mcp",
      scopes: ["mcp:read"]
    };
    const oauth = { enabled: true, verifyAccessToken: jest.fn().mockResolvedValue(verified) };
    const real = new AuthMiddleware(
      { sessionCookieName: "session" } as unknown as AppConfigService,
      f.otp as unknown as OtpService,
      f.api as unknown as ApiTokenService,
      oauth as unknown as McpOAuthServer
    );
    const req = {
      headers: { authorization: "Bearer verified-oauth-opaque-value" },
      cookies: { session: "more-privileged-browser" }
    } as unknown as AuthenticatedRequest;
    await real.use(req, {} as Response, f.next);
    expect(req.oauthAccess).toEqual(verified);
    expect(req.apiToken).toBeNull();
    expect(req.userId).toBeNull();
    expect(f.otp.resolveSession).not.toHaveBeenCalled();
    expect(oauth.verifyAccessToken).toHaveBeenCalledWith("verified-oauth-opaque-value");
  });

  it("never substitutes an invalid OAuth bearer with a Tesbo browser cookie", async () => {
    const { McpOAuthServer } = await import("./mcp-oauth-server");
    const f = fixture(null);
    const oauth = { enabled: true, verifyAccessToken: jest.fn().mockResolvedValue(null) };
    const real = new AuthMiddleware(
      { sessionCookieName: "session" } as unknown as AppConfigService,
      f.otp as unknown as OtpService,
      f.api as unknown as ApiTokenService,
      oauth as unknown as McpOAuthServer
    );
    const req = {
      headers: { authorization: "Bearer rejected-oauth" },
      cookies: { session: "existing-human" }
    } as unknown as AuthenticatedRequest;
    await real.use(req, {} as Response, f.next);
    expect(req.userId).toBeNull();
    expect(req.oauthAccess).toBeNull();
    expect(req.apiToken).toBeNull();
    expect(f.otp.resolveSession).not.toHaveBeenCalled();
  });

  it("preserves browser cookie authentication when no bearer provided", async () => {
    const f = fixture();
    const req = { headers: {}, cookies: { session: "valid" } } as unknown as AuthenticatedRequest;
    await f.mw.use(req, {} as Response, f.next);
    expect(req.userId).toBe("browser");
    expect(req.apiToken).toBeNull();
    expect(f.api.authenticate).not.toHaveBeenCalled();
  });
});