import { randomUUID } from "node:crypto";
import { recordReviewedCaseFixture } from "./test-helpers/reviewed-case.fixture";
import { mkdtemp } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type INestApplication, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Client, Pool } from "pg";
import type Redis from "ioredis";
import cookieParser from "cookie-parser";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "./legacy.service";
import { buildMcpTools } from "../mcp/mcp.tools";
import { McpController } from "../mcp/mcp.controller";
import { McpService } from "../mcp/mcp.service";
import { ModelStudioPreview } from "../behavior-graph/model-studio-preview";
import { ModelStudioPreviewController } from "../behavior-graph/model-studio-preview.controller";
import { ModelStudioRepository } from "../behavior-graph/model-studio-repository";
import { SchedulesController } from "../schedules/schedules.controller";
import { SchedulesService } from "../schedules/schedules.service";
import { AuthMiddleware } from "../auth/auth.middleware";
import { ApiTokenService } from "../auth/api-token.service";
import { ApiTokenRestGuard } from "../auth/api-token-rest.guard";
import { OtpService } from "../auth/otp.service";
import { ActivityMiddleware } from "../auth/activity.middleware";
import { UserActivityService } from "../auth/user-activity.service";
import type { EmailService } from "../auth/email.service";
import type { AppConfigService } from "../config/app-config.service";
import { EntitlementCacheService } from "../cache/entitlement-cache.service";
import { SessionCacheService } from "../cache/session-cache.service";
import { RequestCacheService } from "../request-cache/request-cache.service";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { ProjectWriteLockGuard } from "../plan-limits/project-write-lock.guard";
import { LegacyController } from "./legacy.controller";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { ZyraProgressService } from "./zyra-progress.service";
import { WelcomeEmailService } from "../welcome-email/welcome-email.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { HttpExceptionFilter } from "../common/http-exception.filter";
import { DIRECT_TESTCASE_PUBLISHERS } from "../common/testcase-publication.policy";
import { StorageService } from "../storage/storage.service";

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("Plan/Run project lineage — migrated PostgreSQL", () => {
  let setup: Client, pool: Pool, project: string, other: string, plan: string, cycle: string;
  let localSuite: string, localCase: string, foreignSuite: string, foreignCase: string, foreignPlan: string;
  const owner = randomUUID(), stamp = randomUUID();
  const poolApplicationName = `plan-lineage-${stamp}`;
  beforeAll(async () => {
    setup = new Client({ connectionString: url }); await setup.connect();
    pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000, application_name: poolApplicationName });
    await setup.query("INSERT INTO users (id,email,name) VALUES ($1,$2,'Lineage owner')", [owner, `lineage-${stamp}@tesbo.invalid`]);
    const org = (await setup.query("INSERT INTO organizations (name,slug) VALUES ('Lineage CI',$1) RETURNING id", [`lineage-${stamp}`])).rows[0].id;
    project = (await setup.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'LNA','Lineage A') RETURNING id", [org])).rows[0].id;
    other = (await setup.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'LNB','Lineage B') RETURNING id", [org])).rows[0].id;
    localSuite = (await setup.query("INSERT INTO suites (project_id,name) VALUES ($1,'Local Suite') RETURNING id", [project])).rows[0].id;
    foreignSuite = (await setup.query("INSERT INTO suites (project_id,name) VALUES ($1,'Private foreign Suite') RETURNING id", [other])).rows[0].id;
    localCase = (await setup.query("INSERT INTO testcases (project_id,external_id,title) VALUES ($1,'LNA-TC-1','Local Case') RETURNING id", [project])).rows[0].id;
    foreignCase = (await setup.query("INSERT INTO testcases (project_id,external_id,title) VALUES ($1,'LNB-TC-1','Private foreign Case') RETURNING id", [other])).rows[0].id;
    foreignPlan = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'Private foreign Plan') RETURNING id", [other])).rows[0].id;
  });
  beforeEach(async () => {
    plan = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'Local Plan') RETURNING id", [project])).rows[0].id;
    cycle = (await setup.query("INSERT INTO cycles (project_id,name,plan_id) VALUES ($1,'Local Run',$2) RETURNING id", [project, plan])).rows[0].id;
  });
  afterAll(async () => { await pool?.end(); await setup?.end(); }); // Preserve synthetic provenance until disposable CI teardown.
  function fixture() {
    const db = new DatabaseService(pool), svc = makeLegacy(db);
    // Native relational/write tests, not HTTP authorization. Genuine HTTP/MCP auth is in smoke.
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({} as never);
    const tool = (name: string, args: Record<string, unknown>) => buildMcpTools().find((item) => item.name === name)!.handler(args, {
      db, legacy: svc, projectId: project, userId: owner, actorId: owner, scopes: ["read", "write"]
    });
    return { svc, tool };
  }
  const state = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ["plans", "suites", "testcases", "cycles"]) result[table] = (await setup.query(`SELECT * FROM ${table} WHERE project_id = ANY($1::uuid[]) ORDER BY id`, [[project, other]])).rows;
    result.items = (await setup.query("SELECT pi.* FROM plan_items pi JOIN plans p ON p.id=pi.plan_id WHERE p.project_id=ANY($1::uuid[]) ORDER BY pi.id", [[project, other]])).rows;
    return result;
  };
  it.each(["foreign", "missing", "malformed", "deleted"])("rejects %s Suite/Case references without a committed prefix or unrelated mutation", async (kind) => {
    const f = fixture();
    for (const field of ["suiteId", "testcaseId"] as const) {
      let id: unknown = kind === "foreign" ? (field === "suiteId" ? foreignSuite : foreignCase) : kind === "missing" ? randomUUID() : { invalid: true };
      if (kind === "deleted") {
        id = field === "suiteId"
          ? (await setup.query("INSERT INTO suites (project_id,name,deleted_at) VALUES ($1,'Deleted Suite',now()) RETURNING id", [project])).rows[0].id
          : (await setup.query("INSERT INTO testcases (project_id,external_id,title,deleted_at) VALUES ($1,$2,'Deleted Case',now()) RETURNING id", [project, `DEL-${randomUUID().slice(0, 8)}`])).rows[0].id;
      }
      const before = await state();
      await expect(f.svc.addPlanItem(owner, plan, { [field]: id })).rejects.toMatchObject({ status: 404 });
      expect(await state()).toEqual(before);
    }
  });
  it("validates every supplied child but retains both-local and historical-deleted-name compatibility", async () => {
    const f = fixture(), before = await state();
    await expect(f.svc.addPlanItem(owner, plan, { suiteId: localSuite, testcaseId: foreignCase })).rejects.toMatchObject({ status: 404 });
    expect(await state()).toEqual(before);
    const item = await f.svc.addPlanItem(owner, plan, { suiteId: localSuite, testcaseId: localCase, position: 3 });
    expect(item).toMatchObject({ planId: plan, suiteId: localSuite, testcaseId: localCase, position: 3 });
    // A valid reference that later soft-deletes is still historical information, not a missing row.
    await setup.query("UPDATE suites SET deleted_at=now() WHERE id=$1", [localSuite]);
    expect(await f.svc.planItems(owner, plan)).toEqual([expect.objectContaining({ id: item.id, suiteName: "Local Suite (deleted)", tcTitle: "Local Case" })]);
    await setup.query("UPDATE suites SET deleted_at=NULL WHERE id=$1", [localSuite]);
  });
  it.each([{}, { suiteId: null }, { suiteId: "", testcaseId: "" }])("rejects an empty Plan item before SQL constraint failure: %j", async (body) => {
    const before = await state();
    await expect(fixture().svc.addPlanItem(owner, plan, body)).rejects.toMatchObject({ status: 400 });
    expect(await state()).toEqual(before);
  });
  describe.each(["create", "update", "MCP create"])("%s Run Plan binding", (kind) => {
    it.each(["foreign", "missing", "malformed", "deleted"])("rejects a %s Plan and preserves all prior rows", async (invalid) => {
      let id: unknown = invalid === "foreign" ? foreignPlan : invalid === "missing" ? randomUUID() : "not-a-uuid";
      if (invalid === "deleted") id = (await setup.query("INSERT INTO plans (project_id,name,deleted_at) VALUES ($1,'Deleted Plan',now()) RETURNING id", [project])).rows[0].id;
      const f = fixture(), before = await state();
      const pending = kind === "create" ? f.svc.createCycle(project, { name: "Must not persist", planId: id })
        : kind === "update" ? f.svc.updateCycle(cycle, owner, { name: "Must not persist", planId: id })
          : f.tool("create_cycle_from_plan", { name: "Must not persist", planId: id });
      await expect(pending).rejects.toMatchObject({ status: 404 });
      expect(await state()).toEqual(before);
    });
  });
  it("preserves local create, omitted association, reassignment and explicit unlink contracts", async () => {
    const f = fixture();
    expect(await f.tool("create_cycle_from_plan", { name: "Allowed", planId: plan })).toMatchObject({ projectId: project, planId: plan });
    expect(await f.svc.createCycle(project, { name: "Unassociated" })).toMatchObject({ projectId: project, planId: null });
    await f.svc.updateCycle(cycle, owner, { name: "Renamed without replaying Plan" });
    expect((await setup.query("SELECT plan_id,name FROM cycles WHERE id=$1", [cycle])).rows[0]).toEqual({ plan_id: plan, name: "Renamed without replaying Plan" });
    const next = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'Next local Plan') RETURNING id", [project])).rows[0].id;
    await f.svc.updateCycle(cycle, owner, { planId: next });
    expect((await setup.query("SELECT plan_id FROM cycles WHERE id=$1", [cycle])).rows[0].plan_id).toBe(next);
    await f.svc.updateCycle(cycle, owner, { clearPlan: true, planId: foreignPlan });
    expect((await setup.query("SELECT plan_id FROM cycles WHERE id=$1", [cycle])).rows[0].plan_id).toBeNull();
  });
  it("retains old invalid associations without exposing foreign display fields or Run rollups", async () => {
    const f = fixture();
    const invalid = (await setup.query("INSERT INTO plan_items (plan_id,suite_id,testcase_id) VALUES ($1,$2,$3) RETURNING id", [plan, foreignSuite, foreignCase])).rows[0].id;
    const foreignRun = (await setup.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'Private foreign Run') RETURNING id", [other, plan])).rows[0].id;
    const before = await state();
    expect(await f.svc.planItems(owner, plan)).toEqual([expect.objectContaining({ id: invalid, suiteId: foreignSuite, testcaseId: foreignCase, suiteName: null, tcTitle: null, tcExternalId: null, lastStatus: null })]);
    expect((await f.svc.planRuns(owner, plan)).map((row) => row.id)).toEqual([cycle]);
    expect(await f.svc.planProgress(owner, plan)).toMatchObject({ runCount: 1, totalCases: 0 });
    expect((await f.svc.listPlans(project)).find((row) => row.id === plan)).toMatchObject({ runCount: 1 });
    expect((await f.svc.planRuns(owner, plan)).some((row) => row.id === foreignRun)).toBe(false);
    expect(await state()).toEqual(before);
    const wrongPlanRun = (await setup.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'Local legacy inconsistent Run') RETURNING id", [project, foreignPlan])).rows[0].id;
    expect(await f.tool("get_test_cycle", { cycleId: wrongPlanRun })).toMatchObject({ id: wrongPlanRun, plan: null });
  });
  it.each(["plans", "suites", "testcases"] as const)("waits for a concurrent %s soft-delete, then refuses the stale reference", async (table) => {
    const id = table === "plans" ? plan : table === "suites" ? localSuite : localCase;
    const blocker = new Client({ connectionString: url }); await blocker.connect(); await blocker.query("BEGIN");
    await blocker.query(`UPDATE ${table} SET deleted_at=now() WHERE id=$1`, [id]);
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    const f = fixture(), before = await state();
    const pending = (table === "plans" ? f.svc.createCycle(project, { name: "Deleted Plan race", planId: id }) : f.svc.addPlanItem(owner, plan, { [table === "suites" ? "suiteId" : "testcaseId"]: id })).then(() => null, (error: unknown) => error);
    try {
      const deadline = Date.now() + 5000;
      let blocked = false;
      while (Date.now() < deadline && !blocked) {
        blocked = (await setup.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))", [pid])).rowCount! > 0;
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(blocked).toBe(true);
      expect(await state()).toEqual(before);
      await blocker.query("COMMIT");
      expect(await pending).toMatchObject({ status: 404 });
      // Only the independently committed soft-delete may change; no Plan item/Run was inserted.
      const after = await state();
      expect(after.items).toEqual(before.items); expect(after.cycles).toEqual(before.cycles);
    } finally {
      await blocker.query("ROLLBACK"); await pending; await blocker.end();
      if (table !== "plans") await setup.query(`UPDATE ${table} SET deleted_at=NULL WHERE id=$1`, [id]);
    }
  }, 15_000);

  describe("MCP locked-project parity at the real HTTP and PostgreSQL boundary", () => {
    const previousProposalPreview = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    let app: INestApplication, base: string, locked: string, organization: string, token: string;
    let db: DatabaseService, limits: PlanLimitsService, mcp: McpService, tokens: ApiTokenService;
    let legacy: LegacyService, storage: StorageService, put: jest.SpyInstance, productActivity: jest.SpyInstance;
    let restHandlers: jest.SpyInstance[], storageQuota: jest.SpyInstance, removeFile: jest.SpyInstance, notifications: jest.SpyInstance;
    let readToken: string, writeToken: string, writableToken: string, session: string;
    let suiteId: string, caseId: string, planId: string, runId: string, executionId: string, bugId: string, folderId: string, documentId: string;
    let lockedModelId: string;
    let handlers: jest.SpyInstance[], quota: jest.SpyInstance, actor: jest.SpyInstance, tracking: jest.SpyInstance;
    const settings = { isStripeBillingEnabled: true, entitlementCacheEnabled: true, enableRequestScopedCache: true,
      frontendUrl: "http://127.0.0.1:3000", sessionCookieName: "mcp-native-session", sessionDays: 1 };
    const config = settings as unknown as AppConfigService;
    const cache = new Map<string, string>();
    // Explicit Redis/email collaborators only: real entitlement service, middleware, guards,
    // MCP controller/engine, token hashing/membership and business SQL. No Stripe API is called.
    const redis = {
      get: jest.fn(async (key: string) => cache.get(key) ?? null),
      set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
        if (args.includes("NX") && cache.has(key)) return null;
        cache.set(key, value); return "OK";
      }),
      del: jest.fn(async (key: string) => Number(cache.delete(key)))
    } as unknown as Redis;
    const email = { sendGraceEnded: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService;
    beforeAll(async () => {
      // Exercise the normal deployed profile even when the disposable CI job also enables preview tests.
      process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = "0";
      organization = (await setup.query("SELECT organization_id FROM projects WHERE id=$1", [project])).rows[0].organization_id;
      await setup.query("INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'owner')", [organization, owner]);
      await setup.query("UPDATE users SET active_organization_id=$1 WHERE id=$2", [organization, owner]);
      locked = (await setup.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'LNC','Locked MCP project') RETURNING id", [organization])).rows[0].id;
      for (const id of [project, other, locked]) await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [id, owner]);
      await setup.query("UPDATE organizations SET plan='launch',plan_grace_ends_at=now()-interval '1 day' WHERE id=$1", [organization]);
      db = new DatabaseService(pool);
      const requestCache = new RequestCacheService(config);
      const uploadDir = await mkdtemp(join(process.env.RUNNER_TEMP ?? join(tmpdir(), "opencode"), "tesbo-rest-lock-"));
      storage = new StorageService({ storageDriver: "local", uploadDir } as AppConfigService);
      put = jest.spyOn(storage, "put");
      removeFile = jest.spyOn(storage, "delete");
      limits = new PlanLimitsService(db, config, email, requestCache, new EntitlementCacheService(redis, config));
      storageQuota = jest.spyOn(limits, "assertStorageAvailable");
      legacy = makeLegacy(db, { config, storage, planLimits: limits, requestCache });
      productActivity = jest.spyOn(legacy, "logProjectActivity");
      notifications = jest.spyOn(legacy, "notifyUsers");
      restHandlers = (["updatePlan", "deletePlan", "addPlanItem", "deletePlanItem", "updateCycle", "deleteCycle", "addCycleTestCases",
        "removeCycleTestCase", "removeCycleTestCases", "updateExecution", "uploadExecutionAttachments", "bulkAssignExecutions",
        "bulkUpdateExecutionStatus", "importRunHistory", "shareCycle", "createNativeRetest", "cancelNativeRetestRequest"] as const).map((method) => jest.spyOn(legacy, method));
      // This boundary test does not boot unrelated resumable Zyra plans from other retained fixtures.
      jest.spyOn(legacy, "onModuleInit").mockResolvedValue(undefined);
      tokens = new ApiTokenService(db);
      token = (await tokens.issueToken(owner, locked, "Native MCP parity", ["read", "write"])).token;
      readToken = (await tokens.issueToken(owner, locked, "Native MCP read", ["read"])).token;
      writeToken = (await tokens.issueToken(owner, locked, "Native MCP write", ["write"])).token;
      writableToken = (await tokens.issueToken(owner, project, "Native writable control", ["read", "write"])).token;
      // Explicit synthetic consent fixture. Production legacy credentials remain disabled by default;
      // these tests exercise billing/lineage after the separately tested human consent boundary.
      for (const projectId of [locked, project]) {
        const credentials = await setup.query("SELECT id, name, scopes FROM api_tokens WHERE project_id = $1", [projectId]);
        const clients = credentials.rows.map(item => ({ tokenId: item.id, clientName: item.name,
          scopes: item.scopes.split(","), allowedTools: null, expiresAt: null }));
        await setup.query("UPDATE projects SET settings = jsonb_set(COALESCE(settings,'{}'::jsonb), '{externalMcpAccess}', $2::jsonb) WHERE id = $1",
          [projectId, JSON.stringify({ enabled: true, revision: 1, clients })]);
      }
      const otp = new OtpService(db, config, email, new SessionCacheService(redis, config), {} as WelcomeEmailService);
      session = await otp.createSession(owner);
      expect(await otp.resolveSession(session)).toBe(owner);
      suiteId = (await setup.query("INSERT INTO suites (project_id,name) VALUES ($1,'Native locked Suite') RETURNING id", [locked])).rows[0].id;
      caseId = (await setup.query("INSERT INTO testcases (project_id,suite_id,external_id,title,owner_id) VALUES ($1,$2,'LNC-TC-1','Native locked Case',$3) RETURNING id", [locked, suiteId, owner])).rows[0].id;
      planId = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'Native locked Plan') RETURNING id", [locked])).rows[0].id;
      runId = (await setup.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'Native locked Run') RETURNING id", [locked, planId])).rows[0].id;
      const item = (await setup.query("INSERT INTO cycle_items (cycle_id,testcase_id,snapshot_title,snapshot_external_id) VALUES ($1,$2,'Native locked Case','LNC-TC-1') RETURNING id", [runId, caseId])).rows[0].id;
      executionId = (await setup.query("INSERT INTO executions (cycle_item_id,status,actual_result,history) VALUES ($1,'Passed','Preserve native result','[{\"status\":\"Blocked\"}]'::jsonb) RETURNING id", [item])).rows[0].id;
      bugId = (await setup.query("INSERT INTO bugs (project_id,external_id,title,testcase_id,cycle_id,execution_id,reported_by) VALUES ($1,'LNC-BUG-1','Native locked Bug',$2,$3,$4,$5) RETURNING id", [locked, caseId, runId, executionId, owner])).rows[0].id;
      await setup.query("INSERT INTO bug_links (bug_id,testcase_id,cycle_id,execution_id) VALUES ($1,$2,$3,$4)", [bugId, caseId, runId, executionId]);
      folderId = (await setup.query("INSERT INTO knowledge_folders (organization_id,project_id,name,is_root,created_by,updated_by) VALUES ($1,$2,'Native locked root',true,$3,$3) RETURNING id", [organization, locked, owner])).rows[0].id;
      documentId = (await setup.query("INSERT INTO knowledge_documents (organization_id,project_id,folder_id,title,content_text,created_by,updated_by) VALUES ($1,$2,$3,'Native locked document','Preserve locked content',$4,$4) RETURNING id", [organization, locked, folderId, owner])).rows[0].id;
      // Retained versions/evidence are populated, not just empty-table equality checks.
      await setup.query("INSERT INTO testcase_versions (testcase_id,version,snapshot) VALUES ($1,1,'{\"title\":\"Prior native Case\"}'::jsonb)", [caseId]);
      await setup.query("INSERT INTO plan_items (plan_id,testcase_id) VALUES ($1,$2)", [planId, caseId]);
      await setup.query("INSERT INTO knowledge_document_versions (document_id,version_number,title,content_text,created_by) VALUES ($1,1,'Prior native document','Keep prior content',$2)", [documentId, owner]);
      // A persisted Model Studio draft, so the read tool is served against real native rows.
      lockedModelId = (await setup.query(
        "INSERT INTO mbt_models (project_id, name, created_by) VALUES ($1,'Native locked model',$2) RETURNING id",
        [locked, owner]
      )).rows[0].id;
      await setup.query(
        `INSERT INTO mbt_model_revisions (model_id, project_id, revision_number, content, content_hash, status, created_by)
         VALUES ($1,$2,1,$3::jsonb,$4,'draft',$5)`,
        [
          lockedModelId,
          locked,
          JSON.stringify({
            schemaVersion: "tesbo-fsm-draft/1",
            semantics: "SEQUENTIAL_FSM",
            initialStateId: "start",
            states: [{ id: "start", label: "Start" }],
            transitions: []
          }),
          "a".repeat(64),
          owner
        ]
      );
      await setup.query("INSERT INTO attachments (project_id,entity_type,entity_id,file_name,content_type,file_size,storage_path,uploaded_by) VALUES ($1,'execution',$2,'keep.txt','text/plain',4,'ci/mcp-lock/keep',$3)", [locked, executionId, owner]);
      quota = jest.spyOn(limits, "assertProjectWritable");
      // The schedule worker is not under test here (EXO-A-08b covers it); it must not sweep while this
      // suite manipulates rows directly.
      process.env.SCHEDULES_WORKER_DISABLED = "1";
      const module = await Test.createTestingModule({
        controllers: [McpController, LegacyController, ModelStudioPreviewController, SchedulesController],
        providers: [McpService, ModelStudioPreview, ModelStudioRepository, SchedulesService,
          { provide: DatabaseService, useValue: db }, { provide: LegacyService, useValue: legacy },
          { provide: PlanLimitsService, useValue: limits },
          { provide: ProjectLookupService, useValue: new ProjectLookupService(db, requestCache) },
          { provide: CustomFieldsService, useValue: {} }, { provide: ZyraProgressService, useValue: {} }, { provide: WelcomeEmailService, useValue: {} },
          { provide: APP_GUARD, useClass: ApiTokenRestGuard }, { provide: APP_GUARD, useClass: ProjectWriteLockGuard }
        ]
      }).compile();
      app = module.createNestApplication();
      app.useGlobalFilters(new HttpExceptionFilter());
      mcp = module.get(McpService);
      handlers = mcp.listTools().map((tool) => jest.spyOn(tool, "handler"));
      actor = jest.spyOn(mcp, "resolveMcpActorId");
      const auth = new AuthMiddleware(config, otp, tokens);
      const activity = new UserActivityService(db, redis), activityMiddleware = new ActivityMiddleware(activity);
      tracking = jest.spyOn(activity, "recordMutation");
      app.use(cookieParser());
      app.use((_req: unknown, _res: unknown, next: () => void) => requestCache.run(next));
      app.use((req: Parameters<AuthMiddleware["use"]>[0], res: Parameters<AuthMiddleware["use"]>[1], next: Parameters<AuthMiddleware["use"]>[2]) => {
        void auth.use(req, res, next).catch(next);
      });
      app.use(activityMiddleware.use.bind(activityMiddleware));
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      // Prove the real cookie is authenticated before using it for MCP session-only
      // refusals and the human archive escape; do not substitute API-token hashing.
      const browserRead = await fetch(`${base}/api/projects/${locked}`, {
        headers: { Cookie: `${settings.sessionCookieName}=${session}` }
      });
      expect(browserRead.status).toBe(200);
      expect((await browserRead.json()).id).toBe(locked);
    });
    beforeEach(async () => {
      settings.isStripeBillingEnabled = true;
      await setup.query("UPDATE organizations SET plan='launch',plan_source='stripe',plan_override_expires_at=NULL,plan_grace_ends_at=now()-interval '1 day' WHERE id=$1", [organization]);
      await limits.invalidateEntitlementCache(organization);
    });
    afterEach(async () => {
      // Keep the original setup error visible if setup failed before the activity spy existed.
      if (tracking) await Promise.all(tracking.mock.results.filter((result) => result.type === "return").map((result) => result.value));
    });
    afterAll(async () => {
      await app?.close();
      if (previousProposalPreview === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
      else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = previousProposalPreview;
    });
    // Membership replacement permanently invalidates generation-bound fixture tokens.
    // Reissue distinct credentials for later unrelated contract tests; never rebind an old row.
    async function renewLockedFixtureCredentials() {
      token = (await tokens.issueToken(owner, locked, "Native MCP parity replacement", ["read", "write"])).token;
      readToken = (await tokens.issueToken(owner, locked, "Native MCP read replacement", ["read"])).token;
      writeToken = (await tokens.issueToken(owner, locked, "Native MCP write replacement", ["write"])).token;
      const credentials = await setup.query("SELECT id, name, scopes FROM api_tokens WHERE project_id = $1", [locked]);
      const clients = credentials.rows.map(item => ({ tokenId: item.id, clientName: item.name,
        scopes: item.scopes.split(","), allowedTools: null, expiresAt: null }));
      await setup.query("UPDATE projects SET settings = jsonb_set(COALESCE(settings,'{}'::jsonb), '{externalMcpAccess}', $2::jsonb) WHERE id = $1",
        [locked, JSON.stringify({ enabled: true, revision: 1, clients })]);
    }

    it("CL-T03 refuses write credential issuance after a manager is demoted while issuance waits on membership", async () => {
      const manager = randomUUID();
      const name = `CL-T03-${manager}`;
      await setup.query("INSERT INTO users (id,email,name,active_organization_id) VALUES ($1,$2,'CL-T03 manager',$3)", [manager, `cl-t03-${manager}@tesbo.invalid`, organization]);
      await setup.query("INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'manager')", [organization, manager]);
      await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'manager')", [project, manager]);
      // Actual LegacyService authorization and actual token persistence, with no mocked role or SQL.
      const issuer = makeLegacy(db, { config, apiTokens: tokens });
      const control = await issuer.createApiKey(manager, project, { name: name + "-control", scopes: ["read", "write"] });
      expect(control.scopes).toEqual(["read", "write"]);
      const rows = async () => (await setup.query("SELECT id,name,scopes FROM api_tokens WHERE project_id=$1 AND user_id=$2 ORDER BY id", [project, manager])).rows;
      const before = await rows();
      const blocker = new Client({ connectionString: url });
      await blocker.connect();
      let pending: Promise<{ error: unknown }> | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2", [project, manager]);
        const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
        // The uncommitted demotion leaves the old manager role visible to ordinary preflight SELECT.
        pending = issuer.createApiKey(manager, project, { name, scopes: ["write"] })
          .then(() => ({ error: null }), (error: unknown) => ({ error }));
        const deadline = Date.now() + 5000;
        let blocked = false;
        while (Date.now() < deadline && !blocked) {
          blocked = (await setup.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$2 AND wait_event_type='Lock' AND $1=ANY(pg_blocking_pids(pid))", [pid, poolApplicationName])).rowCount! > 0;
          if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(blocked).toBe(true);
        expect(await rows()).toEqual(before);
        await blocker.query("COMMIT");
        const outcome = await pending;
        expect(outcome.error).toMatchObject({ status: 403 });
        expect(await rows()).toEqual(before);
        // Current QA role may still mint a read credential; do not solve by denying all issuance.
        const read = await issuer.createApiKey(manager, project, { name: name + "-read", scopes: ["read"] });
        expect(read.scopes).toEqual(["read"]);
      } finally {
        await blocker.query("ROLLBACK");
        await pending;
        await blocker.end();
        await setup.query("DELETE FROM api_tokens WHERE project_id=$1 AND user_id=$2", [project, manager]);
        await setup.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [project, manager]);
        await setup.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2", [organization, manager]);
        await setup.query("DELETE FROM users WHERE id=$1", [manager]);
      }
    }, 15_000);

    const routes = ["dynamic", "project-prefixed"] as const;
    const business = async () => (await setup.query("SELECT * FROM bugs WHERE project_id=$1 ORDER BY id", [locked])).rows;
    type Options = { token?: string | null; project?: string; session?: string; notification?: boolean };
    const endpoint = (route: typeof routes[number], id = locked) => `${base}${route === "dynamic" ? "/api/mcp" : `/api/projects/${id}/mcp`}`;
    async function send(route: typeof routes[number], method: string, params?: Record<string, unknown>, options: Options = {}) {
      const credential = options.token === undefined ? token : options.token;
      return fetch(endpoint(route, options.project), {
        method: "POST", headers: { ...(credential ? { Authorization: `Bearer ${credential}` } : {}), "content-type": "application/json",
          ...(options.session ? { "Mcp-Session-Id": options.session } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", ...(options.notification ? {} : { id: 7 }), method, params })
      });
    }
    async function rpc(route: typeof routes[number], method: string, params?: Record<string, unknown>, options: Options = {}) {
      const response = await send(route, method, params, options);
      return { status: response.status, body: await response.json() as Record<string, any> };
    }
    it.each(routes)("keeps discovery available on a locked project through %s", async (route) => {
      const before = await business(), response = await rpc(route, "tools/list");
      expect(await business()).toEqual(before);
      expect(response.status).toBe(201);
      expect(response.body.error).toBeUndefined();
      expect(response.body.result.tools.map((tool: { name: string }) => tool.name)).toContain("create_bug");
    });
    it.each(routes)("refuses a valid write through %s before any persisted business change", async (route) => {
      const before = await business(), response = await rpc(route, "tools/call", { name: "create_bug", arguments: { title: "Must never be created while locked" } });
      // One comparison exposes both the wire contract and any actually persisted write in red CI.
      expect({ ...response, business: await business() }).toEqual({
        status: 201, body: { jsonrpc: "2.0", id: 7, error: { code: -32003,
          message: expect.stringContaining("This project is read-only") } }, business: before
      });
    });

    it("keeps native model availability readable while the real project lock refuses preview before validation", async () => {
      const before = await businessState(), endpoint = `${base}/api/projects/${locked}/agents/zyra/changes/model-preview`;
      const validator = jest.spyOn(app.get(ModelStudioPreview), "previewForUser");
      const read = await fetch(endpoint, { headers: { Authorization: `Bearer ${readToken}` } });
      expect(read.status).toBe(200);
      expect(await read.json()).toMatchObject({ schemaVersion: "tesbo-fsm-preview-availability/1", enabled: expect.any(Boolean),
        semantics: "SEQUENTIAL_FSM", maxStates: 32, maxTransitions: 64 });
      const credentials: Record<string, string>[] = [
        { Authorization: `Bearer ${writeToken}` }, { Cookie: `${settings.sessionCookieName}=${session}` }
      ];
      for (const headers of credentials) {
        const response = await fetch(endpoint, { method: "POST", headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "start",
            states: [{ id: "start", label: "Start" }], transitions: [] }) });
        expect(response.status).toBe(403);
        expect((await response.json() as { error: string }).error).toContain("This project is read-only");
      }
      expect(validator).not.toHaveBeenCalled();
      expect(await businessState()).toEqual(before);
    });

    const writes: Record<string, () => Record<string, unknown>> = {
      preview_behavior_model_draft: () => ({ model: { schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM",
        initialStateId: "start", states: [{ id: "start", label: "Start" }], transitions: [] } }),
      capture_qa_graph_change: () => ({}),
      create_testcase: () => ({ title: "Blocked creation", suiteId }),
      update_testcase: () => ({ testcaseId: caseId, title: "Blocked edit" }),
      archive_testcase: () => ({ testcaseId: caseId }), restore_testcase: () => ({ testcaseId: caseId }),
      duplicate_testcase: () => ({ testcaseId: caseId }),
      bulk_create_testcases: () => ({ testcases: [{ title: "Blocked prefix" }, { title: "Blocked suffix" }] }),
      bulk_update_testcases: () => ({ testcaseIds: [caseId, foreignCase], priority: "P0" }),
      bulk_archive_testcases: () => ({ testcaseIds: [caseId, foreignCase] }),
      link_requirement_to_testcase: () => ({ testcaseId: caseId, jiraIssueKey: "LOCK-1" }),
      unlink_requirement_from_testcase: () => ({ testcaseId: caseId, provider: "jira" }),
      create_suite: () => ({ name: "Blocked Suite" }), update_suite: () => ({ suiteId, name: "Blocked rename" }),
      clone_test_suite: () => ({ suiteId, name: "Blocked clone" }),
      create_cycle_from_plan: () => ({ name: "Blocked Run", planId }),
      create_cycle_from_testcases: () => ({ name: "Blocked Run", testcaseIds: [caseId, foreignCase] }),
      record_execution_result: () => ({ executionId, status: "Failed" }),
      update_execution_result: () => ({ executionId, status: "Failed" }),
      bulk_record_execution_results: () => ({ results: [{ executionId, status: "Failed" }, { executionId: randomUUID(), status: "Passed" }] }),
      create_bug: () => ({ title: "Blocked Bug", links: [{ testcaseId: caseId, cycleId: runId, executionId }] }),
      update_bug: () => ({ bugId, title: "Blocked Bug edit" }),
      link_testcase_to_bug: () => ({ bugId, testcaseId: caseId, cycleId: runId, executionId }),
      unlink_testcase_from_bug: () => ({ bugId, testcaseId: caseId, cycleId: runId }),
      create_knowledge_document: () => ({ title: "Blocked document", folderId }),
      update_knowledge_document: () => ({ documentId, title: "Blocked document edit" }),
      move_knowledge_document: () => ({ documentId, folderId }),
      archive_knowledge_document: () => ({ documentId }), restore_knowledge_document: () => ({ documentId }),
      create_knowledge_folder: () => ({ name: "Blocked folder", parentFolderId: folderId }),
      update_knowledge_folder: () => ({ folderId, description: "Blocked edit" }),
      move_knowledge_folder: () => ({ folderId, parentFolderId: folderId }),
      create_behavior_model: () => ({
        name: "Blocked model",
        model: {
          schemaVersion: "tesbo-fsm-draft/1",
          semantics: "SEQUENTIAL_FSM",
          initialStateId: "start",
          states: [{ id: "start", label: "Start" }],
          transitions: []
        }
      }),
      save_behavior_model_revision: () => ({
        modelId: lockedModelId,
        baseRevisionId: randomUUID(),
        model: {
          schemaVersion: "tesbo-fsm-draft/1",
          semantics: "SEQUENTIAL_FSM",
          initialStateId: "start",
          states: [{ id: "start", label: "Start" }],
          transitions: []
        }
      }),
      link_behavior_model_case: () => ({
        modelId: lockedModelId,
        revisionId: randomUUID(),
        testcaseId: caseId,
        elementIds: ["start"]
      }),
      archive_behavior_model: () => ({ modelId: lockedModelId }),
      run_behavior_model: () => ({ modelId: lockedModelId, revisionId: randomUUID() })
    };
    const reads: Record<string, () => { args: Record<string, unknown>; expected: unknown }> = {
      list_qa_graph_changes: () => ({ args: {}, expected: { entries: [], nextBeforeId: null } }),
      list_projects: () => ({ args: {}, expected: { projects: [expect.objectContaining({ id: locked })] } }),
      list_testcases: () => ({ args: {}, expected: expect.objectContaining({ rows: expect.arrayContaining([expect.objectContaining({ id: caseId })]) }) }),
      get_testcase: () => ({ args: { testcaseId: caseId }, expected: expect.objectContaining({ id: caseId }) }),
      get_testcase_bugs: () => ({ args: { testcaseId: caseId }, expected: { bugs: expect.arrayContaining([expect.objectContaining({ id: bugId })]) } }),
      get_testcase_executions: () => ({ args: { testcaseId: caseId }, expected: { executions: expect.arrayContaining([expect.objectContaining({ id: executionId, status: "Passed" })]) } }),
      list_suites: () => ({ args: {}, expected: { suites: expect.arrayContaining([expect.objectContaining({ id: suiteId })]) } }),
      get_suite: () => ({ args: { suiteId }, expected: expect.objectContaining({ id: suiteId }) }),
      list_test_cycles: () => ({ args: {}, expected: { cycles: expect.arrayContaining([expect.objectContaining({ id: runId })]) } }),
      get_test_cycle: () => ({ args: { cycleId: runId }, expected: expect.objectContaining({ id: runId, plan: expect.objectContaining({ id: planId }) }) }),
      list_executions: () => ({ args: { cycleId: runId }, expected: { executions: expect.arrayContaining([expect.objectContaining({ id: executionId, status: "Passed" })]) } }),
      get_execution: () => ({ args: { executionId }, expected: expect.objectContaining({ id: executionId, status: "Passed", history: [{ status: "Blocked" }] }) }),
      get_test_execution_summary: () => ({ args: {}, expected: expect.objectContaining({ scope: "project", total: 1, Passed: 1 }) }),
      list_bugs: () => ({ args: {}, expected: { bugs: expect.arrayContaining([expect.objectContaining({ id: bugId })]) } }),
      get_bug: () => ({ args: { bugId }, expected: expect.objectContaining({ id: bugId }) }),
      get_requirement_matrix: () => ({ args: {}, expected: { rows: expect.arrayContaining([expect.objectContaining({ testcaseId: caseId, runId, executionId })]) } }),
      search_knowledge_base: () => ({ args: { q: "Native locked document" }, expected: expect.objectContaining({ list: expect.arrayContaining([expect.objectContaining({ id: documentId })]) }) }),
      list_knowledge_documents: () => ({ args: {}, expected: expect.objectContaining({ list: expect.arrayContaining([expect.objectContaining({ id: documentId })]) }) }),
      get_knowledge_document: () => ({ args: { documentId }, expected: expect.objectContaining({ id: documentId, contentText: "Preserve locked content" }) }),
      list_knowledge_folders: () => ({ args: {}, expected: expect.objectContaining({ id: folderId, isRoot: true }) }),
      get_knowledge_folder: () => ({ args: { folderId }, expected: expect.objectContaining({ id: folderId, isRoot: true }) }),
      get_behavior_model_coverage: () => ({
        args: { modelId: lockedModelId },
        expected: expect.objectContaining({
          modelId: lockedModelId,
          elements: [{ id: "start", linkedCases: 0 }],
          links: [],
          unlinkedElements: ["start"],
          coverageAssertion: "none",
          executionAssertion: "none"
        })
      })
    };
    async function businessState() {
      const ids = [project, other, locked], state: Record<string, unknown> = {};
      // Retain the full project row, including review/consent counters: denied operations must
      // preserve governing state too. The permitted Bug control changes only its row and audit.
      state.projects = (await setup.query(
        "SELECT * FROM projects WHERE id=ANY($1::uuid[]) ORDER BY id", [ids]
      )).rows;
      for (const table of ["suites", "testcases", "plans", "cycles", "bugs", "knowledge_folders", "knowledge_documents", "knowledge_files", "attachments", "audit_logs"]) {
        state[table] = (await setup.query(`SELECT * FROM ${table} WHERE project_id=ANY($1::uuid[]) ORDER BY id`, [ids])).rows;
      }
      state.versions = (await setup.query("SELECT v.* FROM testcase_versions v JOIN testcases t ON t.id=v.testcase_id WHERE t.project_id=ANY($1::uuid[]) ORDER BY v.testcase_id,v.version", [ids])).rows;
      state.planItems = (await setup.query("SELECT i.* FROM plan_items i JOIN plans p ON p.id=i.plan_id WHERE p.project_id=ANY($1::uuid[]) ORDER BY i.id", [ids])).rows;
      state.runItems = (await setup.query("SELECT i.* FROM cycle_items i JOIN cycles c ON c.id=i.cycle_id WHERE c.project_id=ANY($1::uuid[]) ORDER BY i.id", [ids])).rows;
      state.results = (await setup.query("SELECT e.* FROM executions e JOIN cycle_items i ON i.id=e.cycle_item_id JOIN cycles c ON c.id=i.cycle_id WHERE c.project_id=ANY($1::uuid[]) ORDER BY e.id", [ids])).rows;
      state.links = (await setup.query("SELECT l.* FROM bug_links l JOIN bugs b ON b.id=l.bug_id WHERE b.project_id=ANY($1::uuid[]) ORDER BY l.id", [ids])).rows;
      state.retestRequests = (await setup.query("SELECT * FROM cycle_retest_requests WHERE project_id=ANY($1::uuid[]) ORDER BY project_id,request_key",[ids])).rows;
      state.documentVersions = (await setup.query("SELECT v.* FROM knowledge_document_versions v JOIN knowledge_documents d ON d.id=v.document_id WHERE d.project_id=ANY($1::uuid[]) ORDER BY v.id", [ids])).rows;
      return state;
    }
    const noHandler = () => { for (const handler of handlers) expect(handler).not.toHaveBeenCalled(); expect(actor).not.toHaveBeenCalled(); };
    const denied = (response: Awaited<ReturnType<typeof rpc>>) => expect(response).toEqual({
      status: 201, body: { jsonrpc: "2.0", id: 7, error: { code: -32003, message: expect.stringContaining("This project is read-only") } }
    });
    it("covers every current registry classification explicitly, rather than sampling write/read names", () => {
      for (const [scope, cases] of [["write", writes], ["read", reads]] as const) {
        expect(Object.keys(cases).sort()).toEqual(mcp.listTools().filter((tool) => tool.requiredScope === scope && !tool.proposalPreviewOnly).map((tool) => tool.name).sort());
      }
      // 24 active writers, including governed runs; 13 retired testcase/dependency publishers.
      expect(Object.keys(writes).filter(name => !DIRECT_TESTCASE_PUBLISHERS.has(name))).toHaveLength(24);
      expect(Object.keys(writes).filter(name => DIRECT_TESTCASE_PUBLISHERS.has(name))).toHaveLength(13);
      expect(Object.keys(reads)).toHaveLength(22);
    });
    describe.each(routes)("%s full registry", (route) => {
      it.each(Object.keys(writes).filter(name => !DIRECT_TESTCASE_PUBLISHERS.has(name)))("blocks active writer %s before its handler", async (name) => {
        const before = await businessState();
        denied(await rpc(route, "tools/call", { name, arguments: writes[name]() }));
        expect(quota).toHaveBeenCalledTimes(1); expect(quota).toHaveBeenCalledWith(organization, locked);
        noHandler(); expect(await businessState()).toEqual(before);
      });
      it.each(Array.from(DIRECT_TESTCASE_PUBLISHERS))("refuses cached publisher %s before billing, actor or native writes", async (name) => {
        const before = await businessState();
        const response = await rpc(route, "tools/call", { name, arguments: writes[name]() });
        expect(response.status).toBe(201);
        expect(response.body.error).toMatchObject({ code: -32003, data: {
          code: "HUMAN_PUBLICATION_REQUIRED", stagingAvailable: false, stageTool: null, stageEndpoint: null
        } });
        expect(quota).not.toHaveBeenCalled(); noHandler(); expect(await businessState()).toEqual(before);
      });
      it.each(["stage_testcase_changes", "list_testcase_proposals", "get_testcase_proposal_task"])("keeps preview tool %s unavailable without the server flag", async (name) => {
        const before = await businessState();
        const response = await rpc(route, "tools/call", { name, arguments: { requestKey: "cannot-enable", operations: [], enabled: true } });
        expect(response.status).toBe(201);
        expect(response.body.error.data).toEqual({ code: "PROPOSAL_REVIEW_PREVIEW_DISABLED", stagingAvailable: false });
        expect(quota).not.toHaveBeenCalled(); noHandler(); expect(await businessState()).toEqual(before);
      });
      it.each(Object.keys(reads))("serves %s with a read-only token and preserves all business/history rows", async (name) => {
        const before = await businessState(), input = reads[name]();
        const response = await rpc(route, "tools/call", { name, arguments: input.args }, { token: readToken });
        expect(response.status).toBe(201); expect(response.body.error).toBeUndefined();
        expect(response.body.result.isError).toBe(false);
        expect(JSON.parse(response.body.result.content[0].text)).toEqual(input.expected);
        expect(quota).not.toHaveBeenCalled(); expect(actor).not.toHaveBeenCalled();
        expect(await businessState()).toEqual(before);
      });
    });

    describe.each(routes)("%s authorization and transport controls", (route) => {
      it("preserves scope denials, unknown-tool/method errors and real issuer membership before entitlement checks", async () => {
        const before = await businessState();
        expect((await rpc(route, "tools/list", {}, { token: writeToken })).body.result.tools.map((tool: { name: string }) => tool.name))
          .toEqual(mcp.listTools().filter(tool => tool.requiredScope === "write" && !tool.hiddenFromDiscovery && !tool.proposalPreviewOnly).map(tool => tool.name));
        for (const [method, params, credential, code] of [
          ["tools/call", { name: "create_bug", arguments: { title: "No permission" } }, readToken, -32002],
          ["tools/call", { name: "list_testcases", arguments: {} }, writeToken, -32002],
          ["tools/call", { name: "not_a_tool" }, token, -32601],
          ["not_a_method", {}, token, -32601]
        ] as const) {
          const response = await rpc(route, method, params, { token: credential });
          expect(response.status).toBe(201); expect(response.body.error.code).toBe(code);
        }
        const retiredToken = token;
        await setup.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [locked, owner]);
        try {
          const response = await rpc(route, "tools/call", { name: "create_bug", arguments: { title: "Revoked issuer" } });
          expect(response.status).toBe(401);
        } finally {
          await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [locked, owner]);
          try {
            // Still denied after rejoin, even with the original named grant intact.
            expect((await rpc(route, "tools/list", {}, { token: retiredToken })).status).toBe(401);
            expect(quota).not.toHaveBeenCalled(); noHandler(); expect(await businessState()).toEqual(before);
          } finally { await renewLockedFixtureCredentials(); }
        }
        expect((await rpc(route, "tools/list", {}, { token })).status).toBe(201);
        expect((await rpc(route, "tools/list", {}, { token: retiredToken })).status).toBe(401);
      });
      it("keeps genuine browser-only, invalid bearer and revoked-token calls out of the machine surface", async () => {
        const before = await businessState();
        const temporary = await tokens.issueToken(owner, locked, "Revocation control", ["read", "write"]);
        await tokens.revokeToken(locked, temporary.id);
        for (const credential of [null, "tsbo_invalid", temporary.token]) {
          const response = await fetch(endpoint(route), { method: "POST", headers: {
            "content-type": "application/json", Cookie: `${settings.sessionCookieName}=${session}`,
            ...(credential ? { Authorization: `Bearer ${credential}` } : {})
          }, body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }) });
          expect(response.status).toBe(401);
        }
        expect(quota).not.toHaveBeenCalled(); noHandler(); expect(await businessState()).toEqual(before);
      });
      it("retains initialization, ping, current/no-session calls, stale-session recovery, notifications and method refusal", async () => {
        const before = await businessState();
        const initialized = await send(route, "initialize", { protocolVersion: "2025-06-18" }, { token: readToken });
        expect(initialized.status).toBe(201);
        expect((await initialized.json()).result.protocolVersion).toBe("2025-06-18");
        const current = initialized.headers.get("mcp-session-id")!;
        expect(current).toMatch(/^[a-f0-9]{16}\.[a-f0-9-]{36}$/);
        expect(await rpc(route, "ping", {}, { token: readToken, session: current })).toEqual({ status: 201, body: { jsonrpc: "2.0", id: 7, result: {} } });
        expect((await rpc(route, "tools/list", {}, { token: readToken, session: current })).body.result.tools).toHaveLength(22);
        // The default fixture token carries read+write: 22 read and 24 active write tools.
        expect((await rpc(route, "tools/list")).body.result.tools).toHaveLength(46);
        const trailing = await fetch(`${endpoint(route)}/?native=1`, { method: "POST", headers: {
          Authorization: `Bearer ${readToken}`, "content-type": "application/json"
        }, body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }) });
        expect(trailing.status).toBe(201);
        expect((await trailing.json()).result.tools.map((tool: { name: string }) => tool.name))
          .toEqual(mcp.listTools().filter(tool => tool.requiredScope === "read" && !tool.proposalPreviewOnly).map(tool => tool.name));
        const stale = "0000000000000000.11111111-2222-4333-8444-555555555555";
        const refused = await rpc(route, "tools/call", { name: "create_bug", arguments: { title: "Stale call" } }, { session: stale });
        expect(refused.status).toBe(404); expect(refused.body.error.code).toBe(-32004);
        const recovered = await send(route, "initialize", {}, { session: stale });
        expect(recovered.status).toBe(201); expect(recovered.headers.get("mcp-session-id")).not.toBe(stale);
        const note = await send(route, "notifications/initialized", {}, { token: readToken, session: current, notification: true });
        expect(note.status).toBe(202); expect(await note.text()).toBe("");
        for (const method of ["GET", "DELETE"]) {
          const response = await fetch(endpoint(route), { method, headers: { Authorization: `Bearer ${token}` } });
          expect(response.status).toBe(405); expect(response.headers.get("allow")).toBe("POST");
        }
        expect(quota).not.toHaveBeenCalled(); noHandler(); expect(await businessState()).toEqual(before);
      });
      it.each(["Pro", "grace", "billing disabled", "within allowance"])("preserves a real persisted write for %s", async (mode) => {
        if (mode === "Pro") await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]);
        if (mode === "grace") await setup.query("UPDATE organizations SET plan_grace_ends_at=now()+interval '1 day' WHERE id=$1", [organization]);
        if (mode === "billing disabled") settings.isStripeBillingEnabled = false;
        await limits.invalidateEntitlementCache(organization);
        const target = mode === "within allowance" ? project : locked;
        const before = await businessState(), name = `Allowed ${route} ${mode}`;
        const response = await rpc(route, "tools/call", { name: "create_bug", arguments: { title: name } }, {
          token: mode === "within allowance" ? writableToken : token, project: target
        });
        expect(response.status).toBe(201); expect(response.body.error).toBeUndefined();
        const result = JSON.parse(response.body.result.content[0].text);
        expect((await setup.query("SELECT title,project_id FROM bugs WHERE id=$1", [result.id])).rows).toEqual([{ title: name, project_id: target }]);
        const after = await businessState();
        expect((after.bugs as unknown[]).length).toBe((before.bugs as unknown[]).length + 1);
        const previousAudit = new Set((before.audit_logs as Array<{ id: string }>).map(row => row.id));
        const newAudit = (after.audit_logs as Array<Record<string, unknown>>).filter(row => !previousAudit.has(String(row.id)));
        expect(newAudit).toEqual([expect.objectContaining({ entity_type: "bug", entity_id: result.id,
          action: "bug_created", actor_id: owner, project_id: target })]);
        expect({ ...after, bugs: before.bugs, audit_logs: before.audit_logs }).toEqual(before);
        expect(quota).toHaveBeenCalledWith(organization, target);
      });
      it("uses the authenticated project, not project/organization values inside tool arguments", async () => {
        const before = await businessState();
        denied(await rpc(route, "tools/call", { name: "create_bug", arguments: { title: "Spoofed", projectId: project, organizationId: randomUUID() } }));
        expect(quota).toHaveBeenCalledWith(organization, locked); noHandler(); expect(await businessState()).toEqual(before);
      });
      it("falls back to PostgreSQL if Redis fails and does not mislabel an actual PostgreSQL failure as a plan denial", async () => {
        const before = await businessState();
        (redis.get as jest.Mock).mockRejectedValueOnce(new Error("Controlled Redis read failure"));
        (redis.set as jest.Mock).mockRejectedValueOnce(new Error("Controlled Redis write failure"));
        denied(await rpc(route, "tools/call", { name: "create_bug", arguments: { title: "Cache failure" } }));
        quota.mockImplementationOnce(async () => { await db.query("SELECT 1 / 0"); });
        const failed = await rpc(route, "tools/call", { name: "create_bug", arguments: { title: "Database failure" } });
        expect(failed).toEqual({ status: 201, body: { jsonrpc: "2.0", id: 7, error: { code: -32603, message: "Internal error" } } });
        noHandler(); expect(await businessState()).toEqual(before);
      });
    });
    it("refuses a token on another project's URL before consulting that project's entitlement", async () => {
      const before = await businessState();
      const response = await rpc("project-prefixed", "tools/list", {}, { project: other });
      expect(response.status).toBe(201); expect(response.body.error.code).toBe(-32001);
      expect(quota).not.toHaveBeenCalled(); noHandler(); expect(await businessState()).toEqual(before);
    });
    it("keeps ordinary project-prefixed REST writes under the existing HTTP 403 lock", async () => {
      const before = await businessState();
      const response = await fetch(`${base}/api/projects/${locked}/bugs`, { method: "POST", headers: {
        Authorization: `Bearer ${writeToken}`, "content-type": "application/json"
      }, body: JSON.stringify({ title: "REST remains locked" }) });
      expect(response.status).toBe(403); expect((await response.json()).error).toContain("This project is read-only");
      expect(quota).toHaveBeenCalledWith(organization, locked); noHandler(); expect(await businessState()).toEqual(before);
    });
    it("keeps the existing entitlement cache and explicit invalidation semantics, without waiting out or changing its TTL", async () => {
      await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]);
      await limits.invalidateEntitlementCache(organization);
      const input = { name: "create_bug", arguments: { title: "Warm Pro cache" } };
      expect((await rpc("dynamic", "tools/call", input)).body.error).toBeUndefined();
      expect(redis.set).toHaveBeenCalledWith(`entitlement:${organization}`, expect.any(String), "EX", 45);
      await setup.query("UPDATE organizations SET plan='launch' WHERE id=$1", [organization]);
      // Direct SQL intentionally does not invalidate Redis; this pins the existing cached snapshot,
      // not acceptance of a new consistency policy or a real Redis-expiry experiment.
      expect((await rpc("project-prefixed", "tools/call", { ...input, arguments: { title: "Existing cached snapshot" } })).body.error).toBeUndefined();
      await limits.invalidateEntitlementCache(organization);
      denied(await rpc("dynamic", "tools/call", input));
    });
    it("retains expired-admin-override retirement and the one-time billing notice without changing business rows", async () => {
      // A comp expiry opens no grace. Start without a previous downgrade deadline so the
      // later, separate grace-ended scenario owns the one-time notice assertion.
      await setup.query("UPDATE organizations SET plan='pro',plan_source='admin',plan_override_expires_at=now()-interval '1 day',plan_grace_ends_at=NULL,grace_locked_notified_at=NULL WHERE id=$1", [organization]);
      await limits.invalidateEntitlementCache(organization);
      const before = await businessState();
      denied(await rpc("dynamic", "tools/call", { name: "create_bug", arguments: { title: "Expired grant" } }));
      expect((await setup.query("SELECT plan,plan_source,plan_grace_ends_at,plan_override_expires_at FROM organizations WHERE id=$1", [organization])).rows[0])
        .toEqual({ plan: "launch", plan_source: "stripe", plan_grace_ends_at: null, plan_override_expires_at: null });
      expect((await setup.query("SELECT count(*)::int AS count FROM audit_logs WHERE organization_id=$1 AND action='billing_downgraded'", [organization])).rows[0].count).toBe(1);
      expect(email.sendGraceEnded).not.toHaveBeenCalled();
      await setup.query("UPDATE organizations SET plan_grace_ends_at=now()-interval '1 day' WHERE id=$1", [organization]);
      await limits.invalidateEntitlementCache(organization);
      const notices = (await setup.query("SELECT count(*)::int AS count FROM audit_logs WHERE organization_id=$1 AND action='billing_limits_enforced'", [organization])).rows[0].count;
      for (const route of routes) denied(await rpc(route, "tools/call", { name: "create_bug", arguments: { title: "One notice" } }));
      expect(email.sendGraceEnded).toHaveBeenCalledTimes(1);
      expect((await setup.query("SELECT count(*)::int AS count FROM audit_logs WHERE organization_id=$1 AND action='billing_limits_enforced'", [organization])).rows[0].count).toBe(notices + 1);
      noHandler(); expect(await businessState()).toEqual(before);
    });
    it("preserves real token usage, workspace-pointer self-healing and activity metadata on an MCP denial", async () => {
      const observed = jest.spyOn(db, "query");
      try {
        await setup.query("UPDATE users SET active_organization_id=NULL,last_active_at='2000-01-01' WHERE id=$1", [owner]);
        for (const key of cache.keys()) if (key.startsWith("activity:")) cache.delete(key);
        const before = await businessState();
        denied(await rpc("dynamic", "tools/call", { name: "create_bug", arguments: { title: "Metadata only" } }));
        await Promise.all(tracking.mock.results.filter((result) => result.type === "return").map((result) => result.value));
        await Promise.all(observed.mock.results.filter((result) => result.type === "return").map((result) => result.value));
        expect(tracking).toHaveBeenCalledWith(owner);
        expect((await setup.query("SELECT active_organization_id,last_active_at > '2000-01-01' AS active FROM users WHERE id=$1", [owner])).rows[0])
          .toEqual({ active_organization_id: organization, active: true });
        expect((await setup.query("SELECT last_used_at FROM api_tokens WHERE token_hash=$1", [tokens.hashToken(token)])).rows[0].last_used_at).not.toBeNull();
        noHandler(); expect(await businessState()).toEqual(before);
      } finally { observed.mockRestore(); }
    });
    it("retains the human project-archive escape and lets the next project become writable without a new token", async () => {
      const refused = await fetch(`${base}/api/projects/${locked}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      expect(refused.status).toBe(403); // Machine tokens still cannot administer projects.
      const archived = await fetch(`${base}/api/projects/${other}`, { method: "DELETE", headers: { Cookie: `${settings.sessionCookieName}=${session}` } });
      try {
        expect(archived.status).toBe(200);
        expect((await setup.query("SELECT archived_at FROM projects WHERE id=$1", [other])).rows[0].archived_at).not.toBeNull();
        const response = await rpc("dynamic", "tools/call", { name: "create_bug", arguments: { title: "Unlocked by archive" } });
        expect(response.body.error).toBeUndefined();
        const created = JSON.parse(response.body.result.content[0].text);
        expect((await setup.query("SELECT project_id FROM bugs WHERE id=$1", [created.id])).rows[0].project_id).toBe(locked);
      } finally { await setup.query("UPDATE projects SET archived_at=NULL WHERE id=$1", [other]); }
    });
    it("allows a human to archive the locked project itself but refuses its now-inaccessible token calls", async () => {
      const archived = await fetch(`${base}/api/projects/${locked}`, { method: "DELETE", headers: { Cookie: `${settings.sessionCookieName}=${session}` } });
      try {
        expect(archived.status).toBe(200);
        const response = await rpc("dynamic", "tools/list");
        expect(response.status).toBe(401); expect(quota).not.toHaveBeenCalled(); noHandler();
      } finally { await setup.query("UPDATE projects SET archived_at=NULL WHERE id=$1", [locked]); }
    });

    describe("authenticated REST Plan/Run aliases", () => {
      let restPlan: string, restItem: string, restRun: string, restCase: string, spareCase: string, restExecution: string, restAttachment: string, restRetestDigest: string, restCancelKey: string;
      const retainedTrace = Buffer.from("PK disposable retained trace bytes");
      beforeEach(async () => {
        // Every red-case target is independent: an actually persisted deletion or edit must not
        // make the next reproduction fail on a missing parent instead of its intended lock oracle.
        restPlan = (await setup.query("INSERT INTO plans (project_id,name) VALUES ($1,'REST lock Plan') RETURNING id", [locked])).rows[0].id;
        restCase = (await setup.query("INSERT INTO testcases (project_id,external_id,title,status) VALUES ($1,$2,'REST lock Case','Approved') RETURNING id", [locked, `REST-${randomUUID().slice(0, 24)}`])).rows[0].id;
        await recordReviewedCaseFixture(setup, restCase, owner);
        spareCase = (await setup.query("INSERT INTO testcases (project_id,external_id,title,status) VALUES ($1,$2,'REST spare Case','Approved') RETURNING id", [locked, `REST-${randomUUID().slice(0, 24)}`])).rows[0].id;
        await recordReviewedCaseFixture(setup, spareCase, owner);
        restItem = (await setup.query("INSERT INTO plan_items (plan_id,testcase_id) VALUES ($1,$2) RETURNING id", [restPlan, restCase])).rows[0].id;
        restRun = (await setup.query("INSERT INTO cycles (project_id,plan_id,name) VALUES ($1,$2,'REST lock Run') RETURNING id", [locked, restPlan])).rows[0].id;
        const item = (await setup.query("INSERT INTO cycle_items (cycle_id,testcase_id,snapshot_title) VALUES ($1,$2,'REST retained snapshot') RETURNING id", [restRun, restCase])).rows[0].id;
        restExecution = (await setup.query("INSERT INTO executions (cycle_item_id,status,actual_result,executed_by,history) VALUES ($1,'Passed','Retained REST result',$2,'[{\"status\":\"Blocked\"}]'::jsonb) RETURNING id", [item, owner])).rows[0].id;
        const key = `ci/rest-lock/${restExecution}/retained.zip`;
        await storage.put(key, retainedTrace, "application/zip");
        restAttachment = (await setup.query("INSERT INTO attachments (project_id,entity_type,entity_id,file_name,content_type,file_size,storage_path,uploaded_by) VALUES ($1,'execution',$2,'retained.zip','application/zip',$3,$4,$5) RETURNING id", [locked, restExecution, retainedTrace.length, key, owner])).rows[0].id;
        restRetestDigest = (await legacy.previewNativeRetest(restRun, owner, [restExecution])).previewDigest;
        restCancelKey = randomUUID();
        put.mockClear(); // Seeded content exists on disk; only request-time puts count as side effects.
      });
      const restWrites = {
        "Plan edit": () => ({ method: "PATCH", path: `/api/plans/${restPlan}`, body: { name: "Must not persist" } }),
        "Plan delete": () => ({ method: "DELETE", path: `/api/plans/${restPlan}` }),
        "Plan item add": () => ({ method: "POST", path: `/api/plans/${restPlan}/items`, body: { testcaseId: spareCase } }),
        "Plan item delete": () => ({ method: "DELETE", path: `/api/plans/${restPlan}/items/${restItem}` }),
        "Run edit": () => ({ method: "PATCH", path: `/api/cycles/${restRun}`, body: { name: "Must not persist", status: "In Progress" } }),
        "Run delete": () => ({ method: "DELETE", path: `/api/cycles/${restRun}` }),
        "Run case add": () => ({ method: "POST", path: `/api/cycles/${restRun}/testcases`, body: { testcaseIds: [spareCase] } }),
        "Run case delete": () => ({ method: "DELETE", path: `/api/cycles/${restRun}/testcases/${restCase}` }),
        "Run cases delete": () => ({ method: "POST", path: `/api/cycles/${restRun}/testcases/bulk-delete`, body: { testcaseIds: [restCase] } }),
        "Execution edit": () => ({ method: "PATCH", path: `/api/cycles/${restRun}/executions/${restExecution}`, body: { status: "Failed", actualResult: "Must not persist" } }),
        "Evidence upload": () => ({ method: "POST", path: `/api/cycles/${restRun}/executions/${restExecution}/attachments`, upload: true }),
        "Execution bulk assign": () => ({ method: "POST", path: `/api/cycles/${restRun}/executions/bulk-assign`, body: { executionIds: [restExecution], assigneeId: owner } }),
        "Execution bulk status": () => ({ method: "POST", path: `/api/cycles/${restRun}/executions/bulk-status`, body: { executionIds: [restExecution], status: "Failed" } }),
        "History import": () => ({ method: "POST", path: `/api/cycles/${restRun}/history-import`, body: { run: { status: "Completed" }, results: [{ testcaseId: restCase, status: "Failed", history: [{ status: "Passed" }] }] } }),
        "Sharing enable": () => ({ method: "POST", path: `/api/cycles/${restRun}/share`, body: { enabled: true } }),
        "Retest creation": () => ({ method: "POST", path: `/api/cycles/${restRun}/retests`, body: {
          requestKey: randomUUID(), executionIds: [restExecution], expectedPreviewDigest: restRetestDigest,
          name: "Reviewed retest of retained result", buildVersion: "fixed-disposable-build"
        } })
      } satisfies Record<string, () => { method: string; path: string; body?: unknown; upload?: boolean }>;
      const restRecoveries = {
        "Retest cancellation": () => ({method:"POST",path:`/api/cycles/${restRun}/retests/requests/${restCancelKey}/cancel`,
          body:{...restWrites["Retest creation"]().body,requestKey:restCancelKey}})
      };
      type RestInput = { method: string; path: string; body?: unknown; upload?: boolean };
      async function rest(input: RestInput, headers: Record<string, string> = { Cookie: `${settings.sessionCookieName}=${session}` }) {
        const form = new FormData();
        if (input.upload) form.append("files", new Blob(["Real disposable evidence"], { type: "text/plain" }), "evidence.txt");
        const response = await fetch(`${base}${input.path}`, { method: input.method,
          headers: { ...headers, ...(!input.upload && input.body !== undefined ? { "content-type": "application/json" } : {}) },
          ...(input.upload ? { body: form } : input.body !== undefined ? { body: JSON.stringify(input.body) } : {}) });
        const text = await response.text();
        await Promise.all(productActivity.mock.results.filter((result) => result.type === "return").map((result) => result.value));
        await Promise.all(tracking.mock.results.filter((result) => result.type === "return").map((result) => result.value));
        return { status: response.status, body: text ? response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) as unknown : text : undefined };
      }
      it.each(Object.keys(restWrites) as Array<keyof typeof restWrites>)("refuses %s before business/history/file work", async (name) => {
        const before = await businessState(), input = restWrites[name]();
        const response = await rest(input);
        // Compare wire AND actual committed state together: a red success cannot hide its write.
        expect({ ...response, business: await businessState(), filesWritten: put.mock.calls.length }).toEqual({
          status: 403, body: { error: expect.stringContaining("This project is read-only") }, business: before, filesWritten: 0
        });
        expect(quota).toHaveBeenCalledWith(organization, locked);
        expect(productActivity).not.toHaveBeenCalled(); expect(tracking).not.toHaveBeenCalled();
        for (const handler of restHandlers) expect(handler).not.toHaveBeenCalled();
        expect(storageQuota).not.toHaveBeenCalled(); expect(removeFile).not.toHaveBeenCalled(); expect(notifications).not.toHaveBeenCalled();
      });
      it("accounts for every alias, without mistaking missing frontend helpers for mutations", () => {
        const aliases = Object.getOwnPropertyNames(LegacyController.prototype).flatMap((name) => {
          const handler = Object.getOwnPropertyDescriptor(LegacyController.prototype, name)?.value;
          if (typeof handler !== "function") return [];
          const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
          const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
          return path && /^\/api\/(plans|cycles)\//.test(path) ? [{ path, method }] : [];
        });
        const mutations = aliases.filter(({ method }) => method !== RequestMethod.GET);
        const normalize = (input: RestInput) => `${input.method} ${input.path.replace(restPlan, ":planId").replace(restItem, ":itemId").replace(restRun, ":cycleId").replace(restExecution, ":executionId").replace(restCase, ":testcaseId").replace(restCancelKey, ":requestKey")}`;
        expect(mutations.map(({ path, method }) => `${RequestMethod[method]} ${path}`).sort()).toEqual([...Object.values(restWrites),...Object.values(restRecoveries)].map((input) => normalize(input())).sort());
        expect(aliases).toHaveLength(31);
        expect(aliases.filter(({ method }) => method === RequestMethod.GET)).toHaveLength(14);
        // Run schedules moved to SchedulesController when they stopped being stubs; their auth and
        // contract are covered by e2e/api/execution-ops.spec.ts instead of this alias inventory.
        expect(aliases.filter(({ path }) => path.startsWith("/api/cycles/schedules/"))).toHaveLength(0);
      });
      it.each(Object.keys(restWrites) as Array<keyof typeof restWrites>)("persists an authorized unlocked %s through the same HTTP writer", async (name) => {
        await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]);
        await limits.invalidateEntitlementCache(organization);
        const before = await businessState(), response = await rest(restWrites[name]());
        expect(response.status).toBe(name === "Plan edit" || name === "Plan delete" || name === "Plan item delete" || name === "Run edit" || name === "Run delete" || name === "Run case delete" || name === "Execution edit" ? 200 : 201);
        const after = await businessState();
        expect(after).not.toEqual(before);
        expect(quota).toHaveBeenCalledWith(organization, locked);
        const savedPlan = (after.plans as Array<Record<string, unknown>>).find((row) => row.id === restPlan)!;
        const savedRun = (after.cycles as Array<Record<string, unknown>>).find((row) => row.id === restRun)!;
        const savedExecution = (after.results as Array<Record<string, unknown>>).find((row) => row.id === restExecution)!;
        const savedItem = (after.planItems as Array<Record<string, unknown>>).find((row) => row.id === restItem)!;
        if (name === "Plan edit") expect(savedPlan.name).toBe("Must not persist");
        if (name === "Plan delete") { expect(savedPlan.deleted_at).not.toBeNull(); expect(savedItem.deleted_at).not.toBeNull(); expect(savedRun.deleted_at).toBeNull(); }
        if (name === "Plan item add") expect(after.planItems).toEqual(expect.arrayContaining([expect.objectContaining({ plan_id: restPlan, testcase_id: spareCase, deleted_at: null })]));
        if (name === "Plan item delete") expect(savedItem.deleted_at).not.toBeNull();
        if (name === "Run edit") { expect(savedRun).toMatchObject({ name: "Must not persist", status: "In Progress" }); expect(savedRun.started_at).not.toBeNull(); }
        if (name === "Run delete") { expect(savedRun.deleted_at).not.toBeNull(); expect(savedExecution.deleted_at).not.toBeNull(); }
        if (name === "Run case add") {
          const added = (after.runItems as Array<Record<string, unknown>>).find((row) => row.cycle_id === restRun && row.testcase_id === spareCase)!;
          expect(added).toMatchObject({ deleted_at: null, snapshot_title: "REST spare Case" });
          expect(after.results).toEqual(expect.arrayContaining([expect.objectContaining({ cycle_item_id: added.id, status: "Untested", deleted_at: null })]));
        }
        if (name === "Run case delete" || name === "Run cases delete") expect(savedExecution.deleted_at).not.toBeNull();
        if (name === "Execution edit") expect(savedExecution).toMatchObject({ status: "Failed", actual_result: "Must not persist", executed_by: owner, history: [{ status: "Blocked" }] });
        if (name === "Execution bulk assign") expect(savedExecution).toMatchObject({ assignee_id: owner, executed_by: owner, status: "Passed", history: [{ status: "Blocked" }] });
        if (name === "Execution bulk status") expect(savedExecution).toMatchObject({ status: "Failed", executed_by: owner, history: [{ status: "Blocked" }] });
        if (name === "History import") { expect(savedRun.status).toBe("Completed"); expect(savedExecution).toMatchObject({ status: "Failed", executed_by: owner, history: [{ status: "Passed" }] }); }
        if (name === "Sharing enable") expect(savedRun).toMatchObject({ share_enabled: true, share_token: expect.any(String) });
        if (name === "Retest creation") {
          const receipt = response.body as { cycleId: string; manifest: { occurrences: Array<{ executionId: string; sourceExecutionId: string; sourceEvidence: Array<{ id: string }> }> } };
          expect(receipt.cycleId).not.toBe(restRun);
          expect(savedRun).toEqual((before.cycles as Array<Record<string, unknown>>).find((row) => row.id === restRun));
          expect(savedExecution).toEqual((before.results as Array<Record<string, unknown>>).find((row) => row.id === restExecution));
          const occurrence = receipt.manifest.occurrences[0];
          expect(occurrence.sourceExecutionId).toBe(restExecution);
          expect(occurrence.sourceEvidence).toEqual(expect.arrayContaining([expect.objectContaining({ id: restAttachment })]));
          expect((after.results as Array<Record<string, unknown>>).find((row) => row.id === occurrence.executionId))
            .toMatchObject({ status: "Untested", actual_result: null, executed_by: null });
        }
        if (name === "Evidence upload") {
          expect(put).toHaveBeenCalledTimes(1);
          const saved = (await setup.query("SELECT storage_path FROM attachments WHERE entity_id=$1 AND id<>$2", [restExecution, restAttachment])).rows;
          expect(saved).toHaveLength(1);
          expect(await storage.getBuffer(saved[0].storage_path)).toEqual(Buffer.from("Real disposable evidence"));
        } else expect(put).not.toHaveBeenCalled();
      });
      const restReads = {
        "Plan detail": () => ({ path: `/api/plans/${restPlan}`, expected: expect.objectContaining({ id: restPlan }) }),
        "Plan items": () => ({ path: `/api/plans/${restPlan}/items`, expected: expect.arrayContaining([expect.objectContaining({ id: restItem })]) }),
        "Plan runs": () => ({ path: `/api/plans/${restPlan}/runs`, expected: expect.arrayContaining([expect.objectContaining({ id: restRun })]) }),
        "Plan progress": () => ({ path: `/api/plans/${restPlan}/progress`, expected: expect.objectContaining({ runCount: 1, totalCases: 1 }) }),
        "Run detail": () => ({ path: `/api/cycles/${restRun}`, expected: expect.objectContaining({ id: restRun }) }),
        "Executions": () => ({ path: `/api/cycles/${restRun}/executions`, expected: expect.arrayContaining([expect.objectContaining({ id: restExecution, status: "Passed", history: [{ status: "Blocked" }] })]) }),
        "Evidence list": () => ({ path: `/api/cycles/${restRun}/executions/${restExecution}/attachments`, expected: expect.objectContaining({ total: 1, list: [expect.objectContaining({ id: restAttachment })] }) }),
        "Evidence download": () => ({ path: `/api/cycles/${restRun}/executions/${restExecution}/attachments/${restAttachment}/download`, expected: retainedTrace.toString() }),
        "Trace link": () => ({ path: `/api/cycles/${restRun}/executions/${restExecution}/attachments/${restAttachment}/trace-link`, expected: expect.objectContaining({ token: expect.any(String), expiresAt: expect.any(String) }) }),
        "CSV export": () => ({ path: `/api/cycles/${restRun}/export/csv`, expected: expect.stringContaining("Retained REST result") }),
        "Run summary": () => ({ path: `/api/cycles/${restRun}/report/summary`, expected: { total: 1, passed: 1, failed: 0, blocked: 0, skipped: 0, untested: 0 } }),
        "Retest preview": () => ({ path: `/api/cycles/${restRun}/retests/preview?executionIds=${restExecution}`, expected: expect.objectContaining({ sourceCycleId: restRun, previewDigest: restRetestDigest }) }),
        "Retest list": () => ({ path: `/api/cycles/${restRun}/retests`, expected: [] })
      };
      it.each(Object.keys(restReads) as Array<keyof typeof restReads>)("retains the locked %s read and all stored history", async (name) => {
        const before = await businessState(), input = restReads[name](), response = await rest({ method: "GET", path: input.path });
        expect(response).toEqual({ status: 200, body: input.expected });
        expect(quota).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled();
        expect(await businessState()).toEqual(before);
        if (name === "Trace link") {
          const { token, expiresAt } = response.body as { token: string; expiresAt: string };
          expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(3_590_000);
          expect(Date.parse(expiresAt) - Date.now()).toBeLessThanOrEqual(3_600_000);
          expect(await rest({ method: "GET", path: `/api/public/trace/${token}` }, {})).toEqual({ status: 200, body: retainedTrace.toString() });
          expect((await rest({ method: "GET", path: `/api/public/trace/${token}tampered` }, {})).status).toBe(404);
        }
      });
      it.each(Object.keys(restWrites) as Array<keyof typeof restWrites>)("retains bearer-token exclusion for %s before entitlement work", async (name) => {
        const before = await businessState();
        const response = await rest(restWrites[name](), { Cookie: `${settings.sessionCookieName}=${session}`, Authorization: `Bearer ${token}` });
        expect(response).toEqual({ status: 403, body: { error: "API token is not authorized for this REST project route" } });
        expect(quota).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(productActivity).not.toHaveBeenCalled();
        expect(await businessState()).toEqual(before);
      });
      it("recovers the exact committed retest after the project becomes read-only without creating another Run", async () => {
        await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]);
        await limits.invalidateEntitlementCache(organization);
        const input = restWrites["Retest creation"](), created = await rest(input);
        expect(created.status).toBe(201);
        const receipt = created.body as { cycleId: string; requestKey: string; manifest: unknown };
        await setup.query("UPDATE organizations SET plan='launch' WHERE id=$1", [organization]);
        await limits.invalidateEntitlementCache(organization);
        quota.mockClear();
        const before = await businessState();
        expect(await rest({ method: "GET", path: `/api/cycles/${restRun}/retests/requests/${receipt.requestKey}` }))
          .toEqual({ status: 200, body: { ...(created.body as object), replayed: true } });
        expect(quota).not.toHaveBeenCalled();
        expect(await rest(input)).toEqual({status:201,body:{...(created.body as object),replayed:true}});
        expect(await rest({...input,body:{...input.body,requestKey:randomUUID()}}))
          .toEqual({status:403,body:{error:expect.stringContaining("This project is read-only")}});
        expect(await businessState()).toEqual(before);
      });
      it("records and recovers terminal cancellation while billing is read-only, without a Run or evidence write", async () => {
        const input = restRecoveries["Retest cancellation"](), before = await businessState();
        const cancelled = await rest(input);
        expect(cancelled).toMatchObject({status:201,body:{outcome:"cancelled",projectId:locked,sourceCycleId:restRun,requestKey:restCancelKey,requestedBy:owner}});
        expect(quota).not.toHaveBeenCalled();
        const after = await businessState();
        expect({...after,audit_logs:before.audit_logs,retestRequests:before.retestRequests}).toEqual(before);
        expect((after.retestRequests as Array<Record<string,unknown>>).filter(row => row.request_key === restCancelKey)).toHaveLength(1);
        expect(await rest({method:"GET",path:`/api/cycles/${restRun}/retests/requests/${restCancelKey}`})).toEqual({status:200,body:cancelled.body});
        expect(await rest(input)).toEqual(cancelled);
        const refused = await rest({...restWrites["Retest creation"](),body:input.body});
        expect(refused).toMatchObject({status:409,body:{code:"RETEST_REQUEST_CANCELLED",disposition:cancelled.body}});
        expect(await businessState()).toEqual(after);
        expect(put).not.toHaveBeenCalled();
        expect(quota).not.toHaveBeenCalled();
      });
      it("denies machine-token cancellation before recording any terminal disposition", async () => {
        const before = await businessState();
        expect(await rest(restRecoveries["Retest cancellation"](),{Authorization:`Bearer ${token}`}))
          .toEqual({status:403,body:{error:"API token is not authorized for this REST project route"}});
        expect(await businessState()).toEqual(before);
        expect(quota).not.toHaveBeenCalled();
      });
      it("refuses a retest when billing changes after its real HTTP guard cached Pro and before the source lock releases", async () => {
        // The actual middleware above runs RequestCacheService.run(next), with both its switch
        // and Redis enabled. Invalidating outside this request cannot clear its cached Pro result.
        expect(settings.enableRequestScopedCache).toBe(true);
        await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]);
        await limits.invalidateEntitlementCache(organization);
        const input = restWrites["Retest creation"]();
        const blocker = new Client({ connectionString: url }); await blocker.connect();
        let pending: ReturnType<typeof rest> | undefined;
        try {
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM cycles WHERE id=$1 FOR UPDATE", [restRun]);
          pending = rest(input);
          const deadline = Date.now() + 5000;
          let waiting = false;
          while (Date.now() < deadline) {
            const state = await setup.query(`SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE application_name=$1 AND wait_event_type='Lock' AND query ILIKE '%FROM cycles%FOR UPDATE%'`, [poolApplicationName]);
            if (state.rows[0].n > 0) { waiting = true; break; }
            await new Promise<void>((resolve) => setTimeout(resolve,20));
          }
          expect(waiting).toBe(true);
          expect(quota).toHaveBeenCalledTimes(1);
          expect(JSON.parse(cache.get(`entitlement:${organization}`)!)).toMatchObject({ effectivePlan: "pro" });
          const before = await businessState();
          // A different database connection and async context model the committed billing event.
          await setup.query("UPDATE organizations SET plan='launch',plan_grace_ends_at=now()-interval '1 day' WHERE id=$1", [organization]);
          await limits.invalidateEntitlementCache(organization);
          await blocker.query("COMMIT");
          expect(await pending).toEqual({ status: 403, body: { error: expect.stringContaining("This project is read-only") } });
          expect(await businessState()).toEqual(before);
          expect((await setup.query("SELECT id FROM cycles WHERE retest_request_key=$1", [input.body.requestKey])).rows).toEqual([]);
          expect(put).not.toHaveBeenCalled();
        } finally {
          await blocker.query("ROLLBACK");
          await pending;
          await blocker.end();
        }
      }, 15_000);
      it("preserves missing/invalid credentials and membership/URL ownership before entitlement or input validation", async () => {
        const before = await businessState(), input = { ...restWrites["Plan edit"](), body: { name: "x".repeat(10_000) } };
        expect(await rest(input, {})).toEqual({ status: 400, body: { error: "Authentication required" } });
        expect(await rest(input, { Cookie: `${settings.sessionCookieName}=${session}`, Authorization: "Bearer tsbo_invalid" })).toEqual({ status: 400, body: { error: "Authentication required" } });
        await setup.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [locked, owner]);
        try { expect((await rest(input)).status).toBe(404); }
        finally { await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [locked, owner]); }
        for (const path of [`/api/plans/${randomUUID()}`, "/api/plans/malformed", `/api/cycles/${randomUUID()}`, "/api/cycles/malformed",
          `/api/plans/${planId}/items/${restItem}`, `/api/cycles/${runId}/executions/${restExecution}`,
          `/api/cycles/${runId}/executions/${restExecution}/attachments`]) {
          expect((await rest({ method: path.endsWith("/attachments") ? "POST" : path.includes("/items/") ? "DELETE" : "PATCH", path, body: {} })).status).toBe(404);
        }
        expect(quota).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(productActivity).not.toHaveBeenCalled();
        expect(await businessState()).toEqual(before);
      });
      it("retains the history-import role denial before billing and malformed import validation", async () => {
        await setup.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2", [locked, owner]);
        try {
          expect(await rest({ ...restWrites["History import"](), body: { run: null } })).toEqual({ status: 403, body: { error: "QA Engineers cannot import run history" } });
          expect(quota).not.toHaveBeenCalled(); expect(productActivity).not.toHaveBeenCalled();
        } finally { await setup.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2", [locked, owner]); }
      });
      it.each(["Plan", "Run", "Plan item", "Execution", "Run item"])("refuses a deleted %s URL target before entitlement work", async (kind) => {
        let input: RestInput;
        if (kind === "Plan") { await setup.query("UPDATE plans SET deleted_at=now() WHERE id=$1", [restPlan]); input = restWrites["Plan edit"](); }
        else if (kind === "Plan item") { await setup.query("UPDATE plan_items SET deleted_at=now() WHERE id=$1", [restItem]); input = restWrites["Plan item delete"](); }
        else {
          if (kind === "Run") await setup.query("UPDATE cycles SET deleted_at=now() WHERE id=$1", [restRun]);
          if (kind === "Execution") await setup.query("UPDATE executions SET deleted_at=now() WHERE id=$1", [restExecution]);
          if (kind === "Run item") await setup.query("UPDATE cycle_items SET deleted_at=now() WHERE cycle_id=$1", [restRun]);
          input = kind === "Run" ? restWrites["Run edit"]() : restWrites["Evidence upload"]();
        }
        const before = await businessState(); expect((await rest(input)).status).toBe(404);
        expect(quota).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(await businessState()).toEqual(before);
      });
      it("refuses write-shaped no-ops and invalid inputs before validators, parent locks or multipart parsing", async () => {
        const before = await businessState();
        for (const input of [
          { ...restWrites["Run edit"](), body: { status: "invalid" } },
          { ...restWrites["Plan item add"](), body: {} },
          { ...restWrites["Run case add"](), body: { testcaseIds: [] } },
          { ...restWrites["Run cases delete"](), body: { testcaseIds: [] } },
          { ...restWrites["History import"](), body: { run: null } },
          { ...restWrites["Run case delete"](), path: `/api/cycles/${restRun}/testcases/${randomUUID()}` },
          { ...restWrites["Evidence upload"](), upload: false } // No files would normally be 400.
        ]) expect(await rest(input)).toEqual({ status: 403, body: { error: expect.stringContaining("This project is read-only") } });
        const malformed = await fetch(`${base}/api/cycles/${restRun}/executions/${restExecution}/attachments`, { method: "POST", headers: {
          Cookie: `${settings.sessionCookieName}=${session}`, "content-type": "multipart/form-data; boundary=missing"
        }, body: "not a multipart form" });
        expect(malformed.status).toBe(403); // A check in the handler would let Multer fail first.
        expect(put).not.toHaveBeenCalled(); expect(productActivity).not.toHaveBeenCalled(); expect(await businessState()).toEqual(before);
      });
      it("uses the actual owning project instead of body-supplied project and organization ids", async () => {
        const before = await businessState();
        expect(await rest({ ...restWrites["Run edit"](), body: { name: "Spoofed", projectId: project, organizationId: randomUUID() } }))
          .toEqual({ status: 403, body: { error: expect.stringContaining("This project is read-only") } });
        expect(quota).toHaveBeenCalledWith(organization, locked); expect(await businessState()).toEqual(before);
      });
      it.each([undefined, true, "false", 0, null, {}, []])("does not treat enabled=%j as sharing disable", async (enabled) => {
        const before = await businessState();
        expect(await rest({ ...restWrites["Sharing enable"](), body: { enabled } })).toEqual({ status: 403, body: { error: expect.stringContaining("This project is read-only") } });
        expect(await businessState()).toEqual(before);
      });
      it.each(["existing", "absent"])("allows exact-false disable with an %s token, preserving the existing token lifecycle", async (kind) => {
        const existingToken = kind === "existing" ? randomUUID() : null;
        await setup.query("UPDATE cycles SET share_enabled=$2,share_token=$3 WHERE id=$1", [restRun, kind === "existing", existingToken]);
        const before = await businessState();
        const disabled = await rest({ ...restWrites["Sharing enable"](), body: { enabled: false } });
        expect(disabled.status).toBe(201);
        const sharing = disabled.body as { shareEnabled: boolean; shareToken: string };
        expect(sharing.shareEnabled).toBe(false); expect(sharing.shareToken).toEqual(existingToken ?? expect.any(String));
        const repeated = await rest({ ...restWrites["Sharing enable"](), body: { enabled: false } });
        expect(repeated).toEqual(disabled); expect(quota).not.toHaveBeenCalled();
        expect((await rest({ method: "GET", path: `/api/public/shared-runs/${sharing.shareToken}` }, {})).status).toBe(404);
        const after = await businessState(); expect({ ...after, cycles: before.cycles }).toEqual(before);
        const stored = (await setup.query("SELECT share_enabled,share_token FROM cycles WHERE id=$1", [restRun])).rows[0];
        expect(stored).toEqual({ share_enabled: false, share_token: sharing.shareToken });
      });
      it("refuses schedule creation on a read-only project and keeps schedule edits authenticated", async () => {
        const before = await businessState();
        expect(
          await rest({
            method: "POST",
            path: `/api/projects/${locked}/cycles/schedules`,
            body: { name: "locked", cycleId: restRun, scheduleType: "recurring", intervalMinutes: 60 }
          })
        ).toEqual({ status: 403, body: { error: expect.stringContaining("This project is read-only") } });
        expect(quota).toHaveBeenCalledWith(organization, locked);
        expect(await businessState()).toEqual(before);

        // PATCH/DELETE carry no project in the URL, so they never reach the plan guard; a non-existent
        // row is a 404 from the schedule owner and still writes nothing.
        quota.mockClear();
        for (const method of ["PATCH", "DELETE"]) {
          expect(await rest({ method, path: `/api/cycles/schedules/${randomUUID()}` })).toEqual({
            status: 404,
            body: { error: "Schedule not found" }
          });
        }
        expect(quota).not.toHaveBeenCalled();
        expect(await businessState()).toEqual(before);
      });
      it("retains enabled public reads while locked and reuses the same token after disable and unlocked re-enable", async () => {
        const shareToken = randomUUID();
        await setup.query("UPDATE cycles SET share_enabled=true,share_token=$2 WHERE id=$1", [restRun, shareToken]);
        const publicInput = { method: "GET", path: `/api/public/shared-runs/${shareToken}` };
        const visible = await rest(publicInput, {}); expect(visible.status).toBe(200);
        expect(Object.keys(visible.body as object).sort()).toEqual(["name", "status", "description", "environment", "buildVersion", "createdAt", "startedAt", "endedAt"].sort());
        expect((await rest(restWrites["Sharing enable"]())).status).toBe(403);
        expect(await rest(publicInput, {})).toEqual(visible);
        expect((await rest({ ...restWrites["Sharing enable"](), body: { enabled: false } })).body).toEqual({ shareEnabled: false, shareToken });
        expect((await rest(publicInput, {})).status).toBe(404);
        await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]); await limits.invalidateEntitlementCache(organization);
        expect((await rest(restWrites["Sharing enable"]())).body).toEqual({ shareEnabled: true, shareToken });
        expect(await rest(publicInput, {})).toEqual(visible);
      });
      it.each(["Pro", "grace", "billing disabled", "within allowance", "archive escape"])("persists an ordinary REST write for %s", async (mode) => {
        if (mode === "Pro") await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]);
        if (mode === "grace") await setup.query("UPDATE organizations SET plan_grace_ends_at=now()+interval '1 day' WHERE id=$1", [organization]);
        if (mode === "billing disabled") settings.isStripeBillingEnabled = false;
        const id = mode === "within allowance" ? plan : restPlan;
        if (mode === "archive escape") expect((await rest({ method: "DELETE", path: `/api/projects/${other}` })).status).toBe(200);
        try {
          await limits.invalidateEntitlementCache(organization);
          const name = `REST allowed ${mode}`;
          expect((await rest({ method: "PATCH", path: `/api/plans/${id}`, body: { name } })).status).toBe(200);
          expect((await setup.query("SELECT name FROM plans WHERE id=$1", [id])).rows[0].name).toBe(name);
        } finally { if (mode === "archive escape") await setup.query("UPDATE projects SET archived_at=NULL WHERE id=$1", [other]); }
      });
      it("retains finalization and input/nesting/no-op behavior once the project is writable", async () => {
        await setup.query("UPDATE cycles SET source='automation',closed_at=now() WHERE id=$1", [restRun]);
        expect((await rest(restWrites["Execution edit"]())).status).toBe(403);
        await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]); await limits.invalidateEntitlementCache(organization);
        expect((await rest(restWrites["Execution edit"]())).status).toBe(409);
        expect((await rest({ ...restWrites["Run edit"](), body: { status: "invalid" } })).status).toBe(400);
        expect((await rest({ ...restWrites["Execution edit"](), path: `/api/cycles/${runId}/executions/${restExecution}` })).status).toBe(404);
        await setup.query("UPDATE cycles SET source='manual',closed_at=NULL WHERE id=$1", [restRun]);
        expect((await rest({ ...restWrites["Run case delete"](), path: `/api/cycles/${restRun}/testcases/${randomUUID()}` })).status).toBe(200);
      });
      it("preserves Redis fallback and returns a real 500 for database failure, not a false plan denial", async () => {
        const before = await businessState();
        (redis.get as jest.Mock).mockRejectedValueOnce(new Error("REST controlled Redis outage"));
        expect((await rest(restWrites["Plan edit"]())).status).toBe(403);
        quota.mockImplementationOnce(async () => { await db.query("SELECT 1 / 0"); });
        const logging = jest.spyOn(console, "error").mockImplementation(() => undefined);
        try { expect(await rest(restWrites["Plan edit"]())).toEqual({ status: 500, body: { error: "Internal server error" } }); }
        finally { logging.mockRestore(); }
        expect(productActivity).not.toHaveBeenCalled(); expect(put).not.toHaveBeenCalled(); expect(await businessState()).toEqual(before);
      });
      it("reuses cached entitlement and canonical invalidation, without changing cache TTL or promising zero staleness", async () => {
        await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]); await limits.invalidateEntitlementCache(organization);
        expect((await rest(restWrites["Plan edit"]())).status).toBe(200);
        expect(redis.set).toHaveBeenCalledWith(`entitlement:${organization}`, expect.any(String), "EX", 45);
        await setup.query("UPDATE organizations SET plan='launch' WHERE id=$1", [organization]);
        expect((await rest({ ...restWrites["Plan edit"](), body: { name: "Existing cached entitlement" } })).status).toBe(200);
        await limits.invalidateEntitlementCache(organization);
        const before = await businessState(); expect((await rest(restWrites["Plan edit"]())).status).toBe(403);
        expect(await businessState()).toEqual(before);
      });
      it("does not pretend deleting a Run frees a project slot", async () => {
        await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]); await limits.invalidateEntitlementCache(organization);
        expect((await rest(restWrites["Run delete"]())).status).toBe(200);
        await setup.query("UPDATE organizations SET plan='launch' WHERE id=$1", [organization]); await limits.invalidateEntitlementCache(organization);
        expect((await rest(restWrites["Plan edit"]())).status).toBe(403);
        expect((await setup.query("SELECT archived_at FROM projects WHERE id=$1", [locked])).rows[0].archived_at).toBeNull();
      });
    });
  });
});
