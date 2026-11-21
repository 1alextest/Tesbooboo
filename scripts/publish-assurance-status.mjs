#!/usr/bin/env node
/** Publish a bounded observation of authenticated, coordinator-attested AI records. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACT, PROVENANCE, githubJson, parsePolicy, readLocalPolicy, run } from './assurance-pr-gate.mjs';

const SHA = /^[a-f0-9]{40}$/;
const REPO = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;
const CHECK = 'specification-assurance';
const accepted = report => ['analytical_evidence_accepted', 'not_applicable'].includes(report?.status);

function checkPayload(report, head, sourceSha, errors, now, policy, runId) {
  const passed = errors.length === 0 && accepted(report);
  const outcome = passed ? report.status : 'blocked';
  const observedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + policy.maxCheckAgeMinutes * 60000).toISOString();
  const observation = { contract: CONTRACT, outcome, head, base: report?.base ?? null,
    policySha: sourceSha, policyDigest: report?.policyDigest ?? null,
    stateDigest: report?.stateDigest ?? null, observedAt, expiresAt,
    importReviewId: report?.importReviewId ?? null, provenance: PROVENANCE };
  const summary = [
    `Outcome: ${outcome}`,
    `PR head: ${head}`,
    `Trusted policy source: ${sourceSha}`,
    `Evidence state digest: ${observation.stateDigest ?? 'UNAVAILABLE'}`,
    `Observed: ${observedAt}; fresh-merge deadline: ${expiresAt}`,
    'Provenance: owner-authorized coordinator observed distinct AI worker outputs.',
    'This is not cryptographic worker authentication, human review, canonical FROZEN, product acceptance or merge authorization.',
    'Existing owner integration policy and separate main/release rules remain in force.',
    ...(errors.length ? errors.map(error => `- ${error}`) : []),
    'GitHub does not automatically expire a successful check. Refresh and verify the current evidence state immediately before merging.',
  ].join('\n').slice(0, 6000);
  return { observation, payload: { name: CHECK, head_sha: head, status: 'completed',
    conclusion: passed ? 'success' : 'failure',
    external_id: `${CONTRACT}:${sourceSha}:${report?.stateDigest ?? 'unavailable'}`,
    ...(runId ? { details_url: `https://github.com/${report.repository}/actions/runs/${runId}` } : {}),
    output: { title: `Tesbo analytical assurance: ${outcome}`, summary,
      text: `\`\`\`json\n${JSON.stringify(observation, null, 2)}\n\`\`\`` } } };
}
function acknowledged(check, head, conclusion) {
  return Number.isSafeInteger(check?.id) && check.id > 0 && check.name === CHECK &&
    check.head_sha === head && check.status === 'completed' && check.conclusion === conclusion;
}

export async function publishAssuranceStatus(options) {
  const { repository, prNumber, token, sourceSha, policyRaw, runId, now = new Date() } = options;
  if (!REPO.test(repository ?? '') || !Number.isSafeInteger(prNumber) || prNumber < 1 ||
      !token || !SHA.test(sourceSha ?? '') || !(now instanceof Date) || Number.isNaN(now.getTime()) ||
      (runId !== undefined && !/^\d+$/.test(String(runId)))) throw new Error('Invalid assurance publisher inputs');
  const policy = parsePolicy(policyRaw);
  let first;
  let current;
  const errors = [];
  try { first = await run(options); } catch { errors.push('Initial evidence snapshot is unavailable or invalid'); }
  try { current = await run(options); } catch { errors.push('Final evidence snapshot is unavailable or invalid'); }
  if (current?.prState === 'closed') return { status: 'closed', skipped: true, head: current.head };
  if (first?.stateDigest !== current?.stateDigest || !first?.stateDigest) {
    errors.push('Head, base, policy or native receipt/import state changed or was not verified');
  }
  errors.push(...(first?.errors ?? []), ...(current?.errors ?? []));
  let head = current?.head;
  if (!SHA.test(head ?? '')) {
    const pr = await githubJson(repository, `/pulls/${prNumber}`, token);
    if (pr.state === 'closed') return { status: 'closed', skipped: true, head: pr.head?.sha ?? null };
    head = pr.head?.sha;
    if (!SHA.test(head ?? '')) throw new Error('Current PR head unavailable; no status was published');
  }
  const report = { ...current, repository };
  const prepared = checkPayload(report, head, sourceSha, [...new Set(errors)], now, policy, runId);
  const created = await githubJson(repository, '/check-runs', token, prepared.payload);
  if (!acknowledged(created, head, prepared.payload.conclusion)) {
    throw new Error('Check write outcome did not acknowledge the exact head and conclusion');
  }
  // Recheck after publication as well. A late withdrawal must not leave our just-written success.
  if (prepared.payload.conclusion === 'success') {
    let after;
    try { after = await run(options); } catch { /* Unavailability invalidates the optimistic result. */ }
    if (!after || after.stateDigest !== current.stateDigest || !accepted(after)) {
      const invalidated = checkPayload(report, head, sourceSha,
        ['Evidence changed or became unavailable during check publication; fresh evaluation is required'],
        now, policy, runId);
      const { head_sha: ignoredHead, name: ignoredName, ...patch } = invalidated.payload;
      void ignoredHead; void ignoredName;
      const updated = await githubJson(repository, `/check-runs/${created.id}`, token, patch, 'PATCH');
      if (!acknowledged(updated, head, 'failure')) throw new Error('Could not acknowledge invalidation of a stale successful check');
      return { ...invalidated.observation, checkId: created.id, conclusion: 'failure' };
    }
  }
  return { ...prepared.observation, checkId: created.id, conclusion: prepared.payload.conclusion };
}

export async function refreshAssurance({ repository, token, sourceSha, policyRaw, prNumber, runId }) {
  const policy = parsePolicy(policyRaw);
  let numbers;
  if (prNumber !== undefined) {
    if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('Invalid PR selection');
    numbers = [prNumber];
  } else {
    const rows = await githubJson(repository, `/pulls?state=open&per_page=${policy.maxOpenPullRequests + 1}`, token);
    if (!Array.isArray(rows) || rows.length > policy.maxOpenPullRequests ||
        rows.some(pr => !Number.isSafeInteger(pr.number) || pr.number < 1)) {
      throw new Error('Open-PR refresh bound exceeded or list unavailable; no partial refresh is represented as complete');
    }
    numbers = [...new Set(rows.map(pr => pr.number))].sort((a, b) => a - b);
  }
  const results = [];
  const failures = [];
  for (const number of numbers) {
    try { results.push({ prNumber: number, ...await publishAssuranceStatus({ repository,
      prNumber: number, token, sourceSha, policyRaw, runId }) }); }
    catch (error) { failures.push({ prNumber: number, error: error.message }); }
  }
  if (failures.length) {
    console.error(JSON.stringify({ refresh: 'incomplete', failures, reported: results.length }));
    throw new Error('Assurance refresh could not report every selected PR');
  }
  return results;
}

export async function main(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || !['schedule', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) {
    throw new Error('The publisher requires the installed schedule or dispatch workflow');
  }
  const repository = env.GITHUB_REPOSITORY;
  const repo = await githubJson(repository, '', env.GITHUB_TOKEN);
  if (env.GITHUB_REF !== `refs/heads/${repo.default_branch}` ||
      String(repo.id) !== env.GITHUB_REPOSITORY_ID) throw new Error('Workflow is not running for the trusted repository/default branch');
  const selected = env.PR_NUMBER?.trim();
  if (selected && !/^[1-9][0-9]*$/.test(selected)) throw new Error('PR number must be a positive integer or empty for bounded refresh');
  const results = await refreshAssurance({ repository, token: env.GITHUB_TOKEN,
    sourceSha: env.GITHUB_SHA, policyRaw: readLocalPolicy(),
    prNumber: selected ? Number(selected) : undefined, runId: env.GITHUB_RUN_ID });
  // A reported refusal is an expected policy outcome; an unreported API/write failure throws.
  console.log(JSON.stringify({ contract: CONTRACT, refreshed: results }, null, 2));
  return results;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Assurance refresh failed: ${error.message}`); process.exitCode = 1; });
}
