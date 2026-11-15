import { projectCurrentCacheGraph, type CurrentSourceProjection } from "./current-cache-graph-projection";
import { prepareQaChangeReviewReceipt } from "./qa-change-review-receipt";

const base: CurrentSourceProjection = {
  projectId: "project-a",
  inventoryStatus: "complete",
  diagnostics: [],
  sourceScopes: [{
    provider: "jira", mappingId: "mapping", connectionId: "connection",
    namespace: "https://example.invalid", remoteProjectId: "QA", disconnected: false
  }],
  requirements: [{
    projectId: "project-a", provider: "jira", rowId: "req-1",
    key: "QA-1", remoteId: "remote-1", summary: "Before", description: null,
    propertiesJsonbText: null
  }],
  cases: [{
    projectId: "project-a", id: "case-1", title: "Draft case",
    description: null, preconditions: null, postconditions: null,
    stepsJsonbText: null, testData: null,
    jiraIssueKey: "QA-1", linearIssueKey: null, notionPageId: null
  }, {
    projectId: "project-a", id: "case-2", title: "Unlinked draft",
    description: null, preconditions: null, postconditions: null,
    stepsJsonbText: null, testData: null,
    jiraIssueKey: null, linearIssueKey: null, notionPageId: null
  }]
};
const capture = (rows: CurrentSourceProjection) => projectCurrentCacheGraph(rows);
const changed = (summary: string): CurrentSourceProjection => ({
  ...base, requirements: base.requirements.map((requirement) => ({ ...requirement, summary }))
});

describe("QA graph change-review receipt", () => {
  it("creates stable source-revision-bound review work without claiming tests ran or coverage", () => {
    const before = capture(base);
    const after = capture(changed("After"));
    const receipt = prepareQaChangeReviewReceipt(before, after)!;
    expect(receipt.id).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt).toEqual(prepareQaChangeReviewReceipt(before, after));
    expect(receipt.status).toBe("needs_qa_triage");
    expect(receipt.candidates).toEqual([{
      caseNodeId: JSON.stringify(["test_case", "project-a", "case-1"]),
      reasons: ["requirement_reference"],
      requirementNodeIds: [JSON.stringify(["cached_requirement", "project-a", "jira", "req-1"])]
    }]);
    expect(receipt.unlinkedCaseNodeIds).toEqual([JSON.stringify(["test_case", "project-a", "case-2"])]);
    expect(receipt.evidence).toEqual({
      basis: "cached_source_reference_only",
      upstreamFreshness: "unverified",
      coverageAssertion: "none",
      executionAssertion: "none",
      verification: "not_performed"
    });
  });

  it("does not generate repetitive work for identical captures, including persistent unlinked cases", () => {
    expect(prepareQaChangeReviewReceipt(capture(base), capture(base))).toBeNull();
    expect(prepareQaChangeReviewReceipt(capture(changed("After")), capture(changed("After")))).toBeNull();
  });

  it("does not suppress requirement changes just because no case links exist", () => {
    const rows = { ...base, cases: base.cases.map((c) => ({ ...c, jiraIssueKey: null })) };
    const before = capture(rows);
    const after = capture({
      ...rows, requirements: rows.requirements.map((r) => ({ ...r, summary: "Changed" }))
    });
    const receipt = prepareQaChangeReviewReceipt(before, after)!;
    expect(receipt).not.toBeNull();
    expect(receipt.candidates).toEqual([]);
    expect(receipt.unlinkedCaseNodeIds).toHaveLength(2);
  });

  it("versions separate source changes and handles reversed comparisons as distinct revisions", () => {
    const before = capture(base);
    const after = capture(changed("After"));
    const third = capture(changed("Third"));
    const ids = [
      prepareQaChangeReviewReceipt(before, after)!.id,
      prepareQaChangeReviewReceipt(after, third)!.id,
      prepareQaChangeReviewReceipt(after, before)!.id
    ];
    expect(new Set(ids).size).toBe(3);
  });

  it("refuses partial caches, disconnected providers, scope changes and foreign projects", () => {
    const before = capture(base);
    expect(() => prepareQaChangeReviewReceipt(before, capture({
      ...base, inventoryStatus: "unknown"
    }))).toThrow("source inventory is not complete");
    expect(() => prepareQaChangeReviewReceipt(before, capture({
      ...base, sourceScopes: [{ ...base.sourceScopes[0], disconnected: true }]
    }))).toThrow("source inventory is not complete");
    expect(() => prepareQaChangeReviewReceipt(before, capture({
      ...base, sourceScopes: [{ ...base.sourceScopes[0], connectionId: "other-connection" }]
    }))).toThrow("source scopes differ");
    expect(() => prepareQaChangeReviewReceipt(before, capture({
      ...base, projectId: "project-b"
    }))).toThrow();
  });

  it("reorders equivalent input rows without changing receipt content or mutating sources", () => {
    const previous = JSON.stringify(base);
    const after = changed("After");
    const reversed = { ...after, cases: [...after.cases].reverse(), requirements: [...after.requirements].reverse() };
    expect(prepareQaChangeReviewReceipt(capture(base), capture(after)))
      .toEqual(prepareQaChangeReviewReceipt(capture(base), capture(reversed)));
    expect(JSON.stringify(base)).toBe(previous);
  });
});
