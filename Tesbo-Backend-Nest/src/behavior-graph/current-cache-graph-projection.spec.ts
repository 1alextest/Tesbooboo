import { compareComparableGraphCaptures } from "./graph-comparison-gate";
import {
  CURRENT_CACHE_PROJECTION_CONTRACT,
  projectCurrentCacheGraph,
  type CurrentSourceProjection
} from "./current-cache-graph-projection";

const baseline: CurrentSourceProjection = {
  projectId: "project-1",
  inventoryStatus: "complete",
  diagnostics: [],
  sourceScopes: [{
    provider: "jira", mappingId: "map-1", connectionId: "connection-1",
    namespace: "https://example.atlassian.net", remoteProjectId: "JR"
  }],
  requirements: [{
    projectId: "project-1", provider: "jira", rowId: "cached-row-1",
    key: "JR-123", remoteId: "upstream-123", summary: "Original",
    description: "Exact source text", propertiesJsonbText: null
  }],
  cases: [{
    projectId: "project-1", id: "case-1", title: "Test the fix",
    description: null, preconditions: null, postconditions: null,
    stepsJsonbText: "[{\"action\":\"press\"}]", testData: null,
    jiraIssueKey: "JR-123", linearIssueKey: null, notionPageId: null
  }]
};

describe("current cached requirement projection", () => {
  it("is stable across row order and does not change input", () => {
    const before = JSON.stringify(baseline);
    const first = projectCurrentCacheGraph(baseline);
    const reordered = projectCurrentCacheGraph({
      ...baseline, sourceScopes: [...baseline.sourceScopes].reverse(),
      requirements: [...baseline.requirements].reverse(), cases: [...baseline.cases].reverse()
    });
    expect(first).toEqual(reordered);
    expect(JSON.stringify(baseline)).toBe(before);
    expect(first.contractId).toBe(CURRENT_CACHE_PROJECTION_CONTRACT);
    expect(first.snapshot?.nodes).toHaveLength(2);
    expect(first.snapshot?.edges[0].type).toBe("references_cached_requirement");
  });

  it("detects source content updates without promoting reference to coverage", () => {
    const changed = projectCurrentCacheGraph({
      ...baseline, requirements: baseline.requirements.map((r) => ({ ...r, summary: "Revised" }))
    });
    const impact = compareComparableGraphCaptures(projectCurrentCacheGraph(baseline), changed);
    expect(impact.modifiedNodes).toHaveLength(1);
    expect(impact.modifiedEdges).toEqual([]);
    expect(impact.directlyAffectedNodeIds).toHaveLength(1);
    expect(impact.directlyAffectedNodeIds[0]).toContain("cached_requirement");
  });

  it("reports changed old and new endpoints when a native link retargets", () => {
    const changedRows: CurrentSourceProjection = {
      ...baseline,
      requirements: [...baseline.requirements, {
        ...baseline.requirements[0], rowId: "cached-row-2", key: "JR-456", remoteId: "upstream-456"
      }],
      cases: [{ ...baseline.cases[0], jiraIssueKey: "JR-456" }]
    };
    const originalInSameInventory = projectCurrentCacheGraph({
      ...changedRows, cases: baseline.cases
    });
    const changed = projectCurrentCacheGraph(changedRows);
    const impact = compareComparableGraphCaptures(originalInSameInventory, changed);
    expect(impact.modifiedEdges).toHaveLength(1);
    expect(impact.directlyAffectedNodeIds).toHaveLength(3);
  });

  it.each(["incomplete", "unknown"] as const)(
    "refuses %s producer inventory without a comparable graph",
    (inventoryStatus) => {
      const capture = projectCurrentCacheGraph({
        ...baseline, inventoryStatus, requirements: []
      });
      expect(capture.snapshot).toBeNull();
      expect(() => compareComparableGraphCaptures(projectCurrentCacheGraph(baseline), capture))
        .toThrow("source inventory is not complete");
    }
  );

  it("refuses real-looking but unsynced source links and ambiguous keys", () => {
    const missing = projectCurrentCacheGraph({
      ...baseline, cases: [{ ...baseline.cases[0], jiraIssueKey: "JR-UNKNOWN" }]
    });
    expect(missing.snapshot).toBeNull();
    expect(missing.unresolvedDiagnostics.join(" ")).toContain("unresolved");
    const ambiguous = projectCurrentCacheGraph({
      ...baseline, requirements: [...baseline.requirements, {
        ...baseline.requirements[0], rowId: "second-local-row"
      }]
    });
    expect(ambiguous.snapshot).toBeNull();
    expect(ambiguous.unresolvedDiagnostics.join(" ")).toContain("ambiguous");
  });

  it("refuses disabled/missing mappings instead of fabricating requirements", () => {
    const capture = projectCurrentCacheGraph({ ...baseline, sourceScopes: [] });
    expect(capture.snapshot).toBeNull();
    expect(capture.inventoryStatus).toBe("incomplete");
  });

  it("rejects duplicate or cross-project canonical identity", () => {
    const duplicate = projectCurrentCacheGraph({
      ...baseline, cases: [...baseline.cases, baseline.cases[0]]
    });
    expect(duplicate.snapshot).toBeNull();
    expect(duplicate.unresolvedDiagnostics.join(" ")).toContain("duplicate");
    const foreign = projectCurrentCacheGraph({
      ...baseline, requirements: [{ ...baseline.requirements[0], projectId: "other-project" }]
    });
    expect(foreign.snapshot).toBeNull();
  });

  it("distinguishes source scopes across remapped connection namespace", () => {
    const remapped = projectCurrentCacheGraph({
      ...baseline, sourceScopes: [{
        ...baseline.sourceScopes[0], namespace: "https://another.atlassian.net"
      }]
    });
    expect(() => compareComparableGraphCaptures(projectCurrentCacheGraph(baseline), remapped))
      .toThrow("source scopes differ");
  });

  it("does not invent differences for case status, owner or timestamps absent from contract", () => {
    const first = projectCurrentCacheGraph(baseline);
    const extra = { ...baseline.cases[0], status: "Archived", updated_at: "2026-11-14" };
    const second = projectCurrentCacheGraph({ ...baseline, cases: [extra] });
    expect(first.snapshot?.revision).toBe(second.snapshot?.revision);
  });

  it("works with no provider records or links without pretending linked coverage exists", () => {
    const capture = projectCurrentCacheGraph({
      ...baseline, sourceScopes: [], requirements: [],
      cases: [{ ...baseline.cases[0], jiraIssueKey: null }]
    });
    expect(capture.inventoryStatus).toBe("complete");
    expect(capture.snapshot?.nodes).toHaveLength(1);
    expect(capture.snapshot?.edges).toHaveLength(0);
  });
});
