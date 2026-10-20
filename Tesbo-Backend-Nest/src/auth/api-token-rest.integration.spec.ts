import { Controller, Get, INestApplication, Module, Post } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ApiTokenRestGuard } from "./api-token-rest.guard";
import { LegacyService } from "../legacy/legacy.service";
import type { AuthenticatedRequest } from "../common/request.types";

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
    await app.init();
  });

  afterAll(async () => { await app?.close(); });
  beforeEach(() => { member.mockClear(); });

  it("rejects read-token writes and allows reads", async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${PROJECT}/testcases`)
      .send({ title: "not allowed" }).expect(403);
    expect(member).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get(`/api/projects/${PROJECT}/testcases`)
      .expect(200, { ok: true });
    expect(member).toHaveBeenCalledWith("u", PROJECT);
  });

  it("checks membership for writes and denies revoked issuers", async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${PROJECT}/testcases`)
      .set("x-test-scope", "write")
      .send({}).expect(201);
    const { ForbiddenException } = await import("@nestjs/common");
    member.mockRejectedValueOnce(new ForbiddenException("revoked"));
    await request(app.getHttpServer())
      .post(`/api/projects/${PROJECT}/testcases`)
      .set("x-test-scope", "write")
      .send({}).expect(403);
  });
});
