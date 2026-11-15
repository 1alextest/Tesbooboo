import { createHash } from "node:crypto";
import type { GraphCaptureForComparison } from "./graph-comparison-gate";
import type { GraphEdge, GraphNode, GraphSnapshot } from "./graph-change-impact";

export type ImplementationConceptKind = "route" | "state" | "behavior" | "journey";

export interface SourceFileObservation {
  /** Normalized repository-relative file path. */
  path: string;
  /** SHA-256 of source bytes, computed by the trusted scanner. */
  contentSha256: string;
}

export interface SourceConceptObservation {
  kind: ImplementationConceptKind;
  /** Stable identifier within the source repository, e.g. route template. */
  key: string;
  /** The source location supporting this observed declaration. */
  filePath: string;
  lineStart: number;
  lineEnd: number;
  /** Source-backed declaration fingerprint, not a test result. */
  declarationSha256: string;
}

/**
 * The caller must independently verify repository identity, revision, full
 * inventory, source bytes and observation locations. No public endpoint or
 * agent-authored request may use this adapter as a provenance attestation.
 */
export interface TrustedSourceObservation {
  projectId: string;
  repositoryId: string;
  refName: string;
  commitSha: string;
  inventoryStatus: "complete" | "incomplete" | "unknown";
  files: readonly SourceFileObservation[];
  concepts: readonly SourceConceptObservation[];
}

export interface ImplementationGraphCapture extends GraphCaptureForComparison {
  observedCommitSha: string;
  sourceAttestation: "caller_must_verify";
  semantics: "declarations_not_runtime_verification";
  coverageAssertion: "none";
  executionAssertion: "none";
}

export const IMPLEMENTATION_PROJECTION_CONTRACT = "tesbo-implementation-declarations-v1";
const SHA256 = /^[0-9a-f]{64}$/;
const GIT_SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const TYPES: readonly string[] = ["route", "state", "behavior", "journey"];

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
function identity(parts: readonly string[]): string { return JSON.stringify(parts); }
function filled(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}
function validPath(path: unknown): path is string {
  return filled(path) && !path.startsWith("/") && !path.includes("\\") &&
    !path.includes("//") && !path.split("/").some((segment) => segment === "" ||
      segment === "." || segment === "..") && !/[\u0000-\u001f]/.test(path);
}
function reject(message: string): never { throw new Error(`Invalid source observation: ${message}`); }

/** Add source-declared nodes to the EXISTING graph shape, without guessed coverage edges. */
export function projectImplementationObservations(
  existing: GraphCaptureForComparison,
  source: TrustedSourceObservation
): ImplementationGraphCapture {
  if (!existing?.snapshot || existing.inventoryStatus !== "complete" ||
      !Array.isArray(existing.unresolvedDiagnostics) || existing.unresolvedDiagnostics.length ||
      !filled(existing.contractId) || !filled(existing.sourceScopeFingerprint)) {
    return reject("base graph capture is not complete");
  }
  if (!source || !filled(source.projectId) || !filled(source.repositoryId) ||
      !filled(source.refName) || !GIT_SHA.test(source.commitSha) ||
      source.inventoryStatus !== "complete" ||
      !Array.isArray(source.files) || !Array.isArray(source.concepts)) {
    return reject("missing complete versioned source inventory");
  }
  if (existing.snapshot.projectId !== source.projectId) reject("project mismatch");
  const nodes: GraphNode[] = [...existing.snapshot.nodes];
  const edges: GraphEdge[] = [...existing.snapshot.edges];
  const ids = new Set(nodes.map((node) => node.id));
  const paths = new Map<string, string>();
  for (const file of source.files) {
    if (!file || !validPath(file.path) || !SHA256.test(file.contentSha256)) reject("invalid file path/digest");
    if (paths.has(file.path)) reject("duplicate file path");
    const id = identity(["implementation_file", source.projectId, source.repositoryId, file.path]);
    if (ids.has(id)) reject("duplicate node identity");
    ids.add(id);
    paths.set(file.path, id);
    nodes.push({ id, type: "implementation_file", version: file.contentSha256 });
  }
  const concepts = new Set<string>();
  for (const concept of source.concepts) {
    if (!concept || !TYPES.includes(concept.kind) || !filled(concept.key) ||
        !paths.has(concept.filePath) || !SHA256.test(concept.declarationSha256) ||
        !Number.isSafeInteger(concept.lineStart) || concept.lineStart < 1 ||
        !Number.isSafeInteger(concept.lineEnd) || concept.lineEnd < concept.lineStart) {
      reject("invalid concept or missing supporting source file");
    }
    const id = identity(["source_declaration", source.projectId, source.repositoryId, concept.kind, concept.key]);
    if (concepts.has(id) || ids.has(id)) reject("duplicate concept identity");
    concepts.add(id);
    ids.add(id);
    nodes.push({
      id,
      type: `source_declared_${concept.kind}`,
      version: digest([concept.declarationSha256, concept.filePath, concept.lineStart, concept.lineEnd])
    });
    const fileId = paths.get(concept.filePath)!;
    edges.push({
      id: identity(["declared_in_source", id, fileId]),
      from: id,
      to: fileId,
      type: "declared_in_source",
      version: digest([concept.declarationSha256, concept.lineStart, concept.lineEnd])
    });
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => a.id.localeCompare(b.id));
  const scope = digest([
    IMPLEMENTATION_PROJECTION_CONTRACT, existing.contractId,
    existing.sourceScopeFingerprint, source.projectId, source.repositoryId, source.refName
  ]);
  const revision = digest([
    IMPLEMENTATION_PROJECTION_CONTRACT, existing.snapshot.revision,
    nodes.map((node) => [node.id, node.type, node.version]),
    edges.map((edge) => [edge.id, edge.type, edge.from, edge.to, edge.version])
  ]);
  const snapshot: GraphSnapshot = {
    projectId: source.projectId, revision, nodes, edges
  };
  return {
    snapshot,
    contractId: IMPLEMENTATION_PROJECTION_CONTRACT,
    sourceScopeFingerprint: scope,
    inventoryStatus: "complete",
    unresolvedDiagnostics: [],
    observedCommitSha: source.commitSha,
    sourceAttestation: "caller_must_verify",
    semantics: "declarations_not_runtime_verification",
    coverageAssertion: "none",
    executionAssertion: "none"
  };
}
