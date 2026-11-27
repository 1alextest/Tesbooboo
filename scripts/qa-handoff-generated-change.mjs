// Reference consumer for one approved handoff packet.
//
// This is not a generator fleet and it does not choose a case. It accepts the exact packet a human
// confirmed through scripts/qa-approved-handoff.mjs, verifies its identity again, and emits one
// reviewable Playwright change for the approved "exactly one current linked case" oracle. A real
// project generator may replace this file; the identity checks are the reusable contract.
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sha = /^[0-9a-f]{40}$/;
const digest = /^[a-f0-9]{64}$/;
// One bounded adapter, not a natural-language generator: it only claims the oracle it can assert.
export const SUPPORTED_ORACLE = 'The requirement exposes exactly one current approved link for the selected case and criteria.';

function fail(message) {
  throw new Error(message);
}

function packetDigest(packet) {
  const { selectionDigest, ...body } = packet;
  if (!digest.test(selectionDigest ?? '')) fail('The packet has no valid selection digest.');
  const actual = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  if (actual !== selectionDigest) fail('The packet content does not match its confirmed selection digest.');
}

/** Recheck the exact native case, revisions, criteria and target the human confirmed. */
export function validateHandoffPacket(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) fail('A handoff packet object is required.');
  if (packet.schemaVersion !== 1 || packet.purpose !== 'prepare_automation_change') fail('Unsupported handoff packet schema or purpose.');
  packetDigest(packet);
  const native = packet.native, target = packet.target, investigation = packet.investigation;
  if (!native || !target || !investigation) fail('The packet needs native, target and investigation sections.');
  for (const id of [packet.native.projectId, packet.native.taskId, packet.native.receiptId,
    packet.native.requirementId, packet.native.requirementVersionId, packet.native.linkId,
    packet.native.testcaseId]) if (typeof id !== 'string' || !uuid.test(id)) fail('The packet is missing an exact native identity.');
  if (!Array.isArray(native.criterionKeys) || !native.criterionKeys.length ||
      new Set(native.criterionKeys).size !== native.criterionKeys.length) fail('The packet needs exact criterion keys.');
  for (const value of [native.proposalRevision, native.testcaseRevision, native.testcaseApprovalRevision])
    if (typeof value !== 'string' || !digest.test(value)) fail('The packet is missing an exact revision.');
  const testcase = native.testcase;
  if (!testcase || testcase.id !== native.testcaseId || typeof testcase.title !== 'string' || !testcase.title.trim() ||
      typeof testcase.externalId !== 'string' || !/^[^\\"')\s]{1,128}$/.test(testcase.externalId))
    fail('The approved case needs a title and its Tesbo external id for @tesbo.testId().');
  if (typeof testcase.automationPath !== 'string' || testcase.automationPath !== target.path ||
      !/\.(spec|test)\.(?:[cm]?[jt]sx?)$/.test(testcase.automationPath) ||
      testcase.automationPath.startsWith('/') || testcase.automationPath.split('/').some(part => !part || ['.', '..'].includes(part)) ||
      testcase.automationPath.includes('\\')) fail('The target path is not the approved reviewable Playwright file.');
  if (String(testcase.automationFramework ?? '').toLowerCase() !== 'playwright') fail('The approved case does not name Playwright.');
  if (typeof target.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(target.repository) ||
      typeof testcase.automationRepo !== 'string' || target.repository.toLowerCase() !== testcase.automationRepo.toLowerCase() ||
      typeof target.branch !== 'string' || !sha.test(target.revision ?? '')) fail('The packet has no exact published Git target matching the approved case.');
  if (investigation.targetPath !== target.path || investigation.repoRevision !== target.revision ||
      typeof investigation.targetBlob !== 'string' || !/^[a-f0-9]{40}$/.test(investigation.targetBlob))
    fail('The investigation is not bound to the approved target file and revision.');
  if (!Array.isArray(investigation.risks) || investigation.risks.length !== 1 ||
      investigation.risks[0]?.oracle !== SUPPORTED_ORACLE)
    fail('This reference consumer only supports the approved exactly-one-current-link oracle.');
  return packet;
}

const literal = value => JSON.stringify(value);

/** Emit one reviewable Playwright test, tied to the packet's case and oracle. */
export function generateCoverageSpec(packet) {
  validateHandoffPacket(packet);
  const native = packet.native;
  const title = native.testcase.automationTestName?.trim() || native.testcase.title;
  const constants = {
    caseId: native.testcaseId,
    requirementId: native.requirementId,
    requirementVersionId: native.requirementVersionId,
    linkId: native.linkId,
    criterionKeys: native.criterionKeys,
    testcaseRevision: native.testcaseRevision,
    testcaseApprovalRevision: native.testcaseApprovalRevision,
    selectionDigest: packet.selectionDigest,
    // Keep the packet identity attachment bounded to the four reviewed target fields.
    target: { repository: packet.target.repository, branch: packet.target.branch,
      revision: packet.target.revision, path: packet.target.path },
    caseExternalId: native.testcase.externalId,
  };
  const tag = `@tesbo.testId(${JSON.stringify(native.testcase.externalId)})`;
  return `// Generated from an approved Tesbo automation handoff. Review before committing.
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { test, expect } from '@playwright/test';

const BASIS = ${literal(constants)};

test(${literal(title)}, { tag: ${literal(tag)} }, async ({ request }) => {
  const coverageUrl = process.env.TESBO_JOURNEY_COVERAGE_URL;
  const token = process.env.TESBO_JOURNEY_TOKEN;
  const evidence = process.env.TESBO_JOURNEY_EVIDENCE_PATH;
  expect(coverageUrl, 'TESBO_JOURNEY_COVERAGE_URL').toBeTruthy();
  expect(token, 'TESBO_JOURNEY_TOKEN').toBeTruthy();
  expect(evidence, 'TESBO_JOURNEY_EVIDENCE_PATH').toBeTruthy();
  const expectedOrigin = process.env.TESBO_JOURNEY_API_ORIGIN;
  expect(expectedOrigin, 'TESBO_JOURNEY_API_ORIGIN').toBeTruthy();
  let destination;
  let allowed;
  try {
    destination = new URL(coverageUrl);
    allowed = new URL(expectedOrigin);
  } catch {
    throw new Error('The approved coverage API origin or URL is malformed.');
  }
  expect(allowed.pathname === '/', 'The approved API origin may not contain an alternate path').toBe(true);
  expect(destination.origin === allowed.origin, 'Coverage must use the explicitly approved API origin').toBe(true);
  expect(!destination.username && !destination.password && !allowed.username && !allowed.password,
    'Coverage URLs may not carry credentials').toBe(true);
  if (destination.protocol !== 'https:') {
    expect(['127.0.0.1', 'localhost', '[::1]'].includes(destination.hostname),
      'Unencrypted API traffic is allowed only for a loopback disposable fixture').toBe(true);
  }
  const identity = { selectionDigest: BASIS.selectionDigest, target: BASIS.target };
  try {
    if (!isDeepStrictEqual(JSON.parse(readFileSync(evidence, 'utf8')), identity)) {
      throw new Error('Invalid packet identity evidence');
    }
  } catch {
    // Never include the supplied path, parser diagnostic or unverified fields.
    throw new Error('Packet identity evidence is unavailable or does not match the bounded payload.');
  }
  // The existing native reporter uploads file-backed attachments. Materialize
  // the bounded identity in this attempt's output directory; do not forward
  // the caller's raw file (which may change or include bytes hidden by parsing).
  const validatedEvidence = test.info().outputPath('approved-handoff-identity.json');
  writeFileSync(validatedEvidence, JSON.stringify(identity), { flag: 'wx', mode: 0o600 });
  await test.info().attach('approved-handoff-evidence.json', { path: validatedEvidence, contentType: 'application/json' });

  let response;
  try {
    response = await request.get(coverageUrl, {
      headers: { Authorization: 'Bearer ' + token }, maxRedirects: 0
    });
  } catch {
    // Playwright transport errors may contain the URL and Authorization header.
    throw new Error('Coverage request failed (request details deliberately withheld).');
  }
  expect(response.status(), 'Coverage read HTTP status (body deliberately withheld)').toBe(200);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error('Coverage response is not valid JSON (body deliberately withheld).');
  }
  expect(body && typeof body === 'object' && !Array.isArray(body), 'A typed coverage result is required').toBe(true);
  const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
  const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  expect(isUuid(body.requirementId), 'Coverage requirement identity must be a UUID').toBe(true);
  expect(isUuid(body.approvedVersionId), 'Coverage approved version identity must be a UUID').toBe(true);
  expect(body.requirementId, 'Coverage must be for the reviewed requirement').toBe(BASIS.requirementId);
  expect(body.approvedVersionId, 'Coverage must be for the reviewed approved version').toBe(BASIS.requirementVersionId);
  expect(Array.isArray(body.cases), 'Coverage cases must be a list').toBe(true);
  // The native link contract preserves the exact ordered criterion array.
  // Count the logical group first; filtering by the expected link ID would
  // miss a second distinct link, and sorting keys would collapse valid neighbors.
  const sameKeys = (keys) => isDeepStrictEqual(keys, BASIS.criterionKeys);
  const matching = body.cases.filter((item) =>
    item && typeof item === 'object' && !Array.isArray(item) &&
    item.approved === true &&
    item.testcaseId === BASIS.caseId &&
    item.requirementVersionId === BASIS.requirementVersionId &&
    sameKeys(item.criterionKeys));
  // Expose only cardinality to the assertion formatter. Passing native rows here
  // would copy every returned property into error text and failure attachments.
  expect({ length: matching.length }, 'exactly one current approved link for the selected case and criteria').toHaveLength(1);
  expect(isUuid(matching[0].linkId), 'The selected link identity must be a UUID').toBe(true);
  expect(isDigest(matching[0].testcaseRevision), 'The selected case edit revision must be a digest').toBe(true);
  expect(isDigest(matching[0].testcaseApprovalRevision), 'The selected case approval revision must be a digest').toBe(true);
  expect(matching[0].linkId, 'The sole approved link must match the selected native link').toBe(BASIS.linkId);
  expect(matching[0].testcaseRevision, 'The selected case edit revision must match').toBe(BASIS.testcaseRevision);
  expect(matching[0].testcaseApprovalRevision, 'The selected case approval revision must match').toBe(BASIS.testcaseApprovalRevision);
});
`;
}

export function writeGeneratedChange(packet, directory) {
  validateHandoffPacket(packet);
  const content = generateCoverageSpec(packet);
  return { path: join(directory, packet.target.path), content, sha256: createHash('sha256').update(content).digest('hex') };
}
