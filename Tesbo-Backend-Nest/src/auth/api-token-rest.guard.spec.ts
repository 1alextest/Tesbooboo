import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { ApiTokenRestGuard } from "./api-token-rest.guard";
import { LegacyService } from "../legacy/legacy.service";
const P = "11111111-1111-4111-8111-111111111111";
const Q = "22222222-2222-4222-8222-222222222222";
const legacy = () => ({ requireProjectAccess: jest.fn().mockResolvedValue({ id: P }) });
function request(path: string, method: string, scopes: string[] | null = ["read"], projectId = P): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({
    path, method,
    apiToken: scopes ? { tokenId: "token-1", userId: "user-1", projectId, scopes } : null
  }) }) } as unknown as ExecutionContext;
}
describe("ApiTokenRestGuard", () => {
  it("preserves cookie requests", async () => {
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, "POST", null))).toBe(true);
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects read token %s", async method => {
    const l = legacy();
    await expect(new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, method))).rejects.toBeInstanceOf(ForbiddenException);
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });
  it("permits own-project read while checking membership", async () => {
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, "GET"))).toBe(true);
    expect(l.requireProjectAccess).toHaveBeenCalledWith("user-1", P);
  });
  it("denies write-only tokens reading routes", async () => {
    await expect(new ApiTokenRestGuard(legacy() as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, "GET", ["write"]))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("permits write token mutation after membership validation", async () => {
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, "POST", ["write"]))).toBe(true);
    expect(l.requireProjectAccess).toHaveBeenCalledWith("user-1", P);
  });
  it("denies another project even if user belongs to it", async () => {
    const l = legacy();
    await expect(new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${Q}/testcases`, "GET"))).rejects.toBeInstanceOf(ForbiddenException);
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });
  it.each(["/api/cycles/other", "/api/bugs/other", "/api/projects", "/api/auth/me"])("denies ambiguous REST alias %s", async path => {
    await expect(new ApiTokenRestGuard(legacy() as unknown as LegacyService).canActivate(request(path, "POST", ["write"]))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(["/api/mcp", `/api/projects/${P}/mcp`])("delegates %s to MCP's existing checks", async path => {
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(path, "POST"))).toBe(true);
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });
  it("denies revoked project membership", async () => {
    const l = legacy(); l.requireProjectAccess.mockRejectedValue(new ForbiddenException());
    await expect(new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, "GET"))).rejects.toBeInstanceOf(ForbiddenException);
  });
});