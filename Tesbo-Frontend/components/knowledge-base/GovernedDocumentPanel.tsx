"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  getKnowledgeDocumentVersion,
  listKnowledgeDocumentVersions,
  type KnowledgeDocument,
  type KnowledgeDocumentVersion,
  type KnowledgeDocumentVersionDetail,
} from "@/lib/api";
import { Button, Card, Field, FieldError, FieldLabel, Input, Select, StatusChip } from "@/components/ui";
import { VersionContent } from "@/components/knowledge-base/GovernedVersionContent";
import { ChangeHistoryList } from "@/components/knowledge-base/ChangeHistory";
import { KnowledgeComparison } from "@/components/knowledge-base/KnowledgeComparison";
import { compareDocuments, shortIdentity, type ComparableDocument } from "@/lib/kb-comparison";
import { formatDateTime } from "@/lib/date";

type Metadata = {
  schemaVersion: "tesbo-governed-document/1";
  audience: "internal" | "external";
  subtype: string;
  confidentiality: "public" | "internal" | "confidential" | "restricted";
  distribution: "internal" | "external" | "withheld";
  sourceAuthority: { kind: "internal" | "external" | "regulatory" | "contractual" | "other"; label: string; reference: string | null };
  effectivity: { from: string | null; to: string | null };
  enforcementRefs: string[];
};

const MANUAL_SUBTYPES = ["manual", "quick_start", "reference", "runbook"];
const POLICY_SUBTYPES = ["policy", "standard", "procedure", "guideline"];

function isGoverned(type: string): boolean {
  return type === "user_manual" || type === "policy";
}

function metadataOf(doc: KnowledgeDocument): Metadata {
  const raw = (doc.governedMetadata || {}) as Record<string, unknown>;
  const authority = (raw.sourceAuthority || {}) as Record<string, unknown>;
  const effectivity = (raw.effectivity || {}) as Record<string, unknown>;
  return {
    schemaVersion: "tesbo-governed-document/1",
    audience: raw.audience === "external" ? "external" : "internal",
    subtype: typeof raw.subtype === "string" ? raw.subtype : doc.documentType === "policy" ? "policy" : "manual",
    confidentiality: ["public", "internal", "confidential", "restricted"].includes(String(raw.confidentiality))
      ? raw.confidentiality as Metadata["confidentiality"] : "internal",
    distribution: ["internal", "external", "withheld"].includes(String(raw.distribution))
      ? raw.distribution as Metadata["distribution"] : "internal",
    sourceAuthority: {
      kind: ["internal", "external", "regulatory", "contractual", "other"].includes(String(authority.kind))
        ? authority.kind as Metadata["sourceAuthority"]["kind"] : "internal",
      label: typeof authority.label === "string" ? authority.label : "Project owner",
      reference: typeof authority.reference === "string" ? authority.reference : null,
    },
    effectivity: {
      from: typeof effectivity.from === "string" ? effectivity.from : null,
      to: typeof effectivity.to === "string" ? effectivity.to : null,
    },
    enforcementRefs: Array.isArray(raw.enforcementRefs) ? raw.enforcementRefs.map(String) : [],
  };
}

function decisionOf(version: KnowledgeDocumentVersion | undefined): string {
  return version?.snapshotKind === "approved" ? "approved" : version?.snapshotKind === "rejected" ? "rejected" : "";
}

export function GovernedDocumentPanel({ projectId, doc, canManage, onChanged, onSaveMetadata, onSubmitForReview, onDecide }: {
  projectId: string;
  doc: KnowledgeDocument;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
  onSaveMetadata: (metadata: Record<string, unknown>) => Promise<KnowledgeDocument>;
  onSubmitForReview: (metadata: Record<string, unknown>, submissionKey: string) => Promise<{ versionNumber: number }>;
  onDecide: (decision: "approved" | "rejected", versionId: string, reason?: string) => Promise<KnowledgeDocument>;
}) {
  const [metadata, setMetadata] = useState<Metadata>(() => metadataOf(doc));
  const [versions, setVersions] = useState<KnowledgeDocumentVersion[]>([]);
  const [submittedVersion, setSubmittedVersion] = useState<KnowledgeDocumentVersion | null>(null);
  const [submittedDetail, setSubmittedDetail] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [openedVersion, setOpenedVersion] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [comparisonVersionId, setComparisonVersionId] = useState("");
  const [comparisonDetail, setComparisonDetail] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [comparisonLoadedId, setComparisonLoadedId] = useState("");
  const [comparisonState, setComparisonState] = useState<{ loading: boolean; error: string | null; denied: boolean }>({ loading: false, error: null, denied: false });
  const comparisonSeq = useRef(0);
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const submissionKey = useRef<{ revision: string | undefined; key: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const governed = isGoverned(doc.documentType);
  // The document's own decision binding is authoritative. Snapshot history alone is not: an edit
  // clears status/reviewed_version_id to draft while the prior approved/rejected snapshot remains
  // in history, and reporting that history row as current would claim an approval that is gone.
  const decidedSnapshot = doc.reviewedVersionId
    ? versions.find((version) => version.id === doc.reviewedVersionId
      && (version.snapshotKind === "approved" || version.snapshotKind === "rejected"))
    : undefined;
  const currentDecision = doc.status === "approved" || doc.status === "rejected"
    ? decisionOf(decidedSnapshot)
    : "";

  useEffect(() => {
    // An editor autosave replaces `doc` while the user may be editing governance fields. Keep the
    // unsaved local values until Save/Submit, rather than silently discarding them.
    if (!governed || metadataDirty) return;
    setMetadata(metadataOf(doc));
  }, [doc, governed, metadataDirty]);

  const load = useCallback(async () => {
    if (!governed) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listKnowledgeDocumentVersions(projectId, doc.id);
      const list = result.list || [];
      if (!mounted.current) return;
      setVersions(list);
      const submitted = list.find((version) => version.snapshotKind === "submitted");
      if (!submitted) {
        setSubmittedVersion(null);
        setSubmittedDetail(null);
        return;
      }
      const detail = await getKnowledgeDocumentVersion(projectId, doc.id, submitted.id);
      if (!mounted.current) return;
      setSubmittedVersion(submitted);
      setSubmittedDetail(detail);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "The governed version history could not be read.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [doc.id, governed, projectId]);

  useEffect(() => { void load(); }, [load]);

  // The default historical comparison is the latest approved snapshot earlier than the submitted
  // one; a reviewer can select another earlier immutable version. The current working revision is
  // compared separately and is never labelled as an approval.
  const earlierImmutableVersions = versions
    .filter((version) => version.snapshotKind !== "autosave" && submittedVersion && version.versionNumber < submittedVersion.versionNumber)
    .sort((left, right) => left.versionNumber - right.versionNumber);
  useEffect(() => {
    if (!submittedVersion) {
      setComparisonVersionId("");
      return;
    }
    const earlier = versions
      .filter((version) => version.snapshotKind !== "autosave" && version.versionNumber < submittedVersion.versionNumber)
      .sort((left, right) => left.versionNumber - right.versionNumber);
    setComparisonVersionId((previous) => {
      if (previous && earlier.some((version) => version.id === previous)) return previous;
      const latestApproved = earlier.filter((version) => version.snapshotKind === "approved").at(-1)?.id;
      return latestApproved || earlier.at(-1)?.id || "";
    });
  }, [submittedVersion, versions]);

  const loadComparison = useCallback(async () => {
    const seq = ++comparisonSeq.current;
    if (!comparisonVersionId) {
      setComparisonDetail(null);
      setComparisonLoadedId("");
      setComparisonState({ loading: false, error: null, denied: false });
      return;
    }
    setComparisonDetail(null);
    setComparisonLoadedId("");
    setComparisonState({ loading: true, error: null, denied: false });
    try {
      const detail = await getKnowledgeDocumentVersion(projectId, doc.id, comparisonVersionId);
      if (seq !== comparisonSeq.current || !mounted.current) return;
      setComparisonDetail(detail);
      setComparisonLoadedId(comparisonVersionId);
      setComparisonState({ loading: false, error: null, denied: false });
    } catch (err) {
      if (seq !== comparisonSeq.current || !mounted.current) return;
      const denied = err instanceof ApiError && (err.status === 403 || err.status === 404);
      setComparisonDetail(null);
      setComparisonState({
        loading: false,
        denied,
        error: denied ? "That exact version is not available in this project, or you no longer have access to it."
          : err instanceof Error ? err.message : "The selected version could not be read."
      });
    }
  }, [comparisonVersionId, doc.id, projectId]);

  useEffect(() => { void loadComparison(); }, [loadComparison]);

  async function openVersion(version: KnowledgeDocumentVersion) {
    setError(null);
    try {
      const detail = await getKnowledgeDocumentVersion(projectId, doc.id, version.id);
      if (mounted.current) setOpenedVersion(detail);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "That exact version could not be read.");
    }
  }

  function patchMetadata(patch: Partial<Metadata>) {
    setMetadata((previous) => ({ ...previous, ...patch }));
    setMetadataDirty(true);
    setMessage(null);
    setError(null);
  }

  async function saveMetadata(): Promise<KnowledgeDocument | null> {
    setBusy(true);
    setError(null);
    try {
      const updated = await onSaveMetadata(metadata as unknown as Record<string, unknown>);
      setMetadataDirty(false);
      await onChanged();
      setMessage("Governance metadata saved with the current body. The exact revision can now be submitted for review.");
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The governance metadata could not be saved. Your draft remains in the editor.");
      return null;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const key = submissionKey.current?.key ?? crypto.randomUUID();
      submissionKey.current = { revision: doc.editRevision, key };
      const version = await onSubmitForReview(metadata as unknown as Record<string, unknown>, key);
      submissionKey.current = null;
      setMetadataDirty(false);
      await load();
      await onChanged();
      setMessage(`Submitted v${version.versionNumber} as an immutable candidate. Review and approval are separate.`);
    } catch (err) {
      // Do not reload here: load() clears the error, and the retained draft/uncertain submission
      // must stay visible until the author resolves or retries it.
      setError(err instanceof Error ? err.message : "The exact version could not be submitted. Your draft remains in the editor.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function decide(decisionKind: "approved" | "rejected") {
    if (!submittedVersion) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await onDecide(decisionKind, submittedVersion.id, reason.trim() || undefined);
      await load();
      await onChanged();
      setMessage(`${decisionKind === "approved" ? "Approved" : "Rejected"} submitted v${submittedVersion.versionNumber} exactly.`);
    } catch (err) {
      // Refresh the submitted-version view first, then set the error: load() clears errors, so
      // setting it after load keeps the refusal visible while the panel shows the current version.
      await load();
      if (err instanceof ApiError && err.status === 409 && err.code === "DOCUMENT_REVISION_CONFLICT") {
        setError("The document changed after this version was submitted. Review the current submitted version or submit a refreshed revision.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError(err.message || "Only project owners and managers can decide this version.");
      } else if (err instanceof ApiError && err.status >= 500) {
        setError("The decision outcome could not be confirmed. Refresh to verify before retrying; the same exact version decision is idempotent.");
      } else {
        setError(err instanceof Error ? err.message : "The decision could not be recorded.");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  if (!governed) return null;
  const subtypes = doc.documentType === "policy" ? POLICY_SUBTYPES : MANUAL_SUBTYPES;
  const submittedMetadata = submittedDetail?.snapshotMetadata?.governedMetadata as Metadata | undefined;
  const openedMetadata = openedVersion?.snapshotMetadata?.governedMetadata as Metadata | undefined;
  const latestDecisionSnapshot = versions
    .filter((version) => version.snapshotKind === "approved" || version.snapshotKind === "rejected")
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];
  // A prior decision on this submitted version no longer applies after the body/metadata edit
  // that cleared the document's binding. The same is true for an undecided submission that has
  // since changed: compare the snapshot's bound content, not editRevision, because a no-op save
  // can change updated_by without changing what the reviewer would approve.
  const submittedContentChanged = Boolean(submittedDetail && (
    submittedDetail.title !== doc.title
    || (submittedDetail.contentText ?? null) !== (doc.contentText ?? null)
    || (submittedDetail.contentHtml ?? null) !== (doc.contentHtml ?? null)
    || JSON.stringify(submittedDetail.contentJson ?? null) !== JSON.stringify(doc.contentJson ?? null)
    || JSON.stringify(submittedDetail.snapshotMetadata?.governedMetadata ?? null) !== JSON.stringify(doc.governedMetadata ?? null)
    // These fields also participate in the server's content digest and snapshot binding.
    || submittedDetail.snapshotMetadata?.folderId !== doc.folderId
    || submittedDetail.snapshotMetadata?.documentType !== doc.documentType
    || submittedDetail.snapshotMetadata?.sourceProvider !== (doc.sourceProvider ?? null)
    || submittedDetail.snapshotMetadata?.sourceExternalId !== (doc.sourceExternalId ?? null)
    || submittedDetail.snapshotMetadata?.sourceUrl !== (doc.sourceUrl ?? null)
    || submittedDetail.snapshotMetadata?.sourceRole !== (doc.sourceRole ?? null)
    || submittedDetail.snapshotMetadata?.isReadOnly !== (doc.isReadOnly ?? false)
  ));
  const submittedSuperseded = Boolean(currentDecision === "" && submittedVersion
    && (latestDecisionSnapshot?.snapshotMetadata?.sourceVersionId === submittedVersion.id
      || submittedContentChanged));
  const decidedOnSubmitted = Boolean(currentDecision && decidedSnapshot && submittedVersion
    && doc.reviewedVersionId === decidedSnapshot.id
    && decidedSnapshot.snapshotMetadata?.sourceVersionId === submittedVersion.id);

  const sourceOf = (value: Record<string, unknown> | undefined | null) => ({
    folderId: value?.folderId ?? null,
    documentType: value?.documentType ?? null,
    sourceProvider: value?.sourceProvider ?? null,
    sourceExternalId: value?.sourceExternalId ?? null,
    sourceUrl: value?.sourceUrl ?? null,
    sourceRole: value?.sourceRole ?? null,
    isReadOnly: value?.isReadOnly ?? false,
  });
  const currentComparable: ComparableDocument = {
    title: doc.title,
    contentText: doc.contentText ?? null,
    contentHtml: doc.contentHtml ?? null,
    contentJson: doc.contentJson ?? null,
    governedMetadata: doc.governedMetadata ?? {},
    source: sourceOf(doc as unknown as Record<string, unknown>),
  };
  const submittedComparable: ComparableDocument | null = submittedDetail ? {
    title: submittedDetail.title,
    contentText: submittedDetail.contentText ?? null,
    contentHtml: submittedDetail.contentHtml ?? null,
    contentJson: submittedDetail.contentJson ?? null,
    governedMetadata: (submittedDetail.snapshotMetadata?.governedMetadata as Record<string, unknown> | undefined) ?? {},
    source: sourceOf(submittedDetail.snapshotMetadata),
  } : null;
  const selectedComparisonVersion = versions.find((version) => version.id === comparisonVersionId);
  const historicalComparable: ComparableDocument | null = comparisonDetail ? {
    title: comparisonDetail.title,
    contentText: comparisonDetail.contentText ?? null,
    contentHtml: comparisonDetail.contentHtml ?? null,
    contentJson: comparisonDetail.contentJson ?? null,
    governedMetadata: (comparisonDetail.snapshotMetadata?.governedMetadata as Record<string, unknown> | undefined) ?? {},
    source: sourceOf(comparisonDetail.snapshotMetadata),
  } : null;
  const currentAuthorityLabel = doc.status === "approved" && doc.reviewedVersionId
    ? `Current working revision · currently approved (${shortIdentity(doc.reviewedVersionId)})`
    : `Current working revision · ${doc.status}`;

  return (
    <Card className="space-y-4 p-4" data-testid="governed-document-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Governed {doc.documentType === "policy" ? "policy" : "manual"}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Audience, distribution, confidentiality, source authority, effectivity and approval are separate facts. Only an owner or manager can approve or reject the exact submitted version.</p>
        </div>
        <StatusChip tone={doc.status === "approved" ? "success" : doc.status === "rejected" ? "error" : "info"}>{doc.status}</StatusChip>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field><FieldLabel>Audience</FieldLabel><Select data-testid="governed-audience" value={metadata.audience} onChange={(event) => patchMetadata({ audience: event.target.value as Metadata["audience"] })}><option value="internal">Internal</option><option value="external">External</option></Select></Field>
        <Field><FieldLabel>Subtype</FieldLabel><Select data-testid="governed-subtype" value={metadata.subtype} onChange={(event) => patchMetadata({ subtype: event.target.value })}>{subtypes.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select></Field>
        <Field><FieldLabel>Confidentiality</FieldLabel><Select data-testid="governed-confidentiality" value={metadata.confidentiality} onChange={(event) => patchMetadata({ confidentiality: event.target.value as Metadata["confidentiality"] })}><option value="public">Public</option><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></Select></Field>
        <Field><FieldLabel>Distribution</FieldLabel><Select data-testid="governed-distribution" value={metadata.distribution} onChange={(event) => patchMetadata({ distribution: event.target.value as Metadata["distribution"] })}><option value="internal">Internal</option><option value="external">External</option><option value="withheld">Withheld</option></Select></Field>
        <Field><FieldLabel>Source authority kind</FieldLabel><Select data-testid="governed-authority-kind" value={metadata.sourceAuthority.kind} onChange={(event) => patchMetadata({ sourceAuthority: { ...metadata.sourceAuthority, kind: event.target.value as Metadata["sourceAuthority"]["kind"] } })}><option value="internal">Internal</option><option value="external">External</option><option value="regulatory">Regulatory</option><option value="contractual">Contractual</option><option value="other">Other</option></Select></Field>
        <Field><FieldLabel>Source authority label</FieldLabel><Input data-testid="governed-authority-label" value={metadata.sourceAuthority.label} onChange={(event) => patchMetadata({ sourceAuthority: { ...metadata.sourceAuthority, label: event.target.value } })} /></Field>
        <Field><FieldLabel>Source reference</FieldLabel><Input data-testid="governed-authority-reference" value={metadata.sourceAuthority.reference || ""} onChange={(event) => patchMetadata({ sourceAuthority: { ...metadata.sourceAuthority, reference: event.target.value || null } })} placeholder="Optional URL or reference" /></Field>
        <Field><FieldLabel>Effectivity from</FieldLabel><Input data-testid="governed-effectivity-from" type="date" value={metadata.effectivity.from || ""} onChange={(event) => patchMetadata({ effectivity: { ...metadata.effectivity, from: event.target.value || null } })} /></Field>
        <Field><FieldLabel>Effectivity to</FieldLabel><Input data-testid="governed-effectivity-to" type="date" value={metadata.effectivity.to || ""} onChange={(event) => patchMetadata({ effectivity: { ...metadata.effectivity, to: event.target.value || null } })} /></Field>
      </div>
      {doc.documentType === "policy" && (
        <Field><FieldLabel>Enforcement references</FieldLabel><Input data-testid="governed-enforcement-refs" value={metadata.enforcementRefs.join(", ")} onChange={(event) => patchMetadata({ enforcementRefs: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} placeholder="Comma-separated references" /></Field>
      )}
      {error && <FieldError>{error}</FieldError>}
      {message && <p className="text-sm text-[var(--success-foreground)]" role="status">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void saveMetadata()} disabled={busy} data-testid="governed-save-metadata">Save governance metadata</Button>
        <Button size="sm" onClick={() => void submitForReview()} disabled={busy || !doc.editRevision || doc.status !== "draft"} data-testid="governed-submit">Submit exact version for review</Button>
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Exact submitted version</h3>
        {loading ? <p className="mt-2 text-sm text-[var(--muted)]">Loading version history…</p> : !submittedVersion ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No submitted version yet. Save the document content, then submit the exact revision.</p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-xs text-[var(--muted)]" data-testid="governed-submitted-version">Submitted v{submittedVersion.versionNumber} · {submittedVersion.createdAt ? formatDateTime(submittedVersion.createdAt) : "—"} · {decidedOnSubmitted ? `decision ${currentDecision}` : submittedSuperseded ? "changed since this version was submitted" : "awaiting exact-version decision"}</p>
            {submittedMetadata && (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs" data-testid="governed-submitted-metadata">
                <p>Audience: {submittedMetadata.audience} · Subtype: {submittedMetadata.subtype} · Confidentiality: {submittedMetadata.confidentiality} · Distribution: {submittedMetadata.distribution}</p>
                <p>Source authority: {submittedMetadata.sourceAuthority?.kind} — {submittedMetadata.sourceAuthority?.label}{submittedMetadata.sourceAuthority?.reference ? ` (${submittedMetadata.sourceAuthority.reference})` : ""}</p>
                <p>Effectivity: {submittedMetadata.effectivity?.from || "—"} to {submittedMetadata.effectivity?.to || "—"}{submittedMetadata.enforcementRefs?.length ? ` · Enforcement: ${submittedMetadata.enforcementRefs.join(", ")}` : ""}</p>
              </div>
            )}
            {submittedDetail && <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs"><VersionContent detail={submittedDetail} /></div>}
            {submittedDetail && submittedComparable && (
              <div className="space-y-3" data-testid="governed-comparison">
                <div className="rounded-lg border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">Historical comparison</p>
                    <Select
                      className="max-w-full"
                      value={comparisonVersionId}
                      onChange={(event) => {
                        setComparisonVersionId(event.target.value);
                        setComparisonDetail(null);
                        setComparisonLoadedId("");
                        setComparisonState({ loading: true, error: null, denied: false });
                      }}
                      disabled={earlierImmutableVersions.length === 0 || comparisonState.loading}
                      data-testid="governed-comparison-version"
                    >
                      {earlierImmutableVersions.length === 0 ? <option value="">First submission — no earlier version</option> : earlierImmutableVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          v{version.versionNumber} · {version.snapshotKind || "snapshot"} · {version.createdAt ? formatDateTime(version.createdAt) : "—"}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {earlierImmutableVersions.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--muted)]" data-testid="governed-comparison-first">This is the first submission; there is no earlier immutable version to compare, but the current working revision comparison below is still available.</p>
                  ) : comparisonState.loading ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">Loading the exact selected version…</p>
                  ) : comparisonState.error ? (
                    <div className="mt-2 text-xs text-[var(--error-foreground)]" data-testid="governed-comparison-error">
                      <p>{comparisonState.error}</p>
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => void loadComparison()}>Retry comparison</Button>
                    </div>
                  ) : historicalComparable && selectedComparisonVersion && comparisonLoadedId === comparisonVersionId ? (
                    <div className="mt-2">
                      <KnowledgeComparison
                        testId="governed-historical-comparison"
                        baseLabel={`v${selectedComparisonVersion.versionNumber} · ${selectedComparisonVersion.snapshotKind || "snapshot"} · historical, not current authority`}
                        baseIdentity={`${shortIdentity(selectedComparisonVersion.id)} · digest ${shortIdentity(String(selectedComparisonVersion.snapshotMetadata?.contentDigest || ""))}`}
                        targetLabel={`Submitted v${submittedVersion.versionNumber}`}
                        targetIdentity={`${shortIdentity(submittedVersion.id)} · digest ${shortIdentity(String(submittedVersion.snapshotMetadata?.contentDigest || ""))}`}
                        result={compareDocuments(historicalComparable, submittedComparable)}
                        onOpenBase={() => void openVersion(selectedComparisonVersion)}
                        onOpenTarget={() => void openVersion(submittedVersion)}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-xs font-semibold">Current working revision comparison</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    The submitted snapshot is compared with what is persisted now. A historical approval is shown above and does not replace the document&apos;s current decision binding.
                  </p>
                  <div className="mt-2">
                    <KnowledgeComparison
                      testId="governed-current-comparison"
                      baseLabel={currentAuthorityLabel}
                      baseIdentity={`edit revision ${shortIdentity(doc.editRevision)}`}
                      targetLabel={`Submitted v${submittedVersion.versionNumber}`}
                      targetIdentity={`${shortIdentity(submittedVersion.id)} · digest ${shortIdentity(String(submittedVersion.snapshotMetadata?.contentDigest || ""))}`}
                      result={compareDocuments(currentComparable, submittedComparable)}
                      onOpenTarget={() => void openVersion(submittedVersion)}
                    />
                  </div>
                </div>
              </div>
            )}
            {decidedOnSubmitted ? (
              <p className="text-sm text-[var(--success-foreground)]" data-testid="governed-decision">This exact version is {currentDecision}.</p>
            ) : submittedSuperseded ? (
              <p className="text-sm text-[var(--muted)]" data-testid="governed-decision-superseded">
                The document changed after this version was submitted. Submit the current revision for a new decision.
              </p>
            ) : doc.status !== "draft" ? (
              <p className="text-sm text-[var(--muted)]" data-testid="governed-decision-readonly">
                This document is {doc.status}. Edit it to create a new draft before submitting another version.
              </p>
            ) : canManage ? (
              <div className="space-y-2">
                <Field><FieldLabel>Rejection reason (optional)</FieldLabel><Input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void decide("approved")} disabled={busy} data-testid="governed-approve">Approve submitted v{submittedVersion.versionNumber}</Button>
                  <Button size="sm" variant="secondary" onClick={() => void decide("rejected")} disabled={busy} data-testid="governed-reject">Reject submitted v{submittedVersion.versionNumber}</Button>
                </div>
              </div>
            ) : <p className="text-xs text-[var(--muted)]">Only a project owner or manager can approve or reject this version.</p>}
          </div>
        )}
      </div>

      <details className="border-t border-[var(--border)] pt-3" open>
        <summary className="cursor-pointer text-sm font-medium">Version history and diffs</summary>
        {versions.some((version) => version.snapshotKind !== "autosave") && (
          <div className="mt-2 space-y-1" data-testid="governed-version-timeline">
            {versions.filter((version) => version.snapshotKind !== "autosave").map((version) => (
              <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--border)] px-2 py-1 text-xs">
                <span>v{version.versionNumber} · {version.snapshotKind} · {version.createdAt ? formatDateTime(version.createdAt) : "—"}</span>
                <Button size="sm" variant="secondary" onClick={() => void openVersion(version)} data-testid="governed-version-open">Open exact version</Button>
              </div>
            ))}
          </div>
        )}
        {openedVersion && (
          <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-xs" data-testid="governed-version-detail">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium">v{openedVersion.versionNumber} · {openedVersion.snapshotKind} (read-only)</p>
              <Button size="sm" variant="secondary" onClick={() => setOpenedVersion(null)}>Close</Button>
            </div>
            {openedMetadata && (
              <p className="mb-2">
                Audience: {openedMetadata.audience} · Subtype: {openedMetadata.subtype} · Confidentiality: {openedMetadata.confidentiality} · Distribution: {openedMetadata.distribution}
                {" · "}Authority: {openedMetadata.sourceAuthority?.kind} — {openedMetadata.sourceAuthority?.label}{openedMetadata.sourceAuthority?.reference ? ` (${openedMetadata.sourceAuthority.reference})` : ""}
                {" · "}Effectivity: {openedMetadata.effectivity?.from || "—"} to {openedMetadata.effectivity?.to || "—"}{openedMetadata.enforcementRefs?.length ? ` · Enforcement: ${openedMetadata.enforcementRefs.join(", ")}` : ""}
              </p>
            )}
            <div className="max-h-64 overflow-auto"><VersionContent detail={openedVersion} /></div>
          </div>
        )}
        <div className="mt-2"><ChangeHistoryList projectId={projectId} documentId={doc.id} showHeading={false} /></div>
      </details>
    </Card>
  );
}
