import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import type { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { McpService } from "./mcp.service";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const USER = "tesbo-member";
const CLIENT = "https://chatgpt.com/oauth/client.json";
const FINGERPRINT = "a".repeat(64);
const validClient = {
  kind: "oauth_client", oauthClientId: CLIENT, clientName: "Approved QA reader",
  scopes: ["read"], allowedTools: ["list_testcases"], expiresAt: null
};
const settings = (revision = 3, enabled = true, clients: unknown[] = [validClient]) =>
  ({ externalMcpAccess: { enabled, revision, clients } });
const req = (changes: Record<string, unknown> = {}) =>
  ({ userId: USER, apiToken: null, oauthAccess: null, headers: {}, ...changes }) as unknown as AuthenticatedRequest;

function fixture() {
  const requireProjectAccess = jest.fn().mockResolvedValue({ organization_id: "org-ci" });
  const binding = {
    grant_fingerprint: FINGERPRINT, client_id: CLIENT,
    resource: "https://tesbo.example/api/projects/" + PROJECT + "/mcp",
    approval_revision: 3, created_at: new Date("2026-11-20T10:00:00Z"),
    revoked_at: null as Date | null, settings: settings(),
    organization_id: "org-ci"
  };
  const query = jest.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes("SELECT b.grant_fingerprint")) return { rows: [binding] };
    if (sql.includes("SELECT b.client_id")) return { rows: [binding] };
    if (sql.includes("SET revoked_at")) {
      binding.revoked_at = new Date("2026-11-21T10:00:00Z");
      return { rows: [{ grant_fingerprint: FINGERPRINT }] };
    }
    if (sql.includes("INSERT INTO audit_logs")) return { rows: [{}] };
    throw Error("Unexpected SQL in consent test");
  });
  const transaction = jest.fn(async (callback: (client: { query: typeof query }) => Promise<unknown>) =>
    callback({ query }));
  const svc = new McpService(
    { requireProjectAccess } as unknown as LegacyService,
    { query, transaction } as unknown as DatabaseService,
    { assertProjectWritable: jest.fn() } as unknown as PlanLimitsService
  );
  return { svc, binding, query, transaction, requireProjectAccess };
}

describe("human-owned OAuth consent evidence and self-revocation", () => {
  it("shows only the human's own consent with bounded, non-live status", async () => {
    const f = fixture();
    const result = await f.svc.listMyOAuthConsents(req(), PROJECT);
    expect(result).toEqual({
      consents: [{
        id: FINGERPRINT, clientId: CLIENT, clientName: "Approved QA reader",
        resource: f.binding.resource, status: "consent_current",
        createdAt: "2026-11-20T10:00:00.000Z", revokedAt: null
      }], truncated: false
    });
    expect(f.requireProjectAccess).toHaveBeenCalledWith(USER, PROJECT);
    expect(f.query.mock.calls[0][1]).toEqual([PROJECT, USER]);
    expect(f.query.mock.calls[0][0]).toContain("b.account_id=$2");
    expect(JSON.stringify(result)).not.toContain("access_token");
    expect(JSON.stringify(result)).not.toContain("refresh_token");
  });

  it("does not claim current consent after expiry, project disablement, revocation, or policy revision", async () => {
    for (const change of [
      { settings: settings(4) },
      { settings: settings(3, false) },
      { settings: settings(3, true, []) },
      { revoked_at: new Date("2026-11-21T10:00:00Z") }
    ]) {
      const f = fixture();
      Object.assign(f.binding, change);
      const result = await f.svc.listMyOAuthConsents(req(), PROJECT);
      expect(result.consents[0].status).toBe(change.revoked_at ? "revoked" : "reconsent_required");
    }
  });

  it("refuses bearer credentials and anonymous callers before reading any identity", async () => {
    for (const candidate of [
      req({ userId: null }),
      req({ apiToken: { tokenId: "test" } }),
      req({ oauthAccess: { kind: "oauth_access" } }),
      req({ headers: { authorization: "Bearer token" } })
    ]) {
      const f = fixture();
      await expect(f.svc.listMyOAuthConsents(candidate, PROJECT)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(f.svc.revokeMyOAuthConsent(candidate, PROJECT, FINGERPRINT))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(f.query).not.toHaveBeenCalled();
      expect(f.transaction).not.toHaveBeenCalled();
    }
  });

  it("refuses removed membership and never reads or revokes another account's binding", async () => {
    const f = fixture();
    f.requireProjectAccess.mockRejectedValueOnce(new ForbiddenException());
    await expect(f.svc.listMyOAuthConsents(req(), PROJECT)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.query).not.toHaveBeenCalled();
    f.query.mockImplementationOnce(async () => ({ rows: [] }));
    await expect(f.svc.revokeMyOAuthConsent(req(), PROJECT, FINGERPRINT))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(f.query.mock.calls.at(-1)?.[1]).toEqual([PROJECT, USER, FINGERPRINT]);
  });

  it("revokes only the authenticated human's binding and writes attributable audit in one transaction", async () => {
    const f = fixture();
    const result = await f.svc.revokeMyOAuthConsent(req(), PROJECT, FINGERPRINT);
    expect(result).toEqual({ id: FINGERPRINT, status: "revoked", replayed: false });
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.binding.revoked_at).toBeInstanceOf(Date);
    expect(f.query.mock.calls.map(c => c[0])).toEqual([
      expect.stringContaining("FOR UPDATE OF b FOR SHARE OF p,pm,om"),
      expect.stringContaining("SET revoked_at"),
      expect.stringContaining("INSERT INTO audit_logs")
    ]);
    expect(f.query.mock.calls[2][1]?.[0]).toBe(PROJECT);
    expect(f.query.mock.calls[2][1]?.[1]).toBe(USER);
    expect(f.query.mock.calls[2][1]?.[2]).toBe(FINGERPRINT);
    const replay = await f.svc.revokeMyOAuthConsent(req(), PROJECT, FINGERPRINT);
    expect(replay).toEqual({ id: FINGERPRINT, status: "revoked", replayed: true });
    expect(f.query.mock.calls.filter(c => c[0].includes("INSERT INTO audit_logs"))).toHaveLength(1);
  });

  it("refuses malformed IDs before opening a mutation and propagates audit failures", async () => {
    const f = fixture();
    await expect(f.svc.revokeMyOAuthConsent(req(), PROJECT, "main")).rejects.toBeInstanceOf(NotFoundException);
    expect(f.transaction).not.toHaveBeenCalled();
    f.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT b.client_id")) return { rows: [f.binding] };
      if (sql.includes("SET revoked_at")) return { rows: [{}] };
      throw new Error("audit write failed");
    });
    await expect(f.svc.revokeMyOAuthConsent(req(), PROJECT, FINGERPRINT))
      .rejects.toThrow("audit write failed");
  });

  it("reports truncated history rather than silently presenting fifty rows as all consent history", async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce({ rows: Array.from({ length: 51 }, () => ({ ...f.binding })) });
    const result = await f.svc.listMyOAuthConsents(req(), PROJECT);
    expect(result.consents).toHaveLength(50);
    expect(result.truncated).toBe(true);
  });
});
