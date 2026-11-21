import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requiresAssurance, parseReviewBody, hasAssuranceRole, evaluateAssuranceReviews } from './assurance-pr-gate.mjs';

const head = 'a'.repeat(40);
const specialist = 'docs/specs/agent-synchronized-engineering/reviews/independent-blue.md';
const white = 'docs/specs/agent-synchronized-engineering/reviews/white-final.md';
const changedFiles = ['docs/specs/agent-synchronized-engineering/requirements.md'];
const trustedPermissions = { blue: 'maintain', white: 'admin' };
function review(login, role, receipt, options = {}) {
  const decision = options.decision ?? (role === 'WHITE' ? 'FROZEN' : 'REVIEWED');
  return { id: options.id ?? 10, state: options.state ?? 'APPROVED', commit_id: options.commit ?? head,
    submitted_at: options.at ?? '2026-11-20T02:00:00Z', user: { login, type: options.type ?? 'User' },
    body: `TESBO-ASSURANCE: ${role}\nTESBO-HEAD: ${options.namedHead ?? head}\nTESBO-EVIDENCE: ${receipt}\nTESBO-DECISION: ${decision}` +
      (options.reason ? `\nTESBO-WAIVER-REASON: ${options.reason}` : '') };
}
function check(reviews, extra = {}) { return evaluateAssuranceReviews({ changedFiles, head, author: 'author', reviews, reviewerPermissions: trustedPermissions, ...extra }); }
const valid = [review('blue', 'INDEPENDENT', specialist), review('white', 'WHITE', white, { id: 11 })];

test('only protected spec/assurance material triggers the gate', () => {
  assert.equal(requiresAssurance('docs/specs/agent-synchronized-engineering/design.md'), true);
  assert.equal(requiresAssurance('scripts/assurance-pr-gate.mjs'), true);
  assert.equal(requiresAssurance('Tesbo-Backend-Nest/src/app.module.ts'), false);
  assert.equal(check([], { changedFiles: ['README.md'] }).status, 'not_applicable');
});
test('review roles derive only from GitHub-administered collaborator permissions', () => {
  assert.equal(hasAssuranceRole('admin', 'WHITE'), true);
  assert.equal(hasAssuranceRole('maintain', 'WHITE'), false);
  assert.equal(hasAssuranceRole('write', 'WHITE'), false);
  assert.equal(hasAssuranceRole('maintain', 'INDEPENDENT'), true);
  assert.equal(hasAssuranceRole('admin', 'INDEPENDENT'), true);
  for (const permission of [null, '', 'write', 'triage', 'read', 'none', 'owner']) {
    assert.equal(hasAssuranceRole(permission, 'INDEPENDENT'), false);
  }
  assert.equal(hasAssuranceRole('admin', 'PUBLISH'), false);
});
test('fails closed without current GitHub permissions, despite plausible self-described approvals', () => {
  assert.equal(check(valid, { reviewerPermissions: null }).status, 'blocked');
  assert.match(check(valid, { reviewerPermissions: null }).errors.join(' '), /permissions are unavailable/);
  assert.equal(check(valid, { reviewerPermissions: {} }).status, 'blocked');
  assert.equal(check(valid, { reviewerPermissions: { blue: 'write', white: 'admin' } }).status, 'blocked');
  assert.equal(check(valid, { reviewerPermissions: { blue: 'maintain', white: 'maintain' } }).status, 'blocked');
});
test('rejects an outsider declaring INDEPENDENT or WHITE and reviewers claiming the wrong role', () => {
  assert.equal(check([review('outsider', 'INDEPENDENT', specialist), valid[1]]).status, 'blocked');
  assert.equal(check([valid[0], review('outsider', 'WHITE', white, { id: 11 })]).status, 'blocked');
  assert.equal(check([review('white', 'INDEPENDENT', specialist), review('blue', 'WHITE', white, { id: 11 })]).status, 'blocked');
});
test('accepts two different approved humans and complete exact-head evidence references', () => {
  assert.equal(check(valid).status, 'review_provisionally_verified');
  assert.equal(check(valid).approvals.length, 2);
});
test('rejects draft, zero reviews and author self approval', () => {
  assert.equal(check(valid, { draft: true }).status, 'blocked');
  assert.equal(check([]).status, 'blocked');
  assert.equal(check([review('author', 'INDEPENDENT', specialist), valid[1]]).status, 'blocked');
});
test('rejects stale head, attestation head mismatch, bot and unapproved review', () => {
  for (const opts of [{ commit:'b'.repeat(40) }, { namedHead:'b'.repeat(40) },
    { type:'Bot' }, { state:'COMMENTED' }]) {
    assert.equal(check([review('blue','INDEPENDENT',specialist,opts), valid[1]]).status,'blocked');
  }
});
test('rejects later change request or dismissal after earlier approval', () => {
  for (const state of ['CHANGES_REQUESTED', 'DISMISSED']) {
    const invalid = [valid[0], review('blue','INDEPENDENT',specialist,{state,id:12,at:'2026-11-20T03:00:00Z'}),valid[1]];
    assert.equal(check(invalid).status,'blocked');
  }
});
test('refuses same reviewer or reused receipt across roles', () => {
  assert.equal(check([valid[0],review('blue','WHITE',white,{id:12,at:'2026-11-20T03:00:00Z'})]).status,'blocked');
  assert.equal(check([valid[0],review('white','WHITE',specialist,{id:12})]).status,'blocked');
});
test('refuses invalid evidence paths, malformed sha and duplicate attestation fields', () => {
  assert.equal(parseReviewBody(valid[0].body.replace(specialist,'../unsafe'),head),null);
  assert.equal(parseReviewBody(valid[0].body.replace(head,'abc'),head),null);
  assert.equal(parseReviewBody(valid[0].body+'\nTESBO-HEAD: '+head,head),null);
});
test('explicit waiver needs a reason and does not impersonate an ordinary White freeze', () => {
  const reason='Authorized scope-only waiver for this documentation wording correction.';
  assert.equal(check([valid[0],review('white','WHITE',white,{id:11,decision:'EXPLICIT-WAIVER',reason})]).status,
    'approved_exception');
  assert.equal(check([valid[0],review('white','WHITE',white,{id:11,decision:'EXPLICIT-WAIVER'})]).status,'blocked');
});
test('incomplete source data fails closed', () => {
  assert.equal(evaluateAssuranceReviews({changedFiles,head:'missing',author:'author',reviews:[]}).status,'blocked');
  assert.equal(evaluateAssuranceReviews({changedFiles:undefined,head,author:'author',reviews:[]}).status,'blocked');
});

test('the live GitHub gate checks evidence on the exact PR head, not a previous branch or PR text', async () => {
  const { run } = await import('./assurance-pr-gate.mjs');
  const previous = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    const data = String(url).includes('/collaborators/blue/permission') ? { permission: 'maintain' }
      : String(url).includes('/collaborators/white/permission') ? { permission: 'admin' }
      : String(url).includes('/pulls/7/files?')
      ? changedFiles.map(filename => ({ filename }))
      : String(url).includes('/pulls/7/reviews?') ? valid
      : String(url).endsWith('/pulls/7') ? { head: { sha: head }, user: { login: 'author' }, draft: false }
      : { type: 'file', size: 200 };
    return { ok: true, json: async () => data };
  };
  try {
    const outcome = await run({ repository: 'example/tesbo', prNumber: 7, token: 'not-a-real-token', authorizedReviewers: trustedRoster });
    assert.equal(outcome.status, 'review_provisionally_verified');
    assert.equal(urls.filter(u => u.includes('/contents/')).length, 2);
    assert.equal(urls.filter(u => u.includes('/collaborators/') && u.endsWith('/permission')).length, 2);
    assert.equal(urls.every(u => !u.includes('ref=development')), true);
    assert.equal(urls.filter(u => u.includes('/contents/')).every(u => u.endsWith('ref='+head)), true);
  } finally { globalThis.fetch = previous; }
});

test('unavailable GitHub review evidence blocks, never counts as an empty approved set', async () => {
  const { run } = await import('./assurance-pr-gate.mjs');
  const previous = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403 });
  try {
    await assert.rejects(run({ repository: 'example/tesbo', prNumber: 7, token: 'not-a-real-token' }),
      /GitHub review evidence fetch failed: 403/);
  } finally { globalThis.fetch = previous; }
});


test('API cannot promote a PR reviewer to White or Independent without current GitHub permission', async () => {
  const { run } = await import('./assurance-pr-gate.mjs');
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    const u = String(url);
    const data = u.includes('/pulls/7/files?') ? changedFiles.map(filename => ({ filename }))
      : u.includes('/pulls/7/reviews?') ? valid
      : u.endsWith('/pulls/7') ? { head: { sha: head }, user: { login: 'author' }, draft: false }
      : u.includes('/collaborators/blue/') ? { permission: 'write' }
      : u.includes('/collaborators/white/') ? { permission: 'maintain' }
      : { type: 'file', size: 250 };
    return { ok: true, json: async () => data };
  };
  try {
    const result = await run({ repository: 'example/tesbo', prNumber: 7, token: 'dummy' });
    assert.equal(result.status, 'blocked');
    assert.match(result.errors.join(' '), /Missing independent/);
    assert.match(result.errors.join(' '), /Missing separate White/);
  } finally { globalThis.fetch = original; }
});

test('unavailable collaborator permission API is a fail-closed authorization error', async () => {
  const { run } = await import('./assurance-pr-gate.mjs');
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    const u = String(url);
    if (u.includes('/collaborators/')) return { ok: false, status: 403 };
    const data = u.includes('/pulls/7/files?') ? changedFiles.map(filename => ({ filename }))
      : u.includes('/pulls/7/reviews?') ? valid
      : { head: { sha: head }, user: { login: 'author' }, draft: false };
    return { ok: true, json: async () => data };
  };
  try {
    await assert.rejects(run({ repository: 'example/tesbo', prNumber: 7, token: 'dummy' }),
      /GitHub review evidence fetch failed: 403/);
  } finally { globalThis.fetch = original; }
});
