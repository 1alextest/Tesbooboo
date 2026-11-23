#!/usr/bin/env node
/**
 * Trusted default-branch entrypoint for a GitHub-App-authored PR handoff.
 * Reads a candidate's Git objects; NEVER runs candidate source code.
 * The write-capable app token is minted only AFTER this bounded staging step.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REPOSITORY = "1alextest/Tesbooboo";
const OWNER = "1alextest";
const SHA = /^[0-9a-f]{40}$/i;
const BRANCH = /^agent-candidate\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
const MAX_CHANGED_FILES = 100;

export function isProtectedCandidatePath(path) {
  return path === ".gitmodules" || path === "AGENTS.md" || path === "CLAUDE.md" ||
    path.startsWith(".github/") ||
    /^scripts\/(?:agent-pr-|assurance-pr-gate|publish-assurance-status|branch-rulesets)/.test(path);
}

export function validateHandoff(input) {
  const { repository, actor, ref, sourceBranch, sourceSha, baseSha } = input;
  if (repository !== REPOSITORY || actor !== OWNER || ref !== "refs/heads/main") {
    throw new Error("Only the repository owner may dispatch the installed main-branch publisher");
  }
  if (typeof sourceBranch !== "string" || sourceBranch.length > 100 ||
      !BRANCH.test(sourceBranch) || sourceBranch.includes("--") || sourceBranch.endsWith("-")) {
    throw new Error("Source must be a bounded agent-candidate/ branch");
  }
  if (!SHA.test(sourceSha ?? "") || !SHA.test(baseSha ?? "")) {
    throw new Error("Source and development base must be exact forty-character commit SHAs");
  }
  if (sourceSha.toLowerCase() === baseSha.toLowerCase()) {
    throw new Error("Candidate has no source change");
  }
  return {
    sourceBranch, sourceSha: sourceSha.toLowerCase(), baseSha: baseSha.toLowerCase(),
    botBranch: "tesbo-agent/" + sourceSha.toLowerCase()
  };
}

export async function readRemoteHead(branch, token, fetchImpl = fetch) {
  if (!token || typeof token !== "string") throw new Error("Read-only GitHub API credential is missing");
  const path = branch.split("/").map(encodeURIComponent).join("/");
  let response;
  try {
    response = await fetchImpl("https://api.github.com/repos/" + REPOSITORY + "/git/ref/heads/" + path, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28" },
      redirect: "error", signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new Error("Live repository ref is unavailable; no candidate staged");
  }
  if (!response.ok) throw new Error("Live repository ref cannot be verified; no candidate staged");
  let data;
  try { data = await response.json(); } catch {
    throw new Error("Malformed GitHub ref response; no candidate staged");
  }
  if (data?.ref !== "refs/heads/" + branch ||
      data?.object?.type !== "commit" || !SHA.test(data?.object?.sha ?? "")) {
    throw new Error("GitHub ref is not an exact commit; no candidate staged");
  }
  return data.object.sha.toLowerCase();
}

export function git(args, cwd = process.cwd()) {
  try {
    return execFileSync("git", args, {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 12 * 1024 * 1024
    }).trim();
  } catch {
    throw new Error("Candidate Git verification or staging failed at " + args[0]);
  }
}

export function stageExactCandidate(request, { cwd = process.cwd(), runGit = git } = {}) {
  const run = (...args) => runGit(args, cwd);
  if (run("status", "--porcelain")) throw new Error("Publisher worktree must start clean");
  const base = run("rev-parse", "refs/remotes/origin/development").toLowerCase();
  const sourceRef = "refs/remotes/origin/" + request.sourceBranch;
  const source = run("rev-parse", sourceRef).toLowerCase();
  if (base !== request.baseSha || source !== request.sourceSha) {
    throw new Error("Local source or development ref differs from the verified exact SHAs");
  }
  run("merge-base", "--is-ancestor", base, source);
  const changed = run("diff", "--name-only", "-z", "--no-renames", base, source)
    .split("\0").filter(Boolean);
  if (!changed.length || changed.length > MAX_CHANGED_FILES) {
    throw new Error("Candidate change-set is empty or outside the bounded file count");
  }
  if (changed.some(isProtectedCandidatePath)) {
    throw new Error("Candidate changes protected trusted policy/workflow files; use the separately reviewed security PR path");
  }

  // Work exclusively on a disposable local development checkout. Never push the
  // original candidate or protected branch. No candidate executable is invoked.
  run("switch", "-C", "development", base);
  run("restore", "--source=" + source, "--staged", "--worktree", "--", ":/");
  const stagedTree = run("write-tree");
  const sourceTree = run("rev-parse", source + "^{tree}");
  if (stagedTree !== sourceTree || !run("diff", "--cached", "--name-only")) {
    throw new Error("Staged tree differs from the pinned candidate; refuse publication");
  }
  return { ...request, fileCount: changed.length, treeSha: stagedTree };
}

export async function prepareHandoff(env = process.env, { cwd, fetchImpl, runGit } = {}) {
  const request = validateHandoff({
    repository: env.GITHUB_REPOSITORY, actor: env.GITHUB_ACTOR,
    ref: env.GITHUB_REF, sourceBranch: env.SOURCE_BRANCH,
    sourceSha: env.SOURCE_SHA, baseSha: env.BASE_SHA
  });
  // An authenticated read verifies that refs have not moved since checkout. An
  // unavailable GitHub API is a denial, never an excuse to trust stale local refs.
  const [base, source] = await Promise.all([
    readRemoteHead("development", env.GITHUB_TOKEN, fetchImpl),
    readRemoteHead(request.sourceBranch, env.GITHUB_TOKEN, fetchImpl)
  ]);
  if (base !== request.baseSha || source !== request.sourceSha) {
    throw new Error("Source or development branch moved after the pinned request");
  }
  return stageExactCandidate(request, { cwd, runGit });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareHandoff().then(result => {
    if (!process.env.GITHUB_OUTPUT) throw new Error("GitHub output destination is unavailable");
    appendFileSync(process.env.GITHUB_OUTPUT,
      ["bot_branch=" + result.botBranch, "source_sha=" + result.sourceSha,
       "base_sha=" + result.baseSha, "source_branch=" + result.sourceBranch,
       "file_count=" + result.fileCount].join("\n") + "\n");
    console.log("Candidate staged with exact tree identity; " + result.fileCount + " changed files");
  }).catch(error => {
    console.error("Agent PR handoff refused: " + error.message);
    process.exitCode = 1;
  });
}
