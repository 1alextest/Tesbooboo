import { explainQaConsequenceReceipt } from './qa-consequence-preview';
import type { QaChangeReviewReceipt } from './qa-change-review-receipt';

const receipt: QaChangeReviewReceipt = {
  id: 'receipt', projectId: 'project',
  source: { contractId: 'cache-v1', scopeFingerprint: 'source-scope', fromRevision: 'old', toRevision: 'new' },
  status: 'needs_qa_triage',
  changed: { addedNodeIds: [], modifiedNodeIds: ['req'], removedNodeIds: [],
    addedEdgeIds: [], modifiedEdgeIds: [], removedEdgeIds: [] },
  candidates: [{ caseNodeId: 'case', reasons: ['requirement_reference'], requirementNodeIds: ['req'] }],
  unlinkedCaseNodeIds: ['unmapped'],
  evidence: { basis: 'cached_source_reference_only', upstreamFreshness: 'unverified', coverageAssertion: 'none',
    executionAssertion: 'none', verification: 'not_performed' }
};

describe('read-only, evidence-bounded QA consequence preview', () => {
  it('explains native reference as review candidate, never as confirmed semantic effect', () => {
    const original = JSON.stringify(receipt);
    const result = explainQaConsequenceReceipt(receipt);
    expect(result).toMatchObject({ receiptId: 'receipt', projectId: 'project', status: 'needs_qa_triage',
      basis: 'cached_source_reference_only', coverageAssertion: 'none', executionAssertion: 'none',
      sourceFreshness: 'unverified', nextAction: 'qa_review', unlinkedCaseNodeIds: ['unmapped'] });
    expect(result.candidateEffects).toEqual([{ caseNodeId: 'case', requirementNodeIds: ['req'],
      observedReasons: ['requirement_reference'], consequence: 'review_existing_case_expectations',
      confidence: 'candidate_only', condition: 'independent_expectation_and_applicability_review_required' }]);
    expect(result.unsupportedClaims).toContain('approved_policy_consequences');
    expect(result.unsupportedClaims).toContain('user_manual_consequences');
    expect(JSON.stringify(receipt)).toEqual(original);
  });

  it('preserves source-only changes with no mapped case as unproven, never no impact', () => {
    const result = explainQaConsequenceReceipt({ ...receipt, candidates: [], unlinkedCaseNodeIds: [] });
    expect(result.candidateEffects).toEqual([]);
    expect(result.unlinkedOrUnprovenChange).toBe(true);
    expect(result.coverageAssertion).toBe('none');
  });

  it('does not fabricate changes when a case is merely unlinked', () => {
    const result = explainQaConsequenceReceipt({ ...receipt, candidates: [], changed: {
      addedNodeIds: [], modifiedNodeIds: [], removedNodeIds: [],
      addedEdgeIds: [], modifiedEdgeIds: [], removedEdgeIds: []
    } });
    expect(result.unlinkedOrUnprovenChange).toBe(false);
  });

  it('rejects malformed missing evidence, fake verified coverage and missing source', () => {
    expect(() => explainQaConsequenceReceipt({ ...receipt, evidence: { ...receipt.evidence,
      coverageAssertion: 'passed' as never } })).toThrow('Malformed authoritative');
    expect(() => explainQaConsequenceReceipt({ ...receipt, source: {} as never })).toThrow('Malformed authoritative');
    expect(() => explainQaConsequenceReceipt(null as never)).toThrow('Malformed authoritative');
  });
});
