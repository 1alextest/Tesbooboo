import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import type { PinnedSourceReader } from "./implementation-source-verifier";

const exec = promisify(execFile);
const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const MAX_TREE_BYTES = 2 * 1024 * 1024;
const MAX_BLOB_BYTES = 2 * 1024 * 1024;

/**
 * Read-only Git object adapter over a server-CONFIGURED local checkout.
 *
 * This is a low-level port, not a source-authority or project-access service.
 * A future trusted caller must bind repositoryId/root/ref to a project and
 * authorize the requested action before constructing/invoking this reader.
 * Never accept root or repositoryId from an arbitrary MCP/REST payload.
 */
export class LocalPinnedGitSourceReader implements PinnedSourceReader {
  private constructor(
    readonly repositoryId: string,
    private readonly root: string
  ) {}

  static async fromConfiguredCheckout(repositoryId: string, configuredRoot: string) {
    if (!repositoryId || !repositoryId.trim() || !configuredRoot) {
      throw new Error("Git source reader requires configured repository identity and root");
    }
    const root = await realpath(configuredRoot);
    // Resolve one repo, not a caller-controlled -C path or Git environment.
    const { stdout } = await exec("git", ["-C", root, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", maxBuffer: 4096, timeout: 10000
    });
    if (await realpath(stdout.trim()) !== root) {
      throw new Error("Configured Git root must be the repository top level");
    }
    return new LocalPinnedGitSourceReader(repositoryId, root);
  }

  private async git(args: readonly string[], maxBuffer = MAX_TREE_BYTES): Promise<Buffer> {
    const { stdout } = await exec("git", ["-C", this.root, ...args], {
      encoding: "buffer", maxBuffer, timeout: 10000
    });
    if (!Buffer.isBuffer(stdout)) throw new Error("Git command did not return raw bytes");
    return stdout;
  }

  async resolveRef(refName: string): Promise<string> {
    if (!REF.test(refName) || refName.includes("..") ||
        refName.includes("//") || refName.endsWith("/") ||
        refName.split("/").some((part) => part.startsWith("."))) {
      throw new Error("Invalid configured Git branch name");
    }
    // Only locally present branch refs; do not fetch, follow arbitrary tags,
    // read a mutable working tree, or execute shell input.
    const result = await this.git(["rev-parse", "--verify", `refs/heads/${refName}^{commit}`], 4096);
    const sha = result.toString("utf8").trim();
    if (!GIT_SHA.test(sha)) throw new Error("Git ref did not resolve to a commit");
    return sha;
  }

  private async entries(commitSha: string): Promise<Array<{ path: string; mode: string; type: string }>> {
    if (!GIT_SHA.test(commitSha)) throw new Error("Invalid Git commit SHA");
    const result = await this.git(["ls-tree", "-r", "-z", "--full-tree", commitSha]);
    const records = result.toString("utf8").split("\0").filter(Boolean);
    return records.map((record) => {
      const tab = record.indexOf("\t");
      const header = record.slice(0, tab).split(" ");
      const path = record.slice(tab + 1);
      if (tab < 0 || header.length !== 3) throw new Error("Malformed Git tree entry");
      const [mode, type] = header;
      // Reject links and submodules rather than silently following them.
      if (!["100644", "100755"].includes(mode) || type !== "blob") {
        throw new Error("Unsupported Git object: symlink, submodule or non-file");
      }
      return { path, mode, type };
    });
  }

  async listFilesAtCommit(commitSha: string): Promise<readonly string[]> {
    return (await this.entries(commitSha)).map((entry) => entry.path);
  }

  async readFileAtCommit(commitSha: string, path: string): Promise<Buffer> {
    if (!GIT_SHA.test(commitSha) || !path || path.startsWith("/") ||
        path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..")) {
      throw new Error("Invalid pinned Git source path");
    }
    const entry = (await this.entries(commitSha)).find((row) => row.path === path);
    if (!entry) throw new Error("File is not in the selected Git commit");
    // Exact object bytes from Git's object database, not from the checkout.
    // maxBuffer enforces a hard cap even if the blob size is unexpected.
    return this.git(["show", `${commitSha}:${path}`], MAX_BLOB_BYTES + 1024);
  }
}
