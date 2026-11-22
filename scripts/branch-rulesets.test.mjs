import {test} from 'node:test';
import assert from 'node:assert/strict';
import {REPO,CHECKS,WORKFLOW_SOURCES,exact,check,patch,run} from './branch-rulesets.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
function f(b='development'){return {id:42,name:'Protect '+b,source:REPO,target:'branch',enforcement:'active',bypass_actors:[],conditions:{ref_name:{include:['refs/heads/'+b],exclude:[]}},rules:[{type:'deletion'},{type:'non_fast_forward'},{type:'pull_request',parameters:{required_approving_review_count:0,dismiss_stale_reviews_on_push:false,require_last_push_approval:false,required_review_thread_resolution:true}},{type:'required_status_checks',parameters:{strict_required_status_checks_policy:false,required_status_checks:[]}}]};}
test('observed missing live checks and review are caught',()=>{assert.ok(check(f(),'development').some(x=>x.includes('playwright-smoke')));assert.ok(check(f(),'development').some(x=>x.includes('review')));});
test('exact patch retains all rules, applies 24 stable CI jobs',()=>{const old=f();const updated={...old,...patch(old,'development')};assert.deepEqual(check(updated,'development'),[]);assert.equal(old.rules[2].parameters.required_approving_review_count,0);assert.equal(CHECKS.length,24);});
test('assurance phase requires another trusted job',()=>{const old=f(),foundation={...old,...patch(old,'development')};assert.ok(check(foundation,'development','assurance').some(x=>x.includes('specification-assurance')));assert.deepEqual(check({...foundation,...patch(foundation,'development','assurance')},'development','assurance'),[]);});
test('cannot bypass by wildcard branch, evaluation mode or admin actor',()=>{for(const change of [{enforcement:'evaluate'},{bypass_actors:[{actor_type:'OrganizationAdmin'}]},{conditions:{ref_name:{include:['refs/heads/*'],exclude:[]}}}]){const bad={...f(),...change};assert.equal(exact(bad,'development'),false);assert.throws(()=>patch(bad,'development'));}});
test('does not erase additional status checks; strict and review regressions fail',()=>{const base=f();base.rules[3].parameters.required_status_checks=[{context:'additional'}];const result={...base,...patch(base,'development')};assert.ok(result.rules[3].parameters.required_status_checks.some(x=>x.context==='additional'));result.rules[2].parameters.dismiss_stale_reviews_on_push=false;assert.ok(check(result,'development').length>0);});

// Exercise the public command with a closed GitHub HTTP fixture. Every request, including
// mutations, stays in this fixture; a missing route throws instead of reaching the network.
const workflowFiles = [
  'ci-hygiene.yml', 'core-quality.yml', 'behavioral-quality.yml',
  'smoke-security-quality.yml', 'security-analysis.yml', 'free-repository-security.yml',
  'repository-secret-guard.yml', 'mutation-quality.yml',
].map(name => '.github/workflows/' + name);
const publisherFiles = [
  '.github/workflows/assurance-pr-gate.yml', '.github/assurance-policy.json',
  'scripts/assurance-pr-gate.mjs', 'scripts/publish-assurance-status.mjs',
];
const blobHash = text => createHash('sha1')
  .update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const fileText = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('reviewed smoke pin includes BOTH tracing parity and WPA-01 KB denial selection', () => {
  const smoke = fileText('.github/workflows/smoke-security-quality.yml');
  const pin = WORKFLOW_SOURCES.find(source => source.path === '.github/workflows/smoke-security-quality.yml');
  assert.ok(pin, 'Keep smoke in the required CI sources');
  assert.equal(blobHash(smoke), pin.sha, 'A changed source requires explicit reviewed pin reconciliation');
  assert.ok(smoke.includes('selection="WPA-01|KB-A-05|'), 'Keep WPA denial selected alongside original KB cases');
  assert.match(smoke, /Verify explicit tracing opt-in and installed SDK export boundaries/);
  assert.match(smoke, /Verify Zyra product behavior with tracing disabled, unset and enabled/);
});

function installedFiles() {
  return [...workflowFiles, ...publisherFiles].map(path => ({
    path, mode: '100644', type: 'blob', sha: blobHash(fileText(path)),
  }));
}
function githubFixture() {
  const state = {
    defaultBranch: 'main',
    refs: { development: 'a'.repeat(40), main: 'b'.repeat(40) },
    treeIds: { development: 'c'.repeat(40), main: 'd'.repeat(40) },
    entries: { development: installedFiles(), main: installedFiles() },
    rules: {
      development: { ...f('development'), id: 1 },
      main: { ...f('main'), id: 2, name: 'Protect main — release only' },
    },
    requests: [], puts: [], refReads: {}, ruleReads: {}, repoReads: 0, disabled: new Set(),
  };
  const reply = (value, status = 200) => ({
    ok: status >= 200 && status < 300, status, json: async () => structuredClone(value),
  });
  state.fetch = async (url, options = {}) => {
    const prefix = 'https://api.github.com/repos/' + REPO;
    assert.ok(url.startsWith(prefix), 'all fixture requests stay on the fixed repository');
    const parsed = new URL(url), path = parsed.pathname.slice(('/repos/' + REPO).length);
    const method = options.method || 'GET';
    state.requests.push({ path, method, query: parsed.search });
    if (!path && method === 'GET') {
      state.repoReads++;
      return state.repositoryUnavailable ? reply({}, 403)
        : reply({ full_name: REPO, default_branch: state.changeDefaultBranch && state.repoReads > 1
          ? 'another-default' : state.defaultBranch });
    }
    if (path === '/rulesets' && method === 'GET') {
      return reply(Object.values(state.rules).map(({ id, name, target }) => ({ id, name, target })));
    }
    if (/^\/rulesets\/[12]$/.test(path)) {
      const branch = path.endsWith('/1') ? 'development' : 'main';
      if (method === 'PUT') {
        state.puts.push({ branch, body: JSON.parse(options.body) });
        state.rules[branch] = { ...state.rules[branch], ...JSON.parse(options.body) };
      } else {
        const count = state.ruleReads[branch] = (state.ruleReads[branch] || 0) + 1;
        if (state.changeRule === branch && count > 1) state.rules[branch].name += ' changed';
      }
      return reply(state.rules[branch]);
    }
    if (path.startsWith('/git/ref/heads/')) {
      const branch = decodeURIComponent(path.slice('/git/ref/heads/'.length));
      const count = state.refReads[branch] = (state.refReads[branch] || 0) + 1;
      const sha = state.changeRef === branch && count > 1 ? 'e'.repeat(40) : state.refs[branch];
      return sha ? reply({ ref: 'refs/heads/' + branch, object: { type: 'commit', sha } }) : reply({}, 404);
    }
    if (path.startsWith('/git/commits/')) {
      const sha = path.slice('/git/commits/'.length);
      const branch = Object.keys(state.refs).find(name => state.refs[name] === sha);
      return branch ? reply({ sha, tree: { sha: state.treeIds[branch] } }) : reply({}, 404);
    }
    if (path.startsWith('/git/trees/')) {
      const sha = path.slice('/git/trees/'.length);
      const branch = Object.keys(state.treeIds).find(name => state.treeIds[name] === sha);
      return branch ? reply({
        sha, truncated: state.truncated === branch, tree: state.entries[branch],
      }) : reply({}, 404);
    }
    if (path.startsWith('/actions/workflows/')) {
      const file = decodeURIComponent(path.slice('/actions/workflows/'.length));
      const workflowPath = '.github/workflows/' + file;
      return workflowFiles.concat(publisherFiles[0]).includes(workflowPath)
        ? reply({ id: 123, path: workflowPath,
          state: state.disabled.has(workflowPath) ? 'disabled_manually' : 'active' })
        : reply({}, 404);
    }
    // The old implementation checks only this mutable development presence. Keep the response
    // valid so negative cases demonstrate its actual write-through defect before the repair.
    if (path === '/contents/.github/workflows/assurance-pr-gate.yml') {
      assert.equal(parsed.searchParams.get('ref'), 'development');
      return reply({ type: 'file', sha: blobHash(fileText(publisherFiles[0])) });
    }
    throw new Error('Unexpected fixture HTTP ' + method + ' ' + path);
  };
  return state;
}
async function command(state, args = ['--apply', '--assurance'], env = {}) {
  const savedFetch = globalThis.fetch, savedLog = console.log, savedExitCode = process.exitCode;
  const output = [];
  globalThis.fetch = state.fetch;
  console.log = line => output.push(line);
  let error;
  try {
    await run({
      GITHUB_REPOSITORY: REPO, GITHUB_RULESET_ADMIN_TOKEN: 'unit-test-admin-token',
      TESBO_RULESET_APPLY_CONFIRM: 'apply:' + REPO, ...env,
    }, args);
  } catch (failure) { error = failure; }
  finally {
    globalThis.fetch = savedFetch; console.log = savedLog; process.exitCode = savedExitCode;
  }
  return { error, output };
}
async function refused(state, pattern, args) {
  const result = await command(state, args);
  assert.equal(state.puts.length, 0, 'a failed preflight must not mutate either ruleset');
  assert.match(result.error?.message || '', pattern);
}

test('apply refuses a publisher present only on development before any ruleset write', async () => {
  const state = githubFixture();
  state.entries.main = state.entries.main.filter(entry => !publisherFiles.includes(entry.path));
  await refused(state, /publisher.*main|main.*publisher/i);
});
test('apply refuses bootstrap-only main even when its trusted publisher is installed', async () => {
  const state = githubFixture();
  state.entries.main = state.entries.main.filter(entry => publisherFiles.includes(entry.path));
  await refused(state, /main.*ci-hygiene|ci-hygiene.*main/i);
});
test('foundation also refuses missing target-branch CI before any write', async () => {
  const state = githubFixture();
  state.entries.main = [];
  await refused(state, /main.*ci-hygiene|ci-hygiene.*main/i, ['--apply']);
});
test('a missing publisher module cannot be mistaken for a complete installation', async () => {
  const state = githubFixture();
  state.entries.main = state.entries.main.filter(entry => entry.path !== 'scripts/assurance-pr-gate.mjs');
  await refused(state, /publisher.*assurance-pr-gate|assurance-pr-gate.*publisher/i);
});
test('a different installed policy requires review before assurance activation', async () => {
  const state = githubFixture();
  state.entries.main.find(entry => entry.path === '.github/assurance-policy.json').sha = 'f'.repeat(40);
  await refused(state, /publisher.*assurance-policy|assurance-policy.*publisher/i);
});
test('job rename or pull-request filter drift refuses the introduced required contexts', async () => {
  const path = '.github/workflows/ci-hygiene.yml';
  for (const changed of [
    fileText(path).replace('name: workflow-lint', 'name: renamed-workflow-lint'),
    fileText(path).replace('  pull_request:', '  pull_request:\n    paths: ["only-this-file"]'),
  ]) {
    const state = githubFixture();
    state.entries.development.find(entry => entry.path === path).sha = blobHash(changed);
    await refused(state, /development.*ci-hygiene|ci-hygiene.*development/i);
  }
});
test('a symlink is not an installed reviewed workflow', async () => {
  const state = githubFixture();
  state.entries.main.find(entry => entry.path === workflowFiles[0]).mode = '120000';
  await refused(state, /main.*ci-hygiene|ci-hygiene.*main/i);
});
test('incomplete or ambiguous immutable tree inventory refuses before writes', async () => {
  for (const kind of ['truncated', 'duplicate']) {
    const state = githubFixture();
    if (kind === 'truncated') state.truncated = 'main';
    else state.entries.main.push({ ...state.entries.main[0] });
    await refused(state, /tree|inventory|duplicate/i);
  }
});
test('disabled native workflow metadata refuses availability without inventing a producer identity', async () => {
  const state = githubFixture();
  state.disabled.add('.github/workflows/assurance-pr-gate.yml');
  await refused(state, /active|disabled|availability/i);
});
test('failure reading the repository default branch does not mutate protections', async () => {
  const state = githubFixture(); state.repositoryUnavailable = true;
  await refused(state, /403/);
});
test('invalid second-branch scope does not partially activate the first branch', async () => {
  const state = githubFixture(); state.rules.main.enforcement = 'evaluate';
  await refused(state, /Unsafe scope|unexpected|scope/i);
});
test('source ref movement during preflight refuses both writes', async () => {
  const state = githubFixture(); state.changeRef = 'main';
  await refused(state, /source|ref|changed/i);
});
test('repository default-branch movement refuses activation against the earlier publisher', async () => {
  const state = githubFixture(); state.changeDefaultBranch = true;
  await refused(state, /default branch changed/i);
});
test('ruleset movement during preflight refuses both writes', async () => {
  const state = githubFixture(); state.changeRule = 'main';
  await refused(state, /ruleset.*changed|changed.*ruleset/i);
});
test('a complete installed source supports both plans and preserves existing extra contexts', async () => {
  for (const args of [['--apply'], ['--apply', '--assurance']]) {
    const state = githubFixture();
    state.rules.main.rules[3].parameters.required_status_checks.push({ context: 'existing-external-check', integration_id: 99 });
    const result = await command(state, args);
    assert.equal(result.error, undefined);
    assert.equal(state.puts.length, 2);
    const added = state.puts.find(item => item.branch === 'main').body.rules[3].parameters.required_status_checks;
    assert.ok(added.some(item => item.context === 'existing-external-check' && item.integration_id === 99));
    assert.deepEqual(check(state.rules.main, 'main', args.includes('--assurance') ? 'assurance' : 'foundation'), []);
  }
});
test('trusted publisher follows the repository default branch, not a hard-coded or caller-selected branch', async () => {
  const state = githubFixture();
  state.defaultBranch = 'release/trusted';
  state.refs[state.defaultBranch] = '1'.repeat(40);
  state.treeIds[state.defaultBranch] = '2'.repeat(40);
  state.entries[state.defaultBranch] = installedFiles();
  state.entries.main = state.entries.main.filter(entry => !publisherFiles.includes(entry.path));
  const result = await command(state);
  assert.equal(result.error, undefined);
  assert.equal(state.puts.length, 2);
  assert.ok(state.requests.some(item => item.path.includes('/git/ref/heads/release')));
});
test('read-only audit remains usable before publisher or application CI installation', async () => {
  const state = githubFixture();
  state.repositoryUnavailable = true; state.entries.main = [];
  const result = await command(state, []);
  assert.equal(result.error, undefined);
  assert.equal(state.puts.length, 0);
  assert.ok(state.requests.every(item => item.path.startsWith('/rulesets')));
  assert.equal(JSON.parse(result.output[0]).mode, 'read-only');
});
test('explicit administration authorization remains required before preflight', async () => {
  const state = githubFixture();
  const result = await command(state, ['--apply'], { TESBO_RULESET_APPLY_CONFIRM: undefined });
  assert.match(result.error.message, /explicit confirmation/);
  assert.equal(state.requests.length, 0);
});
