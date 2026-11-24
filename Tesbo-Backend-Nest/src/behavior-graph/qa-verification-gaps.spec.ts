import { summarizeQaVerificationGaps } from "./qa-verification-gaps";
import type { QaRunCaseLink } from "./graph-review-run-links";

const PROJECT = "00000000-0000-4000-8000-000000000001";
const A = "00000000-0000-4000-8000-000000000002";
const B = "00000000-0000-4000-8000-000000000003";
const C = "00000000-0000-4000-8000-000000000004";
const node = (id: string, project = PROJECT) => JSON.stringify(["test_case", project, id]);
const candidate = (id: string) => ({ caseNodeId: node(id) });
function link(id: string, execution: QaRunCaseLink["execution"]): QaRunCaseLink {
  return { runId: "00000000-0000-4000-8000-000000000010", caseId: id,
    linkedAt: "2026-11-15T12:00:00Z", runName: "QA triage", runStatus: "In Progress",
    caseStillInRun: true, execution };
}

describe("read-only QA verification gap assessment", () => {
  it("reports source-only changes as needing triage, not as zero impact or verified coverage", () => {
    const result = summarizeQaVerificationGaps(PROJECT, {
      candidates: [],
      changed: { modifiedNodeIds: ["source:changed"], addedEdgeIds: [] }
    }, []);
    expect(result).toMatchObject({
      nominatedCaseCount: 0, observedChangeCount: 1,
      sourceOnlyChangeNeedsTriage: true,
      coverageAssertion: "none", approvalAssertion: "none"
    });
  });

  it("does not classify a handoff or an Untested execution as verification", () => {
    const result = summarizeQaVerificationGaps(PROJECT, {
      candidates: [candidate(A), candidate(B), candidate(C)],
      unlinkedCaseNodeIds: [node(C)]
    }, [link(A, null), link(B, {
      id: "e", status: "Untested", executedAt: null, executedAfterHandoff: false,
      actualResultRecorded: false, defectKey: null,
      evidenceFileCount: 0, evidenceAddedAfterHandoffCount: 0
    })]);
    expect(result).toMatchObject({
      nominatedCaseCount: 3, selectedCaseCount: 2, notSelectedCount: 1,
      withSubsequentResultCount: 0, withoutSubsequentResultCount: 3,
      withLaterEvidenceMetadataCount: 0, unlinkedCaseNodeCount: 1
    });
  });

  it("separates historical Failed history from subsequent native results and file metadata", () => {
    const historical = link(A, {
      id: "e1", status: "Failed", executedAt: "2026-11-14T00:00:00Z",
      executedAfterHandoff: false, actualResultRecorded: true,
      defectKey: "BUG-1", evidenceFileCount: 2, evidenceAddedAfterHandoffCount: 0
    });
    const later = link(B, {
      id: "e2", status: "Blocked", executedAt: "2026-11-15T13:00:00Z",
      executedAfterHandoff: true, actualResultRecorded: true,
      defectKey: null, evidenceFileCount: 1, evidenceAddedAfterHandoffCount: 1
    });
    expect(summarizeQaVerificationGaps(PROJECT, {
      candidates: [candidate(A), candidate(B)]
    }, [historical, later])).toMatchObject({
      selectedCaseCount: 2, notSelectedCount: 0,
      historicalResultOnlyCount: 1, withSubsequentResultCount: 1,
      withoutSubsequentResultCount: 1, withLaterEvidenceMetadataCount: 1,
      approvalAssertion: "none"
    });
  });

  it("preserves a soft-removed handoff without counting it as current case selection or verification", () => {
    const removed = { ...link(A, null), caseStillInRun: false };
    const active = link(B, null);
    expect(summarizeQaVerificationGaps(PROJECT, {
      candidates: [candidate(A), candidate(B), candidate(C)]
    }, [removed, active])).toMatchObject({
      nominatedCaseCount: 3, selectedCaseCount: 1, notSelectedCount: 2,
      historicalSelectionOnlyCount: 1, withoutSubsequentResultCount: 3,
      withSubsequentResultCount: 0, coverageAssertion: "none", approvalAssertion: "none"
    });
    const restored = { ...removed, caseStillInRun: true };
    expect(summarizeQaVerificationGaps(PROJECT, { candidates: [candidate(A)] }, [restored]))
      .toMatchObject({ selectedCaseCount: 1, notSelectedCount: 0, historicalSelectionOnlyCount: 0 });
  });

  it("deduplicates nominated cases, excludes foreign/malformed nodes, and never promotes status", () => {
    const result = summarizeQaVerificationGaps(PROJECT, {
      candidates: [candidate(A), candidate(A),
        { caseNodeId: node(B, C) }, { caseNodeId: "not JSON" },
        { caseNodeId: node(B) }, { caseNodeId: 3 }]
    }, [link(A, null), link(C, null)]);
    expect(result).toMatchObject({
      nominatedCaseCount: 2, selectedCaseCount: 1,
      invalidOrRepeatedNominationCount: 4,
      withSubsequentResultCount: 0, coverageAssertion: "none"
    });
  });
});
