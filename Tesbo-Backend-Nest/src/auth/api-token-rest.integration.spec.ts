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
