import { execFileSync } from "node:child_process";

const commitPattern = /^[a-f\d]{40}(?:[a-f\d]{24})?$/i;
const git = (args, cwd, encoding = "utf8") => execFileSync("git", args, {
  cwd, encoding, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]
});
const requireCommit = (commit) => {
  if (typeof commit !== "string" || !commitPattern.test(commit)) throw new Error("Expected a verified Git commit SHA.");
};

/** Resolve once; every quality gate compares the same ancestor, never a guessed branch. */
export function resolveBase(ref, { cwd = process.cwd() } = {}) {
  if (typeof ref !== "string" || !ref.trim() || ref.startsWith("-") || /[\0\r\n]/.test(ref)) {
    throw new Error("An explicit valid --base Git ref is required.");
  }
  try {
    const commit = git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], cwd).trim();
    requireCommit(commit);
    const base = git(["merge-base", commit, "HEAD"], cwd).trim();
    requireCommit(base);
    return base;
  } catch {
    throw new Error(`Cannot resolve --base ${JSON.stringify(ref)} and its merge base with HEAD. Fetch the base history; do not substitute an empty selection.`);
  }
}

/** NUL-separated paths retain spaces/brackets; disabling renames retains both old and new paths. */
export function changedPaths(commit, { cwd = process.cwd() } = {}) {
  requireCommit(commit);
  return git(["diff", "--name-only", "--no-renames", "-z", commit, "--"], cwd)
    .split("\0").filter(Boolean).map((name) => name.replaceAll("\\", "/")).sort();
}

export function readGitFile(commit, filename, { cwd = process.cwd() } = {}) {
  requireCommit(commit);
  if (typeof filename !== "string" || !filename || /^[\\/]|^[a-z]:/i.test(filename) || /[\0\r\n]/.test(filename) ||
      filename.replaceAll("\\", "/").split("/").includes("..")) {
    throw new Error("Expected a repository-relative Git path.");
  }
  filename = filename.replaceAll("\\", "/");
  // Absence is an expected bootstrap state; Git failures must still throw.
  const files = git(["ls-tree", "-r", "--name-only", "-z", commit, "--", filename], cwd).split("\0");
  if (!files.includes(filename)) return null;
  return git(["cat-file", "blob", `${commit}:${filename}`], cwd);
}

/** Mode-aware tree inventory for append-only SQL; never follow symlink blobs. */
export function listGitTree(commit, prefix, { cwd = process.cwd() } = {}) {
  requireCommit(commit);
  if (typeof prefix !== "string" || !/^[a-z\d_.-]+(?:\/[a-z\d_.-]+)*\/?$/i.test(prefix) ||
      prefix.split("/").includes("..")) throw new Error("Expected a safe repository tree prefix.");
  const records = git(["ls-tree", "-r", "-t", "-z", "--full-tree", commit, "--", prefix], cwd).split("\0");
  if (records.pop() !== "") throw new Error("Malformed Git tree metadata: expected NUL-terminated records.");
  return records.map((record) => {
    const match = /^([0-7]{6}) ([a-z]+) ([a-f\d]+)\t(.+)$/s.exec(record);
    if (!match || !commitPattern.test(match[3])) throw new Error("Malformed Git tree metadata.");
    return { mode: match[1], type: match[2], objectId: match[3], path: match[4] };
  });
}

/** Raw bytes matter for SQL checksums, including invalid UTF-8 and newline policy. */
export function readGitBlob(objectId, { cwd = process.cwd() } = {}) {
  requireCommit(objectId);
  return git(["cat-file", "blob", objectId], cwd, null);
}
