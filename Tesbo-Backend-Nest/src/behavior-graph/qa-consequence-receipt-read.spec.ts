import { CurrentCacheGraphHistory } from './current-cache-graph.history';
import { GraphChangeReviewController } from './graph-change-review.controller';
import type { DatabaseService } from '../database/database.service';
import type { QaChangeReviewReceipt } from './qa-change-review-receipt';

const USER = '00000000-0000-4000-8000-000000000001';
const PROJECT = '00000000-0000-4000-8000-000000000002';
const receipt: QaChangeReviewReceipt = {
  id: 'receipt-1', projectId: PROJECT,
  source: { contractId: 'cache', scopeFingerprint: 's', fromRevision: 'old', toRevision: 'new' },
  status: 'needs_qa_triage',
  changed: { addedNodeIds: [], modifiedNodeIds: ['requirement'], removedNodeIds: [],
    addedEdgeIds: [], modifiedEdgeIds: [], removedEdgeIds: [] },
  candidates: [{ caseNodeId: 'case', reasons: ['requirement_reference'], requirementNodeIds: ['requirement'] }],
  unlinkedCaseNodeIds: [],
  evidence: { basis: 'cached_source_reference_only', upstreamFreshness: 'unverified',
    coverageAssertion: 'none', executionAssertion: 'none', verification: 'not_performed' }
};

function context(authorized: boolean, value: QaChangeReviewReceipt | null = receipt) {
  const query = jest.fn(async () => ({ rows: [{ authorized, receipt: value }] }));
  const history = new CurrentCacheGraphHistory({ query } as unknown as DatabaseService, {} as never);
  return { query, history };
}

describe('authorized, exact native QA consequence receipt read', () => {
  it('returns the existing exact receipt from one membership-scoped SELECT, no writes', async () => {
    const { query, history } = context(true);
    expect(await history.readReceiptForUser(USER, PROJECT, '42')).toEqual(receipt);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('JOIN project_members');
    expect(sql).toContain('JOIN organization_members');
    expect(sql).toContain('graph_capture_history');
    expect(sql).toContain('h.review_receipt_json IS NOT NULL');
    expect(sql).toContain("'is_archived'");
    expect(params).toEqual([PROJECT, USER, '42']);
  });

  it('checks user identity before any query and denies revoked membership', async () => {
    const { query, history } = context(true);
    await expect(history.readReceiptForUser(null, PROJECT, '42')).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
    const removed = context(false);
    await expect(removed.history.readReceiptForUser(USER, PROJECT, '42')).rejects.toMatchObject({ status: 403 });
    expect(removed.query).toHaveBeenCalledTimes(1);
  });

  it('does not leak a foreign-project receipt or treat a missing receipt as empty', async () => {
    const foreign = context(true, { ...receipt, projectId: 'another-project' });
    await expect(foreign.history.readReceiptForUser(USER, PROJECT, '42')).rejects.toMatchObject({ status: 404 });
    const absent = context(true, null);
    await expect(absent.history.readReceiptForUser(USER, PROJECT, '42')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects unsafe history ids and object coercion before querying', async () => {
    const { query, history } = context(true);
    const toString = jest.fn(() => '42');
    for (const id of ['', '0', '-1', '01', '1e2', '1.0', ' 42', '42 ', '9223372036854775808',
      ['42'], { toString }, null, 42]) {
      await expect(history.readReceiptForUser(USER, PROJECT, id)).rejects.toMatchObject({ status: 404 });
    }
    expect(query).not.toHaveBeenCalled();
    expect(toString).not.toHaveBeenCalled();
  });

  it('exposes review-only candidate, preserves uncertainty and refuses invention through controller', async () => {
    const { history } = context(true);
    const controller = new GraphChangeReviewController(history, {} as never, {} as never, {} as never, {} as never);
    const value = await controller.analyzeReceipt({ userId: USER } as never, PROJECT, '42');
    expect(value.candidateEffects).toEqual([{
      caseNodeId: 'case', requirementNodeIds: ['requirement'], observedReasons: ['requirement_reference'],
      consequence: 'review_existing_case_expectations', confidence: 'candidate_only',
      condition: 'independent_expectation_and_applicability_review_required'
    }]);
    expect(value.unsupportedClaims).toEqual(expect.arrayContaining([
      'approved_policy_consequences', 'user_manual_consequences', 'deployment_impact'
    ]));
    expect(value.coverageAssertion).toBe('none');
    expect(value.executionAssertion).toBe('none');
  });
});
