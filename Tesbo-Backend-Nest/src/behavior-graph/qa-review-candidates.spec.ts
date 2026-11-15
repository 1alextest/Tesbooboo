import { projectCurrentCacheGraph, type CurrentSourceProjection } from "./current-cache-graph-projection";
import { deriveQaReviewCandidates } from "./qa-review-candidates";

const base: CurrentSourceProjection = {
  projectId: "p", inventoryStatus: "complete", diagnostics: [],
  sourceScopes: [{ provider: "jira", mappingId: "m", connectionId: "c",
    namespace: "https://example.invalid", remoteProjectId: "X", disconnected: false }],
  requirements: [
    { projectId: "p", provider: "jira", rowId: "r1", remoteId: "up1", key: "X-1",
      summary: "A", description: null, propertiesJsonbText: null },
    { projectId: "p", provider: "jira", rowId: "r2", remoteId: "up2", key: "X-2",
      summary: "B", description: null, propertiesJsonbText: null }
  ],
  cases: Array.from({ length: 6 }, (_, i) => ({
    projectId: "p", id: `c${i + 1}`, title: `Draft ${i + 1}`,
    description: null, preconditions: null, postconditions: null,
    stepsJsonbText: null, testData: null,
    jiraIssueKey: i < 3 ? "X-1" : null,
    linearIssueKey: null, notionPageId: null
  }))
};
const capture = (rows: CurrentSourceProjection) => projectCurrentCacheGraph(rows);
const caseId = (n: number) => JSON.stringify(["test_case", "p", `c${n}`]);
const requirementId = (n: number) => JSON.stringify(["cached_requirement", "p", "jira", `r${n}`]);

describe("QA review candidates over native graph references", () => {
  it("nominates three explicitly linked draft cases after a requirement edit, without a coverage claim", () => {
    const before = capture(base);
    const after = capture({ ...base, requirements: base.requirements.map((r, i) =>
      i === 0 ? { ...r, description: "changed" } : r) });
    const result = deriveQaReviewCandidates(before, after);
    expect(result.candidates).toEqual([1, 2, 3].map((n) => ({
      caseNodeId: caseId(n), reasons: ["requirement_reference"],
      requirementNodeIds: [requirementId(1)]
    })));
    expect(result.unlinkedCaseNodeIds).toEqual([4, 5, 6].map(caseId));
    expect(result.coverageAssertion).toBe("none");
    expect(result.executionAssertion).toBe("none");
    expect(result.upstreamFreshness).toBe("unverified");
  });

  it("nominates edited draft text without asserting a requirement was changed", () => {
    const result = deriveQaReviewCandidates(capture(base), capture({
      ...base, cases: base.cases.map((c, i) => i === 3 ? { ...c, description: "Clearer expected result" } : c)
    }));
    expect(result.candidates).toEqual([{
      caseNodeId: caseId(4), reasons: ["case_changed"], requirementNodeIds: []
    }]);
  });

  it("reports both old and new reference endpoints on a retargeted and content-edited case", () => {
    const result = deriveQaReviewCandidates(capture(base), capture({
      ...base, cases: base.cases.map((c, i) => i === 0 ? { ...c, jiraIssueKey: "X-2", description: "Updated for the new requirement" } : c)
    }));
    expect(result.candidates).toEqual([{
      caseNodeId: caseId(1), reasons: ["case_changed", "reference_changed"],
      requirementNodeIds: [requirementId(1), requirementId(2)]
    }]);
  });

  it("retains both reasons for a content edit and removed link without inventing its replacement", () => {
    const result = deriveQaReviewCandidates(capture(base), capture({
      ...base, cases: base.cases.map((c, i) => i === 0 ? { ...c, jiraIssueKey: null, description: "Standalone scenario after unlinking" } : c)
    }));
    expect(result.candidates[0]).toEqual({
      caseNodeId: caseId(1), reasons: ["case_changed", "reference_changed"],
      requirementNodeIds: [requirementId(1)]
    });
    expect(result.unlinkedCaseNodeIds).toContain(caseId(1));
  });

  // Native reference fields version edges, not case-content-v1. A link-only edit must not
  // manufacture a direct content-change reason; combined edits above retain both assertions.
  it.each(["X-2", null])("keeps a link-only change to %s distinct from a case-content edit", (jiraIssueKey) => {
    const result = deriveQaReviewCandidates(capture(base), capture({
      ...base, cases: base.cases.map((c, i) => i === 0 ? { ...c, jiraIssueKey } : c)
    }));
    expect(result.candidates).toEqual([{
      caseNodeId: caseId(1), reasons: ["reference_changed"],
      requirementNodeIds: jiraIssueKey === null ? [requirementId(1)] : [requirementId(1), requirementId(2)]
    }]);
    expect(result.unlinkedCaseNodeIds).toEqual((jiraIssueKey === null ? [1, 4, 5, 6] : [4, 5, 6]).map(caseId));
    expect(result.coverageAssertion).toBe("none");
    expect(result.executionAssertion).toBe("none");
    expect(result.upstreamFreshness).toBe("unverified");
  });

  it("reports no candidates for an unchanged source despite a new capture", () => {
    const result = deriveQaReviewCandidates(capture(base), capture(base));
    expect(result.candidates).toEqual([]);
    expect(result.unlinkedCaseNodeIds).toHaveLength(3);
  });

  it("rejects unsynced links, mismatched projects and changed source scope", () => {
    const good = capture(base);
    const unresolved = capture({
      ...base, cases: base.cases.map((c, i) => i === 0 ? { ...c, jiraIssueKey: "MISSING" } : c)
    });
    expect(() => deriveQaReviewCandidates(good, unresolved)).toThrow("not complete");
    expect(() => deriveQaReviewCandidates(good, capture({ ...base, projectId: "other" })))
      .toThrow();
    expect(() => deriveQaReviewCandidates(good, capture({
      ...base, sourceScopes: [{ ...base.sourceScopes[0], mappingId: "m2" }]
    }))).toThrow("source scopes differ");
  });

  it("is stable under reordered native rows and does not mutate inputs", () => {
    const original = JSON.stringify(base);
    const before = capture(base);
    const changed = {
      ...base,
      requirements: [...base.requirements].reverse().map((r) =>
        r.rowId === "r1" ? { ...r, summary: "edited" } : r),
      cases: [...base.cases].reverse()
    };
    const result = deriveQaReviewCandidates(before, capture(changed));
    expect(result.candidates.map((candidate) => candidate.caseNodeId)).toEqual([1, 2, 3].map(caseId));
    expect(JSON.stringify(base)).toBe(original);
  });
});
