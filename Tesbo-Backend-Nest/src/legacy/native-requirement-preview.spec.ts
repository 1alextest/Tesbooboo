import { BadRequestException, ForbiddenException, ServiceUnavailableException, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { AddressInfo } from "node:net";
import { ApiTokenRestGuard } from "../auth/api-token-rest.guard";
import type { AuthenticatedRequest } from "../common/request.types";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { ProjectWriteLockGuard } from "../plan-limits/project-write-lock.guard";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import { WelcomeEmailService } from "../welcome-email/welcome-email.service";
import { LegacyService } from "./legacy.service";
import { ZyraProgressService } from "./zyra-progress.service";
import { LegacyController } from "./legacy.controller";
import { NativeRequirementPreviewError, previewNativeRequirement } from "./native-requirement-preview";

const USER = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";

describe("native requirement preview through both global HTTP guards", () => {
  let app: INestApplication;
  let origin: string;
  const oldFlag = process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED;
  const projectLookup = { getProjectBasics: jest.fn().mockResolvedValue({ organizationId: "org", archivedAt: null }) };
  const billing = { assertProjectWritable: jest.fn().mockRejectedValue(new ForbiddenException({ error: "billing lock must not be reached by preview" })) };
  const legacy = { requireProjectAccess: jest.fn(async (userId: string) => {
    if (userId !== USER) throw new ForbiddenException({ error: "Project membership required" });
    return { id: PROJECT };
  }) };
  const candidate = { documentType: "requirement_note", title: "Preview",
    contentJson: { schemaVersion: "tesbo-requirement/1", description: "Read-only candidate",
      criteria: [{ key: "AC-1", text: "Refuse unauthorized changes", normative: true }] } };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [LegacyController],
      providers: [
        { provide: LegacyService, useValue: legacy },
        { provide: CustomFieldsService, useValue: {} },
        { provide: ZyraProgressService, useValue: {} },
        { provide: WelcomeEmailService, useValue: {} },
        { provide: APP_GUARD, useValue: new ApiTokenRestGuard(legacy as unknown as LegacyService) },
        { provide: APP_GUARD, useValue: new ProjectWriteLockGuard(
          projectLookup as unknown as ProjectLookupService, billing as unknown as PlanLimitsService) }
      ]
    }).compile();
    app = module.createNestApplication();
    app.use((req: AuthenticatedRequest, _res: unknown, next: () => void) => {
      req.userId = String(req.headers["x-test-user"] ?? "") || undefined;
      const scope = req.headers["x-test-token"];
      if (scope === "read" || scope === "write") {
        req.apiToken = { tokenId: "test-token", userId: USER, projectId: PROJECT, scopes: [scope] };
      }
      next();
    });
    await app.listen(0, "127.0.0.1");
    origin = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED = "1";
  });
  afterAll(async () => {
    await app?.close();
    if (oldFlag === undefined) delete process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED;
    else process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED = oldFlag;
  });
  async function send(user = USER, body: unknown = candidate, suffix = "/knowledge-base/requirements/preview", method = "POST", token?: string) {
    const response = await fetch(`${origin}/api/projects/${PROJECT}${suffix}`, {
      method, headers: { "content-type": "application/json", "x-test-user": user, ...(token ? { "x-test-token": token } : {}) },
      body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
  }
  function expectNoBillingAccess() {
    expect(projectLookup.getProjectBasics).not.toHaveBeenCalled();
    expect(billing.assertProjectWritable).not.toHaveBeenCalled();
  }

  it.each(["/knowledge-base/requirements/preview", "/knowledge-base/requirements/preview/", "/KNOWLEDGE-BASE/REQUIREMENTS/PREVIEW"])(
    "serves a member's read-only preview on a locked project through %s", async suffix => {
      const response = await send(USER, candidate, suffix);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ canPublish: false, authoritativeRequirementId: null, disposition: "preview_only" });
      expectNoBillingAccess();
    });
  it.each(["", "foreign-user"])("refuses unauthorized caller %s before any billing access", async user => {
    for (const flag of [undefined, "1"]) {
      if (flag === undefined) delete process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED;
      else process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED = flag;
      expect(await send(user, { malformed: true })).toEqual({ status: 403, body: { error: "Project membership required" } });
      expectNoBillingAccess();
    }
  });
  it("keeps disabled and invalid-candidate outcomes behind membership on locked projects", async () => {
    delete process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED;
    expect(await send()).toEqual({ status: 503, body: { error: "REQUIREMENT_PREVIEW_DISABLED" } });
    process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED = "1";
    expect(await send(USER, { ...candidate, title: "" })).toEqual({ status: 400, body: { error: "TITLE_INVALID" } });
    expectNoBillingAccess();
  });
  it("preserves token scope and project membership before reaching a read-only preview", async () => {
    expect((await send(USER, candidate, undefined, "POST", "read")).status).toBe(403);
    expect((await send(USER, candidate, undefined, "POST", "write")).status).toBe(200);
    expectNoBillingAccess();
  });
  it("keeps neighboring KB writes subject to the existing billing lock", async () => {
    const response = await send(USER, {}, "/knowledge-base/documents");
    expect(response).toEqual({ status: 403, body: { error: "billing lock must not be reached by preview" } });
    expect(billing.assertProjectWritable).toHaveBeenCalledWith("org", PROJECT);
    expect(legacy.requireProjectAccess).not.toHaveBeenCalled();
  });
});

function candidate() {
  return {
    documentType: "requirement_note",
    title: "  Disallow unverified stock withdrawals  ",
    contentJson: {
      schemaVersion: "tesbo-requirement/1",
      description: "  Warehouse transactions must be authorized.  ",
      criteria: [
        { key: "AC-1", text: " An unauthorized request is refused. ", normative: true },
        { key: "AC-2", text: " Show a contextual error. ", normative: false }
      ]
    }
  };
}

describe("Work Package A typed requirement candidate (preview-only)", () => {
  it("validates canonical criteria and reports a deterministic, nonpublishable preview", () => {
    const input = candidate();
    const before = JSON.stringify(input);
    const result = previewNativeRequirement(input);
    expect(result).toMatchObject({
      documentType: "requirement_note", title: "Disallow unverified stock withdrawals",
      contentJson: { description: "Warehouse transactions must be authorized.",
        criteria: [{ key: "AC-1", text: "An unauthorized request is refused.", normative: true },
          { key: "AC-2", text: "Show a contextual error.", normative: false }] },
      canPublish: false, disposition: "preview_only", skillContext: { status: "unavailable" },
      publicationBlocker: "SKILL_CONTEXT_UNAVAILABLE", authoritativeRequirementId: null,
      coverageAssertion: "none", executionAssertion: "none"
    });
    expect(result.candidateDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(previewNativeRequirement(candidate()).candidateDigest).toBe(result.candidateDigest);
    expect(JSON.stringify(input)).toBe(before);
    expect(result).not.toHaveProperty("requirementId");
    expect(result).not.toHaveProperty("approvedVersionId");
  });

  it("refuses malformed objects, external/mirror controls and undeclared keys", () => {
    for (const raw of [null, [], "a", 1, { ...candidate(), sourceProvider: "jira" },
      { ...candidate(), isReadOnly: false },
      { ...candidate(), documentType: "general" },
      { ...candidate(), contentJson: { ...candidate().contentJson, scope: "foreign project" } },
      { ...candidate(), contentJson: { ...candidate().contentJson, schemaVersion: "next" } },
      { ...candidate(), title: "\u0000" },
      { ...candidate(), title: "" }]) {
      expect(() => previewNativeRequirement(raw)).toThrow(NativeRequirementPreviewError);
    }
  });

  it("requires bounded unique semantic criterion identities and explicit normative booleans", () => {
    const base = candidate();
    const current = base.contentJson;
    for (const criteria of [[], Array(51).fill(current.criteria[0]),
      [current.criteria[0], current.criteria[0]],
      [{ ...current.criteria[0], key: "AC-0" }],
      [{ ...current.criteria[0], key: "AC-1;DROP" }],
      [{ ...current.criteria[0], key: "AC-00000" }],
      [{ ...current.criteria[0], normative: "true" }],
      [{ ...current.criteria[0], text: "   " }],
      [{ ...current.criteria[0], description: "hidden" }]]) {
      const input = { ...base, contentJson: { ...current, criteria } };
      expect(() => previewNativeRequirement(input)).toThrow(NativeRequirementPreviewError);
    }
    expect(() => previewNativeRequirement({ ...base,
      contentJson: { ...current, description: "X".repeat(20001) }
    })).toThrow(NativeRequirementPreviewError);
    expect(() => previewNativeRequirement({ ...base, contentJson: { ...current,
      criteria: [{ key: "AC-9999", text: "Last supported number", normative: true }]
    } })).not.toThrow();
  });

  function controller(access: jest.Mock) {
    const legacy = {
      requireProjectAccess: access,
      createKnowledgeDocument: jest.fn(),
      updateKnowledgeDocument: jest.fn(),
      approveAiMemory: jest.fn()
    };
    return { instance: new LegacyController(legacy as never, {} as never, {} as never, {} as never), legacy };
  }

  const previousFlag = process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED;
  afterEach(() => {
    if (previousFlag === undefined) delete process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED;
    else process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED = previousFlag;
  });

  it("is off by default and checks the project principal before revealing even availability", async () => {
    delete process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED;
    const access = jest.fn().mockResolvedValue({ id: PROJECT });
    const { instance, legacy } = controller(access);
    await expect(instance.previewNativeRequirementCandidate({ userId: USER } as never, PROJECT, candidate()))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(access).toHaveBeenCalledWith(USER, PROJECT);
    await expect(instance.previewNativeRequirementCandidate({ userId: null } as never, PROJECT, candidate()))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(access).toHaveBeenCalledTimes(1);
    expect(legacy.createKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("is tenant-deny-first, even when input is invalid and preview is enabled", async () => {
    process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED = "1";
    const access = jest.fn().mockRejectedValue(new ForbiddenException("Project membership required"));
    const { instance, legacy } = controller(access);
    await expect(instance.previewNativeRequirementCandidate({ userId: USER } as never, PROJECT, { suspicious: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(access).toHaveBeenCalledWith(USER, PROJECT);
    expect(legacy.createKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("previews only authorized valid candidates; invalid payloads never create official records", async () => {
    process.env.TESBO_REQUIREMENT_PREVIEW_ENABLED = "1";
    const access = jest.fn().mockResolvedValue({ id: PROJECT });
    const { instance, legacy } = controller(access);
    const result = await instance.previewNativeRequirementCandidate({ userId: USER } as never, PROJECT, candidate());
    expect(result.canPublish).toBe(false);
    expect(result.publicationBlocker).toBe("SKILL_CONTEXT_UNAVAILABLE");
    await expect(instance.previewNativeRequirementCandidate({ userId: USER } as never, PROJECT, { ...candidate(), title: "" }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(legacy.createKnowledgeDocument).not.toHaveBeenCalled();
    expect(legacy.updateKnowledgeDocument).not.toHaveBeenCalled();
    expect(legacy.approveAiMemory).not.toHaveBeenCalled();
  });
});
