"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  approveRequirementVersion,
  getKnowledgeDocument,
  getKnowledgeDocumentVersion,
  getRequirementCoverage,
  getTestCaseRevisionBasis,
  reapplyRequirementCaseLink,
  type KnowledgeDocument,
  type KnowledgeDocumentVersionDetail,
  type RequirementCoverage,
  type RequirementCoverageCase,
  type TestCaseRevisionBasis,
} from "@/lib/api";
import { Button, Card, StatusChip } from "@/components/ui";
import { VersionContent } from "@/components/knowledge-base/GovernedVersionContent";
import { RequirementCarryForwardReview } from "@/components/agents/RequirementCarryForwardReview";
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
    return { approved: true, currentBasis: true, blocked: false, label: `Approved as v${reviewed.versionNumber}` };
  }
  if (reviewed && reviewed.snapshotKind === "approved" && !sourceVersionId) {
    // Without the recorded source submission the backend cannot recognize an exact replay, so
    // offering approval could create a second snapshot from the same content.
    return { approved: false, currentBasis: false, blocked: true, label: `Approved as v${reviewed.versionNumber}, but its source submission is not recorded; approval is blocked until that basis is verified` };
  }
  if (reviewed && reviewed.snapshotKind !== "approved") {
    return { approved: false, currentBasis: false, blocked: false, label: "The document's reviewed version is not an approved snapshot" };
  }
  if (reviewed) {
    return { approved: false, currentBasis: false, blocked: false, label: `The current approved basis is v${reviewed.versionNumber} from a different submission` };
  }
  return { approved: false, currentBasis: true, blocked: false, label: document?.status === "approved" ? "Approved, but no exact snapshot is bound" : "Submitted, awaiting human approval" };
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
  return "linked version";
}

/** One live relation is scoped to a case *and* its criterion set, not to the case alone. */
function linkGroupKey(item: Pick<RequirementCoverageCase, "testcaseId" | "criterionKeys">): string {
  // Preserve the exact array order the backend uses for its retire/replay comparison, and use a
  // separator the criterion-key grammar does not allow so keys cannot collide with the join.
  return `${item.testcaseId}::${item.criterionKeys.join("::")}`;
}

/**
 * Approval copies active links onto the approved version; the submitted-version generation remains
 * readable. Show one row per case, preferring the current approved basis, so the activation control
 * has one exact link and one set of case revisions. Activation retires the older generations.
 */
function currentCaseRows(cases: RequirementCoverageCase[], coverage: RequirementCoverage): RequirementCoverageCase[] {
  const byGroup = new Map<string, RequirementCoverageCase>();
  const rank = (row: RequirementCoverageCase) => row.requirementVersionId === coverage.approvedVersionId ? 2
    : row.requirementVersionId === coverage.latestSubmittedVersionId ? 1 : 0;
  for (const item of cases) {
    const key = linkGroupKey(item);
    const existing = byGroup.get(key);
    if (!existing || rank(item) > rank(existing)) byGroup.set(key, item);
  }
  return [...byGroup.values()];
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

  // Exact case revisions are read separately from coverage: the coverage row deliberately carries
  // the linked basis, not the current case revisions an activation must quote.
  type CaseBasisState = { basis: TestCaseRevisionBasis | null; loading: boolean; error: string | null };
  const [caseBases, setCaseBases] = useState<Record<string, CaseBasisState>>({});
  const [caseBasesNonce, setCaseBasesNonce] = useState(0);
  const [activatingLinkId, setActivatingLinkId] = useState<string | null>(null);
  const [activationErrors, setActivationErrors] = useState<Record<string, string>>({});
  const [activationNotices, setActivationNotices] = useState<Record<string, { groupKey: string; testcaseId: string; linkId: string; retiredLinkId: string; replayed: boolean }>>({});
  const [unconfirmedActivations, setUnconfirmedActivations] = useState<Record<string, { groupKey: string; linkId: string; testcaseId: string; criterionKeys: string[]; requirementVersionId: string; caseRevision: string; approvalRevision: string }>>({});

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

  useEffect(() => {
    if (!coverage || coverage.cases.length === 0) { setCaseBases({}); return; }
    let active = true;
    const ids = [...new Set(coverage.cases.map((item) => item.testcaseId))];
    setCaseBases((previous) => Object.fromEntries(ids.map((id) => [id, {
      basis: previous[id]?.basis ?? null, loading: true, error: null
    }])));
    void Promise.all(ids.map(async (id) => {
      try {
        return { id, basis: await getTestCaseRevisionBasis(projectId, id), error: null };
      } catch (err) {
        return { id, basis: null, error: err instanceof Error ? err.message : "The case revision could not be read." };
      }
    })).then((rows) => {
      if (!active) return;
      setCaseBases(Object.fromEntries(rows.map((row) => [row.id, { basis: row.basis, loading: false, error: row.error }])));
    });
    return () => { active = false; };
  }, [coverage, projectId, caseBasesNonce]);

  // Reconcile the exact requested state from persisted link revisions. This confirms the current
  // matching link, not which actor committed it or whether an older generation was retired.
  useEffect(() => {
    if (!coverage || coverageLoading || coverageError || Object.keys(unconfirmedActivations).length === 0) return;
    const remaining = { ...unconfirmedActivations };
    let changed = false;
    for (const [groupKey, attempt] of Object.entries(unconfirmedActivations)) {
      // A later requirement/case approval or another ordered group cannot verify this attempt.
      const item = coverage.cases.find((entry) => linkGroupKey(entry) === groupKey
        && entry.approved && entry.requirementVersionId === attempt.requirementVersionId
        && coverage.approvedVersionId === attempt.requirementVersionId
        && entry.testcaseRevision === attempt.caseRevision
        && entry.testcaseApprovalRevision === attempt.approvalRevision);
      if (!item) continue;
      delete remaining[groupKey];
      setActivationErrors((previous) => {
        if (!previous[groupKey]) return previous;
        const next = { ...previous };
        delete next[groupKey];
        return next;
      });
      setActivationNotices((previous) => ({ ...previous, [groupKey]: {
        groupKey, testcaseId: attempt.testcaseId, linkId: item.linkId, retiredLinkId: "", replayed: true
      } }));
      changed = true;
    }
    if (changed) setUnconfirmedActivations((previous) => {
      const next = { ...previous };
      for (const [groupKey, attempt] of Object.entries(unconfirmedActivations)) {
        // Preserve an attempt recorded after this read/effect captured its input.
        if (!remaining[groupKey] && next[groupKey] === attempt) delete next[groupKey];
      }
      return next;
    });
  }, [coverage, coverageLoading, coverageError, unconfirmedActivations]);

  // An approved snapshot names the exact submission it came from. A different approved
  // submission must never render as if this reviewed version were approved.
  const approvedAs = reviewedVersion && reviewedVersion.snapshotKind === "approved"
    && reviewedVersion.snapshotMetadata?.sourceVersionId === versionId ? reviewedVersion : null;
  // A lost approval response is reconciled by re-reading the review state. If the server did
  // commit, show the verified approval instead of leaving an "unconfirmed" message on screen.
  const approvedByReload = Boolean(approvedAs);
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

  async function activate(item: RequirementCoverageCase) {
    const basisState = caseBases[item.testcaseId];
    const basis = basisState?.basis;
    const groupKey = linkGroupKey(item);
    if (!canApprove || activatingLinkId || coverageLoading || coverageError || basisState?.loading || basisState?.error
      || !coverage?.approvedVersionId || !basis || !basis.approvalCurrent
      || !basis.approvalRevision || basis.editRevision.length !== 64 || item.approved) return;
    const requirementVersionId = coverage.approvedVersionId;
    setActivatingLinkId(item.linkId);
    setActivationErrors((previous) => {
      const next = { ...previous };
      delete next[groupKey];
      return next;
    });
    setActivationNotices((previous) => {
      const next = { ...previous };
      delete next[groupKey];
      return next;
    });
    try {
      const result = await reapplyRequirementCaseLink(projectId, documentId, item.linkId,
        basis.editRevision, basis.approvalRevision, requirementVersionId);
      if (!mounted.current) return;
      setActivationNotices((previous) => ({ ...previous, [groupKey]: {
        groupKey, testcaseId: item.testcaseId, linkId: result.link.id, retiredLinkId: result.retiredLinkId, replayed: result.replayed
      } }));
      setUnconfirmedActivations((previous) => {
        const next = { ...previous };
        delete next[groupKey];
        return next;
      });
      setCoverageLoading(true);
      setCoverageNonce((value) => value + 1);
      setCaseBasesNonce((value) => value + 1);
    } catch (err) {
      if (!mounted.current) return;
      let message = "The link activation failed.";
      let uncertain = false;
      if (err instanceof ApiError) {
        if (err.status === 403) message = err.message || "Only project owners and managers can activate a requirement link.";
        else if (err.status === 404) message = "The requirement, link or case no longer exists.";
        else if (err.status === 409 && err.code === "CASE_REVISION_CONFLICT") {
          message = "The case changed since this revision was read. Reload and review the current approved revision before activating.";
        } else if (err.status === 409 && err.code === "CASE_NOT_APPROVED") {
          message = "The case is not currently approved at the revision on screen. Approve the case first.";
        } else if (err.status === 409 && err.code === "REQUIREMENT_NOT_APPROVED") {
          message = "The requirement version is not approved. Approve the exact requirement version before activating the link.";
        } else if (err.status === 409 && err.code === "REQUIREMENT_VERSION_CONFLICT") {
          message = "The approved requirement version changed since it was displayed. Review the current version before activating its link.";
          setContentNonce((value) => value + 1);
        } else if (err.status === 409 && err.code === "SKILL_LINK_REVIEW_REQUIRED") {
          message = "This link has no current reviewed Skill authority. Stage and review a requirement revision with this exact existing link selected before activating it.";
          setContentNonce((value) => value + 1);
        } else if (err.status === 409 && ["SKILL_CONTEXT_STALE", "SKILL_CONTEXT_UNAVAILABLE", "SKILL_ASSIGNMENT_CONFLICT"].includes(err.code || "")) {
          message = "The reviewed Skill assignment is no longer current or available. Resolve the assignment in Skills settings and stage and review a refreshed requirement revision before activating. Historical coverage remains readable.";
          setContentNonce((value) => value + 1);
        } else if (err.status === 409 && err.code === "LINK_NOT_ACTIVE") {
          message = "That link is no longer active. Reload the current coverage and choose the current link.";
        } else if (err.status >= 500) {
          message = "The activation outcome could not be confirmed. Refresh to verify; retrying the same link and revisions is safe and idempotent.";
          uncertain = true;
        } else {
          message = err.message;
        }
      } else {
        message = "The activation outcome could not be confirmed. Refresh to verify; retrying the same link and revisions is safe and idempotent.";
        uncertain = true;
      }
      setActivationErrors((previous) => ({ ...previous, [groupKey]: message }));
      if (uncertain) setUnconfirmedActivations((previous) => ({ ...previous, [groupKey]: {
        groupKey, linkId: item.linkId, testcaseId: item.testcaseId, criterionKeys: item.criterionKeys, requirementVersionId,
        caseRevision: basis.editRevision, approvalRevision: String(basis.approvalRevision)
      } }));
      setCoverageLoading(true);
      setCoverageNonce((value) => value + 1);
      setCaseBasesNonce((value) => value + 1);
    } finally {
      if (mounted.current) setActivatingLinkId(null);
    }
  }

  const criteria = criteriaOf(version);
  const description = descriptionOf(version);
  // The criterion text is the exact submitted version's, not the current mutable document's.
  // Readings still come from the coverage endpoint, joined by criterion key.
  const coverageCriteria = coverage
    ? criteria.map((criterion) => {
      const reading = coverage.criteria.find((item) => item.key === criterion.key);
      return { ...criterion, caseCount: reading?.caseCount ?? 0, authored: reading?.authored ?? false,
        approved: reading?.approved ?? false, executed: reading?.executed ?? false,
        passing: reading?.passing ?? false, mixed: reading?.mixed ?? false };
    })
    : [];
  const linkedCases = coverage ? currentCaseRows(coverage.cases, coverage) : [];
  const coverageMatchesReviewedVersion = Boolean(coverage && (
    approvedAs
    || (coverage.latestSubmittedVersionId && coverage.latestSubmittedVersionId === versionId)));
  const review = reviewState(document, reviewedVersion, versionId);
  const approvalReady = canApprove && !contentLoading && !contentError && Boolean(version) && Boolean(document) && !review.approved && !review.blocked && !approving;

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

          <RequirementCarryForwardReview selections={version.snapshotMetadata?.carryForwardLinks} skillContext={version.snapshotMetadata?.skillContext} />
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
          {review.approved === false && review.currentBasis === false && !review.blocked && (
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
              {approvedAs
                ? "Coverage basis: this approved version"
                : coverage.latestSubmittedVersionId === versionId
                  ? "Coverage basis: this latest submitted version"
                  : "Coverage basis: a newer approved/submitted version"}
            </span>
          )}
        </div>

        {Object.keys(unconfirmedActivations).length > 0 && (
          <Button size="sm" variant="secondary" className="mt-2"
            disabled={coverageLoading || Boolean(activatingLinkId)}
            onClick={() => { setCoverageLoading(true); reconcile(); }}>
            Verify activation outcomes
          </Button>
        )}
        {Object.entries(activationErrors)
          .filter(([groupKey]) => !linkedCases.some((item) => linkGroupKey(item) === groupKey))
          .map(([groupKey, message]) => (
            <p key={groupKey} className="mt-2 rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-foreground)]"
              role="alert" data-testid={`requirement-link-error-${groupKey}`}>
              {message} The previously selected link is not shown on the current coverage basis.
            </p>
          ))}

        {coverageLoading && !coverage && <p className="mt-2 text-sm text-[var(--muted)]" data-testid="requirement-coverage-loading">Loading coverage…</p>}
        {coverageLoading && coverage && <p className="mt-2 text-xs text-[var(--muted)]" data-testid="requirement-coverage-refreshing">Refreshing coverage…</p>}
        {coverageError && (
          <div className="mt-2 rounded-lg border border-[var(--warning-border)] p-3" data-testid="requirement-coverage-unavailable">
            <p className="text-sm text-[var(--warning-foreground)]">Coverage is unavailable. This is not a zero result.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{coverageError}</p>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => setCoverageNonce((value) => value + 1)} data-testid="requirement-coverage-retry">
              Retry coverage
            </Button>
          </div>
        )}
        {!coverageError && coverage && (
          <>
            <div className="mt-2 flex flex-wrap gap-2" data-testid="requirement-coverage-readings">
              <StatusChip tone={coverageReadingTone(coverage.readings.authored)}>Authored: {coverage.readings.authored ? "yes" : "no"}</StatusChip>
              <StatusChip tone={coverageReadingTone(coverage.readings.approved)}>Approved: {coverage.readings.approved ? "yes" : "no"}</StatusChip>
              <StatusChip tone={coverageReadingTone(coverage.readings.executed)}>Executed: {coverage.readings.executed ? "yes" : "no"}</StatusChip>
              <StatusChip tone={coverageReadingTone(coverage.readings.passing)}>Passing: {coverage.readings.passing ? "yes" : "no"}</StatusChip>
              {coverage.readings.mixed && <StatusChip tone="warning">Mixed PASS/FAIL attempts</StatusChip>}
            </div>

            {coverage.approvedVersionId && (
              <p className="mt-2 break-all text-xs text-[var(--muted)]" data-testid="requirement-coverage-approved-version">
                Approved requirement version <span className="font-mono">{coverage.approvedVersionId}</span>
              </p>
            )}

            {!coverageMatchesReviewedVersion && (
              <p className="mt-2 text-xs text-[var(--warning-foreground)]" data-testid="requirement-coverage-other-basis">
                The current coverage basis is a newer version. These readings describe that basis, not the version under review.
              </p>
            )}

            {coverageCriteria.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]" data-testid="requirement-coverage-no-criteria">
                This submitted version stored no acceptance criteria. The coverage readings above still use the current coverage basis.
              </p>
            ) : (
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
                  {coverageCriteria.map((criterion) => (
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
            )}

            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Linked cases</h4>
              {linkedCases.length === 0 ? (
                <p className="text-sm text-[var(--muted)]" data-testid="requirement-coverage-empty">
                  Coverage loaded successfully: no case is linked on the coverage basis shown above. That is a truthful zero, not an unavailable read.
                </p>
              ) : (
                linkedCases.map((item) => {
                  const groupKey = linkGroupKey(item);
                  const basisState = caseBases[item.testcaseId];
                  const basis = basisState?.basis ?? null;
                  const activationError = activationErrors[groupKey];
                  const notice = !coverageLoading && !coverageError && item.approved
                    && activationNotices[groupKey]?.linkId === item.linkId ? activationNotices[groupKey] : null;
                  const requirementApproved = Boolean(coverage.approvedVersionId);
                  const activationReady = canApprove && !activatingLinkId && !coverageLoading && !coverageError
                    && !basisState?.loading && !basisState?.error && requirementApproved
                    && basis?.approvalCurrent === true && basis.editRevision.length === 64 && Boolean(basis.approvalRevision) && !item.approved;
                  const activationReasons = [
                    ...(item.reasons.includes("REQUIREMENT_VERSION_SUPERSEDED") ? ["the link still targets the submitted requirement version"] : []),
                    ...(item.reasons.includes("CASE_REVISION_CHANGED_OR_NOT_APPROVED") ? ["the case is not approved at the linked revision"] : []),
                  ];
                  const hiddenGenerations = coverage.cases.filter((entry) => linkGroupKey(entry) === groupKey).length > 1;
                  return (
                  <div key={groupKey} className="rounded-lg border border-[var(--border)] p-3" data-testid={`requirement-coverage-case-${groupKey}`}>
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
                        <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted-soft)]" data-testid="requirement-coverage-link-id">
                          Link {item.linkId}
                        </p>
                        {hiddenGenerations && (
                          <p className="mt-1 text-xs text-[var(--muted)]" data-testid={`requirement-link-hidden-generation-${groupKey}`}>
                            An earlier link generation for this criterion group is hidden here; activation retires it.
                          </p>
                        )}
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

                    {basisState?.loading && <p className="mt-1 text-xs text-[var(--muted)]" data-testid={`requirement-link-case-revision-loading-${groupKey}`}>Loading the exact case revision…</p>}
                    {basisState?.error && (
                      <div className="mt-1 rounded-lg border border-[var(--warning-border)] p-2" data-testid={`requirement-link-case-revision-error-${groupKey}`}>
                        <p className="text-xs text-[var(--warning-foreground)]">{basisState.error}</p>
                        <Button size="sm" variant="secondary" className="mt-1" onClick={() => setCaseBasesNonce((value) => value + 1)}>
                          Retry case revision
                        </Button>
                      </div>
                    )}
                    {basis && (
                      <p className="mt-1 break-all font-mono text-[11px] text-[var(--muted-soft)]" data-testid={`requirement-link-case-revision-${groupKey}`}>
                        Case edit {basis.editRevision || "not available"} · approval {basis.approvalRevision || "not approved"}
                      </p>
                    )}

                    <div className="mt-2 rounded-lg border border-[var(--border)] p-2" data-testid={`requirement-link-state-${groupKey}`}>
                      <p className="text-xs text-[var(--muted)]">
                        <span className="font-medium text-[var(--foreground)]">Link activation:</span>{" "}
                        {item.approved
                          ? `active on the approved requirement version (link ${item.linkId.slice(0, 8)}…).`
                          : "not active on the approved requirement version."}
                      </p>
                      {activationReasons.length > 0 && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Activation is needed because {activationReasons.join(" and ")}.
                        </p>
                      )}
                      {activationError && (
                        <p className="mt-1 rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] px-2 py-1 text-xs text-[var(--error-foreground)]" role="alert" data-testid={`requirement-link-error-${groupKey}`}>
                          {activationError}
                        </p>
                      )}
                      {notice && (
                        <p className="mt-1 text-xs text-[var(--success-foreground)]" role="status" data-testid={`requirement-link-notice-${groupKey}`}>
                          Active link {notice.linkId}{notice.retiredLinkId ? ` (retired ${notice.retiredLinkId})` : ""}{notice.replayed ? " — verified after an unconfirmed response." : "."}
                        </p>
                      )}
                      {!item.approved && (
                        requirementApproved ? (
                          !canApprove ? (
                            <p className="mt-1 text-xs text-[var(--muted)]" data-testid={`requirement-link-readonly-${groupKey}`}>
                              Only a project owner or manager can activate this link.
                            </p>
                          ) : !basisState || basisState.loading ? (
                            <p className="mt-1 text-xs text-[var(--muted)]">Loading the exact case revision before activation…</p>
                          ) : basisState.error ? null : !basis?.approvalCurrent || !basis.approvalRevision ? (
                            <p className="mt-1 text-xs text-[var(--muted)]" data-testid={`requirement-link-case-unapproved-${groupKey}`}>
                              The case is not currently approved at its edit revision. Approve the case first; activation stays unavailable.
                            </p>
                          ) : (
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={() => void activate(item)}
                              disabled={!activationReady || Boolean(activatingLinkId)}
                              data-testid={`requirement-link-activate-${groupKey}`}
                            >
                              {activatingLinkId === item.linkId ? "Activating…" : "Activate approved case on approved version"}
                            </Button>
                          )
                        ) : (
                          <p className="mt-1 text-xs text-[var(--muted)]" data-testid={`requirement-link-requirement-unapproved-${groupKey}`}>
                            Approve the exact requirement version first; activation binds the case to the approved version.
                          </p>
                        )
                      )}
                    </div>

                    {item.reasons.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--muted)]">
                        {item.reasons.map((reason) => <li key={reason}>{REASON_LABELS[reason] || reason}</li>)}
                      </ul>
                    )}
                  </div>
                  );
                })
              )}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">Historical links and attempts remain readable; current readings use the basis shown above.</p>
          </>
        )}
      </div>
    </Card>
  );
}
