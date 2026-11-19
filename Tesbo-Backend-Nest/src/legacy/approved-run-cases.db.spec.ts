import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { AutomationService } from "../automation/automation.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { StorageService } from "../storage/storage.service";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "Approved-only run-case write policy — real migrated PostgreSQL", () => {
    let admin: Client, pool: Pool, project: string, user: string, approved: string, draft: string, inReview: string, foreign: string;
    const stamp = randomUUID();
    const poolApplicationName = `approved-run-review-${stamp}`;
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
    async function waitForBlockedCaseWriters(count: number): Promise<void> {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const blocked = await admin.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE application_name=$1 AND state='active' AND wait_event_type='Lock'
              AND query LIKE '%testcases%'`, [poolApplicationName]
        );
        if (blocked.rows[0].n >= count) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`Expected ${count} case queries to wait for the open writer transaction`);
    }
    beforeAll(async () => {
      admin = new Client({ connectionString: url });
      await admin.connect();
      pool = new Pool({ connectionString: url, max: 5, application_name: poolApplicationName });
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
      jest.spyOn(svc as never, "enqueueTestcaseEmbedding" as never).mockImplementation((() => undefined) as never);
      return svc;
    }
    async function approve(id = approved) {
      const svc = service();
      const reviewed = await svc.getTestCaseForUser(user, project, id);
      return svc.approveTestCaseForUser(user, project, id, {
        expectedRevision: reviewed.editRevision, expectedApprovalRevision: reviewed.approvalRevision
      }, { kind: "human_session" });
    }
    async function resetStatus(): Promise<void> {
      await approve();
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

    it("requires renewed approval after soft removal and preserves the previous execution snapshot", async () => {
      await resetStatus();
      const cycle = await newCycle("Re-approval after removal");
      const svc = service();
      expect(await svc.addCycleTestCases(cycle, user, { testcaseIds: [approved] }))
        .toMatchObject({ added: 1 });
      const oldItem = (await cases(cycle)).rows[0].id;
      const oldExecution = (await executions(cycle)).rows[0].id;
      await admin.query("UPDATE cycle_items SET deleted_at=now() WHERE id=$1", [oldItem]);
      await admin.query("UPDATE executions SET deleted_at=now() WHERE id=$1", [oldExecution]);
      await admin.query("UPDATE testcases SET status='Draft' WHERE id=$1", [approved]);
      try {
        await expect(svc.addCycleTestCases(cycle, user, { testcaseIds: [approved] }))
          .rejects.toMatchObject({ status: 409 });
        expect((await cases(cycle)).rows).toHaveLength(0);
        expect((await admin.query<{ id: string }>(
          "SELECT id FROM executions WHERE id=$1", [oldExecution]
        )).rows).toHaveLength(1);
        await approve();
        expect(await svc.addCycleTestCases(cycle, user, { testcaseIds: [approved] }))
          .toMatchObject({ added: 1, skipped: 0 });
        expect((await cases(cycle)).rows).toHaveLength(1);
        expect((await executions(cycle)).rows).toHaveLength(1);
        expect((await admin.query<{ id: string }>(
          "SELECT id FROM cycle_items WHERE cycle_id=$1 AND testcase_id=$2", [cycle,approved]
        )).rows).toHaveLength(2);
      } finally {
        await resetStatus();
      }
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
        const attempt = service().addCycleTestCases(cycle,user,{ testcaseIds: [approved] })
          .then(() => null, (error: unknown) => error);
        await waitForBlockedCaseWriters(1);
        await blocker.query("COMMIT");
        expect(await attempt).toMatchObject({ status: 409 });
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
      expect((await cases(run.runId)).rows.map(r=>r.testcase_id)).toEqual([approved]);
      expect((await executions(run.runId)).rows).toHaveLength(1);
    });

    it("rejects a historical Approved label with no semantic receipt and preserves existing run history", async () => {
      const unknown = (await admin.query<{id: string}>(
        "INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,$2,'Unverified old approval','Approved') RETURNING id",
        [project, `APR-UNKNOWN-${randomUUID().slice(0,8)}`]
      )).rows[0].id;
      const cycle = await newCycle("No fabricated historical approval");
      await expect(service().addCycleTestCases(cycle,user,{testcaseIds:[unknown]})).rejects.toMatchObject({status:409});
      expect((await cases(cycle)).rows).toHaveLength(0);
      expect((await admin.query("SELECT * FROM testcase_approval_receipts WHERE testcase_id=$1",[unknown])).rows).toHaveLength(0);
    });

    it("binds the exact reviewed snapshot, keeps retry idempotent, and rejects content ABA", async () => {
      const svc=service(), reviewed=await svc.getTestCaseForUser(user,project,draft);
      const request={expectedRevision:reviewed.editRevision,expectedApprovalRevision:reviewed.approvalRevision};
      const first=await svc.approveTestCaseForUser(user,project,draft,request,{kind:"human_session"});
      const repeated=await svc.approveTestCaseForUser(user,project,draft,request,{kind:"human_session"});
      expect(repeated.receipt.id).toBe(first.receipt.id);
      expect(first.receipt.reviewedSnapshot).toEqual(reviewed.approvalSnapshot);
      const audit=await admin.query("SELECT * FROM audit_logs WHERE entity_id=$1 AND action='testcase_approved'",[draft]);
      expect(audit.rows.filter(row=>row.diff?.approvedRevision===request.expectedRevision)).toHaveLength(1);
      const cycle=await newCycle("Pinned reviewed content");
      await svc.addCycleTestCases(cycle,user,{testcaseIds:[draft]});
      const snapshot=(await admin.query("SELECT snapshot_reviewed_content,snapshot_approval_revision FROM cycle_items WHERE cycle_id=$1",[cycle])).rows[0];
      expect(snapshot.snapshot_reviewed_content).toEqual(reviewed.approvalSnapshot);
      await admin.query("UPDATE testcases SET title='Temporary change' WHERE id=$1",[draft]);
      await admin.query("UPDATE testcases SET title=$2 WHERE id=$1",[draft,reviewed.title]);
      expect((await svc.getTestCaseForUser(user,project,draft)).approvalRevision).not.toBe(reviewed.approvalRevision);
      await expect(svc.approveTestCaseForUser(user,project,draft,request,{kind:"human_session"})).rejects.toMatchObject({status:409});
      expect((await admin.query("SELECT snapshot_reviewed_content,snapshot_approval_revision FROM cycle_items WHERE cycle_id=$1",[cycle])).rows[0]).toEqual(snapshot);
      await expect(admin.query("UPDATE testcase_approval_receipts SET reviewed_snapshot='{}'::jsonb WHERE id=$1",[first.receipt.id])).rejects.toMatchObject({code:"23514"});
      await resetStatus();
    });

    it("rejects a partially bound receipt without a human principal at the database boundary", async () => {
      // The digest deliberately matches the actual snapshot: only the missing principal is
      // invalid. A nullable CHECK expression must not treat this partial receipt as UNKNOWN.
      await expect(admin.query(
        `INSERT INTO testcase_approval_receipts
           (project_id,testcase_id,approved_revision,actor_id,semantic_revision,reviewed_snapshot,principal_kind)
         SELECT project_id,id,repeat('a',64),$2,
                encode(sha256(convert_to(testcase_approval_snapshot(id)::text,'UTF8')),'hex'),
                testcase_approval_snapshot(id),NULL
           FROM testcases WHERE id=$1`, [inReview,user]
      )).rejects.toMatchObject({code:"23514",constraint:"testcase_approval_snapshot_binding"});
      expect((await admin.query(
        "SELECT id FROM testcase_approval_receipts WHERE testcase_id=$1 AND approved_revision=repeat('a',64)",
        [inReview]
      )).rows).toHaveLength(0);
    });

    it("invalidates approval for custom values, their definitions and tag assignments while preserving old snapshots", async () => {
      const field=(await admin.query<{id:string}>(
        "INSERT INTO custom_field_definitions(project_id,key,name,field_type) VALUES ($1,$2,'Review field','text') RETURNING id",
        [project,`review-${randomUUID()}`]
      )).rows[0].id;
      const tag=(await admin.query<{id:string}>("INSERT INTO custom_tags(project_id,name) VALUES ($1,$2) RETURNING id",[project,`Review ${randomUUID().slice(0,8)}`])).rows[0].id;
      try {
        await approve();
        const before=await service().getTestCaseForUser(user,project,approved);
        await admin.query("INSERT INTO custom_field_values(definition_id,testcase_id,value) VALUES ($1,$2,'\"first\"'::jsonb)",[field,approved]);
        await expect(service().approveTestCaseForUser(user,project,approved,{expectedRevision:before.editRevision,expectedApprovalRevision:before.approvalRevision},{kind:"human_session"})).rejects.toMatchObject({status:409});
        expect((await service().getTestCaseForUser(user,project,approved)).status).toBe("In Review");
        await approve();
        await admin.query("UPDATE custom_field_definitions SET name='Changed meaning' WHERE id=$1",[field]);
        expect((await service().getTestCaseForUser(user,project,approved)).status).toBe("In Review");
        await approve();
        await admin.query("INSERT INTO testcase_custom_tags(testcase_id,tag_id) VALUES ($1,$2)",[approved,tag]);
        const cycle=await newCycle("Dependency invalidation");
        await expect(service().addCycleTestCases(cycle,user,{testcaseIds:[approved]})).rejects.toMatchObject({status:409});
        await approve();
        await admin.query("UPDATE custom_tags SET name='Changed tag' WHERE id=$1",[tag]);
        expect((await service().getTestCaseForUser(user,project,approved)).status).toBe("In Review");
      } finally {
        await admin.query("DELETE FROM custom_field_definitions WHERE id=$1",[field]);
        await admin.query("DELETE FROM custom_tags WHERE id=$1",[tag]);
        await resetStatus();
      }
    });

    it("serializes a dependency edit against approval and run admission", async () => {
      const tag=(await admin.query<{id:string}>("INSERT INTO custom_tags(project_id,name) VALUES ($1,$2) RETURNING id",[project,`Race ${randomUUID().slice(0,8)}`])).rows[0].id;
      await approve();
      const reviewed=await service().getTestCaseForUser(user,project,approved);
      const cycle=await newCycle("Concurrent dependency");
      const blocker=new Client({connectionString:url});await blocker.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query("INSERT INTO testcase_custom_tags(testcase_id,tag_id) VALUES ($1,$2)",[approved,tag]);
        const approval=service().approveTestCaseForUser(user,project,approved,{expectedRevision:reviewed.editRevision,expectedApprovalRevision:reviewed.approvalRevision},{kind:"human_session"}).then(()=>null,(error:unknown)=>error);
        const attachment=service().addCycleTestCases(cycle,user,{testcaseIds:[approved]}).then(()=>null,(error:unknown)=>error);
        await waitForBlockedCaseWriters(2);
        await blocker.query("COMMIT");
        expect(await approval).toMatchObject({status:409});
        expect(await attachment).toMatchObject({status:409});
        expect((await cases(cycle)).rows).toHaveLength(0);
      } finally {
        await blocker.query("ROLLBACK");await blocker.end();
        await admin.query("DELETE FROM custom_tags WHERE id=$1",[tag]);await resetStatus();
      }
    });

    it("rolls back status and receipt when mandatory audit fails", async () => {
      const svc=service(), reviewed=await svc.getTestCaseForUser(user,project,inReview);
      const before=(await admin.query("SELECT * FROM testcases WHERE id=$1",[inReview])).rows[0];
      const receipts=(await admin.query("SELECT * FROM testcase_approval_receipts WHERE testcase_id=$1 ORDER BY id",[inReview])).rows;
      jest.spyOn(svc,"logProjectActivity").mockRejectedValueOnce(new Error("mandatory audit unavailable"));
      await expect(svc.approveTestCaseForUser(user,project,inReview,{expectedRevision:reviewed.editRevision,expectedApprovalRevision:reviewed.approvalRevision},{kind:"human_session"})).rejects.toThrow("mandatory audit unavailable");
      expect((await admin.query("SELECT * FROM testcases WHERE id=$1",[inReview])).rows[0]).toEqual(before);
      expect((await admin.query("SELECT * FROM testcase_approval_receipts WHERE testcase_id=$1 ORDER BY id",[inReview])).rows).toEqual(receipts);
    });
  }
);
