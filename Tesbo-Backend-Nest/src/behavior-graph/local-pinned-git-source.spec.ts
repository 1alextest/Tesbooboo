import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalPinnedGitSourceReader } from "./local-pinned-git-source";
import { captureVerifiedSourceDeclarations } from "./implementation-source-verifier";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

describe("real local pinned Git source reader", () => {
  let root: string;
  let commit: string;
  let reader: LocalPinnedGitSourceReader;
  const source = "export const route = '/login';\n";
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "tesbo-graph-git-"));
    execFileSync("git", ["init", "-b", "development", root], { stdio: "pipe" });
    git("config", "user.name", "Tesbo CI");
    git("config", "user.email", "tesbo@invalid.test");
    writeFileSync(join(root, "login.ts"), source);
    git("add", "login.ts");
    git("commit", "-m", "baseline");
    commit = git("rev-parse", "HEAD");
    reader = await LocalPinnedGitSourceReader.fromConfiguredCheckout("test/application", root);
  });

  afterAll(() => { if (root) rmSync(root, { recursive: true, force: true }); });

  it("resolves a real immutable branch and verifies bytes against Git, not the worktree", async () => {
    expect(await reader.resolveRef("development")).toBe(commit);
    expect(await reader.listFilesAtCommit(commit)).toEqual(["login.ts"]);
    writeFileSync(join(root, "login.ts"), "uncommitted modifications");
    expect((await reader.readFileAtCommit(commit, "login.ts")).toString()).toBe(source);
    const observation = await captureVerifiedSourceDeclarations(reader, {
      projectId: "p1", refName: "development", expectedCommitSha: commit,
      proposedConcepts: [{
        kind: "route", key: "GET /login", filePath: "login.ts",
        lineStart: 1, lineEnd: 1, declarationSha256: digest(source.trimEnd())
      }]
    });
    expect(observation.files[0].contentSha256).toBe(digest(source));
    expect(observation.concepts).toHaveLength(1);
  });

  it("refuses branch movement between requested version and actual Git HEAD", async () => {
    git("add", "login.ts");
    git("commit", "-m", "changed");
    await expect(captureVerifiedSourceDeclarations(reader, {
      projectId: "p1", refName: "development", expectedCommitSha: commit,
      proposedConcepts: []
    })).rejects.toThrow("ref moved");
  });

  it("rejects invalid ref names and unavailable paths rather than running Git arguments", async () => {
    await expect(reader.resolveRef("--upload-pack=/bin/sh")).rejects.toThrow("Invalid");
    await expect(reader.resolveRef("../main")).rejects.toThrow("Invalid");
    await expect(reader.readFileAtCommit(commit, "../.git/config")).rejects.toThrow("Invalid");
    await expect(reader.readFileAtCommit(commit, "untracked.txt")).rejects.toThrow("not in");
  });

  it("fails closed on symlinks in the pinned tree", async () => {
    symlinkSync("login.ts", join(root, "alias.ts"));
    git("add", "alias.ts");
    git("commit", "-m", "symlink");
    const latest = git("rev-parse", "HEAD");
    await expect(reader.listFilesAtCommit(latest)).rejects.toThrow("Unsupported Git object");
  });
});
