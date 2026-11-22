import { comparePinnedSkillResolution, resolveGovernedSkills, type EffectiveSkillContext,
  type GovernedSkillInventory, type GovernedSkillAssignment, type GovernedSkillVersion } from "./governed-skill-resolver";

const sha = (c: string) => c.repeat(64);
const context: EffectiveSkillContext = {
  workspaceId: "workspace-1", projectId: "project-1", principalId: "human-1",
  module: "requirements", subtype: "functional", audience: "internal",
  operation: "author", phase: "draft", asOf: "2026-11-22T00:00:00Z"
};
const core: GovernedSkillVersion = {
  skillId: "core", versionId: "core-v1", contentSha256: sha("a"),
  state: "approved", approvedBy: "human-reviewer", approvedReceiptSha256: sha("b"), dependencies: []
};
const coreAssignment: GovernedSkillAssignment = {
  assignmentId: "core-assignment", skillId: "core", versionId: "core-v1",
  workspaceId: context.workspaceId, projectId: context.projectId,
  module: context.module, subtype: context.subtype, audience: context.audience,
  operation: context.operation, phase: context.phase, state: "active",
  effectiveFrom: "2026-11-01T00:00:00Z", effectiveUntil: null,
  kind: "core", precedence: 10, compositionId: null, compositionReceiptSha256: null,
  humanActivatedBy: "human-admin", assignmentApprovalSha256: sha("c"), weakensMandatoryRoot: false
};
function inventory(overrides: Partial<GovernedSkillInventory> = {}): GovernedSkillInventory {
  return { workspaceId: context.workspaceId, projectId: context.projectId,
    status: "complete", authorityRevision: "policy-revision-1",
    versions: [core], assignments: [coreAssignment], ...overrides };
}
const denied = (c: EffectiveSkillContext, data: GovernedSkillInventory, code: string) => {
  const result = resolveGovernedSkills(c, data);
  expect(result.status).toBe("blocked");
  if (result.status === "blocked") {
    expect(result.code).toBe(code);
    expect(result.skills).toEqual([]);
    expect(result.publicationAuthority).toBe("none");
  }
};

describe("effective governed Skill resolution (pure, native-owner inputs only)", () => {
  it("deterministically pins an exact approved and human-activated Skill without publication rights", () => {
    const a = resolveGovernedSkills(context, inventory());
    const b = resolveGovernedSkills(context, inventory());
    expect(a).toEqual(b);
    expect(a.status).toBe("resolved");
    if (a.status === "resolved") {
      expect(a.skills).toEqual([{ assignmentId: "core-assignment", skillId: "core", versionId: "core-v1",
        contentSha256: sha("a"), precedence: 10, kind: "core" }]);
      expect(a.digest).toMatch(/^[a-f0-9]{64}$/);
      expect(a.publicationAuthority).toBe("none");
      expect(comparePinnedSkillResolution(a.digest, a)).toBe("current");
      expect(comparePinnedSkillResolution(sha("f"), a)).toBe("SKILL_CONTEXT_STALE");
    }
  });

  it.each(["partial", "unknown"] as const)("%s inventory is unavailable, never an empty safe assignment", status => {
    denied(context, inventory({ status }), "SKILL_CONTEXT_UNAVAILABLE");
  });
  it("cross-project/workspace and invalid server context are refused", () => {
    denied(context, inventory({ projectId: "other-project" }), "SKILL_CONTEXT_UNAVAILABLE");
    denied({ ...context, principalId: "" }, inventory(), "SKILL_CONTEXT_UNAVAILABLE");
    denied({ ...context, asOf: "2026-02-30T00:00:00Z" }, inventory(), "SKILL_CONTEXT_UNAVAILABLE");
  });
  it("does not implicitly use a different subtype, audience, operation, phase or project", () => {
    for (const changed of [
      { subtype: "security" }, { audience: "external" }, { operation: "approve" },
      { phase: "release" }, { projectId: "other-project" }
    ]) {
      const c = { ...context, ...changed };
      const value = changed.projectId ? inventory({ projectId: "other-project" }) : inventory();
      denied(c, value, changed.projectId ? "SKILL_ASSIGNMENT_CONFLICT" : "UNASSIGNED");
    }
  });
  it("inactive, future and expired assignments have no effective instruction", () => {
    denied(context, inventory({ assignments: [{ ...coreAssignment, state: "inactive" }] }), "UNASSIGNED");
    denied(context, inventory({ assignments: [{ ...coreAssignment, effectiveFrom: "2026-12-01T00:00:00Z" }] }), "UNASSIGNED");
    denied(context, inventory({ assignments: [{ ...coreAssignment, effectiveUntil: context.asOf }] }), "UNASSIGNED");
  });
  it("candidate, rejected or revoked versions never become effective merely through active assignment", () => {
    for (const state of ["candidate", "rejected", "revoked"] as const) {
      denied(context, inventory({ versions: [{ ...core, state }] }), "SKILL_CONTEXT_STALE");
    }
  });
  it("missing human activation, approved-version review and exact approval digest fail closed", () => {
    denied(context, inventory({ assignments: [{ ...coreAssignment, humanActivatedBy: null }] }), "SKILL_CONTEXT_STALE");
    denied(context, inventory({ assignments: [{ ...coreAssignment, assignmentApprovalSha256: null }] }), "SKILL_CONTEXT_STALE");
    denied(context, inventory({ versions: [{ ...core, approvedBy: null }] }), "SKILL_CONTEXT_STALE");
    denied(context, inventory({ versions: [{ ...core, approvedReceiptSha256: null }] }), "SKILL_CONTEXT_STALE");
  });
  it("rejects duplicate IDs, mismatched version owner and foreign-assignment contamination", () => {
    denied(context, inventory({ versions: [core, core] }), "SKILL_ASSIGNMENT_CONFLICT");
    denied(context, inventory({ assignments: [coreAssignment, coreAssignment] }), "SKILL_ASSIGNMENT_CONFLICT");
    denied(context, inventory({ versions: [{ ...core, skillId: "not-core" }] }), "SKILL_CONTEXT_STALE");
    denied(context, inventory({ assignments: [{ ...coreAssignment, projectId: "other-project" }] }), "SKILL_ASSIGNMENT_CONFLICT");
  });
  it("blocks an attempt to override the root mandatory provenance / security contract", () => {
    denied(context, inventory({ assignments: [{ ...coreAssignment, weakensMandatoryRoot: true }] }), "SKILL_ASSIGNMENT_CONFLICT");
  });
  it("does not resolve two active skills without an explicitly approved shared composition", () => {
    const adapter: GovernedSkillVersion = {
      skillId: "adapter", versionId: "adapter-v1", contentSha256: sha("d"),
      state: "approved", approvedBy: "reviewer", approvedReceiptSha256: sha("e"), dependencies: []
    };
    const row: GovernedSkillAssignment = { ...coreAssignment,
      assignmentId: "adapter-assignment", skillId: "adapter", versionId: "adapter-v1",
      kind: "adapter", precedence: 20 };
    denied(context, inventory({ versions: [core, adapter], assignments: [coreAssignment, row] }), "SKILL_ASSIGNMENT_CONFLICT");
    denied(context, inventory({ versions: [core, adapter], assignments: [
      { ...coreAssignment, compositionId: "composition-1", compositionReceiptSha256: sha("f") },
      { ...row, compositionId: "composition-2", compositionReceiptSha256: sha("f") }
    ] }), "SKILL_ASSIGNMENT_CONFLICT");
    const resolved = resolveGovernedSkills(context, inventory({ versions: [adapter, core], assignments: [
      { ...row, compositionId: "composition-1", compositionReceiptSha256: sha("f") },
      { ...coreAssignment, compositionId: "composition-1", compositionReceiptSha256: sha("f") }
    ] }));
    expect(resolved.status).toBe("resolved");
    if (resolved.status === "resolved") expect(resolved.skills.map(x => x.skillId)).toEqual(["core", "adapter"]);
  });
  it("detects duplicate effective owner, precedence ties and adapter without core", () => {
    const add = { ...coreAssignment, assignmentId: "second", precedence: 20 };
    denied(context, inventory({ assignments: [coreAssignment, add] }), "SKILL_ASSIGNMENT_CONFLICT");
    const b = { ...add, kind: "specialist" as const, skillId: "other", versionId: "other-v1",
      precedence: 10, compositionId: "composition", compositionReceiptSha256: sha("f") };
    const ov: GovernedSkillVersion = { ...core, skillId: "other", versionId: "other-v1" };
    denied(context, inventory({ versions: [core, ov], assignments: [
      { ...coreAssignment, compositionId: "composition", compositionReceiptSha256: sha("f") }, b
    ] }), "SKILL_ASSIGNMENT_CONFLICT");
    denied(context, inventory({ versions: [ov], assignments: [{ ...b, kind: "adapter" }] }), "SKILL_ASSIGNMENT_CONFLICT");
  });
  it("refuses self/missing/cyclic dependencies even for otherwise approved assignments", () => {
    denied(context, inventory({ versions: [{ ...core, dependencies: [{ skillId: "core", versionId: "core-v1" }] }] }), "SKILL_ASSIGNMENT_CONFLICT");
    denied(context, inventory({ versions: [{ ...core, dependencies: [{ skillId: "other", versionId: "other-v1" }] }] }), "SKILL_ASSIGNMENT_CONFLICT");
    const a = { ...core, dependencies: [{ skillId: "adapter", versionId: "adapter-v1" }] };
    const b = { ...core, skillId: "adapter", versionId: "adapter-v1",
      dependencies: [{ skillId: "core", versionId: "core-v1" }] };
    denied(context, inventory({ versions: [a, b], assignments: [
      { ...coreAssignment, compositionId: "shared", compositionReceiptSha256: sha("f") },
      { ...coreAssignment, assignmentId: "adapter-a", skillId: "adapter", versionId: "adapter-v1",
        kind: "adapter", precedence: 20, compositionId: "shared", compositionReceiptSha256: sha("f") }
    ] }), "SKILL_ASSIGNMENT_CONFLICT");
  });
  it("marks pins stale on assignment changes, role/context drift and revoked approved versions", () => {
    const first = resolveGovernedSkills(context, inventory());
    if (first.status !== "resolved") throw new Error("positive fixture failed");
    const mutated = [
      resolveGovernedSkills(context, inventory({ authorityRevision: "policy-revision-2" })),
      resolveGovernedSkills(context, inventory({ assignments: [{ ...coreAssignment, assignmentApprovalSha256: sha("d") }] })),
      resolveGovernedSkills({ ...context, principalId: "different-actor" }, inventory())
    ];
    for (const updated of mutated) {
      expect(updated.status).toBe("resolved");
      expect(comparePinnedSkillResolution(first.digest, updated)).toBe("SKILL_CONTEXT_STALE");
    }
    expect(comparePinnedSkillResolution(first.digest, resolveGovernedSkills(context, inventory({ versions: [{ ...core, state: "revoked" }] }))))
      .toBe("SKILL_CONTEXT_UNAVAILABLE");
  });
  it("permits a workspace-scoped assignment only inside the same verified workspace", () => {
    const result = resolveGovernedSkills(context, inventory({ assignments: [{ ...coreAssignment, projectId: null }] }));
    expect(result.status).toBe("resolved");
    denied(context, inventory({ assignments: [{ ...coreAssignment, workspaceId: "other-workspace", projectId: null }] }),
      "SKILL_ASSIGNMENT_CONFLICT");
  });
});
