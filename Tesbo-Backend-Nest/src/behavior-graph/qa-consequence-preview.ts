import type { QaChangeReviewReceipt } from './qa-change-review-receipt';
import { CURRENT_CACHE_PROJECTION_CONTRACT } from './current-cache-graph-projection';

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
  /** Receipt-time nominations only; null means this cached-graph projection is unavailable. */
  cachedRequirementReview: {
    changedRequirementCount: number;
    withoutNomination: Array<{ requirementNodeId: string; change: 'added' | 'modified' | 'removed' }>;
  } | null;
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

/** Keep the current cache projector's canonical tuple and project boundary.
 * Unsupported graph contracts and invalid identities cannot certify an empty inventory.
 */
function cachedNodeKind(id: unknown, projectId: string): 'case' | 'requirement' | null {
  if (typeof id !== 'string') return null;
  try {
    const parts: unknown = JSON.parse(id);
    if (!Array.isArray(parts) || JSON.stringify(parts) !== id || parts[1] !== projectId) return null;
    const nonempty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
    if (parts.length === 3 && parts[0] === 'test_case' && nonempty(parts[2])) return 'case';
    if (parts.length === 4 && parts[0] === 'cached_requirement' &&
        ['jira', 'linear', 'notion'].includes(parts[2]) && nonempty(parts[3])) return 'requirement';
    return null;
  } catch { return null; }
}

function summarizeCachedRequirementReview(receipt: QaChangeReviewReceipt): QaConsequencePreview['cachedRequirementReview'] {
  if (receipt.source.contractId !== CURRENT_CACHE_PROJECTION_CONTRACT ||
      receipt.evidence.basis !== 'cached_source_reference_only') return null;
  const changes = new Map<string, 'added' | 'modified' | 'removed'>();
  const seenNodes = new Set<string>();
  for (const [change, ids] of [
    ['added', receipt.changed.addedNodeIds],
    ['modified', receipt.changed.modifiedNodeIds],
    ['removed', receipt.changed.removedNodeIds]
  ] as const) {
    for (const id of ids) {
      const kind = cachedNodeKind(id, receipt.projectId);
      if (!kind || seenNodes.has(id)) return null;
      seenNodes.add(id);
      if (kind === 'requirement') changes.set(id, change);
    }
  }
  const nominated = new Set<string>();
  const seenCases = new Set<string>();
  for (const candidate of receipt.candidates) {
    if (cachedNodeKind(candidate.caseNodeId, receipt.projectId) !== 'case' ||
        seenCases.has(candidate.caseNodeId) || !Array.isArray(candidate.requirementNodeIds)) return null;
    seenCases.add(candidate.caseNodeId);
    for (const id of candidate.requirementNodeIds) {
      if (cachedNodeKind(id, receipt.projectId) !== 'requirement') return null;
      nominated.add(id);
    }
  }
  // A nomination may describe a historical edge, not a currently linked or approved case.
  // Never translate the absence of a receipt-time nomination into confirmed missing coverage.
  return {
    changedRequirementCount: changes.size,
    withoutNomination: [...changes].filter(([id]) => !nominated.has(id))
      .map(([requirementNodeId, change]) => ({ requirementNodeId, change }))
      .sort((a, b) => a.requirementNodeId.localeCompare(b.requirementNodeId))
  };
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
    cachedRequirementReview: summarizeCachedRequirementReview(receipt),
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
