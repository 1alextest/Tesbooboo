"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  approveRequirementVersion,
  getKnowledgeDocument,
  getKnowledgeDocumentVersion,
  getRequirementCoverage,
  type KnowledgeDocument,
  type KnowledgeDocumentVersionDetail,
  type RequirementCoverage,
  type RequirementCoverageCase,
} from "@/lib/api";
import { Button, Card, StatusChip } from "@/components/ui";
import { VersionContent } from "@/components/knowledge-base/GovernedVersionContent";
import { formatDateTime } from "@/lib/date";

type Criterion = { key: string; text: string; normative: boolean };

function criteriaOf(version: KnowledgeDocumentVersionDetail | null): Criterion[] {
  const json = version?.contentJson as { criteria?: unknown } | null;
  if (!Array.isArray(json?.criteria)) return [];
  return json.criteria
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const key = String(item.key ?? "").trim();
      const text = String(item.text ?? "").trim();
      return key && text ? { key, text, normative: item.normative !== false } : null;
    })
    .filter((entry): entry is Criterion => entry !== null);
}

function descriptionOf(version: KnowledgeDocumentVersionDetail | null): string {
  const json = version?.contentJson as { description?: unknown } | null;
  return typeof json?.description === "string" ? json.description : "";
}

function reviewState(document: KnowledgeDocument | null, reviewed: KnowledgeDocumentVersionDetail | null, versionId: string) {
  const sourceVersionId = reviewed?.snapshotMetadata?.sourceVersionId;
  if (reviewed && reviewed.snapshotKind === "approved" && sourceVersionId === versionId) {
    return { approved: true, currentBasis: true, label: `Approved as v${reviewed.versionNumber}` };
  }
  if (reviewed && reviewed.snapshotKind !== "approved") {
    return { approved: false, currentBasis: false, label: "The document's reviewed version is not an approved snapshot" };
  }
  if (reviewed) {
    return { approved: false, currentBasis: false, label: `The current approved basis is v${reviewed.versionNumber} from a different submission` };
  }
  return { approved: false, currentBasis: true, label: document?.status === "approved" ? "Approved, but no exact snapshot is bound" : "Submitted, awaiting human approval" };
}

const REASON_LABELS: Record<string, string> = {
  REQUIREMENT_VERSION_SUPERSEDED: "Linked to a submission that is not the current approved version",
  CASE_REVISION_CHANGED_OR_NOT_APPROVED: "The case is not currently approved at the linked revision",
  NO_QUALIFYING_ATTEMPT: "No persisted attempt on the exact approved case basis",
};

function coverageReadingTone(value: boolean): "success" | "neutral" {
  return value ? "success" : "neutral";
}

function versionBasisLabel(item: RequirementCoverageCase, coverage: RequirementCoverage): string {
  if (coverage.approvedVersionId && item.requirementVersionId === coverage.approvedVersionId) return "approved version";
  if (coverage.latestSubmittedVersionId && item.requirementVersionId === coverage.latestSubmittedVersionId) return "submitted version";
  return "historical version";
}

export function RequirementReviewPanel({ projectId, documentId, versionId, canApprove }: {
  projectId: string;
  documentId: string;
  versionId: string;
  canApprove: boolean;
}) {
  const [document, setDocument] = useState<KnowledgeDocument | null>(null);
  const [version, setVersion] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [reviewedVersion, setReviewedVersion] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentNonce, setContentNonce] = useState(0);

  const [coverage, setCoverage] = useState<RequirementCoverage | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [coverageNonce, setCoverageNonce] = useState(0);

  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvedNotice, setApprovedNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const contentRequest = useRef(0);
  const coverageRequest = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadContent = useCallback(async () => {
    const request = ++contentRequest.current;
    const isCurrent = () => mounted.current && request === contentRequest.current;
    setContentLoading(true);
    setContentError(null);
    try {
      const [doc, submitted] = await Promise.all([
        getKnowledgeDocument(projectId, documentId),
        getKnowledgeDocumentVersion(projectId, documentId, versionId),
      ]);
      const reviewed = doc.reviewedVersionId
        ? await getKnowledgeDocumentVersion(projectId, documentId, doc.reviewedVersionId)
        : null;
      if (!isCurrent()) return;
      setDocument(doc);
      setVersion(submitted);
      setReviewedVersion(reviewed);
    } catch (err) {
      if (!isCurrent()) return;
      setDocument(null);
      setVersion(null);
      setReviewedVersion(null);
      setContentError(err instanceof Error ? err.message : "The exact submitted requirement version could not be loaded.");
    } finally {
      if (isCurrent()) setContentLoading(false);
    }
  }, [projectId, documentId, versionId]);

  const loadCoverage = useCallback(async () => {
    const request = ++coverageRequest.current;
    const isCurrent = () => mounted.current && request === coverageRequest.current;
    setCoverageLoading(true);
    setCoverageError(null);
    try {
      const result = await getRequirementCoverage(projectId, documentId);
      if (isCurrent()) setCoverage(result);
    } catch (err) {
      if (!isCurrent()) return;
      setCoverage(null);
      setCoverageError(err instanceof Error ? err.message : "The requirement coverage could not be read.");
    } finally {
      if (isCurrent()) setCoverageLoading(false);
    }
  }, [projectId, documentId]);

  useEffect(() => { void loadContent(); }, [loadContent, contentNonce]);
  useEffect(() => { void loadCoverage(); }, [loadCoverage, coverageNonce]);

  // A lost approval response is reconciled by re-reading the review state. If the server did
  // commit, show the verified approval instead of leaving an "unconfirmed" message on screen.
  const approvedByReload = Boolean(reviewedVersion && reviewedVersion.snapshotKind === "approved"
    && reviewedVersion.snapshotMetadata?.sourceVersionId === versionId);
  useEffect(() => {
    if (!approvedByReload) return;
    setApprovalError((current) => current?.includes("could not be confirmed") ? null : current);
  }, [approvedByReload]);

  function reconcile() {
    setContentNonce((value) => value + 1);
    setCoverageNonce((value) => value + 1);
  }

  async function approve() {
    if (!canApprove || approving || !version || !document || contentLoading || contentError) return;
    setApproving(true);
    setApprovalError(null);
    setApprovedNotice(null);
    try {
      await approveRequirementVersion(projectId, documentId, versionId);
      if (!mounted.current) return;
      setApprovedNotice("Requirement approved. The submitted version was not rewritten; case approval and execution remain separate.");
      reconcile();
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof ApiError) {
        if (err.status === 409 && err.code === "DOCUMENT_REVISION_CONFLICT") {
          setApprovalError("The requirement changed after this version was submitted. Approval was not granted. Open the current requirement or stage a refreshed revision.");
        } else if (err.status === 403) {
          setApprovalError(err.message || "Only project owners and managers can approve a requirement version.");
        } else if (err.status === 404) {
          setApprovalError("The requirement or submitted version no longer exists in this project.");
        } else if (err.status >= 500) {
          setApprovalError("The approval outcome could not be confirmed. Refresh to verify before retrying; approving the same exact version is safe and idempotent.");
        } else {
          setApprovalError(err.message);
        }
      } else {
        // No HTTP response: the server may have committed before the response was lost.
        setApprovalError("The approval outcome could not be confirmed. Refresh to verify before retrying; approving the same exact version is safe and idempotent.");
      }
      // Re-read the authoritative review state after every failure, including an uncertain one.
      reconcile();
    } finally {
      if (mounted.current) setApproving(false);
    }
  }

  const criteria = criteriaOf(version);
  const description = descriptionOf(version);
  const review = reviewState(document, reviewedVersion, versionId);
  const approvalReady = canApprove && !contentLoading && !contentError && Boolean(version) && Boolean(document) && !review.approved && !approving;
  const approvedAs = reviewedVersion?.snapshotKind === "approved" ? reviewedVersion : null;

  return (
    <Card className="p-4 space-y-4" data-testid="requirement-review-panel">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Requirement version review</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Approval applies to the exact submitted version loaded here. It is separate from apply, from case approval and from any active link.
        </p>
      </div>

      {contentLoading && <p className="text-sm text-[var(--muted)]" data-testid="requirement-review-loading">Loading the exact submitted requirement version…</p>}

      {contentError && (
        <div className="rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] p-3" data-testid="requirement-review-error">
          <p className="text-sm text-[var(--error-foreground)]">{contentError}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Approval stays disabled until the required version content and its review status load.</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setContentNonce((value) => value + 1)} data-testid="requirement-review-retry">
            Retry version
          </Button>
        </div>
      )}

      {version && document && !contentError && (
        <>
          <div className="grid gap-2 text-xs text-[var(--muted)] md:grid-cols-2" data-testid="requirement-review-version">
            <p>Version: <span className="font-mono">v{version.versionNumber}</span> · {version.snapshotKind || "submitted"}</p>
            <p>Submitted: {version.createdAt ? formatDateTime(version.createdAt) : "—"}</p>
            <p className="break-all">Version id: <span className="font-mono">{version.id}</span></p>
            <p className="break-all">Snapshot digest: <span className="font-mono">{String(version.snapshotMetadata?.contentDigest || "Not recorded")}</span></p>
            <p>Document status: <span className="font-medium">{document.status}</span></p>
            <p data-testid="requirement-review-status">{review.label}</p>
          </div>

          <div data-testid="requirement-review-content">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">{version.title}</h3>
            {description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{description}</p>}
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Acceptance criteria</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]" data-testid="requirement-review-criteria">
                {criteria.map((criterion) => (
                  <li key={criterion.key}>
                    <span className="font-mono text-xs text-[var(--muted)]">{criterion.key}</span> {criterion.text}
                    {!criterion.normative && <span className="ml-2 text-xs text-[var(--muted)]">Context only</span>}
                  </li>
                ))}
                {criteria.length === 0 && <li className="text-[var(--muted)]">No acceptance criteria were stored in this version.</li>}
              </ul>
            </div>
          </div>

          <details className="rounded-lg border border-[var(--border)] p-3 text-sm" data-testid="requirement-review-full-content">
            <summary className="cursor-pointer font-medium">Complete stored version</summary>
            <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs">
              <VersionContent detail={version} />
            </div>
          </details>

          {approvedNotice && <p className="text-sm text-[var(--success-foreground)]" role="status" data-testid="requirement-review-approved-notice">{approvedNotice}</p>}
          {approvedAs && (
            <p className="text-sm text-[var(--success-foreground)]" data-testid="requirement-review-approved">
              Approved as v{approvedAs.versionNumber}. The submitted version and its links were not rewritten.
            </p>
          )}
          {review.approved === false && review.currentBasis === false && (
            <p className="text-sm text-[var(--warning-foreground)]" data-testid="requirement-review-superseded">
              This submitted version is not the current approved basis. Approving it does not approve the newer version.
            </p>
          )}
          {approvalError && (
            <p className="rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-foreground)]" role="alert" data-testid="requirement-review-approval-error">
              {approvalError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {review.approved ? null : canApprove ? (
              <Button onClick={() => void approve()} disabled={!approvalReady} data-testid="requirement-review-approve">
                {approving ? "Approving…" : `Approve submitted v${version.versionNumber}`}
              </Button>
            ) : (
              <p className="text-xs text-[var(--muted)]" data-testid="requirement-review-readonly">
                Only a project owner or manager can approve this version. You can still read the exact version and its coverage.
              </p>
            )}
          </div>
        </>
      )}

      <div className="border-t border-[var(--border)] pt-4" data-testid="requirement-coverage">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Coverage</h3>
            <p className="mt-1 text-xs text-[var(--muted)]">Authored, approved, executed and passing are separate readings from the existing coverage endpoint.</p>
          </div>
          {!coverageLoading && !coverageError && coverage && (
            <span className="text-xs text-[var(--muted)]" data-testid="requirement-coverage-basis">
              Requirement {coverage.approvedVersionId ? "approved version" : "submitted version"} basis
            </span>
          )}
        </div>

        {coverageLoading && <p className="mt-2 text-sm text-[var(--muted)]" data-testid="requirement-coverage-loading">Loading coverage…</p>}
        {coverageError && (
          <div className="mt-2 rounded-lg border border-[var(--warning-border)] p-3" data-testid="requirement-coverage-unavailable">
            <p className="text-sm text-[var(--warning-foreground)]">Coverage is unavailable. This is not a zero result.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{coverageError}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => setCoverageNonce((value) => value + 1)} data-testid="requirement-coverage-retry">
              Retry coverage
            </Button>
          </div>
        )}
        {!coverageLoading && !coverageError && coverage && (
          <>
            <div className="mt-2 flex flex-wrap gap-2" data-testid="requirement-coverage-readings">
              <StatusChip tone={coverageReadingTone(coverage.readings.authored)}>Authored: {coverage.readings.authored ? "yes" : "no"}</StatusChip>
              <StatusChip tone={coverageReadingTone(coverage.readings.approved)}>Approved: {coverage.readings.approved ? "yes" : "no"}</StatusChip>
              <StatusChip tone={coverageReadingTone(coverage.readings.executed)}>Executed: {coverage.readings.executed ? "yes" : "no"}</StatusChip>
              <StatusChip tone={coverageReadingTone(coverage.readings.passing)}>Passing: {coverage.readings.passing ? "yes" : "no"}</StatusChip>
              {coverage.readings.mixed && <StatusChip tone="warning">Mixed PASS/FAIL attempts</StatusChip>}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                  <tr>
                    <th className="px-2 py-2">Criterion</th>
                    <th className="px-2 py-2">Cases</th>
                    <th className="px-2 py-2">Authored</th>
                    <th className="px-2 py-2">Approved</th>
                    <th className="px-2 py-2">Executed</th>
                    <th className="px-2 py-2">Passing</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.criteria.map((criterion) => (
                    <tr key={criterion.key} className="border-t border-[var(--border)]" data-testid={`requirement-coverage-criterion-${criterion.key}`}>
                      <td className="px-2 py-2 align-top">
                        <span className="font-mono text-xs text-[var(--muted)]">{criterion.key}</span>
                        <div className="text-[var(--foreground)]">{criterion.text}</div>
                      </td>
                      <td className="px-2 py-2 align-top">{criterion.caseCount}</td>
                      <td className="px-2 py-2 align-top">{criterion.authored ? "Yes" : "No"}</td>
                      <td className="px-2 py-2 align-top">{criterion.approved ? "Yes" : "No"}</td>
                      <td className="px-2 py-2 align-top">{criterion.executed ? "Yes" : "No"}</td>
                      <td className="px-2 py-2 align-top">{criterion.passing ? "Yes" : "No"}{criterion.mixed ? " (mixed)" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Linked cases</h4>
              {coverage.cases.length === 0 ? (
                <p className="text-sm text-[var(--muted)]" data-testid="requirement-coverage-empty">
                  Coverage loaded successfully: no case is linked to this requirement version yet. That is a truthful zero, not an unavailable read.
                </p>
              ) : (
                coverage.cases.map((item) => (
                  <div key={item.linkId} className="rounded-lg border border-[var(--border)] p-3" data-testid={`requirement-coverage-case-${item.testcaseId}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/projects/${projectId}/testcases?search=${encodeURIComponent(item.title)}`}
                          className="font-medium text-[var(--accent-light)] hover:underline"
                          data-testid="requirement-coverage-case-link"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Criteria {item.criterionKeys.join(", ")} · {versionBasisLabel(item, coverage)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <StatusChip tone={coverageReadingTone(item.approved)}>Approved: {item.approved ? "yes" : "no"}</StatusChip>
                        <StatusChip tone={coverageReadingTone(item.executed)}>Executed: {item.executed ? "yes" : "no"}</StatusChip>
                        <StatusChip tone={coverageReadingTone(item.passing)}>Passing: {item.passing ? "yes" : "no"}</StatusChip>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {item.attemptCount === 0
                        ? "No qualifying attempts."
                        : `${item.attemptCount} qualifying attempt${item.attemptCount === 1 ? "" : "s"}; latest ${item.latestAttempt?.status || "unknown"}${item.latestAttempt?.executedAt ? ` at ${formatDateTime(item.latestAttempt.executedAt)}` : ""}.`}
                      {item.latestAttempt?.cycleId && item.latestAttempt?.executionId && (
                        <>
                          {" "}
                          <Link
                            href={`/projects/${projectId}/cycles/${item.latestAttempt.cycleId}/execute/${item.latestAttempt.executionId}`}
                            className="text-[var(--accent-light)] hover:underline"
                            data-testid="requirement-coverage-execution-link"
                          >
                            Open execution evidence
                          </Link>
                        </>
                      )}
                    </p>
                    {item.reasons.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--muted)]">
                        {item.reasons.map((reason) => <li key={reason}>{REASON_LABELS[reason] || reason}</li>)}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">{coverage.basis}</p>
          </>
        )}
      </div>
    </Card>
  );
}
