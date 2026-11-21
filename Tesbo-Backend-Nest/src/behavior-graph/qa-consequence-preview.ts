import type { QaChangeReviewReceipt } from './qa-change-review-receipt';

/**
 * A truthful, *read-only* explanation of one already-committed and project-authorized
 * graph review receipt. No AI/provider calls or new record lifecycle.
 *
 * An explicit cached source reference can nominate a case for investigation, but cannot
 * establish a normative policy, semantic cause, model conformance or an actual test pass.
 */
export interface QaConsequencePreview {
  receiptId: string;
  projectId: string;
  source: QaChangeReviewReceipt['source'];
  status: 'needs_qa_triage';
  basis: QaChangeReviewReceipt['evidence']['basis'];
  candidateEffects: Array<{
    caseNodeId: string;
    requirementNodeIds: string[];
    observedReasons: string[];
    consequence: 'review_existing_case_expectations';
    confidence: 'candidate_only';
    condition: 'independent_expectation_and_applicability_review_required';
  }>;
  unlinkedCaseNodeIds: string[];
  changedNodeIds: string[];
  unlinkedOrUnprovenChange: boolean;
  unsupportedClaims: readonly [
    'approved_policy_consequences',
    'user_manual_consequences',
    'semantic_causality',
    'deployment_impact',
    'executed_coverage'
  ];
  coverageAssertion: 'none';
  executionAssertion: 'none';
  sourceFreshness: 'unverified';
  nextAction: 'qa_review';
}

export function explainQaConsequenceReceipt(receipt: QaChangeReviewReceipt): QaConsequencePreview {
  if (!receipt || receipt.status !== 'needs_qa_triage' || !receipt.projectId || !receipt.id ||
      !receipt.source?.fromRevision || !receipt.source?.toRevision ||
      !Array.isArray(receipt.candidates) || !Array.isArray(receipt.unlinkedCaseNodeIds) ||
      !receipt.changed || !Array.isArray(receipt.changed.addedNodeIds) ||
      !Array.isArray(receipt.changed.modifiedNodeIds) ||
      !Array.isArray(receipt.changed.removedNodeIds) ||
      !Array.isArray(receipt.changed.addedEdgeIds) ||
      !Array.isArray(receipt.changed.modifiedEdgeIds) ||
      !Array.isArray(receipt.changed.removedEdgeIds) ||
      !receipt.evidence || receipt.evidence.coverageAssertion !== 'none' ||
      receipt.evidence.executionAssertion !== 'none') {
    throw new Error('Malformed authoritative QA review receipt');
  }
  const changedNodeIds = [...new Set([
    ...receipt.changed.addedNodeIds,
    ...receipt.changed.modifiedNodeIds,
    ...receipt.changed.removedNodeIds
  ])].sort();
  const effects = receipt.candidates.map(candidate => ({
    caseNodeId: candidate.caseNodeId,
    requirementNodeIds: [...candidate.requirementNodeIds].sort(),
    observedReasons: [...candidate.reasons].sort(),
    consequence: 'review_existing_case_expectations' as const,
    confidence: 'candidate_only' as const,
    condition: 'independent_expectation_and_applicability_review_required' as const
  })).sort((a, b) => a.caseNodeId.localeCompare(b.caseNodeId));
  return {
    receiptId: receipt.id,
    projectId: receipt.projectId,
    source: { ...receipt.source },
    status: 'needs_qa_triage',
    basis: receipt.evidence.basis,
    candidateEffects: effects,
    unlinkedCaseNodeIds: [...receipt.unlinkedCaseNodeIds].sort(),
    changedNodeIds,
    // A reference-derived candidate is not independent assurance of actual consequences.
    // Mixed source deltas remain unproven even when one possible case link is nominated.
    unlinkedOrUnprovenChange: changedNodeIds.length > 0 ||
      receipt.changed.addedEdgeIds.length > 0 || receipt.changed.modifiedEdgeIds.length > 0 ||
      receipt.changed.removedEdgeIds.length > 0,
    unsupportedClaims: [
      'approved_policy_consequences',
      'user_manual_consequences',
      'semantic_causality',
      'deployment_impact',
      'executed_coverage'
    ],
    coverageAssertion: 'none',
    executionAssertion: 'none',
    sourceFreshness: 'unverified',
    nextAction: 'qa_review'
  };
}
