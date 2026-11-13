import { Controller, Get, INestApplication, Module, NotFoundException, Post } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { AddressInfo } from "node:net";
import { ApiTokenRestGuard } from "./api-token-rest.guard";
import { LegacyService } from "../legacy/legacy.service";
import type { AuthenticatedRequest } from "../common/request.types";
import { LegacyController } from "../legacy/legacy.controller";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import type { DatabaseService } from "../database/database.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { ZyraProgressService } from "../legacy/zyra-progress.service";
import { WelcomeEmailService } from "../welcome-email/welcome-email.service";

const PROJECT = "11111111-1111-4111-8111-111111111111";
@Controller("api/projects/:projectId/testcases")
class CasesController {
  @Get()
  getCases() { return { ok: true }; }

  @Post()
  createCase() { return { created: true }; }
}
@Module({ controllers: [CasesController] })
class CasesModule {}

describe("ApiTokenRestGuard at the Nest HTTP boundary", () => {
  let app: INestApplication;
  const member = jest.fn().mockResolvedValue({ id: PROJECT });
  let baseUrl: string;
  async function send(method: "GET" | "POST", scope: "read" | "write" = "read") {
    const response = await fetch(`${baseUrl}/api/projects/${PROJECT}/testcases`, {
      method,
      headers: { "x-test-scope": scope, ...(method === "POST" ? { "content-type": "application/json" } : {}) },
      ...(method === "POST" ? { body: "{}" } : {})
    });
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [CasesModule],
      providers: [
        { provide: LegacyService, useValue: { requireProjectAccess: member } },
        { provide: APP_GUARD, useClass: ApiTokenRestGuard }
      ]
    }).compile();
    app = module.createNestApplication();
    // Explicit token fixture isolates the authorization guard from token hashing and cookie parsing.
    app.use((req: AuthenticatedRequest, _res: unknown, next: () => void) => {
      req.apiToken = {
        tokenId: "t", userId: "u", projectId: PROJECT,
        scopes: req.headers["x-test-scope"] === "write" ? ["write"] : ["read"]
      };
      next();
    });
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => { await app?.close(); });
  beforeEach(() => { member.mockClear(); });

  it("rejects read-token writes and allows reads", async () => {
    const rejected = await send("POST");
    expect(rejected.status).toBe(403);
    expect(member).not.toHaveBeenCalled();

    const allowed = await send("GET");
    expect(allowed).toEqual({ status: 200, body: { ok: true } });
    expect(member).toHaveBeenCalledWith("u", PROJECT);
  });

  it("checks membership for writes and denies revoked issuers", async () => {
    const allowed = await send("POST", "write");
    expect(allowed).toEqual({ status: 201, body: { created: true } });

    const { ForbiddenException } = await import("@nestjs/common");
    member.mockRejectedValueOnce(new ForbiddenException("revoked"));
    const rejected = await send("POST", "write");
    expect(rejected.status).toBe(403);
  });
});

describe("bug creation through the actual controller/service HTTP boundary", () => {
  const memberId = "22222222-2222-4222-8222-222222222222";
  const nonmemberId = "33333333-3333-4333-8333-333333333333";
  const bugId = "44444444-4444-4444-8444-444444444444";
  const query = jest.fn(async (sql: string, _values?: unknown[]) => ({
    rows: sql.includes("INSERT INTO bugs") ? [{ id: bugId }] : [], rowCount: 1
  }));
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const access = jest.fn(async (userId: string | null | undefined, projectId: string) => {
    if (userId !== memberId || projectId !== PROJECT) throw new NotFoundException({ error: "Project not found" });
    return {};
  });
  let app: INestApplication;
  let baseUrl: string;
  let service: LegacyService;
  let activity: jest.SpyInstance;
  let notify: jest.SpyInstance;

  beforeAll(async () => {
    service = makeLegacy({ query, transaction } as unknown as DatabaseService);
    jest.spyOn(service, "requireProjectAccess").mockImplementation(access);
    jest.spyOn(service as unknown as { nextBugExternalId: () => Promise<string> }, "nextBugExternalId").mockResolvedValue("TEST-BUG-1");
    jest.spyOn(service, "getBug").mockImplementation(async () => ({ id: bugId, title: "Authorized bug", links: [], attachments: [] }));
    activity = jest.spyOn(service, "logProjectActivity").mockResolvedValue(undefined);
    notify = jest.spyOn(service as unknown as { notifyBugChange: () => Promise<void> }, "notifyBugChange").mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [LegacyController],
      providers: [
        { provide: LegacyService, useValue: service },
        { provide: CustomFieldsService, useValue: {} },
        { provide: ZyraProgressService, useValue: {} },
        { provide: WelcomeEmailService, useValue: {} },
        { provide: APP_GUARD, useClass: ApiTokenRestGuard }
      ]
    }).compile();
    app = module.createNestApplication();
    // Synthetic principals isolate transport/service wiring, NOT cookie/token parsing or SQL.
    // The existing disposable PostgreSQL and real-session smoke tests own those other oracles.
    app.use((req: AuthenticatedRequest, _res: unknown, next: () => void) => {
      req.userId = typeof req.headers["x-test-user"] === "string" ? req.headers["x-test-user"] : null;
      const scope = req.headers["x-test-scope"];
      if (scope === "read" || scope === "write") {
        req.apiToken = { tokenId: "fixture", userId: req.userId, projectId: PROJECT, scopes: [scope] };
      }
      next();
    });
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => {
    query.mockClear(); transaction.mockClear(); access.mockClear(); activity.mockClear(); notify.mockClear();
  });

  async function create(userId?: string, scope?: "read" | "write", body: unknown = { title: "Authorized bug" }) {
    return fetch(`${baseUrl}/api/projects/${PROJECT}/bugs`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(userId ? { "x-test-user": userId } : {}), ...(scope ? { "x-test-scope": scope } : {}) },
      body: JSON.stringify(body)
    });
  }

  function expectNoEffects() {
    expect(query).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  }

  it("refuses anonymous browser requests before any bug/link/result work", async () => {
    const response = await create();
    expect(response.status).toBe(400); // Existing canonical requireUser contract, not a new status policy.
    expectNoEffects();
  });

  it("refuses nonmembers before resolving links or allocating a bug ID", async () => {
    const response = await create(nonmemberId, undefined, {
      title: "Unauthorized bug", links: [{ testcaseId: memberId, cycleId: PROJECT, executionId: bugId }]
    });
    expect(response.status).toBe(404);
    expect(access).toHaveBeenCalledWith(nonmemberId, PROJECT);
    expectNoEffects();
  });

  it("authorizes before validating a nonmember's malformed bug fields", async () => {
    const response = await create(nonmemberId, undefined, { title: "x".repeat(2_000) });
    expect(response.status).toBe(404);
    expectNoEffects();
  });

  it("keeps read-token writes refused without side effects", async () => {
    expect((await create(memberId, "read")).status).toBe(403);
    expectNoEffects();
  });

  it.each([undefined, "write"] as const)("allows a current member using %s and retains reporter attribution", async (scope) => {
    const response = await create(memberId, scope);
    expect(response.status).toBe(201);
    expect(access).toHaveBeenCalledWith(memberId, PROJECT);
    expect(transaction).toHaveBeenCalledTimes(1);
    const insert = query.mock.calls.find(([sql]) => sql.includes("INSERT INTO bugs"));
    expect(insert?.[1]?.[11]).toBe(memberId);
    expect(await response.json()).toMatchObject({ id: bugId });
  });
});

describe("execution run context through the actual controller/service HTTP boundary", () => {
  const memberId = "22222222-2222-4222-8222-222222222222";
  const runId = "55555555-5555-4555-8555-555555555555";
  const executionId = "66666666-6666-4666-8666-666666666666";
  const otherRun = "77777777-7777-4777-8777-777777777777";
  const query = jest.fn(async (sql: string, values?: unknown[]) => {
    if (sql.includes("FROM executions e") && sql.includes("WHERE e.id = $1")) {
      return { rows: [{ id: executionId, project_id: PROJECT, cycle_id: runId, status: "Passed", executed_by: memberId, assignee_id: null }] };
    }
    if (sql.includes("FROM cycles") && sql.includes("FOR UPDATE")) return { rows: [{ source: "manual", closed_at: null }] };
    if (sql.includes("UPDATE executions SET")) return { rows: [{ id: executionId, status: values?.[1] ?? "Passed", assignee_id: null }] };
    return { rows: [] };
  });
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  let app: INestApplication;
  let baseUrl: string;
  let activity: jest.SpyInstance;
  let notify: jest.SpyInstance;

  beforeAll(async () => {
    const service = makeLegacy({ query, transaction } as unknown as DatabaseService);
    jest.spyOn(service, "requireProjectAccess").mockImplementation(async (actor) => {
      if (actor !== memberId) throw new NotFoundException({ error: "Project not found" });
      return {} as never;
    });
    activity = jest.spyOn(service, "logProjectActivity").mockResolvedValue(undefined);
    notify = jest.spyOn(service as unknown as { notifyExecutionChange: () => Promise<void> }, "notifyExecutionChange").mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [LegacyController],
      providers: [
        { provide: LegacyService, useValue: service },
        { provide: CustomFieldsService, useValue: {} },
        { provide: ZyraProgressService, useValue: {} },
        { provide: WelcomeEmailService, useValue: {} },
        { provide: APP_GUARD, useClass: ApiTokenRestGuard }
      ]
    }).compile();
    app = module.createNestApplication();
    // Real Nest controller and service; synthetic principals and SQL effects, not cookie/DB proof.
    app.use((req: AuthenticatedRequest, _res: unknown, next: () => void) => {
      req.userId = typeof req.headers["x-test-user"] === "string" ? req.headers["x-test-user"] : null;
      if (req.headers["x-test-token"]) req.apiToken = { tokenId: "fixture", userId: req.userId, projectId: PROJECT, scopes: ["write"] };
      next();
    });
    await app.listen(0, "127.0.0.1");
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { query.mockClear(); transaction.mockClear(); activity.mockClear(); notify.mockClear(); });

  async function patchRun(cycleId: string, actor: string | null = memberId, token = false) {
    return fetch(`${baseUrl}/api/cycles/${cycleId}/executions/${executionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...(actor ? { "x-test-user": actor } : {}), ...(token ? { "x-test-token": "1" } : {}) },
      // A body parent must not override the authoritative URL parent.
      body: JSON.stringify({ status: "Blocked", actualResult: "Scoped edit", cycleId: runId })
    });
  }

  it.each([otherRun, "00000000-0000-4000-8000-000000000001", "not-a-run-id"])("rejects URL run %s before mutation or success events", async (cycleId) => {
    expect((await patchRun(cycleId)).status).toBe(404);
    expect(transaction).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => /^\s*(UPDATE|INSERT|DELETE)\b/.test(sql))).toBe(false);
    expect(activity).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  });

  it("keeps matching-run browser writes allowed", async () => {
    expect((await patchRun(runId)).status).toBe(200);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query.mock.calls.some(([sql]) => sql.includes("UPDATE executions SET"))).toBe(true);
  });

  it("retains anonymous, inaccessible-project and flat token-route refusals", async () => {
    expect((await patchRun(runId, null)).status).toBe(400);
    expect((await patchRun(runId, otherRun)).status).toBe(404);
    expect((await patchRun(runId, memberId, true)).status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
    expect(activity).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  });
});

describe("testcase bulk-create through the actual controller/service HTTP boundary", () => {
  const member = "22222222-2222-4222-8222-222222222222", outsider = "33333333-3333-4333-8333-333333333333";
  const query = jest.fn(async (sql: string, values?: unknown[]) => ({
    rows: /INSERT INTO testcases/.test(sql)
      ? (JSON.parse(String(values?.[2])) as Array<Record<string, unknown>>).map((row, index) => ({ ...row, id: `44444444-4444-4444-8444-44444444444${index}`, project_id: PROJECT, created_by: member, updated_by: member }))
      : [],
  }));
  const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => work({ query }));
  const access = jest.fn(async (actor: string | null | undefined, project: string) => {
    if (actor !== member || project !== PROJECT) throw new NotFoundException({ error: "Project not found" });
    return {} as never;
  });
  let app: INestApplication, baseUrl: string;
  let activity: jest.SpyInstance, suites: jest.SpyInstance, cases: jest.SpyInstance;
  beforeAll(async () => {
    const svc = makeLegacy({ query, transaction } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockImplementation(access);
    activity = jest.spyOn(svc, "logProjectActivity").mockResolvedValue(undefined);
    const internals = svc as unknown as {
      externalIdPrefix: () => Promise<string>; maxExternalIdSeq: () => Promise<number>;
      suitesCache: { invalidate: (id: string) => Promise<void> }; testcasesListCache: { invalidate: (id: string) => Promise<void> };
    };
    jest.spyOn(internals, "externalIdPrefix").mockResolvedValue("BULK");
    jest.spyOn(internals, "maxExternalIdSeq").mockResolvedValue(0);
    suites = jest.spyOn(internals.suitesCache, "invalidate").mockResolvedValue(undefined);
    cases = jest.spyOn(internals.testcasesListCache, "invalidate").mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [LegacyController],
      providers: [
        { provide: LegacyService, useValue: svc }, { provide: CustomFieldsService, useValue: {} },
        { provide: ZyraProgressService, useValue: {} }, { provide: WelcomeEmailService, useValue: {} },
        { provide: APP_GUARD, useClass: ApiTokenRestGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    // Actual controller, guard and writer with synthetic principals/SQL, not real cookie/DB proof.
    app.use((req: AuthenticatedRequest, _res: unknown, next: () => void) => {
      req.userId = typeof req.headers["x-test-user"] === "string" ? req.headers["x-test-user"] : null;
      const scope = req.headers["x-test-scope"];
      if (scope === "read" || scope === "write") req.apiToken = { tokenId: "fixture", userId: req.userId, projectId: PROJECT, scopes: [scope] };
      next();
    });
    await app.listen(0, "127.0.0.1"); baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { query.mockClear(); transaction.mockClear(); access.mockClear(); activity.mockClear(); suites.mockClear(); cases.mockClear(); });
  const valid = { testcases: [{ title: "First case" }, { title: "Second case" }] };
  async function send(actor?: string, scope?: "read" | "write", body: unknown = valid) {
    return fetch(`${baseUrl}/api/projects/${PROJECT}/testcases/bulk-create`, { method: "POST", headers: {
      "content-type": "application/json", ...(actor ? { "x-test-user": actor } : {}), ...(scope ? { "x-test-scope": scope } : {}),
    }, body: JSON.stringify(body) });
  }
  const noEffects = () => {
    expect(query).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled(); expect(activity).not.toHaveBeenCalled();
    expect(suites).not.toHaveBeenCalled(); expect(cases).not.toHaveBeenCalled();
  };
  it("refuses anonymous bulk creation before any transaction", async () => { expect((await send()).status).toBe(400); noEffects(); });
  it.each([
    ["ordinary", valid], ["empty", { testcases: [] }], ["malformed field", { testcases: [{ title: "x".repeat(513) }] }],
  ])("refuses a nonmember's %s batch before validation or side effects", async (_label, body) => {
    expect((await send(outsider, undefined, body)).status).toBe(404); expect(access).toHaveBeenCalledWith(outsider, PROJECT); noEffects();
  });
  it("keeps read-token writes refused", async () => { expect((await send(member, "read")).status).toBe(403); noEffects(); });
  it.each([undefined, "write"] as const)("allows a current member using %s with unchanged batch shape and attribution", async (scope) => {
    const response = await send(member, scope); expect(response.status).toBe(201);
    expect(access).toHaveBeenCalledWith(member, PROJECT); expect(transaction).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({ createdCount: 2, created: [
      expect.objectContaining({ title: "First case", projectId: PROJECT, createdBy: member }),
      expect.objectContaining({ title: "Second case", projectId: PROJECT, createdBy: member }),
    ] });
  });
  it("preserves the authorized empty-batch response without writes", async () => {
    const response = await send(member, undefined, { testcases: [] }); expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ created: [], createdCount: 0 }); expect(access).toHaveBeenCalledWith(member, PROJECT); noEffects();
  });
  it.each([
    ["field length", { testcases: [{ title: "x".repeat(513) }] }],
    ["batch limit", { testcases: Array.from({ length: 501 }, () => ({ title: "Limit control" })) }],
  ])("retains the authorized %s validation before SQL", async (_label, body) => {
    expect((await send(member, undefined, body)).status).toBe(400); expect(access).toHaveBeenCalledWith(member, PROJECT); noEffects();
  });
});
