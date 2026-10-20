import type { NextFunction, Response } from "express";
import { AuthMiddleware } from "./auth.middleware";
import { AppConfigService } from "../config/app-config.service";
import { ApiTokenService } from "./api-token.service";
import { OtpService } from "./otp.service";
import type { AuthenticatedRequest } from "../common/request.types";

function fixture(principal: object | null = { tokenId: "t", userId: "machine", projectId: "p", scopes: ["read"] }) {
  const otp = { resolveSession: jest.fn().mockResolvedValue("browser") };
  const api = { authenticate: jest.fn().mockResolvedValue(principal) };
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
  it("preserves browser cookie authentication when no bearer provided", async () => {
    const f = fixture();
    const req = { headers: {}, cookies: { session: "valid" } } as unknown as AuthenticatedRequest;
    await f.mw.use(req, {} as Response, f.next);
    expect(req.userId).toBe("browser");
    expect(req.apiToken).toBeNull();
    expect(f.api.authenticate).not.toHaveBeenCalled();
  });
});