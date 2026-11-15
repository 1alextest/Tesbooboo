import { compareComparableGraphCaptures } from "./graph-comparison-gate";
import { prepareQaChangeReviewReceipt } from "./qa-change-review-receipt";
import { projectImplementationObservations, type TrustedSourceObservation } from "./implementation-observation-graph";
import type { GraphCaptureForComparison } from "./graph-comparison-gate";

const hex = (char: string) => char.repeat(64);
const base: GraphCaptureForComparison = {
  snapshot: {
    projectId: "p1", revision: "native-r1",
    nodes: [{ id: "existing-case", type: "test_case", version: "case-v1" }],
    edges: []
  },
  contractId: "native-v1",
  sourceScopeFingerprint: "native-scope",
  inventoryStatus: "complete",
  unresolvedDiagnostics: []
};
const source: TrustedSourceObservation = {
  projectId: "p1",
  repositoryId: "org/application",
  refName: "development",
  commitSha: "a".repeat(40),
  inventoryStatus: "complete",
  files: [
    { path: "src/routes/login.ts", contentSha256: hex("a") },
    { path: "src/state/session.ts", contentSha256: hex("b") }
  ],
  concepts: [
    { kind: "route", key: "POST /login", filePath: "src/routes/login.ts",
      lineStart: 12, lineEnd: 25, declarationSha256: hex("c") },
    { kind: "state", key: "session:authenticated", filePath: "src/state/session.ts",
      lineStart: 3, lineEnd: 11, declarationSha256: hex("d") }
  ]
};
const project = (value: TrustedSourceObservation = source) => projectImplementationObservations(base, value);

describe("internal implementation source observation projection", () => {
  it("adds file and declared route/state nodes without replacing native case or claiming coverage", () => {
    const observed = project();
    expect(observed.snapshot?.nodes.map((n) => n.type)).toEqual(expect.arrayContaining([
      "test_case", "implementation_file", "source_declared_route", "source_declared_state"
    ]));
    expect(observed.snapshot?.edges).toHaveLength(2);
    expect(observed.snapshot?.edges.every((e) => e.type === "declared_in_source")).toBe(true);
    expect(observed.coverageAssertion).toBe("none");
    expect(observed.observedCommitSha).toBe(source.commitSha);
    expect(observed.executionAssertion).toBe("none");
    expect(observed.sourceAttestation).toBe("caller_must_verify");
    expect(observed.semantics).toBe("declarations_not_runtime_verification");
  });

  it("is stable under source row order and does not modify the inputs", () => {
    const original = JSON.stringify(source);
    const one = project();
    const two = project({ ...source, files: [...source.files].reverse(), concepts: [...source.concepts].reverse() });
    expect(one).toEqual(two);
    expect(JSON.stringify(source)).toBe(original);
  });

  it("detects modified source content while retaining stable node identities and source scope", () => {
    const before = project();
    const after = project({
      ...source, commitSha: "e".repeat(40),
      files: source.files.map((f) => f.path.endsWith("login.ts") ? { ...f, contentSha256: hex("e") } : f),
      concepts: source.concepts.map((c) => c.kind === "route" ? { ...c, declarationSha256: hex("f") } : c)
    });
    const impact = compareComparableGraphCaptures(before, after);
    expect(impact.modifiedNodes).toHaveLength(2);
    expect(impact.addedNodes).toEqual([]);
    expect(impact.removedNodes).toEqual([]);
    expect(impact.modifiedEdges).toHaveLength(1);
    expect(before.sourceScopeFingerprint).toBe(after.sourceScopeFingerprint);
  });

  it("keeps identical code revisions stable even when the observed commit changes", () => {
    const before = project();
    const after = project({ ...source, commitSha: "f".repeat(40) });
    expect(before.observedCommitSha).not.toBe(after.observedCommitSha);
    expect(before.snapshot?.revision).toBe(after.snapshot?.revision);
    const impact = compareComparableGraphCaptures(before, after);
    expect(impact.modifiedNodes).toEqual([]);
    expect(impact.modifiedEdges).toEqual([]);
    expect(prepareQaChangeReviewReceipt(before, after)).toBeNull();
  });

  it("treats branch/repository selection changes as incomparable scope instead of a clean delta", () => {
    const before = project();
    expect(() => compareComparableGraphCaptures(before, project({ ...source, refName: "main" })))
      .toThrow("source scopes differ");
    expect(() => compareComparableGraphCaptures(before, project({ ...source, repositoryId: "org/other" })))
      .toThrow("source scopes differ");
  });

  it.each([
    ["incomplete inventory", { ...source, inventoryStatus: "incomplete" }],
    ["cross-project input", { ...source, projectId: "other" }],
    ["traversal path", { ...source, files: [{ path: "../private", contentSha256: hex("a") }] }],
    ["absolute path", { ...source, files: [{ path: "/private", contentSha256: hex("a") }] }],
    ["invalid hash", { ...source, files: [{ path: "x.ts", contentSha256: "unknown" }] }],
    ["duplicate paths", { ...source, files: [...source.files, source.files[0]] }],
    ["dangling evidence", { ...source, concepts: [{ ...source.concepts[0], filePath: "missing.ts" }] }],
    ["invalid range", { ...source, concepts: [{ ...source.concepts[0], lineStart: 20, lineEnd: 1 }] }],
    ["duplicate concepts", { ...source, concepts: [source.concepts[0], source.concepts[0]] }],
    ["invalid commit", { ...source, commitSha: "HEAD" }]
  ] as const)("rejects %s before publishing any projection", (_name, observation) => {
    expect(() => project(observation as TrustedSourceObservation)).toThrow("Invalid source observation");
  });

  it("rejects incomplete native graph rather than adding implementation declarations to it", () => {
    expect(() => projectImplementationObservations({ ...base, inventoryStatus: "unknown" }, source))
      .toThrow("base graph capture is not complete");
  });

  it("routes a code-only source change into existing QA receipt semantics without auto-failing a case", () => {
    const before = project();
    const after = project({
      ...source,
      commitSha: "f".repeat(40),
      files: source.files.map((file) =>
        file.path === "src/routes/login.ts" ? { ...file, contentSha256: hex("f") } : file)
    });
    const receipt = prepareQaChangeReviewReceipt(before, after);
    expect(receipt?.status).toBe("needs_qa_triage");
    expect(receipt?.changed.modifiedNodeIds).toHaveLength(1);
    expect(receipt?.changed.modifiedNodeIds[0]).toContain("implementation_file");
    expect(receipt?.candidates).toEqual([]);
    expect(receipt?.evidence).toMatchObject({
      coverageAssertion: "none",
      executionAssertion: "none",
      verification: "not_performed"
    });
  });

  it("preserves removed source declarations as explicit removal impacts", () => {
    const before = project();
    const after = project({
      ...source,
      commitSha: "f".repeat(40),
      concepts: source.concepts.filter((concept) => concept.kind !== "route")
    });
    const delta = compareComparableGraphCaptures(before, after);
    expect(delta.removedNodes).toHaveLength(1);
    expect(delta.removedNodes[0]).toContain("source_declaration");
    expect(delta.removedEdges).toHaveLength(1);
    const receipt = prepareQaChangeReviewReceipt(before, after);
    expect(receipt?.changed.removedNodeIds).toEqual(delta.removedNodes);
    expect(receipt?.changed.removedEdgeIds).toEqual(delta.removedEdges);
  });

  it("supports behavior/journey declarations without inventing links to test cases", () => {
    const extended = project({
      ...source, concepts: [
        ...source.concepts,
        { kind: "behavior", key: "login-failed", filePath: "src/routes/login.ts",
          lineStart: 18, lineEnd: 24, declarationSha256: hex("8") },
        { kind: "journey", key: "user-auth", filePath: "src/routes/login.ts",
          lineStart: 5, lineEnd: 25, declarationSha256: hex("9") }
      ]
    });
    expect(extended.snapshot?.edges).toHaveLength(4);
    expect(extended.snapshot?.edges.some((e) => e.type === "covers")).toBe(false);
  });
});
