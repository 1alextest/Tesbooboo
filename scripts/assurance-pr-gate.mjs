import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f0-9]{40}$/i;
const RECEIPT_PATH = /^docs\/specs\/agent-synchronized-engineering\/reviews\/[A-Za-z0-9/_-]+\.md$/;

/** A protected document or gate change is not a routine documentation typo. */
export function requiresAssurance(filename) {
  return /^docs\/specs\/agent-synchronized-engineering\//.test(filename) ||
    filename === 'scripts/assurance-pr-gate.mjs' ||
    filename === 'scripts/assurance-pr-gate.test.mjs' ||
    filename === '.github/workflows/assurance-pr-gate.yml' ||
    filename === '.github/workflows/ci-hygiene.yml' ||
    filename === 'scripts/publish-assurance-status.mjs' ||
    filename === 'scripts/publish-assurance-status.test.mjs';
}

export function parseReviewBody(body, head) {
  if (typeof body !== 'string' || !SHA.test(head)) return null;
  const lines = body.split(/\r?\n/).map(line => line.trim());
  function exact(label) {
    const matching = lines.filter(line => line.startsWith(label + ':'));
    return matching.length === 1 ? matching[0].slice(label.length + 1).trim() : null;
  }
  const role = exact('TESBO-ASSURANCE');
  const reviewedHead = exact('TESBO-HEAD');
  const receipt = exact('TESBO-EVIDENCE');
  const decision = exact('TESBO-DECISION');
  if (!['INDEPENDENT', 'WHITE'].includes(role) || reviewedHead !== head ||
      !RECEIPT_PATH.test(receipt ?? '')) return null;
  if (role === 'WHITE' && !['FROZEN', 'EXPLICIT-WAIVER'].includes(decision)) return null;
  if (role === 'INDEPENDENT' && decision !== 'REVIEWED') return null;
  const waiverReason = exact('TESBO-WAIVER-REASON');
  if (decision === 'EXPLICIT-WAIVER' && (!waiverReason || waiverReason.length < 25)) return null;
  if (decision !== 'EXPLICIT-WAIVER' && waiverReason !== null) return null;
  return { role, receipt, decision, waiverReason: waiverReason ?? null };
}

/**
 * Authority is GitHub-maintained collaborator permission, not a PR-authored
 * role marker or a repository Actions variable writable by other collaborators.
 * A role marker only nominates the review for the already-authorized role.
 *
 * Independent reviewers need MAINTAIN/ADMIN; White must have ADMIN. GitHub
 * membership and permission changes require an authorized repository admin.
 * A missing/denied API permission lookup is never interpreted as approval.
 */
export function hasAssuranceRole(permission, role) {
  if (typeof permission !== 'string') return false;
  return role === 'WHITE' ? permission === 'admin' :
    role === 'INDEPENDENT' ? ['maintain', 'admin'].includes(permission) : false;
}

const GITHUB_LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;

/**
 * Use GitHub review objects, not PR-authored JSON saying a role approved.
 * A later dismissed/change-requested review by the same actor invalidates an earlier approval.
 * Every approval must be anchored to the exact current PR head.
 */
export function evaluateAssuranceReviews({ changedFiles, reviews, head, author, draft = false, reviewerPermissions = null }) {
  if (!Array.isArray(changedFiles) || !Array.isArray(reviews) || !SHA.test(head) || !author) {
    return { status: 'blocked', errors: ['Invalid or incomplete GitHub review inputs'], approvals: [] };
  }
  const protectedFiles = changedFiles.filter(requiresAssurance).sort();
  if (protectedFiles.length === 0) return { status: 'not_applicable', protectedFiles, errors: [], approvals: [] };
  const errors = [];
  if (draft) errors.push('Draft PR cannot satisfy final assurance');
  if (!reviewerPermissions || typeof reviewerPermissions !== 'object' || Array.isArray(reviewerPermissions)) {
    errors.push('Administrator-maintained GitHub collaborator permissions are unavailable');
  }
  const latest = new Map();
  const chronological = [...reviews].sort((a, b) =>
    String(a.submitted_at ?? '').localeCompare(String(b.submitted_at ?? '')) ||
    Number(a.id ?? 0) - Number(b.id ?? 0));
  for (const review of chronological) {
    if (!review?.user?.login || review.user.type !== 'User') continue;
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    latest.set(review.user.login.toLowerCase(), review);
  }
  const approvals = [];
  for (const [login, review] of latest) {
    if (login === author.toLowerCase() || review.state !== 'APPROVED' || review.commit_id !== head) continue;
    const attestation = parseReviewBody(review.body, head);
    if (!attestation || !hasAssuranceRole(reviewerPermissions?.[login], attestation.role)) continue;
    approvals.push({ ...attestation, login, reviewId: review.id });
  }
  const specialist = approvals.filter(r => r.role === 'INDEPENDENT');
  const white = approvals.filter(r => r.role === 'WHITE');
  if (!specialist.length) errors.push('Missing independent GitHub approval on exact head with source receipt');
  if (!white.length) errors.push('Missing separate White GitHub approval on exact head with decision receipt');
  const pair = specialist.flatMap(a => white.filter(b => a.login !== b.login && a.receipt !== b.receipt)
    .map(b => [a, b]))[0];
  if (specialist.length && white.length && !pair) errors.push('White and independent approvals need distinct humans and receipts');
  return { status: errors.length ? 'blocked' :
    (pair?.[1].decision === 'EXPLICIT-WAIVER' ? 'approved_exception' : 'review_provisionally_verified'),
    protectedFiles, errors, approvals: pair ? pair : approvals };
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    redirect: "error",
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'tesbo-assurance-gate' }
  });
  if (!response.ok) throw new Error(`GitHub review evidence fetch failed: ${response.status} ${url.split('?')[0]}`);
  return response.json();
}

async function githubPages(api, suffix, token) {
  const rows = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await githubJson(`${api}${suffix}?per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error('Invalid paged GitHub response');
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
  throw new Error('GitHub review/file pagination exceeded safe limit');
}

export async function run({ repository, prNumber, token }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
      !Number.isSafeInteger(prNumber) || prNumber < 1 || !token) throw new Error('Invalid GitHub gate configuration');
  const api = `https://api.github.com/repos/${repository}`;
  const pr = await githubJson(`${api}/pulls/${prNumber}`, token);
  if (!SHA.test(pr?.head?.sha) || !pr?.user?.login) throw new Error('No authenticated PR head/author');
  const files = await githubPages(api, `/pulls/${prNumber}/files`, token);
  if (!files.every(f => typeof f.filename === 'string')) throw new Error('Invalid changed-file list');
  if (!files.some(f => requiresAssurance(f.filename))) return {
    head: pr.head.sha, status: 'not_applicable', errors: [], approvals: [], protectedFiles: []
  };
  const reviews = await githubPages(api, `/pulls/${prNumber}/reviews`, token);
  // Never use Actions variables, PR text or client-provided roster data for
  // reviewer authority. Re-read current GitHub-administered repository roles.
  const candidates = new Set();
  for (const review of reviews) {
    const login = review?.user?.login?.toLowerCase?.();
    if (review?.state !== 'APPROVED' || review.user.type !== 'User' ||
        review.commit_id !== pr.head.sha || !GITHUB_LOGIN.test(login ?? '') ||
        !parseReviewBody(review.body, pr.head.sha)) continue;
    candidates.add(login);
    if (candidates.size > 40) throw new Error('Assurance reviewer lookup bound exceeded');
  }
  const reviewerPermissions = Object.create(null);
  for (const login of [...candidates].sort()) {
    const result = await githubJson(`${api}/collaborators/${encodeURIComponent(login)}/permission`, token);
    // The permission endpoint is sourced from GitHub repository membership.
    // No response field from PR comments, Actions vars or skill text can grant a role.
    reviewerPermissions[login] = typeof result?.permission === 'string' ? result.permission : null;
  }
  const outcome = evaluateAssuranceReviews({ changedFiles: files.map(f => f.filename), reviews,
    head: pr.head.sha, author: pr.user.login, draft: pr.draft, reviewerPermissions });
  outcome.head = pr.head.sha;
  if (!['review_provisionally_verified', 'approved_exception'].includes(outcome.status)) return outcome;
  // Exact head fetch (not default branch) makes a deleted/renamed/past receipt fail closed.
  for (const approval of outcome.approvals) {
    const entry = await githubJson(`${api}/contents/${approval.receipt}?ref=${pr.head.sha}`, token);
    if (entry.type !== 'file' || !Number.isSafeInteger(entry.size) || entry.size < 50) {
      outcome.errors.push(`Missing or empty independent receipt for ${approval.role}`);
    }
  }
  if (outcome.errors.length) outcome.status = 'blocked';
  return outcome;
}

export async function main(env = process.env) {
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('Missing GITHUB_EVENT_PATH');
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const prNumber = event?.pull_request?.number;
  const report = await run({ repository: env.GITHUB_REPOSITORY, prNumber,
    token: env.GITHUB_TOKEN });
  console.log(JSON.stringify({ gate: 'tesbo-spec-assurance-v1', prNumber, ...report }, null, 2));
  if (report.status === 'blocked') process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(`Assurance review gate blocked: ${e.message}`); process.exitCode = 1; });
}
