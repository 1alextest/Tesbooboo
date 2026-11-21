#!/usr/bin/env node
/**
 * Trusted-default-branch reporter for the protected specification assurance gate.
 *
 * Only the BASE repository's default-branch workflow may execute this file.
 * A pull request contributes data (number/head/reviews), never executable code
 * or authority. A GitHub-administered collaborator permission supplies role
 * authorization. The check run is explicitly attached to the current PR HEAD;
 * the pull_request_target job's own base-SHA check is NOT a merge proof.
 */
import { run } from './assurance-pr-gate.mjs';

const SHA = /^[a-f0-9]{40}$/i;
const REPO = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i;

async function requestJson(url, token, body) {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    redirect: 'error',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'tesbo-assurance-status'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.ok) throw new Error(`GitHub check-run API failed with HTTP ${response.status}`);
  return response.json();
}

export async function publishAssuranceStatus({ repository, prNumber, token }) {
  if (!REPO.test(repository ?? '') || !Number.isSafeInteger(prNumber) ||
      prNumber < 1 || !token) throw new Error('Invalid assurance publisher inputs');
  const api = `https://api.github.com/repos/${repository}`;
  const before = await requestJson(`${api}/pulls/${prNumber}`, token);
  if (!SHA.test(before?.head?.sha)) throw new Error('PR HEAD was not verified');

  let report;
  try {
    report = await run({ repository, prNumber, token });
  } catch (error) {
    report = { status: 'blocked', errors: [String(error instanceof Error ? error.message : 'unknown verification error')] };
  }

  // A concurrent force-push, new reviewer decision or rebase must not inherit
  // a passed earlier snapshot. A new head gets a denial check until rerun.
  const after = await requestJson(`${api}/pulls/${prNumber}`, token);
  if (!SHA.test(after?.head?.sha)) throw new Error('Current PR HEAD was not verified');
  const errors = [...(report.errors ?? [])];
  if (before.head.sha !== after.head.sha || report.head !== after.head.sha) {
    errors.push('PR HEAD changed or was not bound to the verified assurance snapshot');
  }
  const passed = errors.length === 0 &&
    ['review_provisionally_verified', 'approved_exception', 'not_applicable'].includes(report.status);
  const outcome = passed ? report.status : 'blocked';
  const summary = [
    `Outcome: ${outcome}`,
    `Verified PR HEAD: ${after.head.sha}`,
    'This check confirms GitHub review/role/evidence references, not a complete independent QA or White execution.',
    ...(errors.length ? errors.map(x => `- ${x}`) : []),
    'Actual human examination and accepted test evidence remain independently required.'
  ].join('\n').slice(0, 6000);
  const result = await requestJson(`${api}/check-runs`, token, {
    name: 'specification-assurance',
    head_sha: after.head.sha,
    status: 'completed',
    conclusion: passed ? 'success' : 'failure',
    output: { title: `Tesbo specification assurance: ${outcome}`, summary }
  });
  if (result?.name !== 'specification-assurance' ||
      result?.head_sha !== after.head.sha) {
    throw new Error('GitHub did not acknowledge the correct check-run/head');
  }
  return { status: outcome, head: after.head.sha, conclusion: passed ? 'success' : 'failure' };
}

export async function main(env = process.env) {
  const number = Number(env.PR_NUMBER);
  const report = await publishAssuranceStatus({
    repository: env.GITHUB_REPOSITORY, prNumber: number, token: env.GITHUB_TOKEN
  });
  console.log(JSON.stringify({ gate: 'tesbo-specification-assurance', ...report }));
  if (report.conclusion !== 'success') process.exitCode = 1;
  return report;
}

if (process.argv[1] && process.argv[1].endsWith('/publish-assurance-status.mjs')) {
  main().catch(error => {
    console.error(`Assurance status publisher refused: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  });
}
