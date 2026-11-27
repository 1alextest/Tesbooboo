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
const commonOptions = ['api-origin', 'repo', 'branch', 'revision', 'harness', 'investigation', 'case'];
const options = Object.fromEntries(['task-url', 'retest-url', ...commonOptions].map(key => [key, { type: 'string' }]));
const usage = 'node scripts/qa-approved-handoff.mjs (--task-url URL | --retest-url URL) --api-origin ORIGIN --repo DIR --branch BRANCH --revision FULL_SHA --harness DIR --investigation ID --case TC-01';

function git(root, args) {
  return execFileSync('git', ['--no-replace-objects', '-c', 'core.fsmonitor=false', '-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/^(GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE|GIT_COMMON_DIR|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES)$/.test(key))), GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

export function parseSelection(argv) {
  const { values } = parseArgs({ args: argv, options });
  for (const key of commonOptions) if (!values[key]?.trim()) throw new Error(usage);
  if (Boolean(values['task-url']?.trim()) === Boolean(values['retest-url']?.trim())) throw new Error(usage);
  const retest = Boolean(values['retest-url']?.trim());
  const task = new URL(retest ? values['retest-url'] : values['task-url']);
  const api = new URL(values['api-origin']);
  for (const url of [task, api]) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.hash || url.search) {
      throw new Error('Use a Tesbo HTTPS address or an explicitly selected loopback test installation.');
    }
  }
  const match = retest
    ? task.pathname.match(/^\/projects\/([^/]+)\/cycles\/([^/]+)\/execute\/([^/]+)\/?$/)
    : task.pathname.match(/^\/projects\/([^/]+)\/agents\/tasks\/([^/]+)\/?$/);
  if (api.pathname !== '/' || !match || !match.slice(1).every(id => uuid.test(id)) || !sha.test(values.revision)) {
    throw new Error(retest
      ? 'Use the full native execution URL with project, Run and execution UUIDs, the API origin and a 40-character Git commit.'
      : 'Use the full native task URL with both UUIDs, the API origin and a 40-character Git commit.');
  }
  return { ...(retest ? { retestUrl: task.href, sourceCycleId: match[2].toLowerCase(), sourceExecutionId: match[3].toLowerCase() }
    : { taskUrl: task.href, taskId: match[2] }), apiOrigin: api.origin, projectId: retest ? match[1].toLowerCase() : match[1],
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


// This is preparation for one future reviewed retest, not authorization to
// execute or a request to convert a manual Run into an automation Run.
export async function prepareNativeRetestAutomation(selection, {request, confirm, checkTarget = verifyTarget, readMapping = readInvestigationMapping}) {
  const { projectId, sourceCycleId, sourceExecutionId } = selection;
  const hex = /^[a-f0-9]{64}$/;
  if (![projectId, sourceCycleId, sourceExecutionId].every(value => typeof value === 'string' && uuid.test(value))) {
    throw new Error('Select the exact native project, source Run and source execution.');
  }
  const previewPath = '/api/cycles/' + sourceCycleId + '/retests/preview?executionIds=' + sourceExecutionId;
  const read = async () => {
    const preview = await request('GET', previewPath);
    if (!preview || typeof preview !== 'object' || Array.isArray(preview) ||
        preview.projectId !== projectId || preview.sourceCycleId !== sourceCycleId ||
        preview.sourceRun?.id !== sourceCycleId || typeof preview.previewDigest !== 'string' || !hex.test(preview.previewDigest) ||
        !Array.isArray(preview.occurrences) || preview.occurrences.length !== 1) {
      throw new Error('The native retest preview did not identify exactly the selected source observation.');
    }
    const occurrence = preview.occurrences[0];
    const current = occurrence?.currentCase;
    const definition = current?.reviewedContent?.case;
    if (!occurrence || occurrence.sourceExecutionId !== sourceExecutionId ||
        !uuid.test(occurrence.sourceCycleItemId ?? '') || !uuid.test(occurrence.testcaseId ?? '') ||
        occurrence.sourceResult?.id !== sourceExecutionId || occurrence.sourceResult.status !== 'Failed' ||
        preview.sourceRun.status !== 'Completed' || occurrence.eligible !== true || current?.approvalCurrent !== true ||
        current.status !== 'Approved' || current.id !== occurrence.testcaseId ||
        typeof current.approvalRevision !== 'string' || !hex.test(current.approvalRevision) || !definition ||
        typeof definition !== 'object' || Array.isArray(definition) || definition.id !== current.id ||
        definition.project_id !== projectId || typeof current.externalId !== 'string' || !current.externalId ||
        definition.external_id !== current.externalId) {
      throw new Error('This preparation requires one failed observation in a completed Run and its current exactly approved native case.');
    }
    // References only; never copy the original attachment bytes or raw runner error into the plan.
    if (!Array.isArray(occurrence.sourceEvidence) || !occurrence.sourceEvidence.every(item => uuid.test(item?.id ?? '')) ||
        !Array.isArray(occurrence.sourceBugLinks) || !occurrence.sourceBugLinks.every(item =>
          uuid.test(item?.id ?? '') && uuid.test(item.bugId ?? '') && item.executionId === sourceExecutionId)) {
      throw new Error('The selected source evidence or Bug associations could not be verified.');
    }
    const testcase = {
      id: current.id, externalId: current.externalId, title: current.title,
      automationRepo: definition.automation_repo, automationPath: definition.automation_path,
      automationFramework: definition.automation_framework, automationTestName: definition.automation_test_name ?? null,
      steps: definition.steps ?? null, preconditions: definition.preconditions ?? null,
      expectedResult: definition.expected_result ?? null, postconditions: definition.postconditions ?? null,
      testData: definition.test_data ?? null,
    };
    if (typeof testcase.automationFramework !== 'string' || typeof testcase.automationPath !== 'string' ||
        typeof testcase.automationRepo !== 'string' || !/\.(spec|test)\.(?:[cm]?[jt]sx?)$/.test(testcase.automationPath)) {
      throw new Error('The current reviewed case needs an existing Playwright automation target.');
    }
    // The operator needs both saved definitions, not just a mutable title or an
    // assertion that they were reviewed. Keep the full comparison local to this
    // interaction; do not export the source definition or raw observation bytes.
    if (!occurrence.sourceDefinition || typeof occurrence.sourceDefinition !== 'object' ||
        Array.isArray(occurrence.sourceDefinition) ||
        !['reviewed_snapshot', 'legacy_snapshot_unknown_approval'].includes(occurrence.sourceDefinitionBasis) ||
        typeof occurrence.definitionChanged !== 'boolean') {
      throw new Error('The saved source definition and its review basis could not be established.');
    }
    return { preview, comparison: {
      sourceRun: preview.sourceRun,
      sourceDefinitionBasis: occurrence.sourceDefinitionBasis,
      sourceDefinition: occurrence.sourceDefinition,
      currentReviewedDefinition: current.reviewedContent,
      sourceEvidenceIds: occurrence.sourceEvidence.map(item => item.id),
      sourceBugLinks: occurrence.sourceBugLinks.map(item => ({ id: item.id, bugId: item.bugId, executionId: item.executionId })),
      sourceObservation: { status: occurrence.sourceResult.status, reportedBy: occurrence.sourceResult.reported_by ?? null,
        executedAt: occurrence.sourceResult.executed_at ?? null }
    }, native: {
      projectId, sourceCycleId, sourceCycleItemId: occurrence.sourceCycleItemId, sourceExecutionId,
      sourceStatus: 'Failed', sourcePreviewDigest: preview.previewDigest,
      sourceApprovalRevision: occurrence.sourceApprovalRevision ?? null,
      targetApprovalRevision: current.approvalRevision, definitionChanged: occurrence.definitionChanged === true,
      sourceEvidenceIds: occurrence.sourceEvidence.map(item => item.id),
      sourceBugLinks: occurrence.sourceBugLinks.map(item => ({ id: item.id, bugId: item.bugId, executionId: item.executionId })),
      testcase
    } };
  };
  const initial = await read();
  const target = checkTarget(selection, initial.native.testcase);
  const mapping = await readMapping({ ...selection, targetPath: target.path });
  if (target.repository !== initial.native.testcase.automationRepo ||
      target.path !== initial.native.testcase.automationPath || target.revision !== selection.repoRevision ||
      target.branch !== selection.branch || mapping.targetPath !== target.path ||
      mapping.upstreamCase !== selection.upstreamCase || mapping.repoRevision !== target.revision ||
      typeof mapping.targetBlob !== 'string' || !sha.test(mapping.targetBlob) ||
      !Array.isArray(mapping.risks) || mapping.risks.length !== 1 ||
      mapping.risks[0]?.observableFromBrowser !== 'yes' ||
      typeof mapping.risks[0]?.oracle !== 'string' || !mapping.risks[0].oracle.trim()) {
    throw new Error('The investigation does not identify one reviewed risk at the selected committed target.');
  }
  const packet = {
    schemaVersion: 1, purpose: 'prepare_native_retest_automation', executionAuthorized: false,
    native: initial.native, target, investigation: { id: selection.investigationId, ...mapping }
  };
  const digest = createHash('sha256').update(JSON.stringify(packet)).digest('hex');
  if (!await confirm(packet, digest, initial.comparison)) throw new Error('Handoff cancelled.');
  if (!isDeepStrictEqual(checkTarget(selection, initial.native.testcase), target) ||
      !isDeepStrictEqual((await read()).preview, initial.preview)) {
    throw new Error('The selected source observation, case or target changed during review. Start again.');
  }
  return { ...packet, selectionDigest: digest };
}

export function createHandoffRequest(apiOrigin, requestContext, kind = 'requirement') {
  return async (method, path, data) => {
    let response;
    try {
      response = await requestContext.fetch(apiOrigin + path, { method, data, maxRedirects: 0, timeout: 20_000 });
    } catch {
      throw new Error('Could not verify the handoff request. Check the connection and Tesbo service availability, then start a fresh handoff.');
    }
    const status = response.status();
    if (status !== 200) {
      const recovery = {
        400: kind === 'retest' ? 'Check the source Run and execution selection, then start a fresh retest preparation.' : 'Check the selected task and revision arguments, then start a fresh handoff.',
        401: 'Sign in to Tesbo in the handoff browser, then start a fresh handoff.',
        403: 'Verify that your signed-in account is authorized for the selected project and operation.',
        404: kind === 'retest' ? 'Check the original execution link, API origin and your project access.' : 'Check the task link, API origin and your access to the selected project.',
        409: kind === 'retest' ? 'Reload the source observation and current case approval before preparing a new retest.' : 'Reopen the selected bundle and verify the current requirement, case approvals and active link before starting again.',
        429: 'Retry only after the service allows another request; start a fresh handoff.',
      }[status] ?? (status >= 300 && status < 400
        ? 'An unexpected redirect was refused. Verify the API origin and sign-in session.'
        : status >= 500 && status < 600
          ? 'Tesbo could not verify the selection because of a service response error. Check service availability and retry with a fresh handoff.'
          : 'The response did not establish eligibility. Verify the API origin and contact support if it persists.');
      throw new Error('Handoff not verified (HTTP ' + status + '). ' + recovery);
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Handoff not verified (HTTP 200): expected a JSON object. Check the API origin and service response.');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Handoff not verified (HTTP 200): expected a JSON object. Check the API origin and service response.');
    }
    return payload;
  };
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
    await page.goto(selection.retestUrl ?? selection.taskUrl, { waitUntil: 'domcontentloaded' });
    await terminal.question(selection.retestUrl ? 'Sign in to your Tesbo source execution in the browser, then press Enter here.\n' : 'Sign in to your Tesbo task in the browser, then press Enter here.\n');
    const request = createHandoffRequest(selection.apiOrigin, context.request, selection.retestUrl ? 'retest' : 'requirement');
    const confirm = async (packet, digest, comparison) => {
      // Quote all operator-visible strings. Strip directional controls that could disguise selected text.
      // The comparison is for the interactive reviewer only, not the exported packet.
      const preview = JSON.stringify(comparison ? { preparation: packet, reviewComparison: comparison } : packet, null, 2).replace(/[\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, ch =>
        '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
      process.stderr.write(preview + '\n');
      const prompt = selection.retestUrl
        ? 'Compare the original failed observation, current approved definition, committed target and investigation oracle. This prepares a selection only and does not authorize execution. Enter '
        : 'Compare the approved criteria and the investigation oracle. To prepare this exact handoff, enter ';
      return (await terminal.question(prompt + digest.slice(0, 8) + ' (Enter cancels): ')).trim() === digest.slice(0, 8);
    };
    const packet = selection.retestUrl
      ? await prepareNativeRetestAutomation(selection, { request, confirm })
      : await prepareHandoff(selection, { request, confirm });
    process.stdout.write(JSON.stringify(packet, null, 2) + '\n');
  } finally {
    terminal.close();
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
