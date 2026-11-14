import { diffGraphSnapshots, type GraphChangeImpact, type GraphSnapshot } from "./graph-change-impact";

/**
 * A claim made by a snapshot producer, NOT proof of authoritative source
 * completeness or permission to read the underlying records.
 *
 * The service constructing this envelope must separately enforce access,
 * provenance, MVCC coherence and source-inventory correctness. A caller may
 * not supply or attest to its own source inventory through a public API.
 */
export interface GraphCaptureForComparison {
  snapshot: GraphSnapshot | null;
  /** Versioned projection algorithm, including included fields and edge semantics. */
  contractId: string;
  /** Fingerprint of scoped provider/mapping/connection identities and selection. */
  sourceScopeFingerprint: string;
  /** Must be determined by the trusted capture provider, not guessed from page size. */
  inventoryStatus: "complete" | "incomplete" | "unknown";
  /** Unresolved source references, ambiguous identities or source failures. */
  unresolvedDiagnostics: readonly string[];
}

function requireFilled(value: string, field: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Graph comparison unavailable: invalid ${field}`);
  }
}

function requireComparableCapture(capture: GraphCaptureForComparison, side: string): GraphSnapshot {
  if (!capture || typeof capture !== "object") {
    throw new Error(`Graph comparison unavailable: missing ${side} capture`);
  }
  requireFilled(capture.contractId, `${side} contractId`);
  requireFilled(capture.sourceScopeFingerprint, `${side} sourceScopeFingerprint`);
  if (capture.inventoryStatus !== "complete") {
    throw new Error(`Graph comparison unavailable: ${side} source inventory is not complete`);
  }
  if (!Array.isArray(capture.unresolvedDiagnostics) || capture.unresolvedDiagnostics.length !== 0) {
    throw new Error(`Graph comparison unavailable: ${side} has unresolved source diagnostics`);
  }
  if (!capture.snapshot) {
    throw new Error(`Graph comparison unavailable: ${side} snapshot is missing`);
  }
  return capture.snapshot;
}

/**
 * Strict, opt-in guard for a comparison across two *declared* complete captures.
 * This does not infer transitive impact, validate the source producer, or grant
 * release approval. A trustworthy adapter still needs its own integration tests.
 */
export function compareComparableGraphCaptures(
  before: GraphCaptureForComparison,
  after: GraphCaptureForComparison
): GraphChangeImpact {
  const previous = requireComparableCapture(before, "before");
  const current = requireComparableCapture(after, "after");
  if (before.contractId !== after.contractId) {
    throw new Error("Graph comparison unavailable: projection contracts differ");
  }
  if (before.sourceScopeFingerprint !== after.sourceScopeFingerprint) {
    throw new Error("Graph comparison unavailable: source scopes differ");
  }
  return diffGraphSnapshots(previous, current);
}
