import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createHandoffRequest, parseSelection, prepareHandoff } from './qa-approved-handoff.mjs';
import { createHandoffFixture, fixtureGit as git } from './qa-handoff-fixture.mjs';
import { HARNESS_REVISION } from './qa-investigation-mapping.mjs';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const projectId = id(1), taskId = id(2);
const targetPath = 'tests/filter.spec.ts';
const targetRepo = 'synthetic-tesbo/consumer';
const origin = 'https://tesbo-fixture.invalid';
const repoRevision = 'a'.repeat(40);
const harnessRoot = process.env.QA_INVESTIGATION_HARNESS_ROOT;
const digest = data => createHash('sha256').update(data).digest('hex');
const basis = {
  receiptId: id(3), proposalRevision: 'b'.repeat(64), selectedIndex: 1,
  requirementId: id(4), requirementVersionId: id(5), linkId: id(6), testcaseId: id(7),
  testcaseRevision: 'c'.repeat(64), testcaseApprovalRevision: 'd'.repeat(64), criterionKeys: ['C1'],
};
const selection = {
  projectId, taskId, investigationId: 'CASE-300', upstreamCase: 'TC-01', branch: 'main', repoRevision,
};
const target = { repository: targetRepo, branch: 'main', revision: repoRevision, path: targetPath };
const current = {
  linkId: basis.linkId, testcaseId: basis.testcaseId, requirementVersionId: basis.requirementVersionId,
  testcaseRevision: basis.testcaseRevision, testcaseApprovalRevision: basis.testcaseApprovalRevision,
  criterionKeys: ['C1'], authored: true, approved: true, executed: false, passing: false,
};
const native = {
  projectId, taskId, ...basis, criteria: [{key: 'C1', text: 'Only matching tasks are returned'}],
  testcase: {id: basis.testcaseId, title: 'Filter tasks', steps: [], automationRepo: targetRepo,
    automationPath: targetPath, automationFramework: 'Playwright'},
  provenance: { reviewerId: id(8), requirementApproverId: id(9), exportedBy: id(10), appliedSkills: [] },
};

// Simulated HTTP contract. Requests go through WHATWG Request and Response in memory.
// All three native reads are modelled; any unexpected route or body fails the test.
function session() {
  const api = '/api/projects/' + projectId;
  const task = api + '/requirements/proposals/' + taskId;
  const receipt = {id: basis.receiptId, proposalRevision: basis.proposalRevision, selectedIndex: basis.selectedIndex,
    requirement: {documentId: basis.requirementId, versionId: id(11)}, testcase: {id: basis.testcaseId},
    link: {id: id(12), criterionKeys: ['C1']}};
  const state = {
    cases: [structuredClone(current)], calls: [], expectedBasis: structuredClone(basis),
    selected: structuredClone(native), receipt: structuredClone(receipt), refusalStatus: null,
  };
  const request = createHandoffRequest(origin, {fetch: async (url, {method, data}) => {
    const incoming = new Request(url, {method, body: data && JSON.stringify(data)});
    const pathname = new URL(incoming.url).pathname;
    const body = incoming.body ? await incoming.json() : undefined;
    state.calls.push({method, path: pathname, body});
    let response;
    if (method === 'GET' && pathname === task) {
      response = Response.json({id: taskId, requirementApplyReceipt: state.receipt});
    } else if (method === 'GET' && pathname === api + '/requirements/' + basis.requirementId + '/coverage') {
      // A different case can make these requirement-level flags true even when the selected one is stale.
      response = Response.json({requirementId: basis.requirementId, approvedVersionId: basis.requirementVersionId,
        readings: {approved: true, mixed: true, passing: true}, cases: state.cases});
    } else if (method === 'POST' && pathname === task + '/automation-handoff') {
      if (state.refusalStatus) response = Response.json({code: 'AUTOMATION_HANDOFF_UNAVAILABLE'}, {status: state.refusalStatus});
      else {
        assert.deepEqual(body, state.expectedBasis, 'read must submit the exact immutable selection');
        response = Response.json(state.selected);
      }
    } else assert.fail(method + ' ' + pathname);
    return {status: () => response.status, json: () => response.json()};
  }});
  const checks = {
    request, confirm: async () => true, checkTarget: () => target,
    readMapping: async () => ({upstreamCase: 'TC-01', targetPath, risks: [{id: 'R1'}]}),
  };
  return {state, checks};
}

test('parses the task and target pins independently and rejects a short Git revision', () => {
  const args = ['--task-url', origin + '/projects/' + projectId + '/agents/tasks/' + taskId,
    '--api-origin', origin, '--repo', '.', '--harness', '.', '--branch', 'main', '--investigation', 'CASE-300',
    '--case', 'TC-01', '--revision', repoRevision];
  const parsed = parseSelection(args);
  assert.equal(parsed.taskId, taskId);
  assert.equal(parsed.projectId, projectId);
  assert.equal(parsed.repoRevision, repoRevision);
  assert.throws(() => parseSelection([...args.slice(0, -1), 'aaaa']), /40-character/);
});

test('exports only the reviewed case despite mixed coverage and rechecks the same pins after consent', async () => {
  const {state, checks} = session();
  state.cases.unshift({...current, testcaseId: id(20), linkId: id(21)},
    {...current, requirementVersionId: id(22), approved: false});
  const events = [];
  checks.checkTarget = () => { events.push('target'); return target; };
  checks.confirm = async (packet, hash) => {
    events.push('consent');
    assert.equal(packet.native.testcase.id, basis.testcaseId);
    assert.equal(packet.native.provenance.reviewerId, id(8));
    assert.equal(hash, digest(JSON.stringify(packet)));
    assert.deepEqual(state.calls.map(x => x.method), ['GET','GET','POST']);
    return true;
  };
  const {selectionDigest, ...packet} = await prepareHandoff(selection, checks);
  assert.equal(selectionDigest, digest(JSON.stringify(packet)));
  assert.deepEqual(state.calls.map(x => x.method), ['GET','GET','POST','POST']);
  assert.deepEqual(state.calls.filter(x => x.method === 'POST').map(x => x.body), [basis, basis]);
  assert.deepEqual(events, ['target','consent','target']);
});

for (const [reason, cases] of [
  ['aggregate only', []], ['different case', [{...current, testcaseId: id(50)}]],
  ['wrong criterion', [{...current, criterionKeys: ['C2']}]], ['old version', [{...current, requirementVersionId: id(51)}]],
  ['withdrawn case', [{...current, approved: false}]], ['ambiguous links', [current, {...current, linkId: id(52)}]],
]) {
  test('no packet from ' + reason + ' despite positive aggregate flags', async () => {
    const {state, checks} = session();
    state.cases = cases;
    checks.confirm = assert.fail;
    await assert.rejects(prepareHandoff(selection, checks), /exactly one current approved link/);
    assert.deepEqual(state.calls.map(x => x.method), ['GET','GET']);
  });
}

test('cancellation stops before final native and target rechecks', async () => {
  const {state, checks} = session();
  let targetReads = 0;
  checks.checkTarget = () => { targetReads++; return target; };
  checks.confirm = async () => false;
  await assert.rejects(prepareHandoff(selection, checks), /cancelled/);
  assert.equal(targetReads, 1);
  assert.deepEqual(state.calls.map(x => x.method), ['GET','GET','POST']);
});

for (const status of [401, 403, 409, 429, 503]) {
  test('HTTP ' + status + ' after consent aborts with the original proposal and case revision', async () => {
    const {state, checks} = session();
    checks.confirm = async () => { state.refusalStatus = status; return true; };
    await assert.rejects(prepareHandoff(selection, checks), new RegExp('HTTP ' + status));
    assert.deepEqual(state.calls.filter(x => x.method === 'POST').map(x => x.body), [basis, basis]);
  });
}

test('a different reviewer or unpinned payload at confirmation cannot be exported', async () => {
  for (const change of [
    data => { data.provenance.reviewerId = id(37); },
    data => { data.testcaseRevision = 'e'.repeat(64); },
    data => { data.criteria[0].text = 'New criterion'; },
  ]) {
    const {state, checks} = session();
    checks.confirm = async () => { change(state.selected); return true; };
    await assert.rejects(prepareHandoff(selection, checks), /changed during review|exact selected case/);
    assert.deepEqual(state.calls.filter(x => x.method === 'POST').map(x => x.body), [basis, basis]);
  }
});

async function checkout(t, addInvestigation = false) {
  const fixture = await createHandoffFixture({
    harnessRoot, repository: targetRepo, targetPath, plan: addInvestigation && {
      key: 'C1', title: 'Filter tasks', oracle: 'Only matching tasks are returned',
      risk: 'The list may show a stale result', action: 'Filter tasks', observation: 'Only matching tasks remain visible.',
    },
  });
  t.after(fixture.cleanup);
  return {...fixture, selected: {...selection, ...fixture.selected}};
}

for (const change of ['published branch', 'working file', 'same-size change hidden from Git status']) {
  test('rechecks the ' + change + ' after consent before returning a handoff', async t => {
    const local = await checkout(t);
    const {state, checks} = session();
    checks.checkTarget = local.checkTarget;
    checks.confirm = async packet => {
      assert.equal(packet.target.revision, local.selected.repoRevision);
      if (change === 'published branch') git(local.remote, 'update-ref', 'refs/heads/main', local.earlier);
      else if (change === 'working file') await writeFile(join(local.repo, targetPath), '// changed after the preview\n');
      else {
        git(local.repo, 'update-index', '--assume-unchanged', '--', targetPath);
        await writeFile(join(local.repo, targetPath), '// Synthetic target, never executed\n');
        assert.equal(git(local.repo, 'status', '--porcelain', '--', targetPath), '');
      }
      return true;
    };
    await assert.rejects(prepareHandoff(local.selected, checks), /verify the selected checkout/);
    assert.equal(state.calls.filter(x => x.method === 'POST').length, 1);
  });
}

test('a pre-existing local change refuses the handoff before operator consent', async t => {
  const local = await checkout(t);
  const {checks} = session();
  checks.checkTarget = local.checkTarget;
  checks.confirm = assert.fail;
  await writeFile(join(local.repo, targetPath), '// locally altered before the preview\n');
  await assert.rejects(prepareHandoff(local.selected, checks), /verify the selected checkout/);
});

test('joins the real pinned investigation, published Git fixture, native HTTP contract and explicit consent', {
  skip: harnessRoot ? false : 'Set QA_INVESTIGATION_HARNESS_ROOT to run this real upstream integration',
}, async t => {
  const local = await checkout(t, true);
  const {state, checks} = session();
  let confirmations = 0;
  const packet = await prepareHandoff(local.selected, {
    request: checks.request, checkTarget: local.checkTarget,
    confirm: async preview => {
      confirmations++;
      assert.equal(preview.native.criteria[0].text, preview.investigation.risks[0].oracle);
      assert.equal(preview.investigation.plan.title, 'Filter tasks');
      assert.equal(preview.investigation.targetBlob, git(local.repo, 'rev-parse', 'HEAD:' + targetPath));
      assert.equal(preview.investigation.harnessRevision, HARNESS_REVISION);
      assert.equal(preview.target.revision, preview.investigation.repoRevision);
      return true;
    },
  });
  assert.equal(confirmations, 1);
  assert.equal(packet.native.provenance.reviewerId, id(8));
  assert.deepEqual(state.calls.filter(x => x.method === 'POST').map(x => x.body), [basis, basis]);
  assert.equal(git(local.repo, 'status', '--porcelain'), '');
});

const recoveryPath = '/api/projects/synthetic/requirements/proposals/synthetic/automation-handoff';
for (const [status, guidance] of [
  [302, /unexpected redirect/i], [400, /task and revision/i], [401, /sign in/i],
  [403, /authorized for the selected project/i], [404, /task link, API origin and your access/i],
  [409, /current requirement, case approvals and active link/i], [429, /after the service allows another request/i],
  [503, /service availability/i], [418, /did not establish eligibility/i],
]) {
  test('handoff HTTP ' + status + ' refuses with relevant recovery and no response disclosure', async () => {
    let calls = 0;
    let bodyReads = 0;
    const request = createHandoffRequest(origin, {fetch: async (url, options) => {
      calls++;
      assert.equal(url, origin + recoveryPath);
      assert.deepEqual(options, {method: 'POST', data: {revision: 'fixture'}, maxRedirects: 0, timeout: 20_000});
      return {status: () => status, json: async () => { bodyReads++; return {error: 'PRIVATE_FIXTURE_CANARY'}; }};
    }});
    await assert.rejects(request('POST', recoveryPath, {revision: 'fixture'}), error => {
      assert.match(error.message, new RegExp('HTTP ' + status));
      assert.match(error.message, guidance);
      assert.doesNotMatch(error.message, /PRIVATE_FIXTURE_CANARY/);
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(bodyReads, 0);
  });
}

test('handoff transport error does not reveal raw exception content', async () => {
  const request = createHandoffRequest(origin, {fetch: async () => { throw new Error('PRIVATE_FIXTURE_CANARY'); }});
  await assert.rejects(request('GET', recoveryPath), error => {
    assert.match(error.message, /connection and Tesbo service availability/);
    assert.doesNotMatch(error.message, /PRIVATE_FIXTURE_CANARY/);
    return true;
  });
});

for (const [name, json] of [
  ['malformed', async () => { throw new Error('PRIVATE_FIXTURE_CANARY'); }],
  ['null', async () => null], ['array', async () => []], ['primitive', async () => 'wrong'],
]) {
  test('handoff refuses ' + name + ' successful JSON without exposing content', async () => {
    const request = createHandoffRequest(origin, {fetch: async () => ({status: () => 200, json})});
    await assert.rejects(request('GET', recoveryPath), error => {
      assert.match(error.message, /HTTP 200.*expected a JSON object/);
      assert.doesNotMatch(error.message, /PRIVATE_FIXTURE_CANARY/);
      return true;
    });
  });
}

test('handoff returns the original object for a valid HTTP 200', async () => {
  const payload = {id: 'fixture', current: true};
  const request = createHandoffRequest(origin, {fetch: async () => ({status: () => 200, json: async () => payload})});
  assert.equal(await request('GET', recoveryPath), payload);
});
