import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTRACT = 'tesbo-coordinator-attested-ai-assurance/v1';
export const PROVENANCE = 'owner-authorized-coordinator-observation';
export const POLICY_PATH = '.github/assurance-policy.json';
export const MARKERS = Object.freeze({
  receipt: 'TESBO-AI-RECEIPT: 1',
  import: 'TESBO-AI-IMPORT: 1',
  revoke: 'TESBO-AI-REVOKE: 1',
});
const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const REPO = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const ROLES = ['INDEPENDENT', 'WHITE'];
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;

export function canonicalJson(value) {
  function order(item) {
    if (Array.isArray(item)) return item.map(order);
    if (object(item)) return Object.fromEntries(Object.keys(item).sort().map(key => [key, order(item[key])]));
    return item;
  }
  return JSON.stringify(order(value));
}
export const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
export const recordBody = (kind, value) => `${MARKERS[kind]}\n${canonicalJson(value)}`;

export function parseRecord(body, kind, maxBytes = 60000) {
  if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') > maxBytes ||
      !body.startsWith(`${MARKERS[kind]}\n`)) return null;
  const source = body.slice(MARKERS[kind].length + 1);
  try {
    const value = JSON.parse(source);
    // One canonical JSON object rejects duplicate keys, trailing data and ambiguous encodings.
    return object(value) && canonicalJson(value) === source ? value : null;
  } catch { return null; }
}

export function parsePolicy(raw) {
  const policy = JSON.parse(raw);
  const keys = ['contract', 'provenance', 'delegatedImporterIds', 'integrationBranch', 'releaseBranch',
    'maxOpenPullRequests', 'maxPages', 'maxReviewBodyBytes', 'maxCheckAgeMinutes'];
  if (!object(policy) || Object.keys(policy).some(key => !keys.includes(key)) ||
      policy.contract !== CONTRACT || policy.provenance !== PROVENANCE ||
      !Array.isArray(policy.delegatedImporterIds) ||
      policy.delegatedImporterIds.some(id => !positiveInteger(id)) ||
      new Set(policy.delegatedImporterIds).size !== policy.delegatedImporterIds.length ||
      ![policy.integrationBranch, policy.releaseBranch].every(branch =>
        typeof branch === 'string' && /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(branch) && !branch.includes('..')) ||
      policy.integrationBranch === policy.releaseBranch ||
      !positiveInteger(policy.maxOpenPullRequests) || policy.maxOpenPullRequests > 50 ||
      !positiveInteger(policy.maxPages) || policy.maxPages > 10 ||
      !positiveInteger(policy.maxReviewBodyBytes) || policy.maxReviewBodyBytes > 60000 ||
      !positiveInteger(policy.maxCheckAgeMinutes) || policy.maxCheckAgeMinutes > 60) {
    throw new Error('Invalid trusted assurance policy');
  }
  return policy;
}

export function requiresAssurance(file) {
  const names = typeof file === 'string' ? [file] : [file?.filename, file?.previous_filename];
  return names.some(name => typeof name === 'string' && (
    name.startsWith('docs/specs/agent-synchronized-engineering/') ||
    name.startsWith('docs/agent-skills/') ||
    name.startsWith('.agents/skills/') ||
    name.startsWith('.claude/skills/') ||
    [POLICY_PATH, 'AGENTS.md', 'CLAUDE.md', 'skills-lock.json', 'docs/ci-quality.md', 'scripts/assurance-pr-gate.mjs',
      'scripts/assurance-pr-gate.test.mjs', 'scripts/assurance-test-fixtures.mjs',
      'scripts/publish-assurance-status.mjs', 'scripts/publish-assurance-status.test.mjs',
      '.github/workflows/assurance-pr-gate.yml', '.github/workflows/ci-hygiene.yml'].includes(name)
  ));
}

export function inputManifest(snapshot) {
  return {
    repositoryId: snapshot.repository.id, prNumber: snapshot.pr.number,
    headSha: snapshot.pr.head.sha, baseSha: snapshot.pr.base.sha,
    files: snapshot.files.map(file => ({ path: file.filename, previousPath: file.previous_filename ?? null,
      status: file.status, blobSha: file.sha })).sort((a, b) => a.path.localeCompare(b.path)),
  };
}
export const inputManifestDigest = snapshot => sha256(canonicalJson(inputManifest(snapshot)));

function subjectMatches(subject, snapshot) {
  return object(subject) && subject.repositoryId === snapshot.repository.id &&
    subject.prNumber === snapshot.pr.number && subject.headSha === snapshot.pr.head.sha &&
    subject.baseSha === snapshot.pr.base.sha && subject.policySha === snapshot.policySha;
}
function isImporter(review, snapshot) {
  // GitHub identity belongs to the importer, not to either analytical worker.
  return positiveInteger(review?.user?.id) && ['User', 'Bot'].includes(review.user.type) &&
    (review.user.id === snapshot.repository.owner.id ||
      snapshot.policy.delegatedImporterIds.includes(review.user.id));
}
function relevantReview(review, snapshot) {
  // A current body cannot reveal whether an authorized edit removed an earlier
  // control marker. Keep native edit metadata for every potential importer.
  return isImporter(review, snapshot) ||
    (typeof review.body === 'string' && review.body.startsWith('TESBO-AI-'));
}
function nativeRecordValid(review, snapshot) {
  return positiveInteger(review?.id) && review.state === 'COMMENTED' &&
    review.commit_id === snapshot.pr.head.sha && review.editVerified === true &&
    review.lastEditedAt === null && timestamp(review.submitted_at) !== null;
}
function receiptErrors(receipt, role, snapshot, protectedPaths) {
  const errors = [];
  if (!object(receipt) || receipt.contract !== CONTRACT || receipt.role !== role ||
      !subjectMatches(receipt.subject, snapshot)) return [`${role} receipt has a wrong contract, role or subject`];
  if (!text(receipt.invocationId) || !text(receipt.implementationInvocationId) ||
      receipt.invocationId === receipt.implementationInvocationId) errors.push(`${role} is not a distinct analytical invocation`);
  if (receipt.inputManifestSha256 !== inputManifestDigest(snapshot)) errors.push(`${role} input manifest does not match the current source delta`);
  if (!Array.isArray(receipt.coveredPaths) || receipt.coveredPaths.some(item => !text(item)) ||
      !protectedPaths.every(name => receipt.coveredPaths.includes(name))) errors.push(`${role} does not declare the complete protected change scope`);
  if (!object(receipt.method) || !text(receipt.method.name) || !text(receipt.method.revision) ||
      !DIGEST.test(receipt.method.sha256 ?? '')) errors.push(`${role} method identity is incomplete`);
  if (!object(receipt.output) || !text(receipt.output.text) ||
      receipt.output.sha256 !== sha256(receipt.output.text)) errors.push(`${role} original output is missing or changed`);
  if (!Array.isArray(receipt.limits) || receipt.limits.some(item => !text(item))) errors.push(`${role} limits must be explicit`);
  if (role === 'INDEPENDENT' && receipt.disposition !== 'reviewed') errors.push('Independent analysis requires changes or is incomplete');
  if (role === 'WHITE' && receipt.disposition !== 'admit_scope') errors.push('White has not admitted this analytical scope');
  return errors;
}

/** Pure mechanical verification of coordinator-attested records, never proof of AI execution. */
export function evaluateAssurance(snapshot) {
  const { repository, pr, files, reviews, policy } = snapshot;
  if (!positiveInteger(repository?.id) || repository?.owner?.type !== 'User' ||
      !positiveInteger(repository.owner.id) || !positiveInteger(pr?.number) ||
      !SHA.test(pr?.head?.sha ?? '') || !SHA.test(pr?.base?.sha ?? '') ||
      !SHA.test(snapshot.policySha ?? '') || !Array.isArray(files) || !Array.isArray(reviews)) {
    throw new Error('Incomplete authenticated assurance inputs or unsupported repository ownership');
  }
  const protectedPaths = [...new Set(files.filter(requiresAssurance).flatMap(file =>
    [file.filename, file.previous_filename].filter(name => typeof name === 'string')))].sort();
  const base = { head: pr.head.sha, base: pr.base.sha, policySha: snapshot.policySha,
    policyDigest: snapshot.policyDigest, inputManifestSha256: inputManifestDigest(snapshot),
    protectedPaths, provenance: PROVENANCE, errors: [], approvals: [], prState: pr.state };
  if (pr.state !== 'open') return { ...base, status: 'closed' };
  const errors = reviewThreadErrors(snapshot.reviewThreads);
  if (!protectedPaths.length) return { ...base, errors, status: errors.length ? 'blocked' : 'not_applicable' };
  if (pr.draft) errors.push('Draft PR cannot satisfy final integration assurance');
  if (![policy.integrationBranch, policy.releaseBranch].includes(pr.base.ref)) errors.push('Target branch is outside the installed assurance policy');
  const authorizedReviews = reviews.filter(review => isImporter(review, snapshot));
  const controls = authorizedReviews.filter(review =>
    typeof review.body === 'string' &&
    (review.body.startsWith('TESBO-AI-IMPORT:') || review.body.startsWith('TESBO-AI-REVOKE:')));
  const times = controls.map(review => timestamp(review.submitted_at));
  const latestTime = times.length && times.every(value => value !== null) ? Math.max(...times) : null;
  const latest = latestTime === null ? [] : controls.filter(review => timestamp(review.submitted_at) === latestTime);
  // Review IDs are allocated before submission and cannot order tied timestamps.
  // A valid import must be uniquely later than conflicting controls and edits.
  const control = latest.length === 1 ? latest[0] : null;
  for (const review of authorizedReviews) {
    if (review.editVerified !== true || !Object.hasOwn(review, 'lastEditedAt') ||
        (review.lastEditedAt !== null && timestamp(review.lastEditedAt) === null)) {
      errors.push('Authorized review edit metadata is unavailable or invalid');
    } else if (review.lastEditedAt !== null &&
        (latestTime === null || timestamp(review.lastEditedAt) >= latestTime)) {
      errors.push('An authorized review was edited at or after the latest control; a uniquely later explicit import is required');
    }
  }
  if (!controls.length) errors.push('Missing owner or delegated-coordinator import of actual AI worker receipts');
  else if (!control) errors.push('Latest authorized control submission order is unavailable or tied; a uniquely later explicit import is required');
  else if (!nativeRecordValid(control, snapshot)) errors.push('Latest import/revocation is edited, stale, unavailable or not a submitted COMMENTED record');
  else if (control.body.startsWith('TESBO-AI-REVOKE:')) {
    errors.push('Latest authorized assurance control is a revocation; a new explicit import is required');
  } else {
    const imported = parseRecord(control.body, 'import', policy.maxReviewBodyBytes);
    if (!imported || imported.contract !== CONTRACT || imported.provenance !== PROVENANCE ||
        !subjectMatches(imported.subject, snapshot) || imported.attestation !== 'observed-distinct-worker-outputs' ||
        !Array.isArray(imported.receipts) || imported.receipts.length !== 2) {
      errors.push('Import does not authenticate this exact subject and the coordinator observation tier');
    } else {
      const selected = [];
      for (const role of ROLES) {
        const refs = imported.receipts.filter(ref => ref?.role === role);
        const ref = refs[0];
        const record = refs.length === 1 && positiveInteger(ref?.reviewId)
          ? reviews.find(review => review.id === ref.reviewId) : null;
        if (!record || !nativeRecordValid(record, snapshot) ||
            !DIGEST.test(ref?.bodySha256 ?? '') || sha256(record.body) !== ref.bodySha256 ||
            String(record.submitted_at) > String(control.submitted_at)) {
          errors.push(`${role} imported receipt is missing, edited, stale, changed or not yet submitted`);
          continue;
        }
        const receipt = parseRecord(record.body, 'receipt', policy.maxReviewBodyBytes);
        errors.push(...receiptErrors(receipt, role, snapshot, protectedPaths));
        selected.push({ role, reviewId: record.id, bodySha256: ref.bodySha256, receipt });
      }
      if (selected.length === 2 && selected.every(item => item.receipt)) {
        const [independent, white] = selected;
        if (independent.reviewId === white.reviewId || independent.receipt.invocationId === white.receipt.invocationId ||
            independent.receipt.implementationInvocationId !== white.receipt.implementationInvocationId) {
          errors.push('Independent and White must be distinct invocations reviewing the same implementation actor');
        }
        if (white.receipt.independentReceiptSha256 !== independent.bodySha256) errors.push('White does not bind the original Independent receipt');
      }
      base.approvals = selected.map(({ role, reviewId, bodySha256, receipt }) => ({
        role, reviewId, bodySha256, invocationId: receipt?.invocationId ?? null,
      }));
      base.importReviewId = control.id;
      base.importerId = control.user.id;
    }
  }
  return { ...base, errors, status: errors.length ? 'blocked' : 'analytical_evidence_accepted',
    ownerAuthority: pr.base.ref === policy.integrationBranch
      ? 'existing-owner-authorized-integration-policy' : 'separate-release-authority-required' };
}

export async function githubJson(repository, suffix, token, body, method = body === undefined ? 'GET' : 'POST') {
  if (!REPO.test(repository ?? '') || !token || typeof suffix !== 'string' || (suffix !== '' && !suffix.startsWith('/'))) {
    throw new Error('Invalid GitHub request boundary');
  }
  if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Invalid GitHub request method');
  const response = await fetch(`https://api.github.com/repos/${repository}${suffix}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'tesbo-assurance-gate',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`GitHub assurance API unavailable (HTTP ${response.status})`);
  return response.json();
}
async function githubPages(repository, suffix, token, maxPages) {
  const rows = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await githubJson(repository, `${suffix}?per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error('Invalid paginated GitHub evidence');
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
  throw new Error('GitHub evidence pagination bound exceeded');
}

async function verifyReviewEditMetadata(reviews, repository, prNumber, token, authority) {
  const selected = reviews.filter(review => relevantReview(review, authority));
  if (!selected.length) return reviews;
  if (selected.some(review => !text(review.node_id))) throw new Error('Native review edit identity unavailable');
  const metadata = new Map();
  // Query only native review metadata, never client-selected GraphQL or executable artifacts.
  for (let start = 0; start < selected.length; start += 50) {
    const ids = selected.slice(start, start + 50).map(review => review.node_id);
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        'User-Agent': 'tesbo-assurance-gate' },
      body: JSON.stringify({ query: 'query($ids:[ID!]!){nodes(ids:$ids){... on PullRequestReview{id body state lastEditedAt commit{oid} pullRequest{number repository{nameWithOwner}}}}}', variables: { ids } }),
    });
    if (!response.ok) throw new Error(`Native review edit metadata unavailable (HTTP ${response.status})`);
    const result = await response.json();
    if (result.errors || !Array.isArray(result.data?.nodes) || result.data.nodes.length !== ids.length) {
      throw new Error('Native review edit metadata is incomplete');
    }
    for (const node of result.data.nodes) {
      if (!node?.id || !Object.hasOwn(node, 'lastEditedAt')) throw new Error('Native review edit metadata is missing');
      metadata.set(node.id, node);
    }
  }
  return reviews.map(review => {
    if (!selected.includes(review)) return review;
    const node = metadata.get(review.node_id);
    if (!node || node.body !== review.body || node.state !== review.state ||
        (node.commit?.oid ?? null) !== (review.commit_id ?? null) || node.pullRequest?.number !== prNumber ||
        node.pullRequest?.repository?.nameWithOwner !== repository) throw new Error('Review changed during native metadata verification');
    return { ...review, editVerified: true, lastEditedAt: node.lastEditedAt };
  });
}

/** All native inline findings must be resolved, including outdated threads.
 * Thread resolution is necessary but not proof of scanner coverage or an authorized disposition.
 */
export function reviewThreadErrors(threads) {
  if (!Array.isArray(threads) || threads.some(t => !text(t?.id) ||
      typeof t.isResolved !== 'boolean' || typeof t.isOutdated !== 'boolean') ||
      new Set(threads.map(t => t.id)).size !== threads.length) {
    return ['Native finding thread inventory unavailable, malformed or duplicated'];
  }
  return threads.filter(t => !t.isResolved).map(t => `Unresolved native review finding: ${t.id}`);
}

async function captureReviewThreads(repository, pr, token, maxPages) {
  const [owner, name] = repository.split('/');
  const threads = [];
  let cursor = null;
  let total;
  const seen = new Set();
  for (let page = 0; page < maxPages; page++) {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
        'User-Agent': 'tesbo-assurance-gate' },
      body: JSON.stringify({ query: 'query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){nameWithOwner pullRequest(number:$number){number headRefOid baseRefOid reviewThreads(first:100,after:$cursor){totalCount pageInfo{hasNextPage endCursor} nodes{id isResolved isOutdated}}}}}', variables: { owner, name, number: pr.number, cursor } }),
    });
    if (!response.ok) throw new Error('Native finding inventory unavailable');
    const result = await response.json();
    const repo = result.data?.repository;
    const candidate = repo?.pullRequest;
    const connection = candidate?.reviewThreads;
    if (result.errors || repo?.nameWithOwner !== repository || candidate?.number !== pr.number ||
        candidate.headRefOid !== pr.head.sha || candidate.baseRefOid !== pr.base.sha ||
        !Number.isSafeInteger(connection?.totalCount) || connection.totalCount < 0 ||
        !Array.isArray(connection.nodes) || typeof connection.pageInfo?.hasNextPage !== 'boolean' ||
        (total !== undefined && connection.totalCount !== total)) throw new Error('Incomplete or changed native finding inventory');
    total = connection.totalCount;
    threads.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) {
      if (threads.length !== total || reviewThreadErrors(threads).some(e => e.startsWith('Native finding'))) throw new Error('Incomplete native finding inventory');
      return threads.sort((a,b) => a.id.localeCompare(b.id));
    }
    cursor = connection.pageInfo.endCursor;
    if (!text(cursor) || seen.has(cursor)) throw new Error('Invalid native finding pagination');
    seen.add(cursor);
  }
  throw new Error('Native finding pagination bound exceeded');
}

export async function captureSnapshot({ repository, prNumber, token, sourceSha, policyRaw }) {
  if (!REPO.test(repository ?? '') || !positiveInteger(prNumber) || !token || !SHA.test(sourceSha ?? '')) {
    throw new Error('Invalid trusted assurance inputs');
  }
  const policy = parsePolicy(policyRaw);
  const repo = await githubJson(repository, '', token);
  if (repo.full_name !== repository || !text(repo.default_branch)) throw new Error('Repository identity/default branch unavailable');
  const ref = await githubJson(repository, `/git/ref/heads/${encodeURIComponent(repo.default_branch)}`, token);
  if (ref.object?.sha !== sourceSha) throw new Error('Trusted default-branch source moved or was not selected');
  const remotePolicy = await githubJson(repository, `/contents/${POLICY_PATH}?ref=${sourceSha}`, token);
  if (remotePolicy.type !== 'file' || remotePolicy.encoding !== 'base64' ||
      sha256(Buffer.from(remotePolicy.content ?? '', 'base64').toString('utf8')) !== sha256(policyRaw)) {
    throw new Error('Local policy is not the installed default-branch policy');
  }
  const pr = await githubJson(repository, `/pulls/${prNumber}`, token);
  if (pr.number !== prNumber || pr.base?.repo?.id !== repo.id || !text(pr.base.ref)) throw new Error('PR does not belong to the policy repository');
  const targetRef = await githubJson(repository, `/git/ref/heads/${encodeURIComponent(pr.base.ref)}`, token);
  if (targetRef.object?.sha !== pr.base.sha) throw new Error('Target branch moved beyond the PR base snapshot');
  const files = await githubPages(repository, `/pulls/${prNumber}/files`, token, policy.maxPages);
  if (!Number.isSafeInteger(pr.changed_files) || pr.changed_files < 0 || files.length !== pr.changed_files ||
      new Set(files.map(file => file.filename)).size !== files.length) throw new Error('Changed-file evidence is incomplete or duplicated');
  if (files.some(file => !text(file.filename) || !text(file.status) || !SHA.test(file.sha ?? '') ||
      (file.previous_filename !== undefined && !text(file.previous_filename)) ||
      (file.status === 'renamed' && !text(file.previous_filename)))) throw new Error('Incomplete changed-file identities');
  let reviews = await githubPages(repository, `/pulls/${prNumber}/reviews`, token, policy.maxPages);
  reviews = await verifyReviewEditMetadata(reviews, repository, prNumber, token, { repository: repo, policy });
  const reviewThreads = await captureReviewThreads(repository, pr, token, policy.maxPages);
  return { repository: repo, pr, files, reviews, reviewThreads, policy, policySha: sourceSha, policyDigest: sha256(policyRaw) };
}

export function snapshotDigest(snapshot) {
  return sha256(canonicalJson({ repositoryId: snapshot.repository.id, ownerId: snapshot.repository.owner.id,
    pr: { number: snapshot.pr.number, state: snapshot.pr.state, draft: snapshot.pr.draft,
      head: snapshot.pr.head.sha, base: snapshot.pr.base.sha, baseRef: snapshot.pr.base.ref },
    policySha: snapshot.policySha, policyDigest: snapshot.policyDigest,
    inputManifestSha256: inputManifestDigest(snapshot),
    reviewThreads: snapshot.reviewThreads?.slice().sort((a,b) => a.id.localeCompare(b.id)),
    records: snapshot.reviews.filter(review => relevantReview(review, snapshot))
      .map(review => ({ id: review.id, userId: review.user?.id, userType: review.user?.type,
        state: review.state, head: review.commit_id, body: review.body, submittedAt: review.submitted_at,
        editVerified: review.editVerified === true, lastEditedAt: review.lastEditedAt ?? null }))
      .sort((a, b) => a.id - b.id),
  }));
}

export async function run(options) {
  const snapshot = await captureSnapshot(options);
  return { ...evaluateAssurance(snapshot), stateDigest: snapshotDigest(snapshot) };
}
export const readLocalPolicy = () => fs.readFileSync(new URL(`../${POLICY_PATH}`, import.meta.url), 'utf8');

export async function main(env = process.env) {
  const report = await run({ repository: env.GITHUB_REPOSITORY, prNumber: Number(env.PR_NUMBER),
    token: env.GITHUB_TOKEN, sourceSha: env.GITHUB_SHA, policyRaw: readLocalPolicy() });
  console.log(JSON.stringify({ gate: CONTRACT, ...report }, null, 2));
  if (!['analytical_evidence_accepted', 'not_applicable'].includes(report.status)) process.exitCode = 1;
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Assurance evidence refused: ${error.message}`); process.exitCode = 1; });
}
