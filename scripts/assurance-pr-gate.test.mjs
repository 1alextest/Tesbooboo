import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTRACT, PROVENANCE, canonicalJson, captureSnapshot, evaluateAssurance,
  inputManifestDigest, parsePolicy, parseRecord, recordBody, requiresAssurance, run,
  sha256, snapshotDigest } from './assurance-pr-gate.mjs';
import { fixtureSnapshot, fixturePolicyRaw, fixtureSource, installReceipts, nativeReview,
  revoke, withGitHub, gateOptions, rewriteRecord } from './assurance-test-fixtures.mjs';

const blocked = snapshot => assert.equal(evaluateAssurance(snapshot).status, 'blocked');

test('owner-author can import two actual-role receipts without two human GitHub accounts', () => {
  const snapshot = fixtureSnapshot();
  const report = evaluateAssurance(snapshot);
  assert.equal(report.status, 'analytical_evidence_accepted');
  assert.equal(report.importerId, snapshot.pr.user.id);
  assert.equal(report.provenance, PROVENANCE);
  assert.equal(report.approvals.length, 2);
  assert.equal(report.ownerAuthority, 'existing-owner-authorized-integration-policy');
});
test('a release still requires its separate authority; analysis never claims FROZEN', () => {
  const snapshot = fixtureSnapshot();
  snapshot.pr.base.ref = 'main';
  const report = evaluateAssurance(snapshot);
  assert.equal(report.status, 'analytical_evidence_accepted');
  assert.equal(report.ownerAuthority, 'separate-release-authority-required');
  installReceipts(snapshot, { white: { disposition: 'FROZEN' } });
  blocked(snapshot);
});
test('candidate-authored receipts alone have no importer authority', () => {
  const snapshot = fixtureSnapshot();
  snapshot.reviews.pop();
  blocked(snapshot);
  const attacker = nativeReview(14, recordBody('import', { contract: CONTRACT }), {
    user: { id: 900, login: 'owner', type: 'User' },
  });
  snapshot.reviews.push(attacker);
  blocked(snapshot);
});
test('an explicitly configured delegate may import; removal revokes that grant', () => {
  const snapshot = fixtureSnapshot();
  snapshot.reviews[2].user = { id: 900, login: 'coordinator', type: 'Bot' };
  blocked(snapshot);
  snapshot.policy.delegatedImporterIds = [900];
  assert.equal(evaluateAssurance(snapshot).status, 'analytical_evidence_accepted');
  snapshot.policy.delegatedImporterIds = [];
  blocked(snapshot);
});
test('raw output mutation or tampering with a receipt body fails its exact digest', () => {
  const snapshot = fixtureSnapshot();
  rewriteRecord(snapshot.reviews[0], 'receipt', value => { value.output.text += ' changed'; });
  blocked(snapshot);
  const altered = fixtureSnapshot();
  installReceipts(altered, { independent: { output: { text: 'changed', sha256: sha256('original') } } });
  blocked(altered);
});
test('White must bind the original Independent receipt and admit the exact scope', () => {
  for (const white of [{ independentReceiptSha256: '0'.repeat(64) }, { disposition: 'hold' }]) {
    blocked(installReceipts(fixtureSnapshot(), { white }));
  }
});
test('role invocations cannot reuse each other or the implementation actor', () => {
  blocked(installReceipts(fixtureSnapshot(), { white: { invocationId: 'independent-actual-id' } }));
  blocked(installReceipts(fixtureSnapshot(), { independent: { invocationId: 'implementation-actual-id' } }));
  blocked(installReceipts(fixtureSnapshot(), { white: { implementationInvocationId: 'different-implementation' } }));
});
test('head, base and installed policy changes invalidate existing imports', () => {
  for (const mutate of [s => { s.pr.head.sha = 'e'.repeat(40); },
    s => { s.pr.base.sha = 'e'.repeat(40); }, s => { s.policySha = 'e'.repeat(40); }]) {
    const snapshot = fixtureSnapshot(); mutate(snapshot); blocked(snapshot);
  }
});
test('input digest and complete changed scope are independent requirements', () => {
  blocked(installReceipts(fixtureSnapshot(), { independent: { inputManifestSha256: '0'.repeat(64) } }));
  blocked(installReceipts(fixtureSnapshot(), { white: { coveredPaths: [] } }));
  const snapshot = fixtureSnapshot();
  const before = inputManifestDigest(snapshot);
  snapshot.files[0].sha = 'e'.repeat(40);
  assert.notEqual(inputManifestDigest(snapshot), before);
  blocked(snapshot);
});
test('missing method identity, missing output and invalid provenance cannot be approved', () => {
  blocked(installReceipts(fixtureSnapshot(), { independent: { method: null } }));
  blocked(installReceipts(fixtureSnapshot(), { white: { output: null } }));
  blocked(installReceipts(fixtureSnapshot(), { imported: { provenance: 'cryptographically-authenticated-worker' } }));
});
test('edited, deleted and unverified native records refuse; restored text does not erase an edit', () => {
  for (const index of [0, 1, 2]) {
    const edited = fixtureSnapshot(); edited.reviews[index].lastEditedAt = '2026-11-22T01:00:00Z'; blocked(edited);
    const missing = fixtureSnapshot(); missing.reviews.splice(index, 1); blocked(missing);
    const unknown = fixtureSnapshot(); unknown.reviews[index].editVerified = false; blocked(unknown);
  }
});
test('latest authenticated revocation or malformed/stale control never falls back to old approval', () => {
  const revoked = fixtureSnapshot(); revoke(revoked); blocked(revoked);
  const malformed = fixtureSnapshot(); malformed.reviews.push(nativeReview(14, 'TESBO-AI-IMPORT: broken')); blocked(malformed);
  const stale = fixtureSnapshot(); stale.reviews.push(nativeReview(14, stale.reviews[2].body, { commit_id: 'e'.repeat(40) })); blocked(stale);
  const untrusted = fixtureSnapshot();
  untrusted.reviews.push(nativeReview(14, 'TESBO-AI-REVOKE: 1\n{}', { user: { id: 900, type: 'User' } }));
  assert.equal(evaluateAssurance(untrusted).status, 'analytical_evidence_accepted');
});
test('native approvals and role names are not substitutes for analytical import records', () => {
  const snapshot = fixtureSnapshot(); snapshot.reviews[2].state = 'APPROVED'; blocked(snapshot);
});
test('canonical protocol rejects duplicate JSON keys, trailing data and excessive bytes', () => {
  assert.equal(parseRecord('TESBO-AI-IMPORT: 1\n{"x":1,"x":2}', 'import'), null);
  assert.equal(parseRecord('TESBO-AI-IMPORT: 1\n{} trailing', 'import'), null);
  assert.equal(parseRecord(recordBody('import', { x: 1 }), 'import', 4), null);
  assert.deepEqual(parseRecord(recordBody('import', { b: 2, a: 1 }), 'import'), { a: 1, b: 2 });
});
test('scope detects renamed protected files and keeps unrelated changes not applicable', () => {
  assert.equal(requiresAssurance({ filename: 'archive/old.md', previous_filename: 'docs/specs/agent-synchronized-engineering/requirements.md' }), true);
  for (const path of ['.github/assurance-policy.json', 'docs/ci-quality.md', 'scripts/assurance-test-fixtures.mjs']) assert.equal(requiresAssurance(path), true);
  const snapshot = fixtureSnapshot(); snapshot.files = [{ filename: 'README.md', status: 'modified', sha: 'd'.repeat(40) }];
  snapshot.reviews = [];
  assert.equal(evaluateAssurance(snapshot).status, 'not_applicable');
});
test('draft and unsupported target branches refuse; closed PRs receive no approval', () => {
  const draft = fixtureSnapshot(); draft.pr.draft = true; blocked(draft);
  const target = fixtureSnapshot(); target.pr.base.ref = 'unreviewed-feature'; blocked(target);
  const closed = fixtureSnapshot(); closed.pr.state = 'closed'; assert.equal(evaluateAssurance(closed).status, 'closed');
});
test('invalid trusted policy refuses rather than enabling an arbitrary profile', () => {
  for (const extra of [{ contract: 'unknown' }, { provenance: 'human-reviewed' },
    { delegatedImporterIds: [1, 1] }, { delegatedImporterIds: ['42'] },
    { maxOpenPullRequests: 51 }, { maxPages: 11 }, { maxCheckAgeMinutes: 0 },
    { integrationBranch: '../feature' }, { unauthorizedSetting: true }]) {
    assert.throws(() => parsePolicy(canonicalJson({ ...JSON.parse(fixturePolicyRaw), ...extra })));
  }
});
test('live adapter uses native edit metadata and installed source, never collaborator role guesses', async () => {
  await withGitHub({}, async ({ requests }) => {
    const report = await run(gateOptions());
    assert.equal(report.status, 'analytical_evidence_accepted');
    assert.ok(requests.some(request => request.url === 'https://api.github.com/graphql'));
    assert.ok(requests.every(request => !request.url.includes('/collaborators/')));
    assert.ok(requests.some(request => request.url.endsWith(`.github/assurance-policy.json?ref=${fixtureSource}`)));
  });
});
test('API failure, unavailable edit metadata and a moved default branch fail closed', async () => {
  await withGitHub({ deny: ({ url }) => url.pathname.endsWith('/reviews') }, async () => {
    await assert.rejects(run(gateOptions()), /unavailable/);
  });
  await withGitHub({ graphqlError: true }, async () => { await assert.rejects(run(gateOptions()), /metadata is incomplete/); });
  await withGitHub({ beforeCapture: (_, snapshot) => { snapshot.policySha = 'e'.repeat(40); } }, async () => {
    await assert.rejects(run(gateOptions()), /source moved/);
  });
});
test('candidate policy bytes and wrong repository identity cannot replace installed policy', async () => {
  await withGitHub({}, async () => {
    await assert.rejects(run({ ...gateOptions(), policyRaw: fixturePolicyRaw + '\n' }), /installed default-branch policy/);
  });
  await withGitHub({ beforeCapture: (_, snapshot) => { snapshot.repository.full_name = 'attacker/tesbo'; } }, async () => {
    await assert.rejects(run(gateOptions()), /identity/);
  });
});
test('snapshot digest includes receipt edits, withdrawals, owner identity and source state', async () => {
  await withGitHub({}, async () => {
    const snapshot = await captureSnapshot(gateOptions());
    const before = snapshotDigest(snapshot);
    revoke(snapshot);
    assert.notEqual(snapshotDigest(snapshot), before);
  });
});

test('the live target ref must still match GitHub PR base metadata', async () => {
  await withGitHub({ actualBaseSha: 'e'.repeat(40) }, async () => {
    await assert.rejects(run(gateOptions()), /Target branch moved/);
  });
});

test('truncated or duplicated changed-file lists cannot become not applicable or complete evidence', async () => {
  for (const mutate of [snapshot => { snapshot.pr.changed_files = 2; },
    snapshot => { snapshot.files = []; }, snapshot => {
      snapshot.files.push({ ...snapshot.files[0] }); snapshot.pr.changed_files = 2;
    }]) {
    await withGitHub({ beforeCapture: (_, snapshot) => mutate(snapshot) }, async () => {
      await assert.rejects(run(gateOptions()), /incomplete or duplicated/);
    });
  }
});
