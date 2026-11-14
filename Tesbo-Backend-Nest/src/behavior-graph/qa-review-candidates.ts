import { compareComparableGraphCaptures, type GraphCaptureForComparison } from "./graph-comparison-gate";
import type { GraphEdge, GraphSnapshot } from "./graph-change-impact";

/**
 * A read-only candidate view over two already-authorized, comparable captures.
 * This is NOT a coverage decision, an execution result, an approval, or a
 * source-of-truth graph store. Do not expose client-authored captures via API/MCP.
 */
export interface QaReviewCandidate {
  caseNodeId: string;
  reasons: Array<"case_changed" | "requirement_reference" | "reference_changed">;
  /** Requirement nodes reached through explicit native reference edges only. */
  requirementNodeIds: string[];
}

export interface QaReviewCandidates {
  projectId: string;
  fromRevision: string;
  toRevision: string;
  candidates: QaReviewCandidate[];
  /** Present test cases with no native cached-requirement reference edge. */
  unlinkedCaseNodeIds: string[];
  coverageAssertion: "none";
  executionAssertion: "none";
  upstreamFreshness: "unverified";
}

const REFERENCE = "references_cached_requirement";

function referenceEdges(snapshot: GraphSnapshot): GraphEdge[] {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return snapshot.edges.filter((edge) =>
    edge.type === REFERENCE &&
    nodes.get(edge.from)?.type === "test_case" &&
    nodes.get(edge.to)?.type === "cached_requirement"
  );
}

/**
 * Direct edits and native reference changes can nominate a case for triage.
 * A modified cached requirement can nominate only cases with an explicit
 * reference in either capture. Never infer transitive or semantic coverage.
 */
export function deriveQaReviewCandidates(
  before: GraphCaptureForComparison,
  after: GraphCaptureForComparison
): QaReviewCandidates {
  // This gate rejects incomplete, ambiguous, missing and cross-scope captures.
  const impact = compareComparableGraphCaptures(before, after);
  const previous = before.snapshot!;
  const current = after.snapshot!;
  const oldNodes = new Map(previous.nodes.map((node) => [node.id, node]));
  const newNodes = new Map(current.nodes.map((node) => [node.id, node]));
  const oldEdges = new Map(previous.edges.map((edge) => [edge.id, edge]));
  const newEdges = new Map(current.edges.map((edge) => [edge.id, edge]));
  const allReferences = [...referenceEdges(previous), ...referenceEdges(current)];
  const candidates = new Map<string, { reasons: Set<QaReviewCandidate["reasons"][number]>; requirementIds: Set<string> }>();

  function add(caseId: string, reason: QaReviewCandidate["reasons"][number], requirementId?: string): void {
    if (oldNodes.get(caseId)?.type !== "test_case" && newNodes.get(caseId)?.type !== "test_case") return;
    const item = candidates.get(caseId) ?? { reasons: new Set<QaReviewCandidate["reasons"][number]>(), requirementIds: new Set<string>() };
    item.reasons.add(reason);
    if (requirementId) item.requirementIds.add(requirementId);
    candidates.set(caseId, item);
  }

  for (const id of [...impact.addedNodes, ...impact.removedNodes, ...impact.modifiedNodes]) {
    if (oldNodes.get(id)?.type === "test_case" || newNodes.get(id)?.type === "test_case") add(id, "case_changed");
  }

  const changedRequirements = new Set(
    [...impact.addedNodes, ...impact.removedNodes, ...impact.modifiedNodes].filter((id) =>
      oldNodes.get(id)?.type === "cached_requirement" || newNodes.get(id)?.type === "cached_requirement"
    )
  );
  for (const edge of allReferences) {
    if (changedRequirements.has(edge.to)) add(edge.from, "requirement_reference", edge.to);
  }

  for (const id of [...impact.addedEdges, ...impact.removedEdges, ...impact.modifiedEdges]) {
    for (const edge of [oldEdges.get(id), newEdges.get(id)]) {
      if (!edge || edge.type !== REFERENCE) continue;
      const sourceNodes = edge === oldEdges.get(id) ? oldNodes : newNodes;
      if (sourceNodes.get(edge.from)?.type === "test_case" &&
          sourceNodes.get(edge.to)?.type === "cached_requirement") {
        add(edge.from, "reference_changed", edge.to);
      }
    }
  }

  const linked = new Set(referenceEdges(current).map((edge) => edge.from));
  return {
    projectId: impact.projectId,
    fromRevision: impact.fromRevision,
    toRevision: impact.toRevision,
    candidates: [...candidates].sort(([a], [b]) => a.localeCompare(b)).map(([caseNodeId, item]) => ({
      caseNodeId,
      reasons: [...item.reasons].sort(),
      requirementNodeIds: [...item.requirementIds].sort()
    })),
    unlinkedCaseNodeIds: current.nodes
      .filter((node) => node.type === "test_case" && !linked.has(node.id))
      .map((node) => node.id).sort(),
    coverageAssertion: "none",
    executionAssertion: "none",
    upstreamFreshness: "unverified"
  };
}
