import { Controller, Get, INestApplication, Module, Post } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { AddressInfo } from "node:net";
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
