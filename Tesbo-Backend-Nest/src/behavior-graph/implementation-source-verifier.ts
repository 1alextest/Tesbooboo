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
  /** Server-approved, complete selection. Empty/omitted means entire repository. */
  selectionPrefixes?: readonly string[];
}

const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_FILES = 2000;
const MAX_TREE_ENTRIES = 100000;
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
  const prefixes = request.selectionPrefixes ?? [];
  if (!Array.isArray(prefixes) || prefixes.length > 32 ||
      prefixes.some((prefix) => !goodPath(prefix)) ||
      new Set(prefixes).size !== prefixes.length) fail("invalid source selection");
  const canonicalPrefixes = [...prefixes].sort();
  const paths = await reader.listFilesAtCommit(resolvedSha);
  if (!Array.isArray(paths) || paths.length > MAX_TREE_ENTRIES) fail("source inventory missing or exceeds limit");
  const seen = new Set<string>();
  for (const path of paths) {
    if (!goodPath(path) || seen.has(path)) fail("invalid or duplicate source tree path");
    seen.add(path);
  }
  const selected = canonicalPrefixes.length
    ? paths.filter((path) => canonicalPrefixes.some((prefix) => path === prefix || path.startsWith(prefix + "/")))
    : paths;
  if (!selected.length) fail("selected source scope is empty");
  if (selected.length > MAX_FILES) fail("selected source inventory exceeds limit");
  const files: Array<{ path: string; contentSha256: string }> = [];
  const lines = new Map<string, string[]>();
  let totalBytes = 0;
  for (const path of selected) {
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
    const sourceLines = content.slice(proposed.lineStart - 1, proposed.lineEnd).join("\n");
    if (!sourceLines.trim()) fail("declaration has no nonblank source evidence");
    const actual = hash(sourceLines);
    if (actual !== proposed.declarationSha256) fail("declaration bytes do not match source");
    concepts.push({ ...proposed });
  }
  return {
    projectId: request.projectId,
    repositoryId: reader.repositoryId,
    refName: request.refName,
    commitSha: resolvedSha,
    inventoryStatus: "complete",
    selectionPrefixes: canonicalPrefixes,
    files,
    concepts
  };
}


/**
 * Internal branded receipt of byte-verified source data. This guards against
 * accidental JSON/request objects reaching persistence. Real trust still
 * depends on the server-approved Git reader and project binding.
 */
export class VerifiedPinnedSource {
  private constructor(readonly value: TrustedSourceObservation) { Object.freeze(this); }

  static async capture(reader: PinnedSourceReader, request: SourceVerificationRequest): Promise<VerifiedPinnedSource> {
    const observation = await captureVerifiedSourceDeclarations(reader, request);
    const immutable: TrustedSourceObservation = Object.freeze({
      ...observation,
      files: Object.freeze(observation.files.map((file) => Object.freeze({ ...file }))),
      concepts: Object.freeze(observation.concepts.map((concept) => Object.freeze({ ...concept }))),
      selectionPrefixes: Object.freeze([...(observation.selectionPrefixes ?? [])])
    });
    return new VerifiedPinnedSource(immutable);
  }
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
