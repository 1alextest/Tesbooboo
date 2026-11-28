import { explainQaConsequenceReceipt } from './qa-consequence-preview';
import type { QaChangeReviewReceipt } from './qa-change-review-receipt';
import { CURRENT_CACHE_PROJECTION_CONTRACT } from './current-cache-graph-projection';

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

  it('keeps a mixed mapped and unmapped source change unproven despite a candidate', () => {
    const result = explainQaConsequenceReceipt({ ...receipt, changed: {
      ...receipt.changed, addedNodeIds: ['unmapped-new-component'],
      addedEdgeIds: ['unreviewed-dependency']
    } });
    expect(result.candidateEffects).toHaveLength(1);
    expect(result.changedNodeIds).toEqual(['req', 'unmapped-new-component']);
    expect(result.unlinkedOrUnprovenChange).toBe(true);
    expect(result.coverageAssertion).toBe('none');
    expect(result.executionAssertion).toBe('none');
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

describe('changed cached-requirement nomination inventory', () => {
  const req = (id: string, project = 'project') => JSON.stringify(['cached_requirement', project, 'jira', id]);
  const tc = JSON.stringify(['test_case', 'project', 'case']);
  const mixed: QaChangeReviewReceipt = {
    ...receipt,
    source: { ...receipt.source, contractId: CURRENT_CACHE_PROJECTION_CONTRACT },
    changed: { ...receipt.changed, addedNodeIds: [req('added')], modifiedNodeIds: [req('linked'), req('modified'), tc],
      removedNodeIds: [req('removed')] },
    candidates: [{ caseNodeId: tc, reasons: ['requirement_reference'], requirementNodeIds: [req('linked')] }]
  };

  it('identifies each unnominated changed requirement even beside an explicit case nomination', () => {
    const original = JSON.stringify(mixed);
    const result = explainQaConsequenceReceipt(mixed);
    expect(result.cachedRequirementReview).toEqual({
      changedRequirementCount: 4,
      withoutNomination: [
        { requirementNodeId: req('added'), change: 'added' },
        { requirementNodeId: req('modified'), change: 'modified' },
        { requirementNodeId: req('removed'), change: 'removed' }
      ]
    });
    expect(result.coverageAssertion).toBe('none');
    expect(result.executionAssertion).toBe('none');
    expect(JSON.stringify(mixed)).toBe(original);
    const reordered = { ...mixed, changed: { ...mixed.changed, modifiedNodeIds: [...mixed.changed.modifiedNodeIds].reverse() } };
    expect(explainQaConsequenceReceipt(reordered).cachedRequirementReview).toEqual(result.cachedRequirementReview);
  });

  it('keeps historical nominations as receipt-time references without asserting current links', () => {
    const result = explainQaConsequenceReceipt({ ...mixed,
      candidates: [{ ...mixed.candidates[0], requirementNodeIds: [req('added'), req('linked'), req('modified'), req('removed')] }]
    });
    expect(result.cachedRequirementReview).toEqual({ changedRequirementCount: 4, withoutNomination: [] });
    expect(result.coverageAssertion).toBe('none');
  });

  it('does not manufacture changed requirements from an edge-only change', () => {
    const result = explainQaConsequenceReceipt({ ...mixed, changed: {
      ...mixed.changed, addedNodeIds: [], modifiedNodeIds: [], removedNodeIds: [], removedEdgeIds: ['link']
    } });
    expect(result.cachedRequirementReview).toEqual({ changedRequirementCount: 0, withoutNomination: [] });
    expect(result.unlinkedOrUnprovenChange).toBe(true);
  });

  it('reports unavailable rather than an empty inventory for unsupported or invalid source identities', () => {
    const incompatible: QaChangeReviewReceipt[] = [
      receipt,
      { ...mixed, source: { ...mixed.source, contractId: 'other' } },
      { ...mixed, evidence: { ...mixed.evidence, basis: 'source_declaration_unattested' } },
      { ...mixed, changed: { ...mixed.changed, addedNodeIds: [req('foreign', 'other')] } },
      { ...mixed, changed: { ...mixed.changed, addedNodeIds: ['not-a-cached-graph-tuple'] } },
      { ...mixed, changed: { ...mixed.changed, addedNodeIds: [req('linked')] } },
      { ...mixed, candidates: [{ ...mixed.candidates[0], caseNodeId: JSON.stringify(['test_case', 'other', 'case']) }] },
      { ...mixed, candidates: [{ ...mixed.candidates[0], requirementNodeIds: [req('foreign', 'other')] }] },
      { ...mixed, candidates: [...mixed.candidates, mixed.candidates[0]] }
    ];
    for (const candidate of incompatible) expect(explainQaConsequenceReceipt(candidate).cachedRequirementReview).toBeNull();
  });
});
