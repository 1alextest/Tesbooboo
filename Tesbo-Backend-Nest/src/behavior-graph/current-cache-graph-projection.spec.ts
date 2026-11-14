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
    namespace: "https://example.atlassian.net", remoteProjectId: "JR", disconnected: false
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
    expect(first.cacheOnly).toBe(true);
    expect(first.originAttestation).toBe("not_recorded");
    expect(first.upstreamFreshness).toBe("unverified");
    expect(first.coverageAssertion).toBe("none");
    expect(first.snapshot?.nodes).toHaveLength(2);
    expect(first.snapshot?.edges[0].type).toBe("references_cached_requirement");
  });

  it("versions case description changes independently from the title and link", () => {
    const original = projectCurrentCacheGraph(baseline);
    const edited = projectCurrentCacheGraph({
      ...baseline,
      cases: [{ ...baseline.cases[0], description: "A newly specified negative case" }]
    });
    const impact = compareComparableGraphCaptures(original, edited);
    expect(impact.modifiedNodes).toEqual(['["test_case","project-1","case-1"]']);
    expect(impact.modifiedEdges).toEqual([]);
  });

  it("versions requirement description changes without changing its reference edge", () => {
    const original = projectCurrentCacheGraph(baseline);
    const edited = projectCurrentCacheGraph({
      ...baseline,
      requirements: [{ ...baseline.requirements[0], description: "New expected behavior" }]
    });
    const impact = compareComparableGraphCaptures(original, edited);
    expect(impact.modifiedNodes).toEqual(['["cached_requirement","project-1","jira","cached-row-1"]']);
    expect(impact.modifiedEdges).toEqual([]);
    expect(impact.directlyAffectedNodeIds).toEqual(impact.modifiedNodes);
  });

  it("normalizes genuine multirow and multi-provider input ordering", () => {
    const populated: CurrentSourceProjection = {
      ...baseline,
      sourceScopes: [
        ...baseline.sourceScopes,
        { provider: "linear", mappingId: "linear-map", connectionId: "linear-conn",
          namespace: "linear-workspace", remoteProjectId: "team:engineering", disconnected: false }
      ],
      requirements: [
        ...baseline.requirements,
        { ...baseline.requirements[0], rowId: "cached-row-2", key: "JR-456",
          remoteId: "remote-456", summary: "Second Jira", description: null },
        { ...baseline.requirements[0], provider: "linear", rowId: "cached-row-3",
          key: "LN-7", remoteId: "linear-7", summary: "Linear requirement" }
      ],
      cases: [
        ...baseline.cases,
        { ...baseline.cases[0], id: "case-2", title: "Second scenario",
          jiraIssueKey: "JR-456", linearIssueKey: "LN-7" }
      ]
    };
    const first = projectCurrentCacheGraph(populated);
    const reordered = projectCurrentCacheGraph({
      ...populated,
      sourceScopes: [...populated.sourceScopes].reverse(),
      requirements: [...populated.requirements].reverse(),
      cases: [...populated.cases].reverse()
    });
    expect(first.inventoryStatus).toBe("complete");
    expect(first.snapshot?.nodes).toHaveLength(5);
    expect(first.snapshot?.edges).toHaveLength(3);
    expect(first.sourceScopeFingerprint).toBe(reordered.sourceScopeFingerprint);
    expect(first.snapshot?.revision).toBe(reordered.snapshot?.revision);
    expect(first.snapshot?.nodes).toEqual(reordered.snapshot?.nodes);
    expect(first.snapshot?.edges).toEqual(reordered.snapshot?.edges);
  });

  it("changes source scope identity when only the mapping ID changes", () => {
    const original = projectCurrentCacheGraph(baseline);
    const mappedElsewhere = projectCurrentCacheGraph({
      ...baseline, sourceScopes: [{ ...baseline.sourceScopes[0], mappingId: "another-mapping" }]
    });
    expect(original.snapshot?.nodes).toEqual(mappedElsewhere.snapshot?.nodes);
    expect(original.sourceScopeFingerprint).not.toBe(mappedElsewhere.sourceScopeFingerprint);
    expect(() => compareComparableGraphCaptures(original, mappedElsewhere))
      .toThrow("source scopes differ");
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

  it("refuses disconnected sources and versions connection state instead of claiming no impact", () => {
    const before = projectCurrentCacheGraph(baseline);
    const disconnected = projectCurrentCacheGraph({
      ...baseline, sourceScopes: [{ ...baseline.sourceScopes[0], disconnected: true }]
    });
    expect(disconnected.inventoryStatus).toBe("incomplete");
    expect(disconnected.snapshot).toBeNull();
    expect(disconnected.unresolvedDiagnostics.join(" ")).toContain("disconnected");
    expect(disconnected.sourceScopeFingerprint).not.toBe(before.sourceScopeFingerprint);
    expect(() => compareComparableGraphCaptures(before, disconnected))
      .toThrow("source inventory is not complete");
  });

  it("rejects a source scope whose disconnect state was never supplied", () => {
    const invalid = projectCurrentCacheGraph({
      ...baseline,
      sourceScopes: [{
        ...baseline.sourceScopes[0], disconnected: undefined as unknown as boolean
      }]
    });
    expect(invalid.snapshot).toBeNull();
    expect(invalid.unresolvedDiagnostics.join(" ")).toContain("invalid current source scope");
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

/**
 * Bounded, synthetic six-case pilot for a combined behavior/traceability review.
 * These IDs and titles are fixtures, NOT the six live NES-TC records. This test
 * never updates Tesbo data, approves a draft or asserts runtime coverage.
 */
describe("six-case joint behavior and traceability pilot (synthetic only)", () => {
  const cases = Array.from({ length: 6 }, (_, index) => ({
    ...baseline.cases[0],
    id: `fixture-draft-${index + 1}`,
    title: `Unapproved scenario ${index + 1}`,
    description: `Original intent ${index + 1}`,
    jiraIssueKey: index < 3 ? "JR-123" : null
  }));
  const source: CurrentSourceProjection = { ...baseline, cases };

  it("keeps six distinct draft-case identities, three reference edges and zero coverage claims", () => {
    const capture = projectCurrentCacheGraph(source);
    expect(capture.inventoryStatus).toBe("complete");
    expect(capture.snapshot?.nodes.filter((node) => node.type === "test_case")).toHaveLength(6);
    expect(capture.snapshot?.edges).toHaveLength(3);
    expect(capture.snapshot?.edges.every((edge) => edge.type === "references_cached_requirement")).toBe(true);
    expect(capture.coverageAssertion).toBe("none");
    expect(capture.upstreamFreshness).toBe("unverified");
    expect(capture.snapshot?.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(cases.map((testcase) => JSON.stringify(["test_case", source.projectId, testcase.id])))
    );
  });

  it("previews three wording refinements without changing IDs or inventing new relationships", () => {
    const original = projectCurrentCacheGraph(source);
    const proposed = projectCurrentCacheGraph({
      ...source,
      cases: cases.map((testcase, index) =>
        [2, 3, 4].includes(index)
          ? { ...testcase, description: `Clearer proposed setup and expected result ${index + 1}` }
          : testcase
      )
    });
    const impact = compareComparableGraphCaptures(original, proposed);
    expect(impact.addedNodes).toEqual([]);
    expect(impact.removedNodes).toEqual([]);
    expect(impact.modifiedNodes).toEqual([3, 4, 5].map((id) =>
      JSON.stringify(["test_case", source.projectId, `fixture-draft-${id}`])
    ));
    expect(impact.addedEdges).toEqual([]);
    expect(impact.removedEdges).toEqual([]);
    expect(impact.modifiedEdges).toEqual([]);
    expect(original.snapshot?.edges).toEqual(proposed.snapshot?.edges);
    expect(cases[2].description).toBe("Original intent 3");
  });

  it("surfaces linked cases as review candidates, not verified tests, when a cached requirement changes", () => {
    const original = projectCurrentCacheGraph(source);
    const changed = projectCurrentCacheGraph({
      ...source, requirements: source.requirements.map((requirement) => ({
        ...requirement, description: "Changed source requirement, needs QA review"
      }))
    });
    const impact = compareComparableGraphCaptures(original, changed);
    expect(impact.modifiedNodes).toEqual([
      JSON.stringify(["cached_requirement", source.projectId, "jira", "cached-row-1"])
    ]);
    expect(impact.modifiedEdges).toEqual([]);
    const changedRequirement = impact.modifiedNodes[0];
    const candidates = changed.snapshot!.edges
      .filter((edge) => edge.type === "references_cached_requirement" && edge.to === changedRequirement)
      .map((edge) => edge.from).sort();
    expect(candidates).toEqual([1, 2, 3].map((id) =>
      JSON.stringify(["test_case", source.projectId, `fixture-draft-${id}`])
    ));
    expect(changed.coverageAssertion).toBe("none");
    expect(impact.directlyAffectedNodeIds).toEqual([changedRequirement]);
    // The remaining unlinked drafts still exist; no edge is fabricated for them.
    expect(changed.snapshot?.nodes.filter((node) => node.type === "test_case")).toHaveLength(6);
  });

  it("fails closed when the pilot has an unsynced requirement link", () => {
    const invalid = projectCurrentCacheGraph({
      ...source, cases: cases.map((testcase, index) =>
        index === 5 ? { ...testcase, jiraIssueKey: "JR-NOT-CACHED" } : testcase)
    });
    expect(invalid.snapshot).toBeNull();
    expect(invalid.unresolvedDiagnostics.join(" ")).toContain("unresolved");
    expect(() => compareComparableGraphCaptures(projectCurrentCacheGraph(source), invalid))
      .toThrow("source inventory is not complete");
  });
});
