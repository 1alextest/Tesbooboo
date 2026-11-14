import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
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

const url = process.env.DATABASE_URL ?? "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("Plan/Run project lineage — migrated PostgreSQL", () => {
  let setup: Client, pool: Pool, project: string, other: string, plan: string, cycle: string;
  let localSuite: string, localCase: string, foreignSuite: string, foreignCase: string, foreignPlan: string;
  const owner = randomUUID(), stamp = randomUUID();
  beforeAll(async () => {
    setup = new Client({ connectionString: url }); await setup.connect();
    pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 3000 });
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
    let app: INestApplication, base: string, locked: string, organization: string, token: string;
    let db: DatabaseService, limits: PlanLimitsService, mcp: McpService, tokens: ApiTokenService;
    let readToken: string, writeToken: string, writableToken: string, session: string;
    let suiteId: string, caseId: string, planId: string, runId: string, executionId: string, bugId: string, folderId: string, documentId: string;
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
      organization = (await setup.query("SELECT organization_id FROM projects WHERE id=$1", [project])).rows[0].organization_id;
      await setup.query("INSERT INTO organization_members (organization_id,user_id,role) VALUES ($1,$2,'owner')", [organization, owner]);
      await setup.query("UPDATE users SET active_organization_id=$1 WHERE id=$2", [organization, owner]);
      locked = (await setup.query("INSERT INTO projects (organization_id,key,name) VALUES ($1,'LNC','Locked MCP project') RETURNING id", [organization])).rows[0].id;
      for (const id of [project, other, locked]) await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [id, owner]);
      await setup.query("UPDATE organizations SET plan='launch',plan_grace_ends_at=now()-interval '1 day' WHERE id=$1", [organization]);
      db = new DatabaseService(pool);
      const legacy = makeLegacy(db), requestCache = new RequestCacheService(config);
      // This boundary test does not boot unrelated resumable Zyra plans from other retained fixtures.
      jest.spyOn(legacy, "onModuleInit").mockResolvedValue(undefined);
      tokens = new ApiTokenService(db);
      token = (await tokens.issueToken(owner, locked, "Native MCP parity", ["read", "write"])).token;
      readToken = (await tokens.issueToken(owner, locked, "Native MCP read", ["read"])).token;
      writeToken = (await tokens.issueToken(owner, locked, "Native MCP write", ["write"])).token;
      writableToken = (await tokens.issueToken(owner, project, "Native writable control", ["read", "write"])).token;
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
      await setup.query("INSERT INTO attachments (project_id,entity_type,entity_id,file_name,content_type,file_size,storage_path,uploaded_by) VALUES ($1,'execution',$2,'keep.txt','text/plain',4,'ci/mcp-lock/keep',$3)", [locked, executionId, owner]);
      limits = new PlanLimitsService(db, config, email, requestCache, new EntitlementCacheService(redis, config));
      quota = jest.spyOn(limits, "assertProjectWritable");
      const module = await Test.createTestingModule({
        controllers: [McpController, LegacyController], providers: [McpService,
          { provide: DatabaseService, useValue: db }, { provide: LegacyService, useValue: legacy },
          { provide: PlanLimitsService, useValue: limits },
          { provide: ProjectLookupService, useValue: new ProjectLookupService(db, requestCache) },
          { provide: CustomFieldsService, useValue: {} }, { provide: ZyraProgressService, useValue: {} }, { provide: WelcomeEmailService, useValue: {} },
          { provide: APP_GUARD, useClass: ApiTokenRestGuard }, { provide: APP_GUARD, useClass: ProjectWriteLockGuard }
        ]
      }).compile();
      app = module.createNestApplication();
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
    afterAll(async () => { await app?.close(); });
    const routes = ["dynamic", "project-prefixed"] as const;
    const business = async () => (await setup.query("SELECT * FROM suites WHERE project_id=$1 ORDER BY id", [locked])).rows;
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
      expect(response.body.result.tools.map((tool: { name: string }) => tool.name)).toContain("create_suite");
    });
    it.each(routes)("refuses a valid write through %s before any persisted business change", async (route) => {
      const before = await business(), response = await rpc(route, "tools/call", { name: "create_suite", arguments: { name: "Must never be created while locked" } });
      // One comparison exposes both the wire contract and any actually persisted write in red CI.
      expect({ ...response, business: await business() }).toEqual({
        status: 201, body: { jsonrpc: "2.0", id: 7, error: { code: -32003,
          message: expect.stringContaining("This project is read-only") } }, business: before
      });
    });

    const writes: Record<string, () => Record<string, unknown>> = {
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
      move_knowledge_folder: () => ({ folderId, parentFolderId: folderId })
    };
    const reads: Record<string, () => { args: Record<string, unknown>; expected: unknown }> = {
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
      get_knowledge_folder: () => ({ args: { folderId }, expected: expect.objectContaining({ id: folderId, isRoot: true }) })
    };
    async function businessState() {
      const ids = [project, other, locked], state: Record<string, unknown> = {};
      state.projects = (await setup.query("SELECT * FROM projects WHERE id=ANY($1::uuid[]) ORDER BY id", [ids])).rows;
      for (const table of ["suites", "testcases", "plans", "cycles", "bugs", "knowledge_folders", "knowledge_documents", "knowledge_files", "attachments", "audit_logs"]) {
        state[table] = (await setup.query(`SELECT * FROM ${table} WHERE project_id=ANY($1::uuid[]) ORDER BY id`, [ids])).rows;
      }
      state.versions = (await setup.query("SELECT v.* FROM testcase_versions v JOIN testcases t ON t.id=v.testcase_id WHERE t.project_id=ANY($1::uuid[]) ORDER BY v.testcase_id,v.version", [ids])).rows;
      state.planItems = (await setup.query("SELECT i.* FROM plan_items i JOIN plans p ON p.id=i.plan_id WHERE p.project_id=ANY($1::uuid[]) ORDER BY i.id", [ids])).rows;
      state.runItems = (await setup.query("SELECT i.* FROM cycle_items i JOIN cycles c ON c.id=i.cycle_id WHERE c.project_id=ANY($1::uuid[]) ORDER BY i.id", [ids])).rows;
      state.results = (await setup.query("SELECT e.* FROM executions e JOIN cycle_items i ON i.id=e.cycle_item_id JOIN cycles c ON c.id=i.cycle_id WHERE c.project_id=ANY($1::uuid[]) ORDER BY e.id", [ids])).rows;
      state.links = (await setup.query("SELECT l.* FROM bug_links l JOIN bugs b ON b.id=l.bug_id WHERE b.project_id=ANY($1::uuid[]) ORDER BY l.id", [ids])).rows;
      state.documentVersions = (await setup.query("SELECT v.* FROM knowledge_document_versions v JOIN knowledge_documents d ON d.id=v.document_id WHERE d.project_id=ANY($1::uuid[]) ORDER BY v.id", [ids])).rows;
      return state;
    }
    const noHandler = () => { for (const handler of handlers) expect(handler).not.toHaveBeenCalled(); expect(actor).not.toHaveBeenCalled(); };
    const denied = (response: Awaited<ReturnType<typeof rpc>>) => expect(response).toEqual({
      status: 201, body: { jsonrpc: "2.0", id: 7, error: { code: -32003, message: expect.stringContaining("This project is read-only") } }
    });
    it("covers every current registry classification explicitly, rather than sampling write/read names", () => {
      for (const [scope, cases] of [["write", writes], ["read", reads]] as const) {
        expect(Object.keys(cases).sort()).toEqual(mcp.listTools().filter((tool) => tool.requiredScope === scope).map((tool) => tool.name).sort());
      }
      expect(Object.keys(writes)).toHaveLength(30); expect(Object.keys(reads)).toHaveLength(20);
    });
    describe.each(routes)("%s full registry", (route) => {
      it.each(Object.keys(writes))("blocks %s before its handler, including prefix/no-op/clone work", async (name) => {
        const before = await businessState();
        denied(await rpc(route, "tools/call", { name, arguments: writes[name]() }));
        expect(quota).toHaveBeenCalledTimes(1); expect(quota).toHaveBeenCalledWith(organization, locked);
        noHandler(); expect(await businessState()).toEqual(before);
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
        expect((await rpc(route, "tools/list", {}, { token: writeToken })).body.result.tools).toHaveLength(50);
        for (const [method, params, credential, code] of [
          ["tools/call", { name: "create_suite", arguments: { name: "No permission" } }, readToken, -32002],
          ["tools/call", { name: "list_testcases", arguments: {} }, writeToken, -32002],
          ["tools/call", { name: "not_a_tool" }, token, -32601],
          ["not_a_method", {}, token, -32601]
        ] as const) {
          const response = await rpc(route, method, params, { token: credential });
          expect(response.status).toBe(201); expect(response.body.error.code).toBe(code);
        }
        await setup.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2", [locked, owner]);
        try {
          const response = await rpc(route, "tools/call", { name: "create_suite", arguments: { name: "Revoked issuer" } });
          expect(response.status).toBe(201); expect(response.body.error.code).toBe(-32001);
        } finally { await setup.query("INSERT INTO project_members (project_id,user_id,role) VALUES ($1,$2,'owner')", [locked, owner]); }
        expect(quota).not.toHaveBeenCalled(); noHandler(); expect(await businessState()).toEqual(before);
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
        expect(await rpc(route, "ping", {}, { session: current })).toEqual({ status: 201, body: { jsonrpc: "2.0", id: 7, result: {} } });
        expect((await rpc(route, "tools/list", {}, { session: current })).body.result.tools).toHaveLength(50);
        const trailing = await fetch(`${endpoint(route)}/?native=1`, { method: "POST", headers: {
          Authorization: `Bearer ${readToken}`, "content-type": "application/json"
        }, body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }) });
        expect(trailing.status).toBe(201); expect((await trailing.json()).result.tools).toHaveLength(50);
        const stale = "0000000000000000.11111111-2222-4333-8444-555555555555";
        const refused = await rpc(route, "tools/call", { name: "create_suite", arguments: { name: "Stale call" } }, { session: stale });
        expect(refused.status).toBe(404); expect(refused.body.error.code).toBe(-32004);
        const recovered = await send(route, "initialize", {}, { session: stale });
        expect(recovered.status).toBe(201); expect(recovered.headers.get("mcp-session-id")).not.toBe(stale);
        const note = await send(route, "notifications/initialized", {}, { session: current, notification: true });
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
        const response = await rpc(route, "tools/call", { name: "create_suite", arguments: { name } }, {
          token: mode === "within allowance" ? writableToken : token, project: target
        });
        expect(response.status).toBe(201); expect(response.body.error).toBeUndefined();
        const result = JSON.parse(response.body.result.content[0].text);
        expect((await setup.query("SELECT name,project_id FROM suites WHERE id=$1", [result.id])).rows).toEqual([{ name, project_id: target }]);
        const after = await businessState();
        expect((after.suites as unknown[]).length).toBe((before.suites as unknown[]).length + 1);
        expect({ ...after, suites: before.suites }).toEqual(before);
        expect(quota).toHaveBeenCalledWith(organization, target);
      });
      it("uses the authenticated project, not project/organization values inside tool arguments", async () => {
        const before = await businessState();
        denied(await rpc(route, "tools/call", { name: "create_suite", arguments: { name: "Spoofed", projectId: project, organizationId: randomUUID() } }));
        expect(quota).toHaveBeenCalledWith(organization, locked); noHandler(); expect(await businessState()).toEqual(before);
      });
      it("falls back to PostgreSQL if Redis fails and does not mislabel an actual PostgreSQL failure as a plan denial", async () => {
        const before = await businessState();
        (redis.get as jest.Mock).mockRejectedValueOnce(new Error("Controlled Redis read failure"));
        (redis.set as jest.Mock).mockRejectedValueOnce(new Error("Controlled Redis write failure"));
        denied(await rpc(route, "tools/call", { name: "create_suite", arguments: { name: "Cache failure" } }));
        quota.mockImplementationOnce(async () => { await db.query("SELECT 1 / 0"); });
        const failed = await rpc(route, "tools/call", { name: "create_suite", arguments: { name: "Database failure" } });
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
      const response = await fetch(`${base}/api/projects/${locked}/suites`, { method: "POST", headers: {
        Authorization: `Bearer ${writeToken}`, "content-type": "application/json"
      }, body: JSON.stringify({ name: "REST remains locked" }) });
      expect(response.status).toBe(403); expect((await response.json()).error).toContain("This project is read-only");
      expect(quota).toHaveBeenCalledWith(organization, locked); noHandler(); expect(await businessState()).toEqual(before);
    });
    it("keeps the existing entitlement cache and explicit invalidation semantics, without waiting out or changing its TTL", async () => {
      await setup.query("UPDATE organizations SET plan='pro' WHERE id=$1", [organization]);
      await limits.invalidateEntitlementCache(organization);
      const input = { name: "create_suite", arguments: { name: "Warm Pro cache" } };
      expect((await rpc("dynamic", "tools/call", input)).body.error).toBeUndefined();
      expect(redis.set).toHaveBeenCalledWith(`entitlement:${organization}`, expect.any(String), "EX", 45);
      await setup.query("UPDATE organizations SET plan='launch' WHERE id=$1", [organization]);
      // Direct SQL intentionally does not invalidate Redis; this pins the existing cached snapshot,
      // not acceptance of a new consistency policy or a real Redis-expiry experiment.
      expect((await rpc("project-prefixed", "tools/call", { ...input, arguments: { name: "Existing cached snapshot" } })).body.error).toBeUndefined();
      await limits.invalidateEntitlementCache(organization);
      denied(await rpc("dynamic", "tools/call", input));
    });
    it("retains expired-admin-override retirement and the one-time billing notice without changing business rows", async () => {
      // A comp expiry opens no grace. Start without a previous downgrade deadline so the
      // later, separate grace-ended scenario owns the one-time notice assertion.
      await setup.query("UPDATE organizations SET plan='pro',plan_source='admin',plan_override_expires_at=now()-interval '1 day',plan_grace_ends_at=NULL,grace_locked_notified_at=NULL WHERE id=$1", [organization]);
      await limits.invalidateEntitlementCache(organization);
      const before = await businessState();
      denied(await rpc("dynamic", "tools/call", { name: "create_suite", arguments: { name: "Expired grant" } }));
      expect((await setup.query("SELECT plan,plan_source,plan_grace_ends_at,plan_override_expires_at FROM organizations WHERE id=$1", [organization])).rows[0])
        .toEqual({ plan: "launch", plan_source: "stripe", plan_grace_ends_at: null, plan_override_expires_at: null });
      expect((await setup.query("SELECT count(*)::int AS count FROM audit_logs WHERE organization_id=$1 AND action='billing_downgraded'", [organization])).rows[0].count).toBe(1);
      expect(email.sendGraceEnded).not.toHaveBeenCalled();
      await setup.query("UPDATE organizations SET plan_grace_ends_at=now()-interval '1 day' WHERE id=$1", [organization]);
      await limits.invalidateEntitlementCache(organization);
      const notices = (await setup.query("SELECT count(*)::int AS count FROM audit_logs WHERE organization_id=$1 AND action='billing_limits_enforced'", [organization])).rows[0].count;
      for (const route of routes) denied(await rpc(route, "tools/call", { name: "create_suite", arguments: { name: "One notice" } }));
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
        denied(await rpc("dynamic", "tools/call", { name: "create_suite", arguments: { name: "Metadata only" } }));
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
        const response = await rpc("dynamic", "tools/call", { name: "create_suite", arguments: { name: "Unlocked by archive" } });
        expect(response.body.error).toBeUndefined();
        const created = JSON.parse(response.body.result.content[0].text);
        expect((await setup.query("SELECT project_id FROM suites WHERE id=$1", [created.id])).rows[0].project_id).toBe(locked);
      } finally { await setup.query("UPDATE projects SET archived_at=NULL WHERE id=$1", [other]); }
    });
    it("allows a human to archive the locked project itself but refuses its now-inaccessible token calls", async () => {
      const archived = await fetch(`${base}/api/projects/${locked}`, { method: "DELETE", headers: { Cookie: `${settings.sessionCookieName}=${session}` } });
      try {
        expect(archived.status).toBe(200);
        const response = await rpc("dynamic", "tools/list");
        expect(response.body.error.code).toBe(-32001); expect(quota).not.toHaveBeenCalled(); noHandler();
      } finally { await setup.query("UPDATE projects SET archived_at=NULL WHERE id=$1", [locked]); }
    });
  });
});
