import { createHash } from "node:crypto";
import { projectImplementationObservations, type SourceConceptObservation, type TrustedSourceObservation } from "./implementation-observation-graph";
import type { GraphCaptureForComparison } from "./graph-comparison-gate";

/**
 * Port implemented by an INTERNAL authenticated source integration. It must
 * resolve a real immutable commit and read its tree/blob bytes. Never construct
 * this port from an MCP/REST request or trust agent-supplied "verified" flags.
 */
export interface PinnedSourceReader {
  readonly repositoryId: string;
  resolveRef(refName: string): Promise<string>;
  listFilesAtCommit(commitSha: string): Promise<readonly string[]>;
  readFileAtCommit(commitSha: string, path: string): Promise<Buffer>;
}

export interface SourceVerificationRequest {
  projectId: string;
  refName: string;
  /** A verified commit selection, never accepted as proof by itself. */
  expectedCommitSha: string;
  /** Untrusted proposed declarations; locations and hashes must be read back. */
  proposedConcepts: readonly SourceConceptObservation[];
}

const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_FILES = 2000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_CONCEPTS = 4000;

const hash = (bytes: Buffer | string): string => createHash("sha256").update(bytes).digest("hex");
function fail(message: string): never { throw new Error(`Source verification failed: ${message}`); }
function goodPath(path: unknown): path is string {
  return typeof path === "string" && path.length > 0 &&
    !path.startsWith("/") && !path.includes("\\") &&
    path.split("/").every((section) => section.length > 0 && section !== "." && section !== "..") &&
    !/[\u0000-\u001f]/.test(path);
}

/**
 * Builds a source observation from the actual commit tree and exact file bytes.
 * It does not infer route/behavior semantics: a candidate declaration is only
 * evidence that those exact source lines exist, not that the code runs.
 *
 * The verified reader MUST be owned/configured by the server (including repo
 * allowlist, credentials, project membership and immutable commit resolution).
 * This function does not implement those authorization/integration duties.
 */
export async function captureVerifiedSourceDeclarations(
  reader: PinnedSourceReader,
  request: SourceVerificationRequest
): Promise<TrustedSourceObservation> {
  if (!reader || !reader.repositoryId || !request ||
      !request.projectId || !request.refName || !GIT_SHA.test(request.expectedCommitSha) ||
      !Array.isArray(request.proposedConcepts) || request.proposedConcepts.length > MAX_CONCEPTS) {
    fail("invalid project, repository, revision or declaration request");
  }
  const resolvedSha = await reader.resolveRef(request.refName);
  if (!GIT_SHA.test(resolvedSha) || resolvedSha !== request.expectedCommitSha) {
    fail("ref moved or resolved commit does not match requested commit");
  }
  const paths = await reader.listFilesAtCommit(resolvedSha);
  if (!Array.isArray(paths) || paths.length > MAX_FILES) fail("source inventory missing or exceeds limit");
  const seen = new Set<string>();
  for (const path of paths) {
    if (!goodPath(path) || seen.has(path)) fail("invalid or duplicate source tree path");
    seen.add(path);
  }
  const files: Array<{ path: string; contentSha256: string }> = [];
  const lines = new Map<string, string[]>();
  let totalBytes = 0;
  for (const path of paths) {
    // The internal integration must reject symlink/submodule entries and return
    // the bytes of a regular blob at this exact commit. Do not follow disk links.
    const bytes = await reader.readFileAtCommit(resolvedSha, path);
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_FILE_BYTES) fail("not a regular bounded source blob");
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) fail("source inventory exceeds byte budget");
    // Require lossless UTF-8 for source-line declarations; binary files cannot
    // be quoted as behavioral evidence.
    const decoded = bytes.toString("utf8");
    if (!Buffer.from(decoded, "utf8").equals(bytes)) fail("non-UTF8 source bytes");
    files.push({ path, contentSha256: hash(bytes) });
    lines.set(path, decoded.split(/\r?\n/));
  }
  const concepts: SourceConceptObservation[] = [];
  const conceptKeys = new Set<string>();
  for (const proposed of request.proposedConcepts) {
    if (!proposed || !["route", "state", "behavior", "journey"].includes(proposed.kind) ||
        typeof proposed.key !== "string" || !proposed.key.trim() ||
        !goodPath(proposed.filePath) ||
        !Number.isSafeInteger(proposed.lineStart) || !Number.isSafeInteger(proposed.lineEnd) ||
        proposed.lineStart < 1 || proposed.lineEnd < proposed.lineStart ||
        !SHA256.test(proposed.declarationSha256)) fail("malformed proposed source declaration");
    const content = lines.get(proposed.filePath);
    if (!content || proposed.lineEnd > content.length) fail("declaration references missing source lines");
    const identity = JSON.stringify([proposed.kind, proposed.key]);
    if (conceptKeys.has(identity)) fail("duplicate declaration identity");
    conceptKeys.add(identity);
    // Canonical line-range hash; a declaration cannot claim a digest for
    // content that is absent from this immutable pinned commit.
    const actual = hash(content.slice(proposed.lineStart - 1, proposed.lineEnd).join("\n"));
    if (actual !== proposed.declarationSha256) fail("declaration bytes do not match source");
    concepts.push({ ...proposed });
  }
  return {
    projectId: request.projectId,
    repositoryId: reader.repositoryId,
    refName: request.refName,
    commitSha: resolvedSha,
    inventoryStatus: "complete",
    files,
    concepts
  };
}

/** Single adapter path; downstream graph provenance remains caller-attested. */
export async function projectFromVerifiedSource(
  base: GraphCaptureForComparison,
  reader: PinnedSourceReader,
  request: SourceVerificationRequest
) {
  const observation = await captureVerifiedSourceDeclarations(reader, request);
  return projectImplementationObservations(base, observation);
}
