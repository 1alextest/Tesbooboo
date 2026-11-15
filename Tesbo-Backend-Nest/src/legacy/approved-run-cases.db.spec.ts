import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { AutomationService } from "../automation/automation.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

const url = process.env.DATABASE_URL ?? "";
(/\\/tesbo_ci(?:\\?|$)/.test(url) ? describe : describe.skip)(
  "Approved-only run-case write policy — real migrated PostgreSQL", () => {
    let admin: Client, pool: Pool, project: string, user: string, approved: string, draft: string, inReview: string, foreign: string;
    const stamp = randomUUID();
    const approvedExternal = "APR-OK";
    const draftExternal = "APR-DRAFT";
    const cases = (cycleId: string) => admin.query<{ id: string; testcase_id: string }>(
      "SELECT id,testcase_id FROM cycle_items WHERE cycle_id=$1 AND deleted_at IS NULL", [cycleId]
    );
    const executions = (cycleId: string) => admin.query<{ id: string }>(
      `SELECT e.id FROM executions e JOIN cycle_items ci ON ci.id=e.cycle_item_id
         WHERE ci.cycle_id=$1 AND e.deleted_at IS NULL`, [cycleId]
    );
    async function newCycle(name: string): Promise<string> {
      return (await admin.query<{ id: string }>(
        "INSERT INTO cycles (project_id,name) VALUES ($1,$2) RETURNING id",
        [project, name]
      )).rows[0].id;
    }
    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
      pool = new Pool({ connectionString: url, max: 5 });
      user = (await admin.query<{ id: string }>(
        "INSERT INTO users(email,name) VALUES ($1,'Run approval QA') RETURNING id",
        ["run-approval-" + stamp + "@tesbo.invalid"]
      )).rows[0].id;
      const org = (await admin.query<{ id: string }>(
        "INSERT INTO organizations(name,slug) VALUES ('Run approval QA',$1) RETURNING id",
        ["run-approval-" + stamp]
      )).rows[0].id;
      project = (await admin.query<{ id: string }>(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'APR','Run approval') RETURNING id",
        [org]
      )).rows[0].id;
      await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'member')",[org,user]);
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,user]);
      const rows = await admin.query<{ id: string; status: string; external_id: string }>(
        `INSERT INTO testcases(project_id,external_id,title,status) VALUES
          ($1,$2,'Approved target','Approved'),
          ($1,$3,'Draft target','Draft'),
          ($1,'APR-REVIEW','Review target','In Review')
         RETURNING id,status,external_id`, [project,approvedExternal,draftExternal]
      );
      approved = rows.rows.find((row) => row.status === "Approved")!.id;
      draft = rows.rows.find((row) => row.status === "Draft")!.id;
      inReview = rows.rows.find((row) => row.status === "In Review")!.id;
      const foreignOrg = (await admin.query<{ id: string }>(
        "INSERT INTO organizations(name,slug) VALUES ('Foreign run approval',$1) RETURNING id",
        ["run-approval-foreign-" + stamp]
      )).rows[0].id;
      const otherProject = (await admin.query<{ id: string }>(
        "INSERT INTO projects(organization_id,key,name) VALUES ($1,'APF','Foreign run approval') RETURNING id",
        [foreignOrg]
      )).rows[0].id;
      foreign = (await admin.query<{ id: string }>(
        "INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,'APF-1','Foreign Approved','Approved') RETURNING id",
        [otherProject]
      )).rows[0].id;
    });
    afterAll(async () => { await pool?.end(); await admin?.end(); }); // Disposable CI fixture.
    function service() {
      const db = new DatabaseService(pool), svc = makeLegacy(db);
      jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({ id: project } as never);
      return svc;
    }
    async function resetStatus(): Promise<void> {
      await admin.query("UPDATE testcases SET status='Approved' WHERE id=$1", [approved]);
      await admin.query("UPDATE testcases SET status='Draft' WHERE id=$1", [draft]);
      await admin.query("UPDATE testcases SET status='In Review' WHERE id=$1", [inReview]);
    }

    it("refuses Draft and In Review additions without creating cycle items or executions", async () => {
      const cycle = await newCycle("Refuse unapproved");
      const svc = service();
      for (const candidate of [draft, inReview]) {
        await expect(svc.addCycleTestCases(cycle, user, { testcaseIds: [candidate] }))
          .rejects.toBeInstanceOf(ConflictException);
      }
      expect((await cases(cycle)).rows).toHaveLength(0);
      expect((await executions(cycle)).rows).toHaveLength(0);
    });

    it("rejects mixed Approved plus Draft atomically, then permits Approved and idempotent replay", async () => {
      await resetStatus();
      const cycle = await newCycle("Atomic approval");
      const svc = service();
      await expect(svc.addCycleTestCases(cycle, user, { testcaseIds: [approved,draft] }))
        .rejects.toMatchObject({ status: 409 });
      expect((await cases(cycle)).rows).toHaveLength(0);
      expect((await executions(cycle)).rows).toHaveLength(0);
      const added = await svc.addCycleTestCases(cycle, user, { testcaseIds: [approved, foreign, randomUUID(), "bad"] });
      expect(added).toMatchObject({ requested: 4, added: 1, skipped: 3 });
      expect((await cases(cycle)).rows.map(x=>x.testcase_id)).toEqual([approved]);
      expect((await executions(cycle)).rows).toHaveLength(1);
      expect(await svc.addCycleTestCases(cycle, user, { testcaseIds: [approved] }))
        .toMatchObject({ added: 0, skipped: 1 });
      await admin.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved]);
      try {
        expect(await svc.addCycleTestCases(cycle, user, { testcaseIds: [approved] }))
          .toMatchObject({ added: 0, skipped: 1 }); // Historical membership is not a NEW add.
        expect((await executions(cycle)).rows).toHaveLength(1);
      } finally { await resetStatus(); }
    });

    it("an MCP-originated create + approved attachment is atomic; mixed Draft rolls back the new run", async () => {
      await resetStatus();
      const svc = service(), name = "Atomic MCP " + stamp;
      await expect(svc.createCycleWithTestcasesForUser(user, project, {
        name, testcaseIds: [approved, draft]
      })).rejects.toMatchObject({ status: 409 });
      const count = await admin.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM cycles WHERE project_id=$1 AND name=$2", [project,name]);
      expect(count.rows[0].n).toBe(0);
      const good = await svc.createCycleWithTestcasesForUser(user,project,{
        name, testcaseIds: [approved, foreign]
      });
      expect(good).toMatchObject({ requested: 2, added: 1, skipped: 1 });
      expect((await cases(good.cycle.id)).rows).toHaveLength(1);
      expect((await executions(good.cycle.id)).rows).toHaveLength(1);
    });

    it("rejects a concurrent demotion after the case was already selected", async () => {
      await resetStatus();
      const cycle = await newCycle("Concurrent demotion");
      const blocker = new Client({ connectionString: url });
      await blocker.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved]);
        const attempt = service().addCycleTestCases(cycle,user,{ testcaseIds: [approved] });
        await blocker.query("COMMIT");
        await expect(attempt).rejects.toMatchObject({ status: 409 });
        expect((await cases(cycle)).rows).toHaveLength(0);
        expect((await executions(cycle)).rows).toHaveLength(0);
      } finally {
        await blocker.query("ROLLBACK").catch(() => undefined);
        await blocker.end();
        await resetStatus();
      }
    });

    it("rejects fresh automation run with unapproved targets without leaving empty run", async () => {
      await resetStatus();
      const db = new DatabaseService(pool), legacy = makeLegacy(db);
      jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({ id: project } as never);
      jest.spyOn(legacy, "logProjectActivity").mockResolvedValue(undefined as never);
      const svc = new AutomationService(db, legacy, {} as PlanLimitsService, {} as StorageService);
      const name = "Atomic automation " + stamp;
      await expect(svc.createRun(user,project,{ name,caseIds:[approvedExternal,draftExternal] }))
        .rejects.toMatchObject({ status: 409 });
      expect((await admin.query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM cycles WHERE project_id=$1 AND name=$2", [project,name]
      )).rows[0].n).toBe(0);
      const run = await svc.createRun(user,project,{ name,caseIds:[approvedExternal] });
      expect(run.casesAttached).toBe(1);
      expect((await cases(run.id)).rows.map(r=>r.testcase_id)).toEqual([approved]);
      expect((await executions(run.id)).rows).toHaveLength(1);
    });
  }
);
