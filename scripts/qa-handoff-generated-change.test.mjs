import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile, mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { generateCoverageSpec, SUPPORTED_ORACLE, validateHandoffPacket, writeGeneratedChange } from './qa-handoff-generated-change.mjs';

import { handoffReportResult, handoffFailureMatches } from './qa-handoff-fixture.mjs';

const execFileAsync = promisify(execFile);

const e2eDir = fileURLToPath(new URL('../e2e/', import.meta.url));
const playwrightCli = join(e2eDir, 'node_modules', '@playwright', 'test', 'cli.js');
const PROJECT = '00000000-0000-4000-8000-000000000001';
const TASK = '00000000-0000-4000-8000-000000000002';
const RECEIPT = '00000000-0000-4000-8000-000000000003';
const REQUIREMENT = '00000000-0000-4000-8000-000000000004';
const REQUIREMENT_VERSION = '00000000-0000-4000-8000-000000000005';
const LINK = '00000000-0000-4000-8000-000000000006';
const CASE = '00000000-0000-4000-8000-000000000007';
const REVISION = 'a'.repeat(64), APPROVAL = 'b'.repeat(64), PROPOSAL = 'c'.repeat(64);
const COMMIT = 'd'.repeat(40), BLOB = 'e'.repeat(40);

function packet() {
  const body = {
    schemaVersion: 1,
    purpose: 'prepare_automation_change',
    native: {
      projectId: PROJECT, taskId: TASK, receiptId: RECEIPT, proposalRevision: PROPOSAL, selectedIndex: 1,
      requirementId: REQUIREMENT, requirementVersionId: REQUIREMENT_VERSION, linkId: LINK,
      testcaseId: CASE, testcaseRevision: REVISION, testcaseApprovalRevision: APPROVAL, criterionKeys: ['AC-1', 'AC-2'],
      criteria: [{ key: 'AC-1', text: 'The requirement lists one linked case' },
        { key: 'AC-2', text: 'The reviewed case is linked to both criteria' }],
      testcase: {
        id: CASE, externalId: 'TES-JOURNEY-1', title: 'Approved journey case',
        steps: [{ stepNumber: 1, action: 'Apply the reviewed bundle', expectedResult: 'One case is linked' }],
        automationRepo: 'owner/repo', automationPath: 'tests/journey.spec.mjs',
        automationFramework: 'Playwright', automationTestName: 'approved journey'
      },
    },
    target: { repository: 'owner/repo', branch: 'main', revision: COMMIT, path: 'tests/journey.spec.mjs' },
    investigation: {
      id: 'CASE-300', upstreamCase: 'TC-01', targetPath: 'tests/journey.spec.mjs', targetBlob: BLOB,
      repoRevision: COMMIT, harnessRevision: 'a468921c2bead820520a97df897168487b2b4985',
      risks: [{ id: 'R1', oracle: SUPPORTED_ORACLE }],
    },
  };
  return { ...body, selectionDigest: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}

function reseal(packet) {
  const body = structuredClone(packet);
  delete body.selectionDigest;
  return { ...body, selectionDigest: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}

function coverage(cases) {
  return JSON.stringify({ requirementId: REQUIREMENT, approvedVersionId: REQUIREMENT_VERSION, cases });
}

const caseObject = {
  linkId: LINK, testcaseId: CASE, requirementVersionId: REQUIREMENT_VERSION, criterionKeys: ['AC-1', 'AC-2'],
  testcaseRevision: REVISION, testcaseApprovalRevision: APPROVAL, approved: true,
};

async function runSpec(directory, coveragePath) {
  const report = join(directory, 'report.json');
  // Each invocation must produce its own report, not reuse an earlier result.
  await rm(report, { force: true });
  try {
    const output = await execFileAsync(process.execPath, [playwrightCli, 'test', 'tests/journey.spec.mjs', '--config=playwright.config.mjs'], {
      cwd: directory, timeout: 60_000,
      env: {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
          !/^(?:https?_proxy|all_proxy)$/i.test(key))),
        NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost',
        TESBO_JOURNEY_COVERAGE_URL: coveragePath, TESBO_JOURNEY_API_ORIGIN: new URL(coveragePath).origin,
        TESBO_JOURNEY_TOKEN: 'test-token', TESBO_JOURNEY_EVIDENCE_PATH: join(directory, 'evidence.json')
      },
    });
    return { ok: true, report: JSON.parse(await readFile(report, 'utf8')), output: output.stdout + output.stderr };
  } catch (error) {
    return { ok: false, report: JSON.parse(await readFile(report, 'utf8')),
      output: String(error.stdout ?? '') + String(error.stderr ?? '') };
  }
}

const uniquenessLabel = 'exactly one current approved link for the selected case and criteria';
const lengths = (received) => ['Expected length: 1', 'Received length: ' + received];
const comparison = (expected, received) => ['Expected: ' + JSON.stringify(expected), 'Received: ' + JSON.stringify(received)];

test('handoff failure evidence rejects metadata, source snippets, wrong cardinality and runner failures', () => {
  const exact = 'Error: ' + uniquenessLabel + '\nExpected length: 1\nReceived length: 2';
  const report = (message, overrides = {}) => ({
    config: { metadata: { gitDiff: uniquenessLabel } },
    errors: [], stats: { expected: 0, unexpected: 1 },
    suites: [{ suites: [{ specs: [{ tests: [{ results: [{ status: 'failed', errors: [{ message }] }] }] }] }] }],
    ...overrides,
  });
  assert.equal(handoffFailureMatches(report(exact), uniquenessLabel, lengths(2)), true);
  assert.equal(handoffFailureMatches(report('Error: request timeout'), uniquenessLabel, lengths(2)), false);
  assert.equal(handoffFailureMatches(report('Error: unrelated setup\n> expect(matching, "' + uniquenessLabel + '").toHaveLength(1);\nExpected length: 1\nReceived length: 2'), uniquenessLabel, lengths(2)), false);
  assert.equal(handoffFailureMatches(report(exact.replace('Received length: 2', 'Received length: 3')), uniquenessLabel, lengths(2)), false);
  assert.equal(handoffFailureMatches(report(exact, { errors: [{ message: 'global error' }] }), uniquenessLabel, lengths(2)), false);
  assert.equal(handoffFailureMatches(report(exact, { suites: [] }), uniquenessLabel, lengths(2)), false);
  assert.equal(handoffFailureMatches(report(exact, { suites: [...report(exact).suites, ...report(exact).suites] }), uniquenessLabel, lengths(2)), false);
  assert.equal(handoffFailureMatches(report(exact, { suites: [{ specs: [{ tests: [{ results: [{ status: 'timedOut', errors: [{ message: exact }] }] }] }] }] }), uniquenessLabel, lengths(2)), false);
  assert.equal(handoffFailureMatches(report('\x1b[31m' + exact + '\x1b[0m'), uniquenessLabel, lengths(2)), true);
});

test('generated Playwright change is packet-bound and catches the duplicated-link fault', async () => {
  const p = packet();
  assert.doesNotThrow(() => validateHandoffPacket(p));
  assert.throws(() => validateHandoffPacket({ ...p, selectionDigest: '0'.repeat(64) }), /selection digest/);
  const noExternal = structuredClone(p);
  delete noExternal.selectionDigest;
  noExternal.native.testcase.externalId = '';
  assert.throws(() => validateHandoffPacket(reseal(noExternal)), /external id/);
  const wrongTarget = structuredClone(p);
  delete wrongTarget.selectionDigest;
  wrongTarget.target.repository = 'other/repo';
  assert.throws(() => validateHandoffPacket(reseal(wrongTarget)), /Git target/);
  const wrongOracle = structuredClone(p);
  delete wrongOracle.selectionDigest;
  wrongOracle.investigation.risks[0].oracle = 'Some ungenerated oracle';
  assert.throws(() => validateHandoffPacket(reseal(wrongOracle)), /only supports/);
  const wrongRevision = structuredClone(p);
  delete wrongRevision.selectionDigest;
  wrongRevision.investigation.repoRevision = 'f'.repeat(40);
  assert.throws(() => validateHandoffPacket(reseal(wrongRevision)), /investigation/);
  const escapedId = structuredClone(p);
  delete escapedId.selectionDigest;
  escapedId.native.testcase.externalId = 'TES\\JOURNEY';
  assert.throws(() => validateHandoffPacket(reseal(escapedId)), /external id/);
  const spec = generateCoverageSpec(p);
  assert.ok(spec.includes(String.raw`@tesbo.testId(\"TES-JOURNEY-1\")`), 'the generated test must carry the approved external id');
  assert.match(spec, /exactly one current approved link/u);
  assert.match(spec, /testcaseApprovalRevision/u);
  assert.match(spec, /approved-handoff-evidence\.json/u);

  const privateCanary = randomUUID();
  let coverageReads = 0;
  const server = createServer((req, res) => {
    coverageReads++;
    if (req.url === '/private-error') {
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end(privateCanary);
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    if (req.url === '/faulty') res.end(coverage([caseObject, { ...caseObject }]));
    else if (req.url === '/different-link-id') res.end(coverage([caseObject, { ...caseObject, linkId: '00000000-0000-4000-8000-000000000009' }]));
    else if (req.url === '/reversed-only') res.end(coverage([{ ...caseObject, criterionKeys: ['AC-2', 'AC-1'] }]));
    else if (req.url === '/reversed-neighbor') res.end(coverage([caseObject, { ...caseObject,
      linkId: '00000000-0000-4000-8000-000000000009', criterionKeys: ['AC-2', 'AC-1'] }]));
    else if (req.url === '/wrong-link-id') res.end(coverage([{ ...caseObject, linkId: '00000000-0000-4000-8000-000000000009' }]));
    else if (req.url === '/other-case') res.end(coverage([caseObject, { ...caseObject, testcaseId: '00000000-0000-4000-8000-000000000008' }]));
    else if (req.url === '/different-criteria') res.end(coverage([caseObject, { ...caseObject, criterionKeys: ['AC-2'] }]));
    else if (req.url === '/wrong-edit-revision') res.end(coverage([{ ...caseObject, testcaseRevision: 'f'.repeat(64) }]));
    else if (req.url === '/wrong-revision') res.end(coverage([{ ...caseObject, testcaseApprovalRevision: 'f'.repeat(64) }]));
    else if (req.url === '/wrong-requirement') res.end(JSON.stringify({ requirementId: '00000000-0000-4000-8000-000000000009', approvedVersionId: REQUIREMENT_VERSION, cases: [caseObject] }));
    else if (req.url === '/wrong-approved-version') res.end(JSON.stringify({ requirementId: REQUIREMENT, approvedVersionId: '00000000-0000-4000-8000-000000000009', cases: [caseObject] }));
    else res.end(coverage([caseObject]));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const directory = await mkdtemp(join(e2eDir, '.journey-'));
  try {
    const generated = writeGeneratedChange(p, directory);
    await mkdir(dirname(generated.path), { recursive: true });
    await writeFile(generated.path, generated.content);
    const identity = { selectionDigest: p.selectionDigest, target: p.target };
    const evidencePath = join(directory, 'evidence.json');
    await writeFile(evidencePath, JSON.stringify(identity));
    await writeFile(join(directory, 'playwright.config.mjs'), `import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', workers: 1, retries: 0, reporter: [['list'], ['json', { outputFile: 'report.json' }]] });
`);
    const expectedBytes = Buffer.from(JSON.stringify(identity));
    const attachmentsOf = result => (result?.attachments ?? []).filter(item => item.name === 'approved-handoff-evidence.json');
    const verifyIdentityAttachment = async (report, status) => {
      const result = handoffReportResult(report, status);
      assert.ok(result, 'one actual child result with the expected status is required');
      const attachments = attachmentsOf(result);
      assert.equal(attachments.length, 1, 'exactly one packet identity attachment on the actual result');
      assert.equal(attachments[0].contentType, 'application/json');
      assert.ok(typeof attachments[0].path === 'string' && attachments[0].path.length > 0);
      assert.equal((await readFile(resolve(directory, attachments[0].path))).equals(expectedBytes), true,
        'the attachment must contain only the canonical identity bytes');
    };
    const good = await runSpec(directory, `http://127.0.0.1:${port}/good`);
    assert.equal(good.ok, true, 'correct coverage must pass');
    await verifyIdentityAttachment(good.report, 'passed');
    const different = '00000000-0000-4000-8000-000000000009';
    const failureCases = [
      ['faulty', uniquenessLabel, lengths(2)],
      ['different-link-id', uniquenessLabel, lengths(2)],
      ['wrong-link-id', 'The sole approved link must match the selected native link', comparison(LINK, different)],
      ['wrong-requirement', 'Coverage must be for the reviewed requirement', comparison(REQUIREMENT, different)],
      ['wrong-approved-version', 'Coverage must be for the reviewed approved version', comparison(REQUIREMENT_VERSION, different)],
      ['wrong-edit-revision', 'The selected case edit revision must match', comparison(REVISION, 'f'.repeat(64))],
      ['wrong-revision', 'The selected case approval revision must match', comparison(APPROVAL, 'f'.repeat(64))],
      ['reversed-only', uniquenessLabel, lengths(0)],
      ['private-error', 'Coverage read HTTP status (body deliberately withheld)', comparison(200, 503)],
    ];
    for (const [scenario, label, details] of failureCases) {
      const candidate = await runSpec(directory, `http://127.0.0.1:${port}/${scenario}`);
      assert.equal(candidate.ok, false, `${scenario} must fail its observed oracle`);
      assert.equal(handoffFailureMatches(candidate.report, label, details), true,
        `${scenario} must fail at the intended assertion with its expected and received values`);
      await verifyIdentityAttachment(candidate.report, 'failed');
      // A runtime marker cannot be present in Git-diff metadata. Check the
      // entire actual report and captured child output without printing either.
      assert.equal(JSON.stringify(candidate.report).includes(privateCanary), false,
        'a rejected coverage API body must not appear in the report');
      assert.equal(candidate.output.includes(privateCanary), false,
        'a rejected coverage API body must not appear in child output');
    }
    for (const scenario of ['other-case', 'different-criteria', 'reversed-neighbor']) {
      const candidate = await runSpec(directory, `http://127.0.0.1:${port}/${scenario}`);
      assert.equal(candidate.ok, true, `${scenario} is a legitimate unrelated link and must not be blocked`);
      await verifyIdentityAttachment(candidate.report, 'passed');
    }

    // Reject an unreviewed extra evidence field before any coverage read or
    // packet attachment. A rejected input must not become an assertion diagnostic.
    const readsBefore = coverageReads;
    await writeFile(evidencePath, JSON.stringify({ ...identity, unreviewed: privateCanary }));
    const unbounded = await runSpec(directory, `http://127.0.0.1:${port}/good`);
    assert.equal(unbounded.ok, false);
    assert.equal(coverageReads, readsBefore);
    assert.equal(handoffFailureMatches(unbounded.report,
      'Packet identity evidence is unavailable or does not match the bounded payload.'), true);
    assert.equal(JSON.stringify(unbounded.report).includes(privateCanary), false);
    assert.equal(unbounded.output.includes(privateCanary), false);
    assert.equal(attachmentsOf(handoffReportResult(unbounded.report, 'failed')).length, 0);

    // Formatting is not authority. A parsed value matching the exact bounded
    // identity may be normalized, but raw bytes are never forwarded. This
    // input includes a shadowed JSON field with an otherwise unreviewed value.
    await writeFile(evidencePath, '{"selectionDigest":' + JSON.stringify(privateCanary) + ',' + JSON.stringify(identity).slice(1));
    const normalized = await runSpec(directory, `http://127.0.0.1:${port}/good`);
    assert.equal(normalized.ok, true);
    await verifyIdentityAttachment(normalized.report, 'passed');
    assert.equal(JSON.stringify(normalized.report).includes(privateCanary), false);
    assert.equal(normalized.output.includes(privateCanary), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
