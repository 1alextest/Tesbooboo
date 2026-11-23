import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateHandoff, isProtectedCandidatePath, readRemoteHead,
  stageExactCandidate, prepareHandoff
} from "./agent-pr-handoff.mjs";
import { verifyPublishedPr } from "./agent-pr-verify-publication.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = "a".repeat(40), BASE = "b".repeat(40);

function req(extra = {}) {
  return {
    repository: "1alextest/Tesbooboo", actor: "1alextest",
    ref: "refs/heads/main", sourceBranch: "agent-candidate/feature",
    sourceSha: SOURCE, baseSha: BASE, ...extra
  };
}
function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "tesbo-agent-pr-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = path.join(dir, "origin.git");
  const producer = path.join(dir, "producer");
  const worker = path.join(dir, "worker");
  git(dir, "init", "--bare", origin);
  mkdirSync(producer);
  git(producer, "init", "-b", "development");
  git(producer, "config", "user.email", "fixture@example.invalid");
  git(producer, "config", "user.name", "Fixture");
  writeFileSync(path.join(producer, "keep.txt"), "before\n");
  writeFileSync(path.join(producer, "remove.txt"), "remove\n");
  git(producer, "add", "-A");
  git(producer, "commit", "-m", "fixture base");
  const baseSha = git(producer, "rev-parse", "HEAD");
  git(producer, "remote", "add", "origin", origin);
  git(producer, "push", "-u", "origin", "development");
  git(origin, "symbolic-ref", "HEAD", "refs/heads/development");
  git(producer, "switch", "-c", "agent-candidate/feature");
  writeFileSync(path.join(producer, "keep.txt"), "after\n");
  rmSync(path.join(producer, "remove.txt"));
  writeFileSync(path.join(producer, "new.txt"), "new\n");
  writeFileSync(path.join(producer, "bytes.bin"), Buffer.from([0, 255, 13, 10]));
  git(producer, "add", "-A");
  git(producer, "commit", "-m", "candidate content");
  const sourceSha = git(producer, "rev-parse", "HEAD");
  git(producer, "push", "-u", "origin", "agent-candidate/feature");
  git(dir, "clone", origin, worker);
  return { dir, origin, producer, worker, baseSha, sourceSha };
}

test("source identity and publisher dispatch deny owner/branch impersonation", () => {
  assert.equal(validateHandoff(req()).botBranch, "tesbo-agent/" + SOURCE);
  for (const change of [
    { actor: "other-user" }, { ref: "refs/heads/development" },
    { repository: "other/repo" }, { sourceBranch: "feature" },
    { sourceBranch: "agent-candidate/../main" },
    { sourceBranch: "agent-candidate/a;echo" },
    { sourceBranch: "agent-candidate/a--b" },
    { sourceSha: "main" }, { baseSha: "a".repeat(40) },
    { sourceSha: BASE, baseSha: BASE }
  ]) assert.throws(() => validateHandoff(req(change)));
});

test("protected policy and workflow paths do not enter an agent publisher", () => {
  for (const file of [
    ".github/workflows/evil.yml", ".github/assurance-policy.json",
    "AGENTS.md", "CLAUDE.md", "scripts/agent-pr-verify-publication.mjs",
    "scripts/assurance-pr-gate.mjs", "scripts/branch-rulesets.mjs", ".gitmodules"
  ]) assert.equal(isProtectedCandidatePath(file), true, file);
  for (const file of ["src/main.ts", "e2e/api/tests.spec.ts", "docs/qa-orchestration/00_README.md"]) {
    assert.equal(isProtectedCandidatePath(file), false, file);
  }
});

test("GitHub remote-ref check refuses unavailable/malformed and wrong refs", async () => {
  const fake = data => async () => ({ ok: true, json: async () => data });
  const branch = "agent-candidate/feature";
  const good = { ref: "refs/heads/" + branch, object: { type: "commit", sha: SOURCE } };
  assert.equal(await readRemoteHead(branch, "masked", fake(good)), SOURCE);
  await assert.rejects(readRemoteHead(branch, "masked", fake({ ...good, ref: "refs/heads/main" })));
  await assert.rejects(readRemoteHead(branch, "masked", fake({ ...good, object: { type: "tag", sha: SOURCE } })));
  await assert.rejects(readRemoteHead(branch, "", fake(good)));
  await assert.rejects(readRemoteHead(branch, "masked", async () => { throw new Error("secret-bearing transport"); }),
    /unavailable/);
});

test("real Git tree staging is exact, includes additions/deletions/binary, and makes no push", t => {
  const f = fixture(t);
  const request = validateHandoff(req({ sourceSha: f.sourceSha, baseSha: f.baseSha }));
  const before = git(f.worker, "rev-parse", "HEAD");
  const staged = stageExactCandidate(request, { cwd: f.worker });
  assert.equal(staged.fileCount, 4);
  assert.equal(staged.treeSha, git(f.producer, "rev-parse", f.sourceSha + "^{tree}"));
  assert.equal(git(f.worker, "rev-parse", "refs/remotes/origin/development"), before);
  assert.equal(readFileSync(path.join(f.worker, "keep.txt"), "utf8"), "after\n");
  assert.equal(readFileSync(path.join(f.worker, "bytes.bin")).length, 4);
  assert.deepEqual(git(f.worker, "diff", "--cached", "--name-only").split("\n"),
    ["bytes.bin", "keep.txt", "new.txt", "remove.txt"]);
});

test("stale source/base refusal happens before any checkout/mutation", t => {
  const f = fixture(t);
  const before = git(f.worker, "rev-parse", "HEAD");
  for (const change of [{ baseSha: SOURCE }, { sourceSha: SOURCE }]) {
    assert.throws(() => stageExactCandidate(validateHandoff(req({
      sourceSha: f.sourceSha, baseSha: f.baseSha, ...change
    })), { cwd: f.worker }));
    assert.equal(git(f.worker, "rev-parse", "HEAD"), before);
    assert.equal(git(f.worker, "status", "--porcelain"), "");
  }
});

test("protected candidate file change is refused without staging", t => {
  const f = fixture(t);
  git(f.producer, "switch", "agent-candidate/feature");
  mkdirSync(path.join(f.producer, ".github", "workflows"), { recursive: true });
  writeFileSync(path.join(f.producer, ".github", "workflows", "exfiltrate.yml"), "on: push\n");
  git(f.producer, "add", "-A");
  git(f.producer, "commit", "-m", "protected change");
  git(f.producer, "push", "origin", "agent-candidate/feature");
  git(f.worker, "fetch", "origin");
  const changedSource = git(f.producer, "rev-parse", "HEAD");
  assert.throws(() => stageExactCandidate(validateHandoff(req({
    sourceSha: changedSource, baseSha: f.baseSha
  })), { cwd: f.worker }), /protected/i);
  assert.equal(git(f.worker, "status", "--porcelain"), "");
});

test("bot publication requires native bot PR owner, signed HEAD, and matching commit identity", () => {
  const branch = "tesbo-agent/" + SOURCE;
  const pr = { number: 77, state: "open", draft: true,
    user: { login: "tesbo-publisher[bot]", type: "Bot" },
    base: { ref: "development" }, head: { ref: branch, sha: SOURCE,
      repo: { full_name: "1alextest/Tesbooboo" } } };
  const commit = { sha: SOURCE, commit: { tree: { sha: BASE }, verification: { verified: true, reason: "valid" } },
    committer: { login: "tesbo-publisher[bot]" } };
  assert.deepEqual(verifyPublishedPr({ pr, commit, appSlug: "tesbo-publisher", branch, expectedTreeSha: BASE }),
    { prNumber: 77, sha: SOURCE, bot: "tesbo-publisher[bot]" });
  for (const change of [
    { pr: { ...pr, user: { login: "1alextest", type: "User" } } },
    { pr: { ...pr, draft: false } },
    { pr: { ...pr, base: { ref: "main" } } },
    { commit: { ...commit, commit: { verification: { verified: false, reason: "unsigned" } } } },
    { commit: { ...commit, committer: { login: "1alextest" } } }
  ]) assert.throws(() => verifyPublishedPr({ pr, commit, appSlug: "tesbo-publisher", branch, expectedTreeSha: BASE, ...change }));
});

test("installed workflow never auto-merges, and bot token follows preflight", () => {
  const workflow = readFileSync(path.join(ROOT, "../.github/workflows/agent-pr-handoff.yml"), "utf8");
  const gate = workflow.indexOf("Validate exact HEADs, scope and stage equal tree");
  const token = workflow.indexOf("Obtain one-repository GitHub App token");
  assert.ok(gate > 0 && token > gate);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\bpull_request_target:|\bpush:\s*\n|auto-merge:\s*true/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /sign-commits: true/);
  assert.match(workflow, /draft: true/);
  assert.match(workflow, /permission-contents: write/);
  assert.match(workflow, /permission-pull-requests: write/);
});
