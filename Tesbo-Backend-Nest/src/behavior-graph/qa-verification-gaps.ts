import type { QaRunCaseLink } from "./graph-review-run-links";

/**
 * An assessment of remaining human QA work derived only from the committed
 * review receipt and current canonical Tesbo run links. It is NOT coverage,
 * deployed-build attestation, evidence-byte verification, or approval.
 */
export interface QaVerificationGaps {
  nominatedCaseCount: number;
  selectedCaseCount: number;
  notSelectedCount: number;
  withoutSubsequentResultCount: number;
  withSubsequentResultCount: number;
  withLaterEvidenceMetadataCount: number;
  historicalResultOnlyCount: number;
  invalidOrRepeatedNominationCount: number;
  unlinkedCaseNodeCount: number;
  observedChangeCount: number;
  sourceOnlyChangeNeedsTriage: boolean;
  coverageAssertion: "none";
  approvalAssertion: "none";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function candidateId(value: unknown, projectId: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const node = (value as { caseNodeId?: unknown }).caseNodeId;
  if (typeof node !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(node);
    if (!Array.isArray(parsed) || parsed.length !== 3 ||
        parsed[0] !== "test_case" || parsed[1] !== projectId ||
        typeof parsed[2] !== "string" || !UUID.test(parsed[2])) return null;
    return parsed[2].toLowerCase();
  } catch { return null; }
}

function countChanged(receipt: Record<string, unknown>): number {
  const changed = receipt.changed;
  if (!changed || typeof changed !== "object" || Array.isArray(changed)) return 0;
  const ids = new Set<string>();
  for (const key of ["addedNodeIds", "modifiedNodeIds", "removedNodeIds",
    "addedEdgeIds", "modifiedEdgeIds", "removedEdgeIds"]) {
    const values = (changed as Record<string, unknown>)[key];
    if (!Array.isArray(values)) continue;
    for (const value of values) if (typeof value === "string") ids.add(key + ":" + value);
  }
  return ids.size;
}

export function summarizeQaVerificationGaps(
  projectId: string, receipt: unknown, links: readonly QaRunCaseLink[]
): QaVerificationGaps {
  const r = receipt && typeof receipt === "object" && !Array.isArray(receipt)
    ? receipt as Record<string, unknown> : {};
  const raw = Array.isArray(r.candidates) ? r.candidates : [];
  const ids = new Set<string>();
  let invalidOrRepeatedNominationCount = 0;
  for (const entry of raw) {
    const id = candidateId(entry, projectId);
    if (!id || ids.has(id)) invalidOrRepeatedNominationCount++;
    else ids.add(id);
  }

  let selectedCaseCount = 0, withSubsequentResultCount = 0;
  let withLaterEvidenceMetadataCount = 0, historicalResultOnlyCount = 0;
  for (const id of ids) {
    const selected = links.filter((link) => link.caseId.toLowerCase() === id);
    if (selected.length) selectedCaseCount++;
    const subsequent = selected.some((link) => link.execution &&
      link.execution.executedAfterHandoff && link.execution.executedAt &&
      link.execution.status !== "Untested");
    if (subsequent) withSubsequentResultCount++;
    if (selected.some((link) => (link.execution?.evidenceAddedAfterHandoffCount ?? 0) > 0)) {
      withLaterEvidenceMetadataCount++;
    }
    if (!subsequent && selected.some((link) => link.execution &&
      link.execution.executedAt && !link.execution.executedAfterHandoff &&
      link.execution.status !== "Untested")) historicalResultOnlyCount++;
  }

  const count = ids.size;
  const observedChangeCount = countChanged(r);
  return {
    nominatedCaseCount: count,
    selectedCaseCount,
    notSelectedCount: count - selectedCaseCount,
    withoutSubsequentResultCount: count - withSubsequentResultCount,
    withSubsequentResultCount,
    withLaterEvidenceMetadataCount,
    historicalResultOnlyCount,
    invalidOrRepeatedNominationCount,
    unlinkedCaseNodeCount: Array.isArray(r.unlinkedCaseNodeIds) ? r.unlinkedCaseNodeIds.length : 0,
    observedChangeCount,
    sourceOnlyChangeNeedsTriage: count === 0 && observedChangeCount > 0,
    coverageAssertion: "none",
    approvalAssertion: "none"
  };
}
