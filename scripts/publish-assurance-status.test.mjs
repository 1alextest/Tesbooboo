import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishAssuranceStatus } from './publish-assurance-status.mjs';

const head = 'a'.repeat(40);
const nextHead = 'b'.repeat(40);
const repository = 'owner/tesbo';
const independentReceipt = 'docs/specs/agent-synchronized-engineering/reviews/independent-blue.md';
const whiteReceipt = 'docs/specs/agent-synchronized-engineering/reviews/white-final.md';

function approval(login, role, receipt) {
  return { id: login === 'blue' ? 1 : 2, state: 'APPROVED', commit_id: head,
    submitted_at: '2026-11-21T01:00:00Z',
    user: { login, type: 'User' },
    body: `TESBO-ASSURANCE: ${role}\nTESBO-HEAD: ${head}\nTESBO-EVIDENCE: ${receipt}\nTESBO-DECISION: ${role === 'WHITE' ? 'FROZEN' : 'REVIEWED'}` };
}

async function withGitHub({ permissions = { blue: 'maintain', white: 'admin' },
  approvals = [approval('blue', 'INDEPENDENT', independentReceipt), approval('white', 'WHITE', whiteReceipt)],
  moveHead = false, failPermissions = false }, action) {
  const original = globalThis.fetch;
  let prReads = 0;
  const checks = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.endsWith('/check-runs')) {
      const payload = JSON.parse(opts.body);
      checks.push(payload);
      return { ok: true, json: async () => ({ name: payload.name, head_sha: payload.head_sha }) };
    }
    if (u.endsWith('/pulls/7')) {
      prReads++;
      return { ok: true, json: async () => ({ head: { sha: moveHead && prReads > 1 ? nextHead : head },
        user: { login: 'author' }, draft: false }) };
    }
    if (u.includes('/pulls/7/files?')) {
      return { ok: true, json: async () => [{ filename: 'docs/specs/agent-synchronized-engineering/requirements.md' }] };
    }
    if (u.includes('/pulls/7/reviews?')) {
      return { ok: true, json: async () => approvals };
    }
    if (u.includes('/collaborators/')) {
      if (failPermissions) return { ok: false, status: 403 };
      const login = u.split('/collaborators/')[1].split('/')[0];
      return { ok: true, json: async () => ({ permission: permissions[login] ?? 'read' }) };
    }
    if (u.includes('/contents/')) {
      return { ok: true, json: async () => ({ type: 'file', size: 150 }) };
    }
    throw new Error('Unexpected GitHub endpoint in test: ' + u);
  };
  try { return await action(checks); } finally { globalThis.fetch = original; }
}

test('trusted current-head, distinct human/admin roles generate one successful PR-head check', async () => {
  await withGitHub({}, async checks => {
    const value = await publishAssuranceStatus({ repository, prNumber: 7, token: 'placeholder-token' });
    assert.equal(value.status, 'review_provisionally_verified');
    assert.equal(value.conclusion, 'success');
    assert.equal(value.head, head);
    assert.equal(checks.length, 1);
    assert.equal(checks[0].name, 'specification-assurance');
    assert.equal(checks[0].head_sha, head);
    assert.equal(checks[0].conclusion, 'success');
    assert.equal(checks[0].output.summary.includes('placeholder-token'), false);
  });
});

test('missing approvals publish a failure check; do not silently skip governance', async () => {
  await withGitHub({ approvals: [] }, async checks => {
    const result = await publishAssuranceStatus({ repository, prNumber: 7, token: 'placeholder-token' });
    assert.equal(result.status, 'blocked');
    assert.equal(checks[0].conclusion, 'failure');
    assert.match(checks[0].output.summary, /Missing independent/);
  });
});

test('role escalation is refused when the repository administrator did not grant permission', async () => {
  await withGitHub({ permissions: { blue: 'write', white: 'maintain' } }, async checks => {
    const result = await publishAssuranceStatus({ repository, prNumber: 7, token: 'placeholder-token' });
    assert.equal(result.status, 'blocked');
    assert.equal(checks[0].conclusion, 'failure');
  });
});

test('a new head during review cannot inherit an older successful check', async () => {
  await withGitHub({ moveHead: true }, async checks => {
    const result = await publishAssuranceStatus({ repository, prNumber: 7, token: 'placeholder-token' });
    assert.equal(result.status, 'blocked');
    assert.equal(result.head, nextHead);
    assert.equal(checks[0].head_sha, nextHead);
    assert.equal(checks[0].conclusion, 'failure');
    assert.match(checks[0].output.summary, /changed or was not bound/);
  });
});

test('permission API denial generates an explicit failed check, never an approved fallback', async () => {
  await withGitHub({ failPermissions: true }, async checks => {
    const result = await publishAssuranceStatus({ repository, prNumber: 7, token: 'placeholder-token' });
    assert.equal(result.status, 'blocked');
    assert.equal(checks[0].conclusion, 'failure');
  });
});

test('a failed Checks API write cannot be misreported as a verified success', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).endsWith('/check-runs')) return { ok: false, status: 403 };
    return { ok: true, json: async () => ({ head: { sha: head }, user: { login: 'author' }, draft: false }) };
  };
  try {
    await assert.rejects(publishAssuranceStatus({ repository, prNumber: 7, token: 'placeholder-token' }), /GitHub check-run API failed/);
  } finally { globalThis.fetch = original; }
});
