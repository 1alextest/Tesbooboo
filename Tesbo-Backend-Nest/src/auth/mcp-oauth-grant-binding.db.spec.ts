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

    it.each(["project", "organization"] as const)(
      "refuses all provider credential models while %s membership is absent",
      async membership => {
        const revision = membership === "project" ? 101 : 102;
        await db.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1",
          [project, JSON.stringify(settings(revision))]);
        const family = `qa-membership-${membership}-${tag}`;
        const models = ["Grant", "AuthorizationCode", "RefreshToken", "AccessToken"] as const;
        const ids = models.map(model => model === "Grant" ? family : `${family}-${model}`);
        const adapters = models.map(issuerAdapter);
        const basis = { projectId: project, accountId: user, clientId: CLIENT,
          resource: resource(), approvalRevision: revision };
        const readFamily = () => Promise.all(adapters.map((adapter, i) => adapter.find(ids[i])));
        try {
          await adapters[0].upsert(ids[0], { accountId: user, clientId: CLIENT });
          await bindOAuthGrantToApproval(db, family, basis);
          for (let i = 1; i < models.length; i++) {
            await adapters[i].upsert(ids[i], { grantId: family, accountId: user, clientId: CLIENT }, 900);
          }
          expect(await currentOAuthGrantBinding(db, family, basis)).toBe(true);
          expect(await readFamily()).toEqual(models.map(() => expect.objectContaining({ accountId: user })));

          // Isolate the live membership predicate from the owner policy revision.
          // Direct fixture deletion is deliberate; it is not a test of a membership API.
          const removed = membership === "project"
            ? await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING user_id", [project,user])
            : await db.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2 RETURNING user_id", [org,user]);
          expect(removed.rows).toHaveLength(1);
          const stillApproved = await db.query("SELECT settings FROM projects WHERE id=$1", [project]);
          expect(stillApproved.rows[0].settings.externalMcpAccess).toEqual(settings(revision).externalMcpAccess);
          const actual = await Promise.all([currentOAuthGrantBinding(db, family, basis), readFamily()]);
          expect(actual).toEqual([false, models.map(() => undefined)]);
        } finally {
          // Restore fixture membership only after destroying this family's artifacts;
          // restoration/reconsent semantics are a separate, unresolved policy decision.
          for (let i = 0; i < models.length; i++) await adapters[i].destroy(ids[i]);
          await db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [org,user]);
          await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [project,user]);
        }
      }
    );

    // OA-T18R: proposed non-resurrection policy; failing-first characterization.
    // Retain all old artifacts until AFTER reinstatement and test a new family
    // as a positive control. This isolates DB semantics, not membership API or
    // HTTP token exchange behavior. The disposable CI guard above still applies.
    it.each(["project", "organization"] as const)(
      "OA-T18R: does not resurrect a prior family when %s membership is restored",
      async membership => {
        const revision = membership === "project" ? 201 : 202;
        await db.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1",
          [project, JSON.stringify(settings(revision))]);
        const family = `qa-rejoin-${membership}-${tag}`;
        const nextFamily = `${family}-new`;
        const models = ["Grant", "AuthorizationCode", "RefreshToken", "AccessToken"] as const;
        const ids = (grantId: string) => models.map(model => model === "Grant" ? grantId : `${grantId}-${model}`);
        const adapters = models.map(issuerAdapter);
        const basis = { projectId: project, accountId: user, clientId: CLIENT,
          resource: resource(), approvalRevision: revision };
        const restore = async () => {
          await db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [org,user]);
          await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [project,user]);
        };
        const seedFamily = async (grantId: string) => {
          const refs = ids(grantId);
          await adapters[0].upsert(refs[0], { accountId: user, clientId: CLIENT });
          await bindOAuthGrantToApproval(db, grantId, basis);
          for (let i = 1; i < models.length; i++) {
            await adapters[i].upsert(refs[i], { grantId, accountId: user, clientId: CLIENT }, 900);
          }
        };
        const readFamily = (grantId: string) => Promise.all(
          adapters.map((adapter, i) => adapter.find(ids(grantId)[i])));
        try {
          await seedFamily(family);
          expect(await currentOAuthGrantBinding(db, family, basis)).toBe(true);
          expect(await readFamily(family)).toEqual(models.map(() => expect.objectContaining({ accountId: user })));

          const removed = membership === "project"
            ? await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING user_id", [project,user])
            : await db.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2 RETURNING user_id", [org,user]);
          expect(removed.rows).toHaveLength(1);
          expect(await currentOAuthGrantBinding(db, family, basis)).toBe(false);
          expect(await readFamily(family)).toEqual(models.map(() => undefined));

          await restore();
          const stillApproved = await db.query("SELECT settings FROM projects WHERE id=$1", [project]);
          expect(stillApproved.rows[0].settings.externalMcpAccess).toEqual(settings(revision).externalMcpAccess);
          const oldBeforeFresh = await Promise.all([currentOAuthGrantBinding(db, family, basis), readFamily(family)]);

          await seedFamily(nextFamily);
          expect(await currentOAuthGrantBinding(db, nextFamily, basis)).toBe(true);
          expect(await readFamily(nextFamily)).toEqual(models.map(() => expect.objectContaining({ accountId: user })));
          const oldAfterFresh = await Promise.all([currentOAuthGrantBinding(db, family, basis), readFamily(family)]);
          const denied = [false, models.map(() => undefined)];
          expect([oldBeforeFresh, oldAfterFresh]).toEqual([denied, denied]);
        } finally {
          await restore();
          for (const grantId of [family, nextFamily]) {
            for (let i = 0; i < models.length; i++) await adapters[i].destroy(ids(grantId)[i]);
          }
        }
      }
    );
  }
);
