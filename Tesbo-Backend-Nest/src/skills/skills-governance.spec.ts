import { classifySkillResolution, findSkillAssignmentConflicts, requirementBundleTargets, reviewedSkillTarget, resolveEffectiveSkills, skillResolutionDigest, skillResolutionMatches, type EffectiveSkill } from "./skills-governance";

const target = { module: "requirements", subtype: "functional", operation: "requirement_revision" };
const linkTarget = { ...target, operation: "requirement_case_link" };
const row = (id: string, versionId = "11111111-1111-4111-8111-111111111111", digest = "a".repeat(64)) => ({
  assignment_id: id, module: "requirements", subtype: "functional", operation: "requirement_revision",
  skill_document_id: "22222222-2222-4222-8222-222222222222", skill_version_id: versionId,
  skill_title: "Requirements authoring", skill_key: "REQ-AUTHORING", version_number: 1, content_digest: digest
});

function query(rows: Array<Record<string, any>>) {
  return { query: jest.fn().mockResolvedValue({ rows }) };
}

describe("governed skills resolution", () => {
  it("deduplicates the typed targets a bundle needs", () => {
    expect(requirementBundleTargets([
      { opType: "requirement_revision" }, { opType: "requirement_revision" },
      { opType: "testcase_create" }, { opType: "requirement_case_link" }
    ])).toEqual([
      { module: "requirements", subtype: "functional", operation: "requirement_case_link" },
      { module: "requirements", subtype: "functional", operation: "requirement_revision" },
      { module: "test_cases", subtype: "manual", operation: "testcase_create" }
    ]);
  });

  it("resolves link authority only for explicit nonempty carry-forward selections", () => {
    expect(requirementBundleTargets([{ opType: "requirement_revision" }])).toEqual([target]);
    expect(requirementBundleTargets([{ opType: "requirement_revision", carryForwardLinks: [] }])).toEqual([target]);
    expect(requirementBundleTargets([{ opType: "requirement_revision", carryForwardLinks: [{ linkId: "selected" }] },
      { opType: "requirement_case_link" }])).toEqual([linkTarget, target]);
  });

  it("reads only an intact historical pin for the requested target, without resolving a new assignment", async () => {
    const pinned = await resolveEffectiveSkills(query([row("shared")]), "project", [target, linkTarget]);
    const link = reviewedSkillTarget(pinned, linkTarget);
    expect(link).toMatchObject({ assignmentId: "shared", target: linkTarget, skillVersionId: pinned.assignments[0].skillVersionId });
    expect(reviewedSkillTarget({ ...pinned, digest: "f".repeat(64) }, linkTarget)).toBeNull();
    const one = await resolveEffectiveSkills(query([row("shared")]), "project", [target]);
    expect(reviewedSkillTarget(one, linkTarget)).toBeNull();
    const duplicated = [pinned.assignments[0], pinned.assignments[0]];
    expect(reviewedSkillTarget({ ...pinned, assignments: duplicated, digest: skillResolutionDigest(duplicated) }, linkTarget)).toBeNull();
    expect(reviewedSkillTarget({ ...pinned, conflicts: [{ ...linkTarget, matches: 2 }] }, linkTarget)).toBeNull();
    expect(reviewedSkillTarget({ ...pinned, assignments: [null] }, linkTarget)).toBeNull();
  });

  it("returns an unassigned basis when no active assignment matches", async () => {
    const result = await resolveEffectiveSkills(query([]), "project", [target]);
    expect(result).toMatchObject({ status: "unassigned", assignments: [], digest: null });
    expect(result.missing).toEqual([target]);
  });

  it("fails closed when more than one wildcard or exact assignment matches", async () => {
    const result = await resolveEffectiveSkills(query([row("a"), row("b")]), "project", [target]);
    expect(result.status).toBe("conflict");
    expect(result.conflicts).toEqual([{ ...target, matches: 2 }]);
    expect(result.digest).toBeNull();
  });

  it("pins the exact assignment/version/digest basis and detects a change", async () => {
    const first = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    const second = await resolveEffectiveSkills(query([row("a", "33333333-3333-4333-8333-333333333333", "b".repeat(64))]), "project", [target]);
    expect(first.status).toBe("resolved");
    expect(skillResolutionMatches(first, first)).toBe(true);
    expect(first.digest).not.toBe(second.digest);
    expect(skillResolutionMatches(first, second)).toBe(false);
  });

  it("does not treat a missing or unassigned pinned basis as authorizing", async () => {
    const resolved = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    expect(skillResolutionMatches({ status: "unassigned" }, resolved)).toBe(false);
    expect(skillResolutionMatches(null, resolved)).toBe(false);
    expect(skillResolutionDigest([])).toHaveLength(64);
  });

  it("canonicalizes the full assignment and target basis without changing the input", async () => {
    const { assignments } = await resolveEffectiveSkills(query([row("shared")]), "project", [target, linkTarget]);
    const original = JSON.stringify(assignments);
    expect(skillResolutionDigest(assignments)).toBe(skillResolutionDigest([...assignments].reverse()));
    expect(JSON.stringify(assignments)).toBe(original);
  });

  it("retains each wildcard-expanded obligation with the same basis across target order and time", async () => {
    const wildcard = { ...row("shared"), operation: "*" };
    const first = await resolveEffectiveSkills(query([wildcard]), "project", [target, linkTarget], "2026-11-22T10:00:00Z");
    const second = await resolveEffectiveSkills(query([wildcard]), "project", [linkTarget, target], "2026-11-22T10:00:01Z");
    expect(first.assignments).toHaveLength(2);
    expect(first.assignments.map(skill => skill.target.operation).sort()).toEqual(["requirement_case_link", "requirement_revision"]);
    expect(first.digest).toBe(second.digest);
    expect(first.assignments).toEqual(second.assignments);
    expect(first.resolvedAt).not.toBe(second.resolvedAt);
    expect(skillResolutionMatches(first, second)).toBe(true);
  });

  it("retains conflict and missing details when separate required targets have both failures", async () => {
    const db = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row("a"), row("b")] }) };
    const result = await resolveEffectiveSkills(db, "project", [target, linkTarget]);
    expect(result.status).toBe("conflict");
    expect(result.missing).toEqual([target]);
    expect(result.conflicts).toEqual([{ ...linkTarget, matches: 2 }]);
    expect(result.digest).toBeNull();
  });

  it("does not accept a matching digest attached to a different pinned basis", async () => {
    const current = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    const forged = { ...current, assignments: current.assignments.map(skill => ({ ...skill, target: linkTarget })) };
    expect(skillResolutionMatches(forged, current)).toBe(false);
  });

  it("refuses malformed pinned records without throwing", async () => {
    const current = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    for (const assignments of [[null], [{}], [{ ...current.assignments[0], target: null }]]) {
      expect(() => skillResolutionMatches({ status: "resolved", assignments }, current)).not.toThrow();
      expect(skillResolutionMatches({ status: "resolved", assignments }, current)).toBe(false);
    }
  });

  it("continues to match an intact older pin without an explicit digest", async () => {
    const current = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    expect(skillResolutionMatches({ status: "resolved", assignments: current.assignments }, current)).toBe(true);
  });

  it("verifies an intact historical wildcard pin before comparing its canonical basis", async () => {
    const current = await resolveEffectiveSkills(query([{ ...row("shared"), operation: "*" }]), "project", [target, linkTarget]);
    const historicalPin = {
      ...current,
      assignments: [...current.assignments].reverse(),
      // Exact pre-canonical digest captured from the unchanged resolver's red baseline.
      digest: "80ad86736c700bedcbdcff0f2c059c041df559049166e8277d80c7f045b03efc"
    };
    expect(historicalPin.digest).not.toBe(current.digest);
    expect(skillResolutionMatches(historicalPin, current)).toBe(true);
    expect(skillResolutionMatches({ ...historicalPin, digest: "f".repeat(64) }, current)).toBe(false);
  });

  it("classifies a previously resolved basis that disappears as stale", async () => {
    const pinned = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    const current = await resolveEffectiveSkills(query([]), "project", [target]);
    expect(classifySkillResolution(pinned, current)).toBe("stale");
    expect(skillResolutionMatches(pinned, current)).toBe(false);
    expect(current.missing).toEqual([target]);
  });

  it.each([null, { status: "unassigned" }, { status: "resolved", assignments: [null] }])(
    "classifies an initial absence without a valid resolved pin as unavailable (%j)", async pinned => {
      const current = await resolveEffectiveSkills(query([]), "project", [target]);
      expect(classifySkillResolution(pinned, current)).toBe("unavailable");
    }
  );

  it("classifies matching and changed resolved bases without mutating either record", async () => {
    const pinned = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    const changed = await resolveEffectiveSkills(query([row("b")]), "project", [target]);
    const before = JSON.stringify({ pinned, changed });
    expect(classifySkillResolution(pinned, pinned)).toBe("current");
    expect(classifySkillResolution(pinned, changed)).toBe("stale");
    expect(classifySkillResolution(null, changed)).toBe("stale");
    expect(JSON.stringify({ pinned, changed })).toBe(before);
  });

  it("classifies actual ambiguity as conflict even when another target is missing", async () => {
    const pinned = await resolveEffectiveSkills(query([row("a")]), "project", [target, linkTarget]);
    const db = { query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row("a"), row("b")] }) };
    const current = await resolveEffectiveSkills(db, "project", [target, linkTarget]);
    expect(classifySkillResolution(pinned, current)).toBe("conflict");
    expect(classifySkillResolution(null, current)).toBe("conflict");
    expect(current.missing).toEqual([target]);
    expect(current.conflicts).toEqual([{ ...linkTarget, matches: 2 }]);
  });

  it("uses the same eligible-row query with separate concrete-read and scope-overlap modes", async () => {
    const wildcard = { module: "*", subtype: "*", operation: "*" };
    const db = query([{ ...row("new"), ...wildcard }, row("other")]);
    await resolveEffectiveSkills(db, "project", [wildcard]);
    const conflicts = await findSkillAssignmentConflicts(db, "project", wildcard, "new");
    const [readCall, overlapCall] = db.query.mock.calls;
    expect(readCall[0]).toBe(overlapCall[0]);
    expect(readCall[1]).toEqual(["project", "*", "*", "*", false]);
    expect(overlapCall[1]).toEqual(["project", "*", "*", "*", true]);
    expect(conflicts).toEqual([{ assignmentId: "other", target }]);
  });

  it("excludes only the replacement identity from scope overlap results", async () => {
    const wildcardRow = { ...row("wildcard"), module: "*", subtype: "*", operation: "*" };
    const db = query([row("replacement"), wildcardRow, row("other")]);
    expect(await findSkillAssignmentConflicts(db, "project", target, "replacement")).toEqual([
      { assignmentId: "wildcard", target: { module: "*", subtype: "*", operation: "*" } },
      { assignmentId: "other", target }
    ]);
    expect(db.query.mock.calls[0][1]).toEqual(["project", target.module, target.subtype, target.operation, true]);
  });

  it.each([
    ["assignment", (skill: EffectiveSkill) => ({ ...skill, assignmentId: "other-assignment" })],
    ["module", (skill: EffectiveSkill) => ({ ...skill, target: { ...skill.target, module: "test_cases" } })],
    ["subtype", (skill: EffectiveSkill) => ({ ...skill, target: { ...skill.target, subtype: "security" } })],
    ["operation", (skill: EffectiveSkill) => ({ ...skill, target: linkTarget })],
    ["document", (skill: EffectiveSkill) => ({ ...skill, skillDocumentId: "other-document" })],
    ["version", (skill: EffectiveSkill) => ({ ...skill, skillVersionId: "other-version" })],
    ["content", (skill: EffectiveSkill) => ({ ...skill, contentDigest: "b".repeat(64) })]
  ] as const)("changes the digest when the %s binding changes", async (_field, change) => {
    const current = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    expect(skillResolutionDigest(current.assignments.map(change))).not.toBe(current.digest);
  });

  it("excludes display metadata from the governing digest", async () => {
    const current = await resolveEffectiveSkills(query([row("a")]), "project", [target]);
    const renamed = current.assignments.map(skill => ({ ...skill, skillTitle: "Renamed", skillKey: "NEW-LABEL", versionNumber: 99 }));
    expect(skillResolutionDigest(renamed)).toBe(current.digest);
  });
});
