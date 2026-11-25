"use client";

import Link from "next/link";
import { useState } from "react";
import type { ZyraTask } from "@/lib/api";
import { Button, Card, Field, FieldLabel, Input, StatusChip } from "@/components/ui";

/**
 * Human review surface for an agent-authored manual/policy candidate. The candidate is inert
 * until an owner/manager applies the exact reviewed revision; apply publishes a native Draft and
 * does not submit or approve it.
 */
export function ManagedDocumentProposalPanel({ projectId, task, canApprove, working, onApply, onReject }: {
  projectId: string;
  task: ZyraTask;
  canApprove: boolean;
  working: boolean;
  onApply: () => void;
  onReject: (reason: string) => void;
}) {
  const proposal = task.managedDocumentProposal;
  const [rejectReason, setRejectReason] = useState("");
  if (!proposal) return null;
  const current = proposal.skillApplicability?.current;
  const applicability = proposal.skillApplicability?.status || "unavailable";
  const targetApplicability = proposal.target?.applicability;
  const targetBlocked = targetApplicability === "changed" || targetApplicability === "missing";
  const decided = task.taskStatus === "done" || Boolean(proposal.applyReceipt);
  const isPolicy = proposal.documentType === "policy";
  const metadata = proposal.proposed.governedMetadata || {};
  const authority = (metadata.sourceAuthority || {}) as Record<string, unknown>;
  const effectivity = (metadata.effectivity || {}) as Record<string, unknown>;

  return (
    <Card className="space-y-4 p-4" data-testid="managed-document-proposal">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            Proposed governed {isPolicy ? "policy" : "manual"}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {proposal.operation === "create" ? "New document" : `Update ${proposal.target?.documentId || "target"}`}
            {proposal.target?.editRevision ? ` · base revision ${proposal.target.editRevision.slice(0, 12)}…` : ""}
          </p>
        </div>
        <StatusChip tone={applicability === "current" ? "success" : applicability === "conflict" ? "error" : "warning"}>
          Skill: {applicability}
        </StatusChip>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
          <p className="font-medium">Proposed document</p>
          <p className="mt-1 font-semibold">{proposal.proposed.title}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Audience: {String(metadata.audience || "—")} · Subtype: {String(metadata.subtype || "—")} · Confidentiality: {String(metadata.confidentiality || "—")} · Distribution: {String(metadata.distribution || "—")}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Authority: {String(authority.kind || "—")} — {String(authority.label || "—")}
            {authority.reference ? ` (${String(authority.reference)})` : ""}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Effectivity: {String(effectivity.from || "—")} to {String(effectivity.to || "—")}
            {Array.isArray(metadata.enforcementRefs) && metadata.enforcementRefs.length ? ` · Enforcement: ${metadata.enforcementRefs.join(", ")}` : ""}
          </p>
          {proposal.target?.base && (
            <p className="mt-2 text-xs text-[var(--muted)]" data-testid="managed-document-base">
              Base: {proposal.target.base.title} · {proposal.target.base.status} · revision {proposal.target.base.editRevision.slice(0, 12)}…
            </p>
          )}
          {proposal.changes?.length ? <p className="mt-2 text-xs">Changes: {proposal.changes.join(", ")}</p> : null}
          {typeof proposal.provenance?.kind === "string" && (
            <p className="mt-2 text-xs text-[var(--muted)]" data-testid="managed-document-provenance">
              Producer: {proposal.provenance.kind}
              {typeof proposal.provenance.principalKey === "string" ? ` · ${proposal.provenance.principalKey}` : ""}
              {typeof proposal.provenance.tokenId === "string" ? ` · token ${proposal.provenance.tokenId.slice(0, 8)}…` : ""}
            </p>
          )}
          {proposal.reason && <p className="mt-2 text-xs">Reason: {proposal.reason}</p>}
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3 text-sm" data-testid="managed-document-diff">
          <p className="font-medium">Comparison with base</p>
          <p className="mt-1 text-xs text-[var(--muted)]">{proposal.diff?.summary || "No textual change detected."}</p>
          {proposal.diff?.fields?.length ? proposal.diff.fields.map((field, index) => (
            <div key={`${field.label}-${index}`} className="mt-2 rounded border border-[var(--border)] p-2 text-xs">
              <p className="font-medium">{field.label}</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--muted)]">− {field.oldExcerpt}</p>
              <p className="mt-1 whitespace-pre-wrap">+ {field.newExcerpt}</p>
            </div>
          )) : null}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm" data-testid="managed-document-content">
        <p className="font-medium">Full proposed content</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Plain text</p>
        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{proposal.proposed.contentText === undefined ? (proposal.operation === "create" ? "Not supplied; the new document starts without plain text." : "Not supplied; the current plain text is preserved on apply.") : proposal.proposed.contentText || "The proposed plain text is empty."}</pre>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium">Stored HTML</summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{proposal.proposed.contentHtml === undefined ? (proposal.operation === "create" ? "Not supplied; the new document starts without HTML." : "Not supplied; the current HTML is preserved on apply.") : proposal.proposed.contentHtml === null ? "The proposal clears the stored HTML." : proposal.proposed.contentHtml}</pre>
        </details>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium">Editor JSON</summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{proposal.proposed.contentJson === undefined ? (proposal.operation === "create" ? "Not supplied; the new document starts without editor JSON." : "Not supplied; the current editor JSON is preserved on apply.") : proposal.proposed.contentJson === null ? "The proposal clears the stored editor JSON." : JSON.stringify(proposal.proposed.contentJson, null, 2)}</pre>
        </details>
      </div>

      <div className="rounded-lg border border-[var(--border)] p-3 text-xs" data-testid="managed-document-skills">
        <p className="font-medium">Pinned Skill basis</p>
        <p className="mt-1 text-[var(--muted)]">
          {proposal.skillContext?.status || "unavailable"}
          {proposal.skillContext?.digest ? ` · ${proposal.skillContext.digest.slice(0, 12)}…` : ""}
        </p>
        {(proposal.skillContext?.assignments || []).map((assignment) => (
          <p key={assignment.assignmentId} className="mt-1">
            {assignment.target?.module}/{assignment.target?.subtype}/{assignment.target?.operation} · {assignment.skillKey || assignment.skillDocumentId} v{assignment.versionNumber ?? "?"} · assignment {assignment.assignmentId.slice(0, 8)}…
          </p>
        ))}
        {(current?.missing || []).map((missing) => (
          <p key={`${missing.module}-${missing.subtype}-${missing.operation}`} className="mt-1 text-[var(--warning-foreground)]">
            Missing: {missing.module}/{missing.subtype}/{missing.operation}
          </p>
        ))}
        {(current?.conflicts || []).map((conflict) => (
          <p key={`${conflict.module}-${conflict.subtype}-${conflict.operation}`} className="mt-1 text-[var(--error-foreground)]">
            Conflict: {conflict.module}/{conflict.subtype}/{conflict.operation} ({conflict.matches} matches)
          </p>
        ))}
      </div>

      {proposal.applyReceipt ? (
        <div className="rounded-lg border border-[var(--success-foreground)]/40 bg-[var(--success-soft)] p-3 text-sm" data-testid="managed-document-apply-receipt">
          {proposal.applyReceipt.document.operation === "no_change" ? (
            <p>No content or metadata changed; the document remains <strong>{proposal.applyReceipt.document.status}</strong>. Nothing was submitted or approved.</p>
          ) : (
            <p>
              Applied as native <strong>{proposal.applyReceipt.document.status === "draft" ? "Draft" : proposal.applyReceipt.document.status}</strong>{" "}
              <Link className="underline" href={`/projects/${projectId}/knowledge-base/documents/${proposal.applyReceipt.document.documentId}`}>
                {proposal.applyReceipt.document.title || proposal.applyReceipt.document.documentId}
              </Link>.
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--muted)]">Submission and approval remain separate human decisions.</p>
        </div>
      ) : decided ? (
        <p className="text-sm text-[var(--muted)]">This candidate was closed without publication.</p>
      ) : !canApprove ? (
        <p className="text-sm text-[var(--muted)]">Only a project owner or manager can apply or reject this candidate.</p>
      ) : (
        <div className="space-y-3" data-testid="managed-document-actions">
          <Button
            onClick={onApply}
            disabled={working || applicability !== "current" || targetBlocked || !task.proposalRevision}
            data-testid="managed-document-apply"
          >
            Apply reviewed candidate as Draft
          </Button>
          {targetBlocked && (
            <p className="text-xs text-[var(--error-foreground)]" data-testid="managed-document-target-blocker">
              {targetApplicability === "missing"
                ? "Apply is blocked because the target document no longer exists. Stage a refreshed candidate against a current target."
                : "Apply is blocked because the target document changed after this candidate was staged. Stage a refreshed candidate against the current revision."}
            </p>
          )}
          {applicability !== "current" && (
            <p className="text-xs text-[var(--error-foreground)]">
              Apply is blocked until the exact approved Skill basis is current. Submit a refreshed candidate after the assignment/version changes.
            </p>
          )}
          <Field><FieldLabel>Rejection reason (optional)</FieldLabel><Input data-testid="managed-document-reject-reason" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} /></Field>
          <Button
            variant="secondary"
            onClick={() => onReject(rejectReason)}
            disabled={working}
            data-testid="managed-document-reject"
          >
            Reject candidate
          </Button>
        </div>
      )}
    </Card>
  );
}
