import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { oauthReferenceFingerprint } from "../common/crypto.util";
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
    const currentMembershipIds = async (accountId = user) => {
      const row = (await db.query(
        `SELECT pm.id AS project_membership_id, om.id AS organization_membership_id
           FROM project_members pm
           JOIN organization_members om ON om.organization_id=$2 AND om.user_id=$3
          WHERE pm.project_id=$1 AND pm.user_id=$3`,
        [project, org, accountId]
      )).rows[0];
      if (typeof row?.project_membership_id !== "string" ||
          typeof row?.organization_membership_id !== "string") {
        throw new Error("Disposable OAuth membership identity missing");
      }
      return { projectMembershipId: row.project_membership_id as string,
        organizationMembershipId: row.organization_membership_id as string };
    };

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
        resource: resource(), approvalRevision: 10, ...await currentMembershipIds()
      });
      await bindOAuthGrantToApproval(db, otherGrant, {
        projectId: project, accountId: otherUser, clientId: CLIENT,
        resource: resource(), approvalRevision: 10, ...await currentMembershipIds(otherUser)
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
        // A stale successful preflight must not authorize a later history read.
        // The service's existing mocked preflight above deliberately remains
        // successful; only the real database membership is removed here.
        const historyWhileRemoved: Array<{ membership: string; disclosed: string[] }> = [];
        for (const membership of ["organization", "project"] as const) {
          const removed = membership === "project"
            ? await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING id", [project, otherUser])
            : await db.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2 RETURNING id", [org, otherUser]);
          expect(removed.rows).toHaveLength(1);
          try {
            const disclosed = await svc.listMyOAuthConsents(other, project).then(
              result => result.consents.map(c => c.id),
              (error: unknown) => {
                if (typeof (error as { getStatus?: unknown })?.getStatus !== "function") throw error;
                expect([403, 404]).toContain((error as { getStatus(): number }).getStatus());
                return [] as string[];
              }
            );
            historyWhileRemoved.push({ membership, disclosed });
            await expect(svc.revokeMyOAuthConsent(other, project, index(otherGrant))).rejects.toThrow();
          } finally {
            await db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING",
              [org, otherUser]);
            await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer') ON CONFLICT DO NOTHING",
              [project, otherUser]);
          }
        }
        // The previous generation remains invalid, but a currently authorized
        // rejoined member may read their own historical consent.
        const rejoinedHistory = await svc.listMyOAuthConsents(other, project);
        expect(rejoinedHistory.consents.find(c => c.id === index(otherGrant))?.status).toBe("reconsent_required");
        expect(historyWhileRemoved).toEqual([
          { membership: "organization", disclosed: [] },
          { membership: "project", disclosed: [] }
        ]);

        // The same client and owner policy can survive a membership delete/rejoin,
        // but the OLD binding must be rejected and shown as requiring new consent.
        const priorMembership = (await db.query(
          "SELECT id FROM project_members WHERE project_id=$1 AND user_id=$2",
          [project, otherUser])).rows[0].id as string;
        try {
          await db.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",
            [project, otherUser]);
          expect(await currentOAuthGrantBinding(db, otherGrant)).toBe(false);
        } finally {
          await db.query(
            "INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer') ON CONFLICT DO NOTHING",
            [project, otherUser]);
        }
        const nextMembership = (await db.query(
          "SELECT id FROM project_members WHERE project_id=$1 AND user_id=$2",
          [project, otherUser])).rows[0].id as string;
        expect(nextMembership).not.toBe(priorMembership);
        expect(await currentOAuthGrantBinding(db, otherGrant)).toBe(false);
        const afterRejoin = await svc.listMyOAuthConsents(other, project);
        const oldConsent = afterRejoin.consents.find(c => c.id === index(otherGrant));
        expect(oldConsent?.status).toBe("reconsent_required");
        expect(oldConsent?.currentAllowedTools).toBeNull();

      } finally {
        await Promise.allSettled([grants.destroy(ownGrant), grants.destroy(otherGrant)]);
        // Restore the disposable fixture basis for the existing OA-T18 journey.
        await db.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1",
          [project, JSON.stringify(settings(1))]);
      }
    });

    it("revokes old Grant and RefreshToken without resurrecting them on identical-client reapproval", async () => {
      const generation = await currentMembershipIds();
      const basis = (revision: number) => ({
        projectId: project, accountId: user, clientId: CLIENT, resource: resource(),
        approvalRevision: revision, ...generation
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
          resource: resource(), approvalRevision: revision, ...(await currentMembershipIds()) };
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
        const staleConsentFamily = `${family}-stale-consent`;
        const models = ["Grant", "AuthorizationCode", "RefreshToken", "AccessToken"] as const;
        const ids = (grantId: string) => models.map(model => model === "Grant" ? grantId : `${grantId}-${model}`);
        const adapters = models.map(issuerAdapter);
        const basis = { projectId: project, accountId: user, clientId: CLIENT,
          resource: resource(), approvalRevision: revision, ...(await currentMembershipIds()) };
        const restore = async () => {
          await db.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [org,user]);
          await db.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [project,user]);
        };
        const seedFamily = async (grantId: string) => {
          const refs = ids(grantId);
          await adapters[0].upsert(refs[0], { accountId: user, clientId: CLIENT });
          await bindOAuthGrantToApproval(db, grantId, { ...basis, ...(await currentMembershipIds()) });
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

          const freshBasis = { ...basis, ...(await currentMembershipIds()) };
          expect(freshBasis[membership === "project" ? "projectMembershipId" : "organizationMembershipId"])
            .not.toBe(basis[membership === "project" ? "projectMembershipId" : "organizationMembershipId"]);

          // The provider may save a new grant after page review but before the
          // final binding transaction. Reusing the pre-rejoin review basis must
          // not bind that new grant to the replacement membership generation.
          await adapters[0].upsert(staleConsentFamily, { accountId: user, clientId: CLIENT });
          await expect(bindOAuthGrantToApproval(db, staleConsentFamily, basis)).rejects.toThrow(/changed/);
          expect(await currentOAuthGrantBinding(db, staleConsentFamily)).toBe(false);
          expect(await adapters[0].find(staleConsentFamily)).toBeUndefined();
          await seedFamily(nextFamily);
          expect(await currentOAuthGrantBinding(db, nextFamily, freshBasis)).toBe(true);
          expect(await readFamily(nextFamily)).toEqual(models.map(() => expect.objectContaining({ accountId: user })));
          const oldAfterFresh = await Promise.all([currentOAuthGrantBinding(db, family, basis), readFamily(family)]);
          const denied = [false, models.map(() => undefined)];
          expect([oldBeforeFresh, oldAfterFresh]).toEqual([denied, denied]);
        } finally {
          await restore();
          for (const grantId of [family, nextFamily, staleConsentFamily]) {
            for (let i = 0; i < models.length; i++) await adapters[i].destroy(ids(grantId)[i]);
          }
        }
      }
    );
  }
);
