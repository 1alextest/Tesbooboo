import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishAssuranceStatus, refreshAssurance, main } from './publish-assurance-status.mjs';
import { fixtureSnapshot, fixtureHead, fixtureSource, fixturePolicyRaw,
  gateOptions, nativeReview, revoke, withGitHub } from './assurance-test-fixtures.mjs';

const options = () => ({ ...gateOptions(), now: new Date('2026-11-22T00:01:00Z'), runId: '1234' });

test('stable owner-imported AI evidence publishes a scoped exact-head check and rereads after publication', async () => {
  await withGitHub({}, async ({ checks, getCaptures }) => {
    const result = await publishAssuranceStatus(options());
    assert.equal(result.outcome, 'analytical_evidence_accepted');
    assert.equal(result.conclusion, 'success');
    assert.equal(result.head, fixtureHead);
    assert.equal(checks.length, 1);
    assert.equal(checks[0].head_sha, fixtureHead);
    assert.equal(getCaptures(), 3);
    assert.match(checks[0].output.summary, /not cryptographic worker authentication/);
    assert.match(checks[0].output.summary, /not.*human review/);
    assert.match(checks[0].output.summary, /2026-11-22T00:31:00.000Z/);
    assert.ok(!checks[0].output.summary.includes('synthetic-test-token'));
  });
});
test('same-head withdrawal between initial and final reads publishes failure', async () => {
  await withGitHub({ beforeCapture: (count, snapshot) => { if (count === 2) revoke(snapshot); } }, async ({ checks }) => {
    const result = await publishAssuranceStatus(options());
    assert.equal(result.conclusion, 'failure');
    assert.equal(result.head, fixtureHead);
    assert.match(checks[0].output.summary, /receipt\/import state changed/);
    assert.match(checks[0].output.summary, /revocation/);
  });
});
test('same-head deleted receipt or edited import during evaluation cannot keep green', async () => {
  for (const mutate of [snapshot => { snapshot.reviews.shift(); },
    snapshot => { snapshot.reviews[2].lastEditedAt = '2026-11-22T00:02:00Z'; }]) {
    await withGitHub({ beforeCapture: (count, snapshot) => { if (count === 2) mutate(snapshot); } }, async ({ checks }) => {
      assert.equal((await publishAssuranceStatus(options())).conclusion, 'failure');
      assert.equal(checks[0].conclusion, 'failure');
    });
  }
});
test('base or trusted policy movement during evaluation invalidates the result', async () => {
  for (const mutate of [snapshot => { snapshot.pr.base.sha = 'e'.repeat(40); },
    snapshot => { snapshot.policySha = 'e'.repeat(40); }]) {
    await withGitHub({ beforeCapture: (count, snapshot) => { if (count === 2) mutate(snapshot); } }, async ({ checks }) => {
      assert.equal((await publishAssuranceStatus(options())).conclusion, 'failure');
      assert.equal(checks[0].conclusion, 'failure');
    });
  }
});
test('new head cannot inherit an old successful observation', async () => {
  await withGitHub({ beforeCapture: (count, snapshot) => { if (count === 2) snapshot.pr.head.sha = 'e'.repeat(40); } }, async ({ checks }) => {
    const result = await publishAssuranceStatus(options());
    assert.equal(result.conclusion, 'failure');
    assert.equal(checks[0].head_sha, 'e'.repeat(40));
  });
});
test('withdrawal during Checks API publication invalidates that same check afterward', async () => {
  await withGitHub({ afterCreate: snapshot => revoke(snapshot) }, async ({ checks }) => {
    const result = await publishAssuranceStatus(options());
    assert.equal(result.conclusion, 'failure');
    assert.equal(checks.length, 2);
    assert.equal(checks[0].conclusion, 'success');
    assert.equal(checks[1].method, 'PATCH');
    assert.equal(checks[1].id, checks[0].id);
    assert.equal(checks[1].conclusion, 'failure');
  });
});
test('a marker-removed revocation is refused by the live publisher', async () => {
  const snapshot = fixtureSnapshot();
  revoke(snapshot);
  snapshot.reviews.at(-1).body = 'Edited record without the protocol marker';
  snapshot.reviews.at(-1).lastEditedAt = '2026-11-22T00:00:18Z';
  await withGitHub({ snapshot }, async ({ checks }) => {
    const result = await publishAssuranceStatus(options());
    assert.equal(result.conclusion, 'failure');
    assert.equal(checks.length, 1);
    assert.equal(checks[0].conclusion, 'failure');
  });
});
test('an authorized ordinary-body edit during publication invalidates the same check', async () => {
  const snapshot = fixtureSnapshot();
  snapshot.reviews.push(nativeReview(10, 'Ordinary body before publication'));
  await withGitHub({ snapshot, afterCreate: current => {
    const record = current.reviews.find(review => review.id === 10);
    record.body = 'Ordinary body after an ambiguous edit';
    record.lastEditedAt = '2026-11-22T00:00:18Z';
  } }, async ({ checks }) => {
    const result = await publishAssuranceStatus(options());
    assert.equal(result.conclusion, 'failure');
    assert.equal(checks.length, 2);
    assert.equal(checks[0].conclusion, 'success');
    assert.equal(checks[1].id, checks[0].id);
    assert.equal(checks[1].method, 'PATCH');
    assert.equal(checks[1].conclusion, 'failure');
  });
});
test('unavailable final evidence cannot silently reuse the initial pass', async () => {
  await withGitHub({ deny: ({ url, captures }) => captures >= 2 && url.pathname.endsWith('/reviews') }, async ({ checks }) => {
    assert.equal((await publishAssuranceStatus(options())).conclusion, 'failure');
    assert.equal(checks[0].conclusion, 'failure');
  });
});
test('Checks API failure is an unreported outcome, never claimed as success', async () => {
  await withGitHub({ deny: ({ url, method }) => url.pathname.endsWith('/check-runs') && method === 'POST' }, async () => {
    await assert.rejects(publishAssuranceStatus(options()), /unavailable/);
  });
});
test('invalidation write failure remains an explicit operational failure', async () => {
  await withGitHub({ afterCreate: snapshot => revoke(snapshot), deny: ({ method }) => method === 'PATCH' }, async () => {
    await assert.rejects(publishAssuranceStatus(options()), /unavailable/);
  });
});
test('closed PRs are not written or certified by queue refresh', async () => {
  const snapshot = fixtureSnapshot(); snapshot.pr.state = 'closed';
  await withGitHub({ snapshot }, async ({ checks }) => {
    const result = await publishAssuranceStatus(options());
    assert.equal(result.skipped, true);
    assert.equal(checks.length, 0);
  });
});
test('a missing import is a truthful failed PR check, not a refresh infrastructure error', async () => {
  const snapshot = fixtureSnapshot(); snapshot.reviews.pop();
  await withGitHub({ snapshot }, async ({ checks }) => {
    const results = await refreshAssurance({ ...gateOptions(), prNumber: undefined });
    assert.equal(results.length, 1);
    assert.equal(results[0].conclusion, 'failure');
    assert.equal(checks[0].conclusion, 'failure');
  });
});
test('missing evidence does not claim that the coordinator observed actual worker outputs', async () => {
  const snapshot = fixtureSnapshot(); snapshot.reviews = [];
  await withGitHub({ snapshot }, async ({ checks }) => {
    assert.equal((await publishAssuranceStatus(options())).conclusion, 'failure');
    assert.doesNotMatch(checks[0].output.summary, /coordinator observed .*worker outputs|importer attests that it observed/i);
    assert.match(checks[0].output.summary, /not established|not accepted|no accepted/i);
  });
});
test('bounded schedule refuses overflow instead of silently ignoring the queue tail', async () => {
  await withGitHub({ openPRs: Array.from({ length: 51 }, (_, i) => ({ number: i + 1 })) }, async ({ checks }) => {
    await assert.rejects(refreshAssurance({ ...gateOptions(), prNumber: undefined }), /bound exceeded/);
    assert.equal(checks.length, 0);
  });
});
test('queue refresh uses a fixed GitHub page request for every valid policy bound', async () => {
  for (const maximum of [1, 50]) {
    const policyRaw = JSON.stringify({ ...JSON.parse(fixturePolicyRaw), maxOpenPullRequests: maximum });
    await withGitHub({ policyRaw }, async ({ requests, checks }) => {
      const results = await refreshAssurance({ ...gateOptions(), policyRaw, prNumber: undefined });
      assert.equal(requests[0].url, 'https://api.github.com/repos/owner/tesbo/pulls?state=open&per_page=100');
      assert.equal(requests[0].method, 'GET');
      assert.equal(results.length, 1);
      assert.equal(results[0].conclusion, 'success');
      assert.equal(checks.length, 1);
      assert.equal(checks[0].head_sha, fixtureHead);
    });
  }
});
test('the fixed queue page still refuses the configured bound and a full page before any write', async () => {
  for (const [maximum, count] of [[1, 2], [50, 51], [50, 100]]) {
    const policyRaw = JSON.stringify({ ...JSON.parse(fixturePolicyRaw), maxOpenPullRequests: maximum });
    const openPRs = Array.from({ length: count }, (_, i) => ({ number: i + 1 }));
    await withGitHub({ policyRaw, openPRs }, async ({ requests, checks }) => {
      await assert.rejects(refreshAssurance({ ...gateOptions(), policyRaw, prNumber: undefined }), /bound exceeded/);
      assert.deepEqual(requests, [{ url: 'https://api.github.com/repos/owner/tesbo/pulls?state=open&per_page=100', method: 'GET' }]);
      assert.equal(checks.length, 0);
    });
  }
});
test('workflow entrypoint refuses PR events, wrong repository ID and non-default refs', async () => {
  const baseEnv = { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REPOSITORY: 'owner/tesbo', GITHUB_TOKEN: 'synthetic-test-token',
    GITHUB_REPOSITORY_ID: '7', GITHUB_SHA: fixtureSource, GITHUB_REF: 'refs/heads/main', PR_NUMBER: '7' };
  await assert.rejects(main({ ...baseEnv, GITHUB_EVENT_NAME: 'pull_request_target' }), /installed schedule or dispatch/);
  await withGitHub({}, async ({ checks }) => {
    await assert.rejects(main({ ...baseEnv, GITHUB_REF: 'refs/heads/untrusted' }), /trusted repository/);
    await assert.rejects(main({ ...baseEnv, GITHUB_REPOSITORY_ID: '8' }), /trusted repository/);
    assert.equal(checks.length, 0);
  });
});
test('selection cannot smuggle an alternate repository or executable string', async () => {
  await assert.rejects(publishAssuranceStatus({ ...options(), repository: '../elsewhere' }), /Invalid/);
  await assert.rejects(refreshAssurance({ ...gateOptions(), prNumber: '7; echo unexpected' }), /Invalid PR selection/);
  assert.equal(JSON.parse(fixturePolicyRaw).contract, 'tesbo-coordinator-attested-ai-assurance/v1');
});


test('unresolved native finding prevents publishing success even with valid assurance receipts', async () => {
  const snapshot = fixtureSnapshot();
  snapshot.reviewThreads = [{id:'scanner-finding',isResolved:false,isOutdated:true}];
  await withGitHub({snapshot}, async ({checks}) => {
    assert.equal((await publishAssuranceStatus(options())).conclusion, 'failure');
    assert.match(checks[0].output.summary, /Unresolved native review finding/);
  });
});
test('same-head finding arriving during publication invalidates the published check', async () => {
  await withGitHub({afterCreate: snapshot => {
    snapshot.reviewThreads.push({id:'late-finding',isResolved:false,isOutdated:false});
  }}, async ({checks}) => {
    assert.equal((await publishAssuranceStatus(options())).conclusion, 'failure');
    assert.equal(checks.length, 2);
    assert.equal(checks[1].id, checks[0].id);
    assert.equal(checks[1].conclusion, 'failure');
  });
});
