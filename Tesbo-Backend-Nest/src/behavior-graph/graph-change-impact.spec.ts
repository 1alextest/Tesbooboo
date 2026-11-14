import { diffGraphSnapshots, type GraphSnapshot } from "./graph-change-impact";

const baseline: GraphSnapshot = {
  projectId: "project-a",
  revision: "r1",
  nodes: [
    { id: "requirement", type: "requirement", version: "v1" },
    { id: "case", type: "test_case", version: "v1" },
    { id: "unrelated", type: "test_case", version: "v1" }
  ],
  edges: [{ id: "covers", from: "case", to: "requirement", type: "covers", version: "v1" }]
};

describe("diffGraphSnapshots", () => {
  it("does not mutate input or fabricate impact for identical content", () => {
    const unchanged = { ...baseline, revision: "r2" };
    const original = JSON.stringify(baseline);
    const result = diffGraphSnapshots(baseline, unchanged);
    expect(result).toEqual({
      projectId: "project-a",
      fromRevision: "r1",
      toRevision: "r2",
      addedNodes: [], removedNodes: [], modifiedNodes: [],
      addedEdges: [], removedEdges: [], modifiedEdges: [],
      directlyAffectedNodeIds: []
    });
    expect(JSON.stringify(baseline)).toBe(original);
  });

  it("reports changed content without claiming unrelated graph nodes are affected", () => {
    const after: GraphSnapshot = {
      ...baseline,
      revision: "r2",
      nodes: baseline.nodes.map((n) => n.id === "requirement" ? { ...n, version: "v2" } : n)
    };
    expect(diffGraphSnapshots(baseline, after).modifiedNodes).toEqual(["requirement"]);
    expect(diffGraphSnapshots(baseline, after).directlyAffectedNodeIds).toEqual(["requirement"]);
  });

  it("reports both old and new endpoints on a reconnected relation", () => {
    const after: GraphSnapshot = {
      ...baseline,
      revision: "r2",
      edges: [{ id: "covers", from: "unrelated", to: "requirement", type: "covers", version: "v2" }]
    };
    const impact = diffGraphSnapshots(baseline, after);
    expect(impact.modifiedEdges).toEqual(["covers"]);
    expect(impact.directlyAffectedNodeIds).toEqual(["case", "requirement", "unrelated"]);
  });

  it("reports additions and removals, including removed relation endpoints", () => {
    const after: GraphSnapshot = {
      ...baseline,
      revision: "r2",
      nodes: [{ id: "requirement", type: "requirement", version: "v1" },
        { id: "new-case", type: "test_case", version: "v1" }],
      edges: [{ id: "new-cover", from: "new-case", to: "requirement", type: "covers", version: "v1" }]
    };
    const impact = diffGraphSnapshots(baseline, after);
    expect(impact.addedNodes).toEqual(["new-case"]);
    expect(impact.removedNodes).toEqual(["case", "unrelated"]);
    expect(impact.addedEdges).toEqual(["new-cover"]);
    expect(impact.removedEdges).toEqual(["covers"]);
    expect(impact.directlyAffectedNodeIds).toEqual(["case", "new-case", "requirement", "unrelated"]);
  });

  it("rejects project crossing even when node identifiers happen to match", () => {
    expect(() => diffGraphSnapshots(baseline, { ...baseline, projectId: "project-b" }))
      .toThrow("different projects");
  });

  it("rejects duplicates, dangling relations and missing version attestations", () => {
    expect(() => diffGraphSnapshots(baseline, { ...baseline, nodes: [...baseline.nodes, baseline.nodes[0]] }))
      .toThrow("duplicate node id");
    expect(() => diffGraphSnapshots(baseline, {
      ...baseline, edges: [{ id: "bad", from: "missing", to: "case", type: "covers", version: "v1" }]
    })).toThrow("missing endpoint");
    expect(() => diffGraphSnapshots(baseline, {
      ...baseline, nodes: baseline.nodes.map((n) => ({ ...n, version: "" }))
    })).toThrow("node.version");
  });

  it("does not treat a changed revision label alone as changed behavior", () => {
    const result = diffGraphSnapshots(baseline, { ...baseline, revision: "r100" });
    expect(result.directlyAffectedNodeIds).toEqual([]);
  });
});
