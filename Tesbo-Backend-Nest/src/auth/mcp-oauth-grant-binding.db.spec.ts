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

/** No production project or user. This suite requires the migrated /tesbo_ci database. */
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
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
      if (project) {
        const cleanup = createMcpOAuthPostgresAdapter(db);
        await new cleanup("RefreshToken").destroy(oldRefresh);
        await new cleanup("Grant").destroy(oldGrant);
        await new cleanup("Grant").destroy(freshGrant);
        await db.query("DELETE FROM audit_logs WHERE project_id=$1", [project]);
        await db.query("DELETE FROM mcp_oauth_grant_approval_bindings WHERE project_id=$1", [project]);
        await db.query("DELETE FROM project_members WHERE project_id=$1", [project]);
        await db.query("DELETE FROM projects WHERE id=$1", [project]);
      }
      if (org) {
        await db.query("DELETE FROM organization_members WHERE organization_id=$1", [org]);
        await db.query("DELETE FROM organizations WHERE id=$1", [org]);
      }
      if (user) await db.query("DELETE FROM users WHERE id=$1", [user]);
      await pool?.end();
      if (priorKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
      else process.env.SECRETS_ENCRYPTION_KEY = priorKey;
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
      // A fresh binding is a distinct provider Grant: never reuse an older identity.
      await refresh.destroy(oldRefresh);
      await grants.destroy(oldGrant);
      await grants.destroy(freshGrant);
    });
  }
);
