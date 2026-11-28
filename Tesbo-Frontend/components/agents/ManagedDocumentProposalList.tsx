"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  listManagedDocumentProposals,
  type ManagedDocumentProposalPage,
  type ZyraTask,
} from "@/lib/api";
import { Button, Input, Select, StatusChip } from "@/components/ui";
import { formatDate } from "@/lib/date";

const PAGE_SIZE = 10;

type ProposalFilters = {
  q: string;
  documentType: "" | "user_manual" | "policy";
  status: "pending" | "in_review" | "failed";
  operation: "" | "create" | "update";
};

const DEFAULT_FILTERS: ProposalFilters = { q: "", documentType: "", status: "pending", operation: "" };

function proposalType(task: ZyraTask): "user_manual" | "policy" {
  return task.managedDocumentProposal?.documentType === "policy" ? "policy" : "user_manual";
}

function proposerLabel(
  provenance: Record<string, unknown> | null | undefined,
  members: Array<{ userId: string; name: string }>
): string {
  if (!provenance) return "Unknown producer";
  const kind = typeof provenance.kind === "string" ? provenance.kind : "producer";
  if (kind === "api_token") {
    const token = typeof provenance.tokenId === "string" ? provenance.tokenId.slice(0, 8) : null;
    return `API token${token ? ` ${token}…` : ""}`;
  }
  const issuer = typeof provenance.issuerId === "string" ? provenance.issuerId : null;
  const name = issuer ? members.find((member) => member.userId === issuer)?.name : null;
  return name || "Project member";
}

function blockerReasons(task: ZyraTask, canApprove: boolean | null): string[] {
  const proposal = task.managedDocumentProposal;
  if (!proposal) return ["Candidate payload unavailable; reload the task"];
  const reasons: string[] = [];
  // null means the member list has not loaded yet — do not flash a role refusal at an owner.
  if (canApprove === false) reasons.push("Only a project owner or manager can apply or reject");
  const applicability = proposal.skillApplicability?.status || "unavailable";
  if (applicability !== "current") {
    const missing = proposal.skillApplicability?.current?.missing?.length || 0;
    const conflicts = proposal.skillApplicability?.current?.conflicts?.length || 0;
    reasons.push(`Skill basis is ${applicability}${missing ? ` (${missing} missing)` : ""}${conflicts ? ` (${conflicts} conflicting)` : ""}`);
  }
  if (proposal.target?.applicability === "changed") reasons.push("Target document changed since staging; stage a refreshed candidate");
  if (proposal.target?.applicability === "missing") reasons.push("Target document is no longer available");
  if (task.taskStatus === "failed") reasons.push("Staging failed; open the candidate for details");
  if (!task.proposalRevision) reasons.push("Review revision unavailable; reload the list");
  return reasons;
}

export default function ManagedDocumentProposalList({
  projectId, canApprove, members = [],
}: { projectId: string; canApprove: boolean | null; members?: Array<{ userId: string; name: string }> }) {
  const [filters, setFilters] = useState<ProposalFilters>(DEFAULT_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState<ManagedDocumentProposalPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number | null; message: string } | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const next = await listManagedDocumentProposals(projectId, { ...filters, limit: PAGE_SIZE, offset });
      // A project switch or newer filter/page change must win over a late response.
      if (seq !== requestSeq.current) return;
      // Another reviewer may have applied/rejected the only row on this page. Clamp to the last
      // real page and reload instead of rendering "Showing 11–10 of 10" and a false empty state.
      if (next.total > 0 && offset >= next.total) {
        setOffset(Math.max(0, Math.floor((next.total - 1) / PAGE_SIZE) * PAGE_SIZE));
        return;
      }
      if (next.total === 0 && offset !== 0) {
        setOffset(0);
        return;
      }
      setPage(next);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const status = err instanceof ApiError ? err.status : null;
      setError({ status, message: err instanceof Error ? err.message : "Could not load document proposals." });
      setPage(null);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [projectId, filters, offset]);

  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchDraft("");
    setOffset(0);
    setPage(null);
  }, [projectId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  useEffect(() => {
    const onFocus = () => setRefreshKey((key) => key + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  function updateFilter(patch: Partial<ProposalFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setOffset(0);
  }

  const total = page?.total ?? 0;
  const shownFrom = total === 0 ? 0 : (page?.offset ?? offset) + 1;
  const shownTo = page ? page.offset + page.list.length : 0;
  const canPrev = offset > 0;
  const canNext = Boolean(page?.hasMore);
  const unavailable = error?.status === 501;
  const denied = error?.status === 403 || error?.status === 404;

  return (
    <section className="space-y-4" data-testid="managed-document-proposals">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-xs font-medium text-[var(--muted)]">
            Search
            <div className="mt-1 flex gap-2">
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") updateFilter({ q: searchDraft.trim() }); }}
                placeholder="Proposal title"
                data-testid="managed-document-search"
              />
              <Button variant="secondary" onClick={() => updateFilter({ q: searchDraft.trim() })} data-testid="managed-document-search-submit">Search</Button>
            </div>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Type
            <Select className="mt-1" value={filters.documentType} onChange={(event) => updateFilter({ documentType: event.target.value as ProposalFilters["documentType"] })} data-testid="managed-document-type-filter">
              <option value="">All types</option>
              <option value="user_manual">Manual</option>
              <option value="policy">Policy</option>
            </Select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Intent
            <Select className="mt-1" value={filters.operation} onChange={(event) => updateFilter({ operation: event.target.value as ProposalFilters["operation"] })} data-testid="managed-document-operation-filter">
              <option value="">New and updates</option>
              <option value="create">New document</option>
              <option value="update">Update</option>
            </Select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            State
            <Select className="mt-1" value={filters.status} onChange={(event) => updateFilter({ status: event.target.value as ProposalFilters["status"] })} data-testid="managed-document-status-filter">
              <option value="pending">All pending</option>
              <option value="in_review">Awaiting review</option>
              <option value="failed">Staging failed</option>
            </Select>
          </label>
          <Button variant="secondary" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading} data-testid="managed-document-refresh">Refresh</Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--muted)]" aria-live="polite">
        <span data-testid="managed-document-range">
          {loading ? "Loading proposals…" : error ? "—" : total === 0 ? "No pending proposals" : `Showing ${shownFrom}–${shownTo} of ${total}`}
        </span>
        <span>Page size {PAGE_SIZE}</span>
      </div>

      {loading && !page ? (
        <div className="space-y-3" data-testid="managed-document-loading">
          {[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]" />)}
        </div>
      ) : unavailable ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-6 text-sm" data-testid="managed-document-unavailable">
          <p className="font-medium">Governed document proposals are unavailable on this deployment.</p>
          <p className="mt-1 text-[var(--muted)]">The review-only preview is disabled. Existing drafts and review controls are unaffected.</p>
        </div>
      ) : denied ? (
        <div className="rounded-xl border border-[var(--error)]/40 bg-[var(--error-soft)] p-6 text-sm text-[var(--error-foreground)]" data-testid="managed-document-denied">
          <p className="font-medium">You do not have access to this project&apos;s document proposals.</p>
          <p className="mt-1">Ask a project owner or manager for access, then retry.</p>
          <Button variant="secondary" className="mt-3" onClick={() => void load()}>Retry</Button>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-[var(--error)]/40 bg-[var(--error-soft)] p-6 text-sm text-[var(--error-foreground)]" data-testid="managed-document-error">
          <p className="font-medium">{error.message}</p>
          <Button variant="secondary" className="mt-3" onClick={() => void load()}>Retry</Button>
        </div>
      ) : page && page.list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] p-8 text-center text-sm" data-testid="managed-document-empty">
          <p className="font-medium">No document proposals match these filters.</p>
          <p className="mt-1 text-[var(--muted)]">Agents stage manual and policy candidates here; nothing is published until an owner applies one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(page?.list || []).map((task) => {
            const proposal = task.managedDocumentProposal;
            if (!proposal) return null;
            const blockers = blockerReasons(task, canApprove);
            const target = proposal.target?.base?.title || (proposal.target?.documentId ? `Document ${proposal.target.documentId.slice(0, 8)}…` : "New document");
            return (
              <article key={task.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" data-testid="managed-document-card" data-task-id={task.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">{task.userStory}</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {proposalType(task) === "policy" ? "Policy" : "Manual"} · {proposal.operation === "create" ? "New document" : "Update"} · {target}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={task.taskStatus === "failed" ? "error" : proposal.skillApplicability?.status === "current" ? "success" : "warning"}>
                      Skill: {proposal.skillApplicability?.status || "unavailable"}
                    </StatusChip>
                    {task.taskStatus === "failed" && <StatusChip tone="error">Staging failed</StatusChip>}
                  </div>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="inline font-medium">Proposer: </dt><dd className="inline">{proposerLabel(task.proposalProvenance, members)}</dd></div>
                  <div><dt className="inline font-medium">Updated: </dt><dd className="inline">{formatDate(task.updatedAt || task.createdAt)}</dd></div>
                  <div><dt className="inline font-medium">Changes: </dt><dd className="inline">{proposal.changes?.length ? proposal.changes.join(", ") : "No visible change"}</dd></div>
                  <div><dt className="inline font-medium">Base revision: </dt><dd className="inline">{proposal.target?.editRevision ? `${proposal.target.editRevision.slice(0, 12)}…` : "None"}</dd></div>
                </dl>

                {proposal.diff?.summary && <p className="mt-2 line-clamp-2 text-xs text-[var(--muted)]">{proposal.diff.summary}</p>}
                {proposal.reason && <p className="mt-1 line-clamp-1 text-xs text-[var(--muted)]">Reason: {proposal.reason}</p>}

                {blockers.length > 0 ? (
                  <ul className="mt-3 space-y-1 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning-soft)] px-3 py-2 text-xs text-[var(--warning-foreground)]" data-testid="managed-document-blockers">
                    {blockers.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-[var(--success-foreground)]">Apply is currently permitted; submission and approval remain separate.</p>
                )}

                <div className="mt-3">
                  <Link
                    href={`/projects/${projectId}/agents/tasks/${task.id}`}
                    className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
                    data-testid="managed-document-open"
                  >
                    Review exact candidate
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={!canPrev || loading} data-testid="managed-document-prev">Previous</Button>
        <span className="text-xs text-[var(--muted)]">Offset {offset}</span>
        <Button variant="secondary" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={!canNext || loading} data-testid="managed-document-next">Next</Button>
      </div>
    </section>
  );
}
