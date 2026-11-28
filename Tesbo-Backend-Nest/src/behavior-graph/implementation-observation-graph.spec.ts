import { compareComparableGraphCaptures } from "./graph-comparison-gate";
import { prepareQaChangeReviewReceipt } from "./qa-change-review-receipt";
import { explainQaConsequenceReceipt } from "./qa-consequence-preview";
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
    expect(observed.conceptInventoryStatus).toBe("unverified");
    expect(observed.declarationClassification).toBe("proposed_not_semantically_attested");
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

  it("versions the explicitly selected source scope and rejects unselected files", () => {
    const before = project({ ...source, selectionPrefixes: ["src"] });
    const after = project({ ...source, selectionPrefixes: ["src/routes"] ,
      files: [source.files[0]], concepts: [source.concepts[0]] });
    expect(() => compareComparableGraphCaptures(before, after)).toThrow("source scopes differ");
    expect(() => project({
      ...source, selectionPrefixes: ["src/routes"]
    })).toThrow("file outside source selection");
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
      basis: "source_declaration_unattested",
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

describe("receipt-time behavioral investigation leads", () => {
  const fileId = (path: string) => JSON.stringify(["implementation_file", "p1", source.repositoryId, path]);
  const conceptId = (kind: string, key: string) => JSON.stringify(["source_declaration", "p1", source.repositoryId, kind, key]);
  it("keeps a journey and unchanged declaration on changed bytes distinct from direct behavior change and unknown file scope", () => {
    const login = source.files[0].path, session = source.files[1].path, other = "src/unknown.ts";
    const withJourney: TrustedSourceObservation = {
      ...source, files: [...source.files, { path: other, contentSha256: hex("a") }],
      concepts: [...source.concepts, {
        kind: "journey", key: "sign-in", filePath: login, lineStart: 1, lineEnd: 10, declarationSha256: hex("c")
      }]
    };
    const after = { ...withJourney, commitSha: "b".repeat(40),
      files: withJourney.files.map(f => f.path === session ? f : { ...f, contentSha256: hex("f") }),
      concepts: withJourney.concepts.map(c => c.kind === "journey" ? { ...c, declarationSha256: hex("e") } : c)
    };
    const receipt = prepareQaChangeReviewReceipt(project(withJourney), project(after))!;
    const result = explainQaConsequenceReceipt(receipt);
    expect(result.sourceDeclarationReview).toEqual({
      version: 1, changedFileCount: 2, declarationLeadCount: 2, filesWithoutDeclarationCount: 1,
      leads: [
        { nodeId: conceptId("journey", "sign-in"), change: "modified", beforeFileId: fileId(login), afterFileId: fileId(login) },
        { nodeId: conceptId("route", "POST /login"), change: "related_source_change", beforeFileId: fileId(login), afterFileId: fileId(login) }
      ],
      filesWithoutDeclaration: [fileId(other)]
    });
    expect(result.coverageAssertion).toBe("none");
    expect(result.executionAssertion).toBe("none");
    expect(receipt.candidates).toEqual([]);
    // The old preview had only raw changed IDs; the new receipt-time association
    // keeps the unchanged declaration attached to the actual changed file.
    expect(receipt.changed.modifiedNodeIds).not.toContain(conceptId("route", "POST /login"));
    expect(explainQaConsequenceReceipt({ ...receipt, sourceDeclarationReview: undefined }).sourceDeclarationReview).toBeNull();
    const malformed = { ...receipt.sourceDeclarationReview!,
      leads: receipt.sourceDeclarationReview!.leads.map((lead, i) => i === 0 ?
        { ...lead, afterFileId: JSON.stringify(["implementation_file", "foreign", source.repositoryId, login]) } : lead) };
    expect(explainQaConsequenceReceipt({ ...receipt, sourceDeclarationReview: malformed }).sourceDeclarationReview).toBeNull();
    const original = JSON.stringify(receipt);
    expect(explainQaConsequenceReceipt(receipt).sourceDeclarationReview).toEqual(result.sourceDeclarationReview);
    expect(JSON.stringify(receipt)).toBe(original);
  });

  it("retains removed declarations, moved support and new behavior with exact before/after references", () => {
    const login = source.files[0].path, session = source.files[1].path;
    const after: TrustedSourceObservation = { ...source, commitSha: "b".repeat(40), concepts: [
      { ...source.concepts[1], filePath: login },
      { kind: "behavior", key: "login-refusal", filePath: session, lineStart: 1, lineEnd: 2, declarationSha256: hex("e") }
    ] };
    const receipt = prepareQaChangeReviewReceipt(project(), project(after))!;
    const review = explainQaConsequenceReceipt(receipt).sourceDeclarationReview!;
    expect(review.changedFileCount).toBe(0);
    expect(review.declarationLeadCount).toBe(3);
    expect(review.leads).toEqual(expect.arrayContaining([
      { nodeId: conceptId("route", "POST /login"), change: "removed", beforeFileId: fileId(login), afterFileId: null },
      { nodeId: conceptId("state", "session:authenticated"), change: "modified", beforeFileId: fileId(session), afterFileId: fileId(login) },
      { nodeId: conceptId("behavior", "login-refusal"), change: "added", beforeFileId: null, afterFileId: fileId(session) }
    ]));
  });

  it("shows ordinary source capture without supplied concepts as unresolved file scope, not no impact", () => {
    const before = { ...source, concepts: [] };
    const after = { ...before, commitSha: "b".repeat(40),
      files: before.files.map(f => ({ ...f, contentSha256: hex("f") })) };
    const review = explainQaConsequenceReceipt(prepareQaChangeReviewReceipt(project(before), project(after))!).sourceDeclarationReview;
    expect(review).toMatchObject({ changedFileCount: 2, declarationLeadCount: 0, filesWithoutDeclarationCount: 2 });
    expect(review?.filesWithoutDeclaration).toEqual(source.files.map(f => fileId(f.path)).sort());
  });

  it("bounds displayed leads and keeps exact totals rather than silently dropping scope", () => {
    const many = { ...source, concepts: Array.from({ length: 60 }, (_, i) => ({
      kind: "journey" as const, key: "journey-" + String(i).padStart(2, "0"), filePath: source.files[0].path,
      lineStart: 1, lineEnd: 2, declarationSha256: hex("c")
    })) };
    const after = { ...many, commitSha: "b".repeat(40),
      files: many.files.map(f => f === many.files[0] ? { ...f, contentSha256: hex("f") } : f) };
    const result = explainQaConsequenceReceipt(prepareQaChangeReviewReceipt(project(many), project(after))!).sourceDeclarationReview!;
    expect(result.declarationLeadCount).toBe(60);
    expect(result.leads).toHaveLength(50);
  });
});
