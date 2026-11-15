import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { AutomationService } from "../automation/automation.service";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "Approved-only canonical run attachment — real migrated PostgreSQL",
  () => {
    let admin: Client, locker: Client, pool: Pool;
    let orgId: string, projectId: string, foreignProjectId: string, userId: string;
    let approved: string, draft: string, review: string, foreign: string;
    let cycleId: string, secondCycleId: string;
    const stamp = randomUUID();

    const count = async (cycle: string) => (await admin.query<{ items: number; results: number }>(
      `SELECT (SELECT COUNT(*)::int FROM cycle_items WHERE cycle_id=$1 AND deleted_at IS NULL) AS items,
              (SELECT COUNT(*)::int FROM executions e
                JOIN cycle_items ci ON ci.id=e.cycle_item_id
               WHERE ci.cycle_id=$1 AND e.deleted_at IS NULL) AS results`,
      [cycle]
    )).rows[0];

    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      locker = new Client({ connectionString: url });
      pool = new Pool({ connectionString: url, max: 4 });
      await Promise.all([admin.connect(), locker.connect()]);
      userId = (await admin.query<{ id: string }>(
        "INSERT INTO users(email,name) VALUES ($1,'Approved run CI') RETURNING id",
        [`approved-cycle-${stamp}@tesbo.invalid`]
      )).rows[0].id;
      orgId = (await admin.query<{ id: string }>(
        "INSERT INTO organizations(name,slug) VALUES ('Approved run CI',$1) RETURNING id",
        [`approved-cycle-${stamp}`]
      )).rows[0].id;
      await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [userId, orgId]);
      projectId = (await admin.query<{ id: string }>(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'APR','Approved run') RETURNING id",
        [orgId]
      )).rows[0].id;
      foreignProjectId = (await admin.query<{ id: string }>(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'APF','Foreign run') RETURNING id",
        [orgId]
      )).rows[0].id;
      await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'member')", [orgId,userId]);
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')", [projectId,userId]);
      const mk = async (project: string, suffix: string, status: string) =>
        (await admin.query<{ id: string }>(
          "INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,$2,$3,$4) RETURNING id",
          [project,`AP-${suffix}`,`Approved test ${suffix}`,status]
        )).rows[0].id;
      approved = await mk(projectId, "APPROVED", "Approved");
      draft = await mk(projectId, "DRAFT", "Draft");
      review = await mk(projectId, "REVIEW", "In Review");
      foreign = await mk(foreignProjectId, "FOREIGN", "Approved");
      cycleId = (await admin.query<{ id: string }>(
        "INSERT INTO cycles(project_id,name) VALUES ($1,'Approved CI cycle') RETURNING id", [projectId]
      )).rows[0].id;
      secondCycleId = (await admin.query<{ id: string }>(
        "INSERT INTO cycles(project_id,name) VALUES ($1,'Second CI cycle') RETURNING id", [projectId]
      )).rows[0].id;
    });

    afterAll(async () => {
      if (admin) {
        try {
          for (const cycle of [cycleId, secondCycleId].filter(Boolean)) {
            await admin.query("DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id=$1)", [cycle]);
            await admin.query("DELETE FROM cycle_items WHERE cycle_id=$1", [cycle]);
            await admin.query("DELETE FROM cycles WHERE id=$1", [cycle]);
          }
          for (const id of [approved,draft,review,foreign].filter(Boolean)) {
            await admin.query("DELETE FROM testcases WHERE id=$1", [id]);
          }
          if (foreignProjectId) await admin.query("DELETE FROM projects WHERE id=$1", [foreignProjectId]);
          if (projectId) await admin.query("DELETE FROM projects WHERE id=$1", [projectId]);
          if (userId) await admin.query("DELETE FROM users WHERE id=$1", [userId]);
          if (orgId) await admin.query("DELETE FROM organizations WHERE id=$1", [orgId]);
        } finally {
          await Promise.all([pool?.end(), locker?.end(), admin.end()]);
        }
      }
    });

    it("rejects a mixed Approved/Draft selection atomically without any execution", async () => {
      const svc = makeLegacy(new DatabaseService(pool));
      await expect(svc.addCycleTestCases(cycleId, userId, { testcaseIds: [approved, draft] }))
        .rejects.toMatchObject({ status: 409 });
      expect(await count(cycleId)).toEqual({ items: 0, results: 0 });
      await expect(svc.addCycleTestCases(cycleId, userId, { testcaseIds: [review] }))
        .rejects.toMatchObject({ status: 409 });
      expect(await count(cycleId)).toEqual({ items: 0, results: 0 });
    });

    it("preserves skipped foreign/unknown IDs and idempotent Approved retries", async () => {
      const svc = makeLegacy(new DatabaseService(pool));
      const unknown = randomUUID();
      expect(await svc.addCycleTestCases(cycleId, userId, {
        testcaseIds: [approved, foreign, unknown]
      })).toEqual({ requested: 3, added: 1, skipped: 2 });
      expect(await count(cycleId)).toEqual({ items: 1, results: 1 });
      expect(await svc.addCycleTestCases(cycleId, userId, { testcaseIds: [approved] }))
        .toEqual({ requested: 1, added: 0, skipped: 1 });
      expect(await count(cycleId)).toEqual({ items: 1, results: 1 });
    });

    it("historical case demotion permits replay but not a new run insertion", async () => {
      const svc = makeLegacy(new DatabaseService(pool));
      await admin.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved]);
      try {
        expect(await svc.addCycleTestCases(cycleId, userId, { testcaseIds: [approved] }))
          .toEqual({ requested: 1, added: 0, skipped: 1 });
        expect(await count(cycleId)).toEqual({ items: 1, results: 1 });
        await expect(svc.addCycleTestCases(secondCycleId, userId, { testcaseIds: [approved] }))
          .rejects.toMatchObject({ status: 409 });
        expect(await count(secondCycleId)).toEqual({ items: 0, results: 0 });
      } finally {
        await admin.query("UPDATE testcases SET status='Approved' WHERE id=$1", [approved]);
      }
    });

    it("does not authorize a new case after concurrent demotion at the locked row", async () => {
      const svc = makeLegacy(new DatabaseService(pool));
      await locker.query("BEGIN");
      await locker.query("SELECT id FROM testcases WHERE id=$1 FOR UPDATE", [approved]);
      let finished = false;
      const pending = svc.addCycleTestCases(secondCycleId,userId,{testcaseIds:[approved]})
        .finally(() => { finished = true; });
      try {
        await new Promise((resolve) => setTimeout(resolve, 120));
        expect(finished).toBe(false);
        await locker.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved]);
        await locker.query("COMMIT");
        await expect(pending).rejects.toMatchObject({ status: 409 });
        expect(await count(secondCycleId)).toEqual({ items: 0, results: 0 });
      } finally {
        if (!finished) await locker.query("ROLLBACK").catch(() => undefined);
        await admin.query("UPDATE testcases SET status='Approved' WHERE id=$1", [approved]);
      }
    });

    it("automation attachment shares the same Approved rule for external case IDs", async () => {
      const db = new DatabaseService(pool);
      const automation = Object.assign(Object.create(AutomationService.prototype), { db }) as AutomationService;
      const attach = (automation as unknown as {
        attachCases: (run: string, project: string, caseIds: string[]) =>
          Promise<{attached: number; unknown: string[]}>
      }).attachCases.bind(automation);
      await expect(attach(secondCycleId, projectId, ["AP-APPROVED","AP-DRAFT"]))
        .rejects.toMatchObject({ status: 409 });
      expect(await count(secondCycleId)).toEqual({ items: 0, results: 0 });
      expect(await attach(secondCycleId, projectId, ["AP-APPROVED"]))
        .toMatchObject({ attached: 1, unknown: [] });
      expect(await count(secondCycleId)).toEqual({ items: 1, results: 1 });
    });
  }
);
