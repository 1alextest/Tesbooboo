import { compareComparableGraphCaptures, type GraphCaptureForComparison } from "./graph-comparison-gate";

const original: GraphCaptureForComparison = {
  contractId: "projected-cache-v1",
  sourceScopeFingerprint: "same-provider-and-mapping",
  inventoryStatus: "complete",
  unresolvedDiagnostics: [],
  snapshot: {
    projectId: "project-a",
    revision: "first",
    nodes: [
      { id: "requirement", type: "cached_requirement", version: "v1" },
      { id: "test", type: "test_case", version: "v1" }
    ],
    edges: [
      { id: "link", from: "test", to: "requirement", type: "references_cached_requirement", version: "v1" }
    ]
  }
};

const next: GraphCaptureForComparison = {
  ...original,
  snapshot: {
    ...original.snapshot!,
    revision: "second",
    nodes: original.snapshot!.nodes.map((node) =>
      node.id === "requirement" ? { ...node, version: "v2" } : node
    )
  }
};

describe("compareComparableGraphCaptures", () => {
  it("reports direct content changes without inventing linked-case or transitive coverage", () => {
    const result = compareComparableGraphCaptures(original, next);
    expect(result.modifiedNodes).toEqual(["requirement"]);
    expect(result.directlyAffectedNodeIds).toEqual(["requirement"]);
  });

  it.each(["incomplete", "unknown"] as const)(
    "refuses a %s source inventory instead of inventing deletion",
    (inventoryStatus) => {
      expect(() => compareComparableGraphCaptures(
        original, { ...next, inventoryStatus, snapshot: { ...next.snapshot!, nodes: [], edges: [] } }
      )).toThrow("source inventory is not complete");
    }
  );

  it("rejects missing capture or a null snapshot instead of returning an empty impact", () => {
    expect(() => compareComparableGraphCaptures(original, { ...next, snapshot: null }))
      .toThrow("snapshot is missing");
    expect(() => compareComparableGraphCaptures(null as unknown as GraphCaptureForComparison, next))
      .toThrow("missing before capture");
  });

  it("rejects a remapped external source even when project IDs match", () => {
    expect(() => compareComparableGraphCaptures(
      original, { ...next, sourceScopeFingerprint: "different-provider" }
    )).toThrow("source scopes differ");
  });

  it("rejects changes to graph projection contracts", () => {
    expect(() => compareComparableGraphCaptures(
      original, { ...next, contractId: "cache-v2-changed-fields" }
    )).toThrow("projection contracts differ");
  });

  it("rejects dangling or ambiguous source identities rather than dropping relationships", () => {
    expect(() => compareComparableGraphCaptures(
      original, { ...next, unresolvedDiagnostics: ["unresolved referenced issue"] }
    )).toThrow("unresolved source diagnostics");
  });

  it("requires valid source attestation fields and diagnostic arrays", () => {
    expect(() => compareComparableGraphCaptures(original, { ...next, sourceScopeFingerprint: "" }))
      .toThrow("invalid after sourceScopeFingerprint");
    expect(() => compareComparableGraphCaptures(original, {
      ...next, unresolvedDiagnostics: undefined as unknown as string[]
    })).toThrow("unresolved source diagnostics");
  });

  it("preserves original per-snapshot project isolation", () => {
    expect(() => compareComparableGraphCaptures(
      original, { ...next, snapshot: { ...next.snapshot!, projectId: "project-b" } }
    )).toThrow("different projects");
  });

  it("leaves all captures and underlying source records unmodified", () => {
    const before = JSON.stringify(original);
    const after = JSON.stringify(next);
    compareComparableGraphCaptures(original, next);
    expect(JSON.stringify(original)).toBe(before);
    expect(JSON.stringify(next)).toBe(after);
  });
});
