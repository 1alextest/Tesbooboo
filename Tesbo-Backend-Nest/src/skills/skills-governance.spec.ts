import { requirementBundleTargets, resolveEffectiveSkills, skillResolutionDigest, skillResolutionMatches } from "./skills-governance";

const target = { module: "requirements", subtype: "functional", operation: "requirement_revision" };
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
});
