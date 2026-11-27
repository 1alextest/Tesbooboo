// Disposable authoring fixtures and report checks shared by handoff verification.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyTarget } from './qa-approved-handoff.mjs';

// Read only actual child test outcomes. Git metadata, source snippets and global
// runner errors cannot establish the requested assertion's failure.
// Keep this shared with the native reporter fixture after branch integration.
export function handoffReportResult(report, status) {
  if (!['passed', 'failed'].includes(status) || !Array.isArray(report?.suites)
      || !Array.isArray(report.errors ?? []) || (report.errors ?? []).length !== 0) return null;
  const rows = [];
  function visit(suite) {
    for (const spec of suite.specs ?? []) {
      for (const item of spec.tests ?? []) rows.push(...(item.results ?? []));
    }
    for (const child of suite.suites ?? []) visit(child);
  }
  try {
    report.suites.forEach(visit);
  } catch {
    return null;
  }
  const result = rows[0];
  const errors = result?.errors ?? [];
  if (rows.length !== 1 || result?.status !== status || !Array.isArray(errors)
      || errors.length !== (status === 'failed' ? 1 : 0)
      || report.stats?.expected !== (status === 'passed' ? 1 : 0)
      || report.stats?.unexpected !== (status === 'failed' ? 1 : 0)) return null;
  return result;
}

export function handoffFailureMatches(report, label, details = []) {
  const result = handoffReportResult(report, 'failed');
  const message = result?.errors[0]?.message;
  if (typeof message !== 'string') return false;
  const lines = message.replace(/\u001b\[[0-9;]*m/g, '').trimStart().split(/\r?\n/).map(line => line.trim());
  const first = lines.shift()?.replace(/^Error:\s*/, '');
  return first === label && details.every(detail => lines.includes(detail));
}

export function fixtureGit(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trimEnd();
}

export async function createHandoffFixture({repository, targetPath, harnessRoot, plan, targetContent}) {
  const root = await mkdtemp(join(tmpdir(), 'tesbo-approved-handoff-'));
  const cleanup = () => rm(root, {recursive: true, force: true});
  const repo = join(root, 'repo'), remote = join(root, 'remote.git');
  const config = join(root, 'trusted.gitconfig');
  // The worker's Git configuration and environment stay untouched. Both Git setup and
  // production target verification get their own process environment and file-only transport.
  const env = {...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1', GIT_ALLOW_PROTOCOL: 'file'};
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], {
    env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
  async function write(file, content) {
    await mkdir(dirname(join(repo, file)), {recursive: true});
    await writeFile(join(repo, file), content);
  }
  try {
    await mkdir(repo);
    await mkdir(remote);
    for (const [key, value] of [
      ['protocol.allow', 'never'], ['protocol.file.allow', 'always'], ['core.hooksPath', '/dev/null'],
      ['url.' + pathToFileURL(remote).href + '.insteadOf', 'https://github.com/' + repository + '.git'],
    ]) git(root, 'config', '--file', config, key, value);
    git(remote, 'init', '-q', '--bare');
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'config', 'user.name', 'Fixture');
    git(repo, 'config', 'user.email', 'fixture@example.invalid');
    git(repo, '-c', 'commit.gpgSign=false', 'commit', '-qm', 'Base', '--allow-empty');
    const earlier = git(repo, 'rev-parse', 'HEAD');
    await write(targetPath, targetContent ?? '// synthetic target, never executed\n');
    if (plan) {
      const {key, oracle, title, risk, action, observation} = plan;
      const artifacts = 'qa-artifacts/CASE-300/';
      const observed = observation + '\n';
      const modelHash = createHash('sha256').update(observed).digest('hex');
      await write(artifacts + 'flow-model.md', observed);
      await write(artifacts + 'investigation.md', [
        '# Investigation: ' + title, 'Format version: 1', 'Local ID: CASE-300', '',
        '## Sources', '| ID | Kind | Locator | Captured | Revision or digest | External identity |',
        '|---|---|---|---|---|---|', '| S1 | Markdown | fixture:review | 2026-11-11 | revision-1 | none |', '',
        '## Cases and requirements', '| ID | Kind | Title or claim | Source ID | Location | Revision |',
        '|---|---|---|---|---|---|', '| ' + key + ' | requirement | ' + oracle + ' | S1 | review | 1 |', '',
      ].join('\n'));
      await write(artifacts + 'risks.md', [
        '# Risks: ' + title, '', '| ID | Step/State | Risk | Proposed oracle | Observable | Status | Requirement IDs |',
        '|---|---|---|---|---|---|---|', '| R1 | Review | ' + risk + ' | ' + oracle + ' | yes | APPROVED | ' + key + ' |', '',
        '## Human decision', '| Decision ID | Risk ID | Decision | Date | Reviewed risk/oracle | Dependency revision |',
        '|---|---|---|---|---|---|', '| D1 | R1 | APPROVED | 2026-11-11 | Risk: ' + risk + '; Oracle: ' + oracle + ' | flow-model.md@sha256:' + modelHash + ' |', '',
        '## Generated mapping (2026-11-11)', '| Risk ID | TC ID | File |', '|---|---|---|', '| R1 | TC-01 | ' + targetPath + ' |', '',
      ].join('\n'));
      await write('specs/CASE-300.plan.md', [
        '# CASE-300', '', '### TC-01: ' + title, '', '**Steps:** ' + action, '', '**Expected:** ' + oracle, '',
      ].join('\n'));
    }
    git(repo, 'add', '-A');
    git(repo, '-c', 'commit.gpgSign=false', 'commit', '-qm', 'Consumer fixture');
    const repoRevision = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'push', '-q', remote, 'HEAD:refs/heads/main');
    const checkTarget = (selection, testcase) => {
      const result = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--verify-target'], {
        env, input: JSON.stringify({selection, testcase}), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      const { value, error } = JSON.parse(result);
      if (error) throw new Error(error);
      return value;
    };
    return {repo, remote, earlier, cleanup, checkTarget,
      selected: {repoRoot: repo, repoRevision, harnessRoot, branch: 'main', investigationId: 'CASE-300', upstreamCase: 'TC-01'}};
  } catch (error) {
    await cleanup();
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url && process.argv[2] === '--verify-target') {
  const {selection, testcase} = JSON.parse(readFileSync(0, 'utf8'));
  try {
    process.stdout.write(JSON.stringify({value: verifyTarget(selection, testcase)}));
  } catch (error) {
    process.stdout.write(JSON.stringify({error: error.message}));
  }
}
