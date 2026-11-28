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
      await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [user,org]);
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
      const db = new DatabaseService(pool), svc = makeLegacy(db, {
        // Relational tests below exercise native transactions; HTTP E2E covers actual entitlements.
        planLimits: { assertProjectWritable: async () => undefined } as unknown as PlanLimitsService
      });
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

    describe("native retest creation at the existing Run owner", () => {
      const human = { kind: "human_session" as const };
      async function createdReadback(cycleId: string, requestKey: string) {
        const result = await service().readNativeRetestRequest(cycleId,user,requestKey,human);
        if (result.outcome !== "created") throw new Error("Expected the retained created Run receipt");
        return result;
      }
      async function source() {
        await resetStatus();
        const cycleId = await newCycle("Native manual source");
        await service().addCycleTestCases(cycleId,user,{testcaseIds:[approved]});
        const executionId = (await executions(cycleId)).rows[0].id;
        await admin.query("UPDATE executions SET status='Failed',actual_result='Original observed result',executed_by=$2,executed_at=now() WHERE id=$1",[executionId,user]);
        const preview = await service().previewNativeRetest(cycleId,user,[executionId]);
        return {cycleId,executionId,preview,body:{requestKey:randomUUID(),executionIds:[executionId],expectedPreviewDigest:preview.previewDigest,name:`Retest ${randomUUID()}`,buildVersion:"new-build"}};
      }
      const cycleCount = async () => (await admin.query("SELECT count(*)::int AS n FROM cycles WHERE project_id=$1",[project])).rows[0].n;
      async function waitForRetestLock(table: "cycles" | "bugs" | "pg_advisory_xact_lock") {
        const deadline = Date.now()+5000;
        while (Date.now()<deadline) {
          const waiting = await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query ILIKE $2",[poolApplicationName,`%${table}%`]);
          if (waiting.rows[0].n > 0) return;
          await new Promise<void>((resolve)=>setTimeout(resolve,20));
        }
        throw new Error(`The retest did not wait for the ${table} owner lock`);
      }

      it("preserves source observations, creates fresh reviewed occurrences and replays one exact receipt", async () => {
        const f = await source();
        const prior = (await admin.query("SELECT * FROM executions WHERE id=$1",[f.executionId])).rows[0];
        const receipts = await Promise.all([service().createNativeRetest(f.cycleId,user,f.body,human),service().createNativeRetest(f.cycleId,user,f.body,human)]);
        expect(new Set(receipts.map((r)=>r.cycleId)).size).toBe(1);
        expect(receipts.map((r)=>r.replayed).sort()).toEqual([false,true]);
        const receipt = receipts[0], entry = receipt.manifest.occurrences[0];
        expect(entry.sourceExecutionId).toBe(f.executionId);
        expect(entry.executionId).not.toBe(f.executionId);
        expect(entry.targetApprovalRevision).toBe(f.preview.occurrences[0].currentCase!.approvalRevision);
        const fresh = (await admin.query("SELECT * FROM executions WHERE id=$1",[entry.executionId])).rows[0];
        expect(fresh).toMatchObject({status:"Untested",actual_result:null,executed_by:null,executed_at:null});
        expect((await admin.query("SELECT * FROM executions WHERE id=$1",[f.executionId])).rows[0]).toEqual(prior);
        expect((await createdReadback(f.cycleId,f.body.requestKey)).manifest).toEqual(receipt.manifest);
        expect((await admin.query("SELECT id FROM audit_logs WHERE entity_id=$1 AND action='run_retest_created'",[receipt.cycleId])).rows).toHaveLength(1);
        await expect(service().createNativeRetest(f.cycleId,user,{...f.body,buildVersion:"different"},human)).rejects.toMatchObject({status:409});
      });

      it("refuses partial receipts and mutation, while ordinary Run metadata remains writable", async () => {
        const f = await source(), receipt = await service().createNativeRetest(f.cycleId,user,f.body,human);
        await expect(admin.query("UPDATE cycles SET retest_manifest=jsonb_set(retest_manifest,'{createdBy}','\"forged\"') WHERE id=$1",[receipt.cycleId])).rejects.toMatchObject({code:"23514"});
        await expect(admin.query("UPDATE cycles SET retest_request_key=$2 WHERE id=$1",[receipt.cycleId,randomUUID()])).rejects.toMatchObject({code:"23514"});
        const ordinary = await newCycle("Ordinary control");
        await expect(admin.query("UPDATE cycles SET retest_source_cycle_id=$2 WHERE id=$1",[ordinary,f.cycleId])).rejects.toMatchObject({code:"23514",constraint:"cycles_retest_receipt_complete"});
        await admin.query("UPDATE cycles SET name='Renamed run' WHERE id=$1",[receipt.cycleId]);
        expect((await createdReadback(f.cycleId,f.body.requestKey)).manifest).toEqual(receipt.manifest);
      });

      it("retests a finalized automation observation as a separate manual Run without reopening its source", async () => {
        const f = await source();
        await admin.query("UPDATE cycles SET source='automation',status='Completed',closed_at=now() WHERE id=$1",[f.cycleId]);
        const before = (await admin.query("SELECT * FROM cycles WHERE id=$1",[f.cycleId])).rows[0];
        const original = (await admin.query("SELECT * FROM executions WHERE id=$1",[f.executionId])).rows[0];
        const reviewed = await service().previewNativeRetest(f.cycleId,user,[f.executionId]);
        const receipt = await service().createNativeRetest(f.cycleId,user,{...f.body,expectedPreviewDigest:reviewed.previewDigest},human);
        expect((await admin.query("SELECT * FROM cycles WHERE id=$1",[f.cycleId])).rows[0]).toEqual(before);
        expect((await admin.query("SELECT * FROM executions WHERE id=$1",[f.executionId])).rows[0]).toEqual(original);
        expect((await admin.query("SELECT source,status,closed_at FROM cycles WHERE id=$1",[receipt.cycleId])).rows[0])
          .toMatchObject({source:"manual",status:"Planning",closed_at:null});
        expect(receipt.manifest.sourceRun.source).toBe("automation");
      });

      it("rejects stale source observations and current definitions without leaving a new Run", async () => {
        const f = await source(), before = await cycleCount();
        await admin.query("UPDATE executions SET actual_result='New source observation' WHERE id=$1",[f.executionId]);
        await expect(service().createNativeRetest(f.cycleId,user,f.body,human)).rejects.toMatchObject({status:409});
        expect(await cycleCount()).toBe(before);
        const current = await service().previewNativeRetest(f.cycleId,user,[f.executionId]);
        await admin.query("UPDATE testcases SET title='Changed before retest' WHERE id=$1",[approved]);
        try {
          await approve();
          await expect(service().createNativeRetest(f.cycleId,user,{...f.body,expectedPreviewDigest:current.previewDigest},human)).rejects.toMatchObject({status:409});
          expect(await cycleCount()).toBe(before);
          const reviewed = await service().previewNativeRetest(f.cycleId,user,[f.executionId]);
          expect(reviewed.occurrences[0].definitionChanged).toBe(true);
          const result = await service().createNativeRetest(f.cycleId,user,{...f.body,expectedPreviewDigest:reviewed.previewDigest},human);
          expect(result.manifest.occurrences[0].targetDefinition.case.title).toBe("Changed before retest");
          expect(result.manifest.occurrences[0].sourceDefinition.case.title).not.toBe("Changed before retest");
        } finally { await resetStatus(); }
      });

      it("rechecks a definition after a blocked row lock and rolls back the whole retest", async () => {
        const f = await source(), before = await cycleCount();
        const blocker = new Client({connectionString:url}); await blocker.connect();
        try {
          await blocker.query("BEGIN");
          await blocker.query("UPDATE testcases SET status='Draft' WHERE id=$1",[approved]);
          const request = service().createNativeRetest(f.cycleId,user,f.body,human).then(()=>null,(error:unknown)=>error);
          await waitForBlockedCaseWriters(1);
          await blocker.query("COMMIT");
          expect(await request).toMatchObject({status:409});
          expect(await cycleCount()).toBe(before);
        } finally { await blocker.query("ROLLBACK"); await blocker.end(); await resetStatus(); }
      });

      it("rechecks the original result after waiting for its native Run writer", async () => {
        const f=await source(), before=await cycleCount();
        const blocker=new Client({connectionString:url}); await blocker.connect();
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM cycles WHERE id=$1 FOR UPDATE",[f.cycleId]);
          await blocker.query("UPDATE executions SET actual_result='Committed concurrent observation' WHERE id=$1",[f.executionId]);
          const pending=service().createNativeRetest(f.cycleId,user,f.body,human).then(()=>null,(error:unknown)=>error);
          await waitForRetestLock("cycles");
          await blocker.query("COMMIT");
          expect(await pending).toMatchObject({status:409});
          expect(await cycleCount()).toBe(before);
        } finally { await blocker.query("ROLLBACK"); await blocker.end(); }
      });

      it("rechecks active Bug links after an unlink holding the native Bug owner lock", async () => {
        const f=await source();
        const bug=(await admin.query("INSERT INTO bugs(project_id,external_id,title) VALUES ($1,$2,'Retest link race') RETURNING id",[project,`APR-BUG-${randomUUID().slice(0,8)}`])).rows[0].id;
        const link=(await admin.query("INSERT INTO bug_links(bug_id,testcase_id,cycle_id,execution_id) VALUES ($1,$2,$3,$4) RETURNING id",[bug,approved,f.cycleId,f.executionId])).rows[0].id;
        const reviewed=await service().previewNativeRetest(f.cycleId,user,[f.executionId]);
        expect(reviewed.occurrences[0].sourceBugLinks).toHaveLength(1);
        const blocker=new Client({connectionString:url}); await blocker.connect();
        const before=await cycleCount();
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM bugs WHERE id=$1 FOR UPDATE",[bug]);
          await blocker.query("UPDATE bug_links SET deleted_at=now() WHERE id=$1",[link]);
          const pending=service().createNativeRetest(f.cycleId,user,{...f.body,expectedPreviewDigest:reviewed.previewDigest},human).then(()=>null,(error:unknown)=>error);
          await waitForRetestLock("bugs");
          await blocker.query("COMMIT");
          expect(await pending).toMatchObject({status:409});
          expect(await cycleCount()).toBe(before);
          expect((await service().previewNativeRetest(f.cycleId,user,[f.executionId])).occurrences[0].sourceBugLinks).toEqual([]);
        } finally { await blocker.query("ROLLBACK"); await blocker.end(); }
      });

      it("rolls back Run/items/executions/receipt when mandatory retest audit fails", async () => {
        const f = await source(), before = await cycleCount(), svc = service();
        jest.spyOn(svc,"logProjectActivity").mockRejectedValueOnce(new Error("retest audit unavailable"));
        await expect(svc.createNativeRetest(f.cycleId,user,f.body,human)).rejects.toThrow("retest audit unavailable");
        expect(await cycleCount()).toBe(before);
        await expect(service().readNativeRetestRequest(f.cycleId,user,f.body.requestKey,human)).rejects.toMatchObject({status:404});
        expect((await admin.query("SELECT id FROM cycles WHERE retest_request_key=$1",[f.body.requestKey])).rows).toHaveLength(0);
        expect((await admin.query("SELECT request_key FROM cycle_retest_requests WHERE project_id=$1 AND request_key=$2",[project,f.body.requestKey])).rows).toHaveLength(0);
      });

      it("retains the original target occurrence after removal/re-addition and never rewrites imported history", async () => {
        const f = await source(), receipt = await service().createNativeRetest(f.cycleId,user,f.body,human);
        const entry = receipt.manifest.occurrences[0];
        await service().removeCycleTestCase(receipt.cycleId,user,approved);
        await service().addCycleTestCases(receipt.cycleId,user,{testcaseIds:[approved]});
        const current = (await executions(receipt.cycleId)).rows[0];
        expect(current.id).not.toBe(entry.executionId);
        expect((await createdReadback(f.cycleId,f.body.requestKey)).manifest.occurrences[0].executionId).toBe(entry.executionId);
        expect((await admin.query("SELECT history FROM executions WHERE id=$1",[f.executionId])).rows[0].history).toBeNull();
      });

      it("denies machine-originated human retest and revoked membership before creation", async () => {
        const f = await source(), before = await cycleCount();
        await expect(service().createNativeRetest(f.cycleId,user,f.body,{kind:"api_token"})).rejects.toMatchObject({status:403});
        await expect(service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,{kind:"api_token"})).rejects.toMatchObject({status:403});
        await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,user]);
        try {
          await expect(service().createNativeRetest(f.cycleId,user,f.body,human)).rejects.toMatchObject({status:403});
          await expect(service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human)).rejects.toMatchObject({status:403});
          expect(await cycleCount()).toBe(before);
        } finally { await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,user]); }
      });

      it.each(["create","cancel","readback"] as const)("refuses %s after membership is revoked during its real source-owner wait", async (operation) => {
        const f = await source();
        if (operation === "readback") await service().createNativeRetest(f.cycleId,user,f.body,human);
        const retainedState = async () => ({
          cycles:(await admin.query("SELECT * FROM cycles WHERE project_id=$1 ORDER BY id",[project])).rows,
          requests:(await admin.query("SELECT * FROM cycle_retest_requests WHERE project_id=$1 ORDER BY request_key",[project])).rows,
          audit:(await admin.query("SELECT * FROM audit_logs WHERE project_id=$1 ORDER BY id",[project])).rows,
          sourceResult:(await admin.query("SELECT * FROM executions WHERE id=$1",[f.executionId])).rows
        });
        expect((await admin.query("SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2",[project,user])).rows)
          .toEqual([{role:"qa_engineer"}]);
        const before = await retainedState();
        const blocker = new Client({connectionString:url}), revoker = new Client({connectionString:url});
        await blocker.connect(); await revoker.connect();
        let pending: Promise<unknown> | undefined;
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM cycles WHERE id=$1 FOR UPDATE",[f.cycleId]);
          const svc = service();
          const call = operation === "create" ? svc.createNativeRetest(f.cycleId,user,f.body,human)
            : operation === "cancel" ? svc.cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human)
              : svc.readNativeRetestRequest(f.cycleId,user,f.body.requestKey,human);
          pending = call.then(() => ({unexpectedSuccess:true}), (error:unknown) => error);
          // Revoke only after PostgreSQL proves this exact owner's request reached its wait.
          // A pre-call revocation cannot discriminate a missing post-wait authority check.
          await waitForRetestLock("cycles");
          await revoker.query("SET lock_timeout='3s'");
          expect((await revoker.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,user])).rowCount).toBe(1);
          await blocker.query("COMMIT");
          expect(await pending).toMatchObject({status:403});
          expect(await retainedState()).toEqual(before);
        } finally {
          await blocker.query("ROLLBACK");
          await pending;
          await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer') ON CONFLICT (project_id,user_id) DO NOTHING",[project,user]);
          await revoker.end(); await blocker.end();
        }
      },15_000);

      it.each(["create","cancel"] as const)("records one immutable outcome when %s wins the real create/cancel lock race", async (first) => {
        const f = await source(), before = await cycleCount();
        const original = (await admin.query("SELECT * FROM executions WHERE id=$1",[f.executionId])).rows[0];
        const blocker = new Client({connectionString:url}); await blocker.connect();
        type RaceResult = {result?: Awaited<ReturnType<ReturnType<typeof service>["cancelNativeRetestRequest"]>>; error?: unknown};
        const create = () => service().createNativeRetest(f.cycleId,user,f.body,human).then(result => ({result}),error => ({error})) as Promise<RaceResult>;
        const cancel = () => service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human).then(result => ({result}),error => ({error})) as Promise<RaceResult>;
        let winner: Promise<RaceResult> | undefined, loser: Promise<RaceResult> | undefined;
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM cycles WHERE id=$1 FOR UPDATE",[f.cycleId]);
          winner = first === "create" ? create() : cancel();
          await waitForRetestLock("cycles");
          loser = first === "create" ? cancel() : create();
          await waitForRetestLock("pg_advisory_xact_lock");
          await blocker.query("COMMIT");
          const won = await winner, lost = await loser;
          expect(won.error).toBeUndefined();
          const readback = await service().readNativeRetestRequest(f.cycleId,user,f.body.requestKey,human);
          if (first === "create") {
            expect(won.result?.outcome).toBe("created");
            expect(lost).toEqual({result:readback});
            expect(await cycleCount()).toBe(before+1);
          } else {
            expect(won.result?.outcome).toBe("cancelled");
            expect(lost.error).toMatchObject({status:409,response:{code:"RETEST_REQUEST_CANCELLED"}});
            expect(await cycleCount()).toBe(before);
            await expect(service().createNativeRetest(f.cycleId,user,f.body,human)).rejects.toMatchObject({status:409,response:{code:"RETEST_REQUEST_CANCELLED"}});
          }
          expect((await admin.query("SELECT * FROM cycle_retest_requests WHERE project_id=$1 AND request_key=$2",[project,f.body.requestKey])).rows).toHaveLength(1);
          expect((await admin.query("SELECT * FROM executions WHERE id=$1",[f.executionId])).rows[0]).toEqual(original);
        } finally { await blocker.query("ROLLBACK"); await winner; await loser; await blocker.end(); }
      },15_000);

      it("rolls back a failed mandatory cancellation audit and allows the original request to create", async () => {
        const f = await source(), before = await cycleCount(), svc = service();
        jest.spyOn(svc,"logProjectActivity").mockRejectedValueOnce(new Error("cancellation audit unavailable"));
        await expect(svc.cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human)).rejects.toThrow("cancellation audit unavailable");
        expect(await cycleCount()).toBe(before);
        expect((await admin.query("SELECT request_key FROM cycle_retest_requests WHERE project_id=$1 AND request_key=$2",[project,f.body.requestKey])).rows).toEqual([]);
        await expect(service().readNativeRetestRequest(f.cycleId,user,f.body.requestKey,human)).rejects.toMatchObject({status:404});
        expect((await service().createNativeRetest(f.cycleId,user,f.body,human)).outcome).toBe("created");
      });

      it("keeps cancellation immutable and enforces the exact successful receipt relationship at the database boundary", async () => {
        const f = await source();
        const cancelled = await service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human);
        expect(cancelled.outcome).toBe("cancelled");
        await expect(admin.query("UPDATE cycle_retest_requests SET requested_by=$3 WHERE project_id=$1 AND request_key=$2",[project,f.body.requestKey,randomUUID()])).rejects.toMatchObject({code:"23514"});
        await expect(admin.query("DELETE FROM cycle_retest_requests WHERE project_id=$1 AND request_key=$2",[project,f.body.requestKey])).rejects.toMatchObject({code:"23514"});
        const ordinary = await newCycle("No invented successful command");
        await expect(admin.query(`INSERT INTO cycle_retest_requests(project_id,request_key,source_cycle_id,request_digest,requested_by,outcome,destination_cycle_id)
          VALUES ($1,$2,$3,$4,$5,'created',$6)`,[project,randomUUID(),f.cycleId,"a".repeat(64),user,ordinary])).rejects.toMatchObject({code:"23514"});
        const created = await service().createNativeRetest(f.cycleId,user,{...f.body,requestKey:randomUUID()},human);
        const manifest = {...created.manifest,cycleId:ordinary};
        await expect(admin.query(`UPDATE cycles SET retest_source_cycle_id=$2,retest_request_key=$3,retest_request_digest=$4,
          retest_manifest=$5::jsonb,retest_manifest_digest=encode(sha256(convert_to(($5::jsonb)::text,'UTF8')),'hex') WHERE id=$1`,
          [ordinary,f.cycleId,f.body.requestKey,cancelled.requestDigest,JSON.stringify(manifest)]))
          .rejects.toMatchObject({code:"23503",constraint:"cycles_retest_request_binding_fk"});
        expect((await admin.query("SELECT retest_manifest FROM cycles WHERE id=$1",[ordinary])).rows[0].retest_manifest).toBeNull();
      });

      it("binds terminal recovery to the exact original source, requesting human and payload", async () => {
        const f = await source(), before = await cycleCount();
        const cancelled = await service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human);
        expect(await service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human)).toEqual(cancelled);
        expect(await service().readNativeRetestRequest(f.cycleId,user,f.body.requestKey,human)).toEqual(cancelled);
        await expect(service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,{...f.body,buildVersion:"different"},human)).rejects.toMatchObject({status:409,response:{code:"RETEST_REQUEST_CONFLICT"}});
        const otherSource = await newCycle("Other source cannot claim this command");
        await expect(service().readNativeRetestRequest(otherSource,user,f.body.requestKey,human)).rejects.toMatchObject({status:409,response:{code:"RETEST_REQUEST_CONFLICT"}});
        const secondHuman = (await admin.query("INSERT INTO users(email,name,active_organization_id) SELECT $1,'Other recovery actor',organization_id FROM projects WHERE id=$2 RETURNING id",[`retest-actor-${randomUUID()}@tesbo.invalid`,project])).rows[0].id;
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) SELECT organization_id,$2,'member' FROM projects WHERE id=$1",[project,secondHuman]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,secondHuman]);
        await expect(service().readNativeRetestRequest(f.cycleId,secondHuman,f.body.requestKey,human)).rejects.toMatchObject({status:409});
        await expect(service().cancelNativeRetestRequest(f.cycleId,secondHuman,f.body.requestKey,f.body,human)).rejects.toMatchObject({status:409});
        expect(await cycleCount()).toBe(before+1); // Only the explicitly created other source.
      });

      it("can cancel after source deletion without any prior creation or fresh approval", async () => {
        const f = await source(), before = await cycleCount();
        await service().deleteCycle(f.cycleId,user);
        await admin.query("UPDATE testcases SET status='Draft' WHERE id=$1",[approved]);
        try {
          await expect(service().readNativeRetestRequest(f.cycleId,user,f.body.requestKey,human)).rejects.toMatchObject({status:404});
          const cancelled = await service().cancelNativeRetestRequest(f.cycleId,user,f.body.requestKey,f.body,human);
          expect(cancelled).toMatchObject({outcome:"cancelled",sourceCycleId:f.cycleId,requestKey:f.body.requestKey});
          expect(await service().readNativeRetestRequest(f.cycleId,user,f.body.requestKey,human)).toEqual(cancelled);
          await expect(service().createNativeRetest(f.cycleId,user,f.body,human)).rejects.toMatchObject({status:409,response:{code:"RETEST_REQUEST_CANCELLED"}});
          await expect(service().createNativeRetest(f.cycleId,user,{...f.body,requestKey:randomUUID()},human)).rejects.toMatchObject({status:404});
          expect(await cycleCount()).toBe(before);
        } finally { await resetStatus(); }
      });
    });
  }
);
