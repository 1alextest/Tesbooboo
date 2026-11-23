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
function futureOAuthRequest(path: string, method = "POST"): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({
    path, method, userId: "tesbo-user", apiToken: null,
    cookies: { tesbo_session: "existing-browser-cookie" },
    oauthAccess: {
      kind: "oauth_access", issuer: "https://issuer.example", subject: "user-sub",
      clientId: "client", grantId: "grant", userId: "tesbo-user", projectId: P,
      resource: `https://tesbo.example/api/projects/${P}/mcp`, scopes: ["read", "write"]
    }
  }) }) } as unknown as ExecutionContext;
}

describe("ApiTokenRestGuard", () => {
  it.each([
    ["POST", "/api/mcp"],
    ["POST", `/api/projects/${P}/mcp`],
    ["GET", `/api/projects/${P}/testcases`],
    ["POST", `/api/projects/${P}/agents/zyra/tasks/proposals`],
    ["POST", `/api/projects/${P}/testcases/case/approve`],
    ["PUT", `/api/projects/${P}/mcp-access`],
    ["POST", "/api/auth/logout"],
    ["GET", "/api/auth/me"]
  ])("fails closed for an OAuth machine principal on %s %s until a verifier and route policy exist",
    async (method, path) => {
      const l = legacy();
      await expect(new ApiTokenRestGuard(l as unknown as LegacyService)
        .canActivate(futureOAuthRequest(path, method)))
        .rejects.toMatchObject({ response: expect.objectContaining({ code: "OAUTH_MACHINE_ACCESS_DISABLED" }) });
      expect(l.requireProjectAccess).not.toHaveBeenCalled();
    }
  );


  it("preserves cookie requests", async () => {
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, "POST", null))).toBe(true);
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects read token %s", async method => {
    const l = legacy();
    await expect(new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/bugs`, method))).rejects.toBeInstanceOf(ForbiddenException);
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
  it("permits raw bug intake after membership validation", async () => {
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/bugs`, "POST", ["write"]))).toBe(true);
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
  it.each(["/api/mcp", `/api/projects/${P}/mcp`, "/API/MCP", `/api/Projects/${P}/Mcp/`])("delegates %s to MCP's existing checks", async path => {
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(path, "POST"))).toBe(true);
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });
  it.each([
    "POST /apikeys", "GET /apikeys", "DELETE /apikeys/token-2",
    "POST /members", "GET /members", "DELETE /members/user-2", "GET /mcp-access", "PUT /mcp-access",
    "POST /APIKEYS/", "GET /ApiKeys", "DELETE /MEMBERS/user-2", "PUT /MCP-ACCESS/"
  ])("blocks bearer project administration %s", async route => {
    const [method, suffix] = route.split(" ");
    const l = legacy();
    await expect(new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(
      request(`/api/projects/${P}${suffix}`, method, ["read", "write"])
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });

  it.each(["PATCH", "DELETE"])("blocks bearer project administration %s /projects/:id", async method => {
    await expect(new ApiTokenRestGuard(legacy() as unknown as LegacyService).canActivate(
      request(`/api/projects/${P}`, method, ["read", "write"])
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("denies revoked project membership", async () => {
    const l = legacy(); l.requireProjectAccess.mockRejectedValue(new ForbiddenException());
    await expect(new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}/testcases`, "GET"))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    "POST /suites", "POST /SUITES/",
    "POST /testcases", "PUT /testcases/case", "DELETE /testcases/case", "POST /testcases/case/duplicate",
    "POST /testcases/bulk-create", "POST /testcases/bulk-update", "POST /testcases/bulk-delete", "POST /testcases/import",
    "POST /testcases/case/approve", "PUT /testcases/case/custom-field-values",
    "POST /custom-fields/definitions", "POST /custom-fields/definitions/reorder", "PATCH /custom-fields/definitions/field",
    "PATCH /custom-fields/definitions/field/status", "POST /custom-fields/definitions/field/options",
    "PATCH /custom-fields/definitions/field/options/option", "DELETE /custom-fields/definitions/field", "POST /custom-fields/definitions/field/restore",
    "POST /custom-tags", "PATCH /custom-tags/tag", "DELETE /custom-tags/tag",
    "POST /review-board/recommendations/recommendation/keep", "POST /review-board/recommendations/recommendation/edit",
    "POST /review-board/recommendations/recommendation/remove", "POST /ai/generation-history/task/save",
    "POST /agents/zyra/tasks/task/save", "POST /agents/zyra/tasks/task/close", "POST /TESTCASES/IMPORT/",
    "POST /model-studio/models/model/revisions/revision/approve",
    "POST /model-studio/models/model/revisions/revision/candidates"
  ])("refuses machine publication before any owner call: %s", async route => {
    const [method, suffix] = route.split(" ");
    const l = legacy();
    const attempt = new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}${suffix}`, method, ["read", "write"]));
    await expect(attempt).rejects.toMatchObject({ response: expect.objectContaining({ code: "HUMAN_PUBLICATION_REQUIRED" }) });
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });

  it.each([
    "POST /agents/zyra/tasks/proposals", "POST /agents/zyra/tasks/task/feedback", "PATCH /agents/zyra/tasks/task/drafts/0",
    "DELETE /agents/zyra/tasks/task/drafts/0", "POST /review-board/analysis", "POST /automation/cases/resolve",
    "POST /automation/runs/run/results", "POST /automation/runs/run/results/case/evidence", "POST /bugs",
    "GET /testcases/case/custom-field-values", "GET /custom-fields/definitions", "GET /custom-tags",
    "POST /model-studio/models/model/revisions/revision/generate",
    "POST /model-studio/models/model/revisions/revision/runs"
  ])("preserves scoped candidate, read or evidence neighbor: %s", async route => {
    const [method, suffix] = route.split(" ");
    const l = legacy();
    expect(await new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request(`/api/projects/${P}${suffix}`, method, ["read", "write"]))).toBe(true);
    expect(l.requireProjectAccess).toHaveBeenCalledWith("user-1", P);
  });

  it("keeps suite deletion machine-denied because it moves or deletes contained official cases", async () => {
    const l = legacy();
    await expect(new ApiTokenRestGuard(l as unknown as LegacyService).canActivate(request("/api/suites/suite", "DELETE", ["write"])))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "HUMAN_PUBLICATION_REQUIRED" }) });
    expect(l.requireProjectAccess).not.toHaveBeenCalled();
  });
});
