import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { LegacyController } from "./legacy.controller";
import { NativeRequirementPreviewError, previewNativeRequirement } from "./native-requirement-preview";

const USER = "00000000-0000-4000-8000-000000000001";
const PROJECT = "00000000-0000-4000-8000-000000000002";

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
