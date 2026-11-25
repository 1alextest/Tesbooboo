import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { McpService } from "../mcp/mcp.service";
import { createMcpOAuthPostgresAdapter } from "./mcp-oauth-postgres.adapter";
import { bindOAuthGrantToApproval, currentOAuthGrantBinding } from "./mcp-oauth-grant-binding";

const url = process.env.DATABASE_URL || "";
const CLIENT = "https://chatgpt.com/oauth/client.json";
const grant = { kind: "oauth_client" as const, oauthClientId: CLIENT,
  clientName: "Disposable OAuth QA", scopes: ["read" as const],
  allowedTools: null, expiresAt: null };

const target = URL.canParse(url) ? new URL(url) : undefined;
const disposableCI = process.env.GITHUB_ACTIONS === "true" && !!target &&
  ["postgresql:", "postgres:"].includes(target.protocol) &&
  ["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname === "/tesbo_ci" && !target.search;
if (process.env.GITHUB_JOB === "real-provider-persistence" && !disposableCI) {
  throw new Error("The OAuth persistence job requires its disposable PostgreSQL service");
}

(disposableCI ? describe : describe.skip)(
  "OA-T18 disposable PostgreSQL grant invalidation — never resurrect an old consent",
  () => {
    let pool: Pool;
    let db: DatabaseService;
    let org = "", user = "", project = "";
    const tag = randomUUID().replaceAll("-", "");
    const oldGrant = `qa-old-${tag}`;
    const freshGrant = `qa-fresh-${tag}`;
    const oldRefresh = `qa-refresh-${tag}`;
    const priorKey = process.env.SECRETS_ENCRYPTION_KEY;
    const settings = (revision: number, enabled = true, clients: unknown[] = [grant]) =>
      ({ externalMcpAccess: { enabled, revision, clients } });
    const resource = () => `https://tesbo.example/api/projects/${project}/mcp`;
    const issuerAdapter = (model: string) => new (createMcpOAuthPostgresAdapter(db,
      { requireLiveGrantBinding: true }))(model);

    beforeAll(async () => {
      process.env.SECRETS_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
      pool = new Pool({ connectionString: url, max: 5, application_name: `oauth-epoch-${tag}` });
      db = new DatabaseService(pool);
      user = (await db.query("INSERT INTO users(email,name) VALUES ($1,'OAuth epoch QA') RETURNING id",
        [`oauth-${tag}@tesbo.invalid`])).rows[0].id;
      org = (await db.query("INSERT INTO organizations(name,slug) VALUES ('OAuth epoch QA',$1) RETURNING id",
        [`oauth-${tag}`])).rows[0].id;
      project = (await db.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'OQA','OAuth epoch QA') RETURNING id",
        [org])).rows[0].id;
      await db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')", [org,user]);
      await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner')", [project,user]);
      await db.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1", [project,JSON.stringify(settings(1))]);
    });

    afterAll(async () => {
      try {
        if (project) {
          const cleanup = createMcpOAuthPostgresAdapter(db);
          const deleted = await Promise.allSettled([
            new cleanup("RefreshToken").destroy(oldRefresh),
            new cleanup("Grant").destroy(oldGrant),
            new cleanup("Grant").destroy(freshGrant)
          ]);
          for (const result of deleted) if (result.status === "rejected") throw result.reason;
        }
        // V62 protects the audit rows, including changes via their parent FKs.
        // The disposable service owns the fixture identities, receipts and revocation tombstone.
      } finally {
        if (priorKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
        else process.env.SECRETS_ENCRYPTION_KEY = priorKey;
        await pool?.end();
      }
    });

    it("lets a human revoke one consent without changing owner grants or another member's consent", async () => {
      const ownGrant = "self-consent-" + tag;
      const otherGrant = "other-consent-" + tag;
      const grants = issuerAdapter("Grant");
      const projectApproval = settings(10);
      await db.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1",
        [project, JSON.stringify(projectApproval)]);
      const otherUser = (await db.query(
        "INSERT INTO users(email,name) VALUES ($1,'Other OAuth member') RETURNING id",
        ["oauth-other-" + tag + "@tesbo.invalid"])).rows[0].id as string;
      await db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'member')",
        [org, otherUser]);
      await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",
        [project, otherUser]);
      await grants.upsert(ownGrant, { accountId: user, clientId: CLIENT });
      await grants.upsert(otherGrant, { accountId: otherUser, clientId: CLIENT });
      await bindOAuthGrantToApproval(db, ownGrant, {
        projectId: project, accountId: user, clientId: CLIENT,
        resource: resource(), approvalRevision: 10
      });
      await bindOAuthGrantToApproval(db, otherGrant, {
        projectId: project, accountId: otherUser, clientId: CLIENT,
        resource: resource(), approvalRevision: 10
      });
      const index = (id: string) => oauthReferenceFingerprint("oauth:Grant:id", id);
      const svc = new McpService(
        { requireProjectAccess: jest.fn().mockResolvedValue({ organization_id: org }) } as unknown as LegacyService,
        db,
        { assertProjectWritable: jest.fn() } as unknown as PlanLimitsService
      );
      const self = { userId: user, headers: {}, apiToken: null, oauthAccess: null } as any;
      const other = { userId: otherUser, headers: {}, apiToken: null, oauthAccess: null } as any;
      try {
        const mine = await svc.listMyOAuthConsents(self, project);
        expect(mine.consents.map(c => c.id)).toContain(index(ownGrant));
        expect(mine.consents.map(c => c.id)).not.toContain(index(otherGrant));
        expect(mine.consents.find(c => c.id === index(ownGrant))?.status).toBe("consent_current");
        await expect(svc.revokeMyOAuthConsent(self, project, index(otherGrant)))
          .rejects.toThrow();
        expect(await currentOAuthGrantBinding(db, otherGrant)).toBe(true);
        const result = await svc.revokeMyOAuthConsent(self, project, index(ownGrant));
        expect(result).toEqual({ id: index(ownGrant), status: "revoked", replayed: false });
        expect(await currentOAuthGrantBinding(db, ownGrant)).toBe(false);
        expect(await grants.find(ownGrant)).toBeUndefined();
        expect(await currentOAuthGrantBinding(db, otherGrant)).toBe(true);
        expect(await grants.find(otherGrant)).toBeDefined();
        const replay = await svc.revokeMyOAuthConsent(self, project, index(ownGrant));
        expect(replay.replayed).toBe(true);
        const audit = await db.query(
          "SELECT actor_id,entity_id FROM audit_logs WHERE project_id=$1 AND action='mcp_oauth_user_consent_revoked'",
          [project]
        );
        expect(audit.rows).toEqual([{ actor_id: user, entity_id: index(ownGrant) }]);
        const otherHistory = await svc.listMyOAuthConsents(other, project);
        expect(otherHistory.consents.map(c => c.id)).toContain(index(otherGrant));
        expect(otherHistory.consents.map(c => c.id)).not.toContain(index(ownGrant));
      } finally {
        await Promise.allSettled([grants.destroy(ownGrant), grants.destroy(otherGrant)]);
      }
    });

    it("revokes old Grant and RefreshToken without resurrecting them on identical-client reapproval", async () => {
      const basis = (revision: number) => ({
        projectId: project, accountId: user, clientId: CLIENT, resource: resource(), approvalRevision: revision
      });
      const grants = issuerAdapter("Grant"), refresh = issuerAdapter("RefreshToken");
      await grants.upsert(oldGrant, { accountId: user, clientId: CLIENT });
      await refresh.upsert(oldRefresh, { grantId: oldGrant, accountId: user }, 900);
      await bindOAuthGrantToApproval(db, oldGrant, basis(1));
      expect(await currentOAuthGrantBinding(db, oldGrant, basis(1))).toBe(true);
      expect(await grants.find(oldGrant)).toBeDefined();
      expect(await refresh.find(oldRefresh)).toBeDefined();

      const service = new McpService(
        { requireProjectAccess: jest.fn().mockResolvedValue({
          caller_role: "owner", organization_id: org }), normalizeRole: (role: string) => role } as unknown as LegacyService,
        db,
        { assertProjectWritable: jest.fn().mockResolvedValue(undefined) } as unknown as PlanLimitsService
      );
      const human = { userId: user, apiToken: null, oauthAccess: null } as any;
      const revoked = await service.updateAccessSettings(human, project,
        { enabled: false, revision: 1, clients: [] });
      expect(revoked.revision).toBe(2);
      expect(await currentOAuthGrantBinding(db, oldGrant)).toBe(false);
      expect(await grants.find(oldGrant)).toBeUndefined();
      expect(await refresh.find(oldRefresh)).toBeUndefined();
      const rebound = await service.updateAccessSettings(human, project,
        { enabled: true, revision: 2, clients: [grant] });
      expect(rebound.revision).toBe(3);
      expect(await currentOAuthGrantBinding(db, oldGrant)).toBe(false);
      expect(await grants.find(oldGrant)).toBeUndefined();
      expect(await refresh.find(oldRefresh)).toBeUndefined();

      await grants.upsert(freshGrant, { accountId: user, clientId: CLIENT });
      await bindOAuthGrantToApproval(db, freshGrant, basis(3));
      expect(await currentOAuthGrantBinding(db, freshGrant, basis(3))).toBe(true);
      expect(await grants.find(freshGrant)).toBeDefined();
      await expect(bindOAuthGrantToApproval(db, oldGrant, basis(3))).rejects.toThrow(/already bound/);
      expect(await currentOAuthGrantBinding(db, oldGrant)).toBe(false);
      expect(await grants.find(oldGrant)).toBeUndefined();
      expect(await refresh.find(oldRefresh)).toBeUndefined();
      expect(await currentOAuthGrantBinding(db, freshGrant, basis(3))).toBe(true);
      const receipts = await db.query(
        `SELECT (diff->'after'->>'revision')::int AS revision FROM audit_logs
          WHERE project_id=$1 AND actor_id=$2 AND action='project_mcp_access_updated'
          ORDER BY revision`, [project, user]);
      expect(receipts.rows.map(row => row.revision)).toEqual([2, 3]);
    });
  }
);
