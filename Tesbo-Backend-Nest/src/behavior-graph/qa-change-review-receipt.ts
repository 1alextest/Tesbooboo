import { createHash } from "node:crypto";
import { compareComparableGraphCaptures, type GraphCaptureForComparison } from "./graph-comparison-gate";
import { deriveQaReviewCandidates, type QaReviewCandidate } from "./qa-review-candidates";

/**
 * Internal immutable-data proposal for the existing Tesbo QA review/notification
 * workflow, NOT a new notification store, actor or approval authority.
 * Only a server-side, authenticated capture provider may supply these inputs.
 */
export interface QaChangeReviewReceipt {
  id: string;
  projectId: string;
  source: {
    contractId: string;
    scopeFingerprint: string;
    fromRevision: string;
    toRevision: string;
  };
  status: "needs_qa_triage";
  /** Exact source delta, including changes with no explicitly linked test case. */
  changed: {
    addedNodeIds: string[];
    modifiedNodeIds: string[];
    removedNodeIds: string[];
    addedEdgeIds: string[];
    modifiedEdgeIds: string[];
    removedEdgeIds: string[];
  };
  candidates: QaReviewCandidate[];
  unlinkedCaseNodeIds: string[];
  evidence: {
    basis: "cached_source_reference_only";
    upstreamFreshness: "unverified";
    coverageAssertion: "none";
    executionAssertion: "none";
    verification: "not_performed";
  };
}

/**
 * Stable identity gives a future native notification writer an idempotency key.
 * It is computed from the actual compared revisions + source contract/scope;
 * retries cannot manufacture distinct work, and another project/scope cannot
 * collide. The presence of a receipt is NOT proof that it has been delivered.
 */
export function prepareQaChangeReviewReceipt(
  before: GraphCaptureForComparison,
  after: GraphCaptureForComparison
): QaChangeReviewReceipt | null {
  const impact = deriveQaReviewCandidates(before, after);
  const delta = compareComparableGraphCaptures(before, after);
  // No change, no notification; an existing unlinked case is NOT itself
  // proof of a new gap and must not generate endless repeat notifications.
  if (before.snapshot!.revision === after.snapshot!.revision) return null;
  // A source-only change can still require triage even if there are no linked
  // test cases; do not silently lose this as "no impact."
  const id = createHash("sha256").update(JSON.stringify([
    "tesbo-qa-review-receipt-v1",
    impact.projectId,
    before.contractId,
    before.sourceScopeFingerprint,
    impact.fromRevision,
    impact.toRevision
  ]), "utf8").digest("hex");

  return {
    id,
    projectId: impact.projectId,
    source: {
      contractId: before.contractId,
      scopeFingerprint: before.sourceScopeFingerprint,
      fromRevision: impact.fromRevision,
      toRevision: impact.toRevision
    },
    status: "needs_qa_triage",
    changed: {
      addedNodeIds: delta.addedNodes,
      modifiedNodeIds: delta.modifiedNodes,
      removedNodeIds: delta.removedNodes,
      addedEdgeIds: delta.addedEdges,
      modifiedEdgeIds: delta.modifiedEdges,
      removedEdgeIds: delta.removedEdges
    },
    candidates: impact.candidates,
    unlinkedCaseNodeIds: impact.unlinkedCaseNodeIds,
    evidence: {
      basis: "cached_source_reference_only",
      upstreamFreshness: "unverified",
      coverageAssertion: "none",
      executionAssertion: "none",
      verification: "not_performed"
    }
  };
}
