// Human-invoked bridge to a consuming project's generator. Run this from a trusted Tesbo checkout.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstatSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { readInvestigationMapping } from './qa-investigation-mapping.mjs';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sha = /^[0-9a-f]{40}$/;
const options = Object.fromEntries(['task-url', 'api-origin', 'repo', 'branch', 'revision', 'harness', 'investigation', 'case'].map(key => [key, { type: 'string' }]));
const usage = 'node scripts/qa-approved-handoff.mjs --task-url URL --api-origin ORIGIN --repo DIR --branch BRANCH --revision FULL_SHA --harness DIR --investigation ID --case TC-01';

function git(root, args) {
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE|GIT_COMMON_DIR|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES)$/.test(key))), GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

export function parseSelection(argv) {
  const { values } = parseArgs({ args: argv, options });
  for (const key of Object.keys(options)) if (!values[key]?.trim()) throw new Error(usage);
  const task = new URL(values['task-url']);
  const api = new URL(values['api-origin']);
  for (const url of [task, api]) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.hash || url.search) {
      throw new Error('Use a Tesbo HTTPS address or an explicitly selected loopback test installation.');
    }
  }
  const match = task.pathname.match(/^\/projects\/([^/]+)\/agents\/tasks\/([^/]+)\/?$/);
  if (api.pathname !== '/' || !match || !match.slice(1).every(id => uuid.test(id)) || !sha.test(values.revision)) {
    throw new Error('Use the full native task URL with both UUIDs, the API origin and a 40-character Git commit.');
  }
  return { taskUrl: task.href, apiOrigin: api.origin, projectId: match[1], taskId: match[2],
    repoRoot: resolve(values.repo), harnessRoot: resolve(values.harness), branch: values.branch,
    repoRevision: values.revision, investigationId: values.investigation, upstreamCase: values.case.toUpperCase() };
}

// The remote is derived from the approved native case. A local origin label cannot attest a branch.
export function verifyTarget({repoRoot, branch, repoRevision}, testcase) {
  if (testcase.automationFramework?.trim().toLowerCase() !== 'playwright') {
    throw new Error('The selected native case must name Playwright as its automation framework.');
  }
  const repo = testcase.automationRepo;
  if (typeof repo !== 'string' || !/^[a-z\d_-][a-z\d_.-]*\/[a-z\d_-][a-z\d_.-]*$/i.test(repo) ||
      !testcase.automationPath || typeof testcase.automationPath !== 'string' ||
      testcase.automationPath.startsWith('/') || testcase.automationPath.split('/').some(part => !part || part === '.' || part === '..') ||
      /[\\:\x00-\x1f]/u.test(testcase.automationPath)) throw new Error('The reviewed case needs a GitHub owner/repository and a relative automation path.');
  if (!sha.test(repoRevision) || typeof branch !== 'string' || branch.startsWith('-')) throw new Error('Invalid target branch or commit.');
  const ref = 'refs/heads/' + branch;
  try {
    git(repoRoot, ['check-ref-format', ref]);
    if (git(repoRoot, ['rev-parse', 'HEAD']) !== repoRevision) throw new Error();
    const remote = git(tmpdir(), ['ls-remote', '--exit-code', '--refs', 'https://github.com/' + repo + '.git', ref]);
    if (remote !== repoRevision + '\t' + ref) throw new Error();
    if (git(repoRoot, ['rev-parse', '--show-prefix'])) throw new Error();
    // The matrix reads committed Git objects. Also refuse to hand a generator a locally edited target.
    const file = resolve(realpathSync(repoRoot), testcase.automationPath);
    if (!lstatSync(file).isFile() || realpathSync(file) !== file) throw new Error();
    const object = git(repoRoot, ['rev-parse', '--verify', repoRevision + ':' + testcase.automationPath]);
    if (git(repoRoot, ['hash-object', '--no-filters', '--', file]) !== object) throw new Error();
  } catch {
    throw new Error('Could not verify the selected checkout, published branch head and unchanged target file. Refresh the selection.');
  }
  return { repository: repo, branch, revision: repoRevision, path: testcase.automationPath };
}

async function selectBasis(request, base, taskId) {
  const task = await request('GET', base + '/requirements/proposals/' + taskId);
  const receipt = task.requirementApplyReceipt;
  if (task.id !== taskId || !receipt?.id || !receipt.proposalRevision || !Number.isInteger(receipt.selectedIndex) ||
      !uuid.test(receipt.requirement?.documentId) || !uuid.test(receipt.testcase?.id) || !receipt.link?.criterionKeys?.length) {
    throw new Error('This task needs an applied requirement bundle containing one reviewed case and its linked criteria.');
  }
  const requirementId = receipt.requirement.documentId;
  const coverage = await request('GET', base + '/requirements/' + requirementId + '/coverage');
  const matches = (coverage.cases || []).filter(row => row.approved === true && row.testcaseId === receipt.testcase.id &&
    row.requirementVersionId === coverage.approvedVersionId && isDeepStrictEqual(row.criterionKeys, receipt.link.criterionKeys));
  if (coverage.requirementId !== requirementId || matches.length !== 1) {
    throw new Error('Expected exactly one current approved link for this case and its reviewed criteria.');
  }
  const { linkId, testcaseId, requirementVersionId, testcaseRevision, testcaseApprovalRevision, criterionKeys } = matches[0];
  return { receiptId: receipt.id, proposalRevision: receipt.proposalRevision, selectedIndex: receipt.selectedIndex,
    requirementId, requirementVersionId, linkId, testcaseId, testcaseRevision, testcaseApprovalRevision, criterionKeys };
}

export async function prepareHandoff(selection, {request, confirm, checkTarget = verifyTarget, readMapping = readInvestigationMapping}) {
  const { projectId, taskId } = selection;
  const base = '/api/projects/' + projectId;
  const basis = await selectBasis(request, base, taskId);
  const path = base + '/requirements/proposals/' + taskId + '/automation-handoff';
  const readNative = async () => {
    const native = await request('POST', path, basis);
    const expected = {projectId, taskId, ...basis};
    if (!Object.entries(expected).every(([key, value]) => isDeepStrictEqual(native[key], value)) ||
        native.testcase?.id !== basis.testcaseId || !native.provenance?.reviewerId) {
      throw new Error('The native receipt does not identify the exact selected case and reviewer.');
    }
    return native;
  };
  const native = await readNative();
  const target = checkTarget(selection, native.testcase);
  const mapping = await readMapping({ ...selection, targetPath: target.path });
  if (mapping.targetPath !== target.path || mapping.upstreamCase !== selection.upstreamCase || !mapping.risks?.length) {
    throw new Error('The investigation does not cover the selected case and target.');
  }
  const packet = { schemaVersion: 1, purpose: 'prepare_automation_change', native, target,
    investigation: {id: selection.investigationId, ...mapping} };
  const digest = createHash('sha256').update(JSON.stringify(packet)).digest('hex');
  if (!await confirm(packet, digest)) throw new Error('Handoff cancelled.');
  checkTarget(selection, native.testcase);
  // The investigation was read from immutable blobs. Recheck mutable native authority after review.
  if (!isDeepStrictEqual(await readNative(), native)) throw new Error('The approved case changed during review. Start again.');
  return { ...packet, selectionDigest: digest };
}

async function main(argv) {
  if (argv.includes('--help')) { console.log(usage); return; }
  const selection = parseSelection(argv);
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal to sign in and confirm the selected plan.');
  const { chromium } = createRequire(new URL('../e2e/package.json', import.meta.url))('@playwright/test');
  const browser = await chromium.launch({ headless: false });
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(selection.taskUrl, { waitUntil: 'domcontentloaded' });
    await terminal.question('Sign in to your Tesbo task in the browser, then press Enter here.\n');
    const request = async (method, path, data) => {
      const response = await context.request.fetch(selection.apiOrigin + path, { method, data, maxRedirects: 0, timeout: 20_000 });
      if (response.status() !== 200) throw new Error('Tesbo refused or could not verify the handoff (HTTP ' + response.status() + '). Reopen the task and check its approvals.');
      return response.json();
    };
    const confirm = async (packet, digest) => {
      // Quote all operator-visible strings. Strip directional controls that could disguise selected text.
      const preview = JSON.stringify(packet, null, 2).replace(/[\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, ch =>
        '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
      process.stderr.write(preview + '\n');
      return (await terminal.question('Compare the approved criteria and the investigation oracle. To prepare this exact handoff, enter ' +
        digest.slice(0, 8) + ' (Enter cancels): ')).trim() === digest.slice(0, 8);
    };
    const packet = await prepareHandoff(selection, { request, confirm });
    process.stdout.write(JSON.stringify(packet, null, 2) + '\n');
  } finally {
    terminal.close();
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
