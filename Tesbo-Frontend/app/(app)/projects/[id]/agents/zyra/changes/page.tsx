"use client";

import Link from "next/link";
import { ModelDraftPreview } from "./ModelDraftPreview";
import { SourceBindingSettings } from "./SourceBindingSettings";
import { ReviewCaseRunSetup } from "./ReviewCaseRunSetup";
import { GraphConsequencePreview } from "./GraphConsequencePreview";
import { CaseCandidateDetails } from "./CaseCandidateDetails";
import { useParams } from "@/lib/routeParams";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  captureZyraGraphChange, listZyraGraphChanges, retryZyraGraphReviewNotification,
  type GraphReviewHistoryRow
} from "@/lib/api";

/** IDs are JSON tuples produced by Tesbo's canonical case projector.
 * Never let an arbitrary graph node or foreign-project tuple become a case URL.
 */
function canonicalReviewCaseId(nodeId: string, projectId: string): string | null {
  try {
    const parts: unknown = JSON.parse(nodeId);
    if (!Array.isArray(parts) || parts.length !== 3 ||
        parts[0] !== "test_case" || parts[1] !== projectId ||
        typeof parts[2] !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[2])) {
      return null;
    }
    return parts[2];
  } catch { return null; }
}

/** An inspection view inside Zyra, not a second agent or approval board. */
export default function ZyraChangeReviewPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [entries, setEntries] = useState<GraphReviewHistoryRow[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A late page request must not replace newer history or cross a project switch.
  // Keep this in the existing view rather than adding a second request/cache owner.
  const historyRequest = useRef({ generation: 0 });
  const historyReads = useRef(new Set<AbortController>());
  // Capture/notification writes can commit even when a browser navigates away.
  // Never apply their late UI feedback to another project or remount.
  const mutationLifetime = useRef({ generation: 0 });
  const activeProject = useRef(projectId);
  const notificationInFlight = useRef<{ historyId: string; generation: number } | null>(null);
  const captureInFlight = useRef<{ generation: number } | null>(null);
  activeProject.current = projectId;
  const load = useCallback(async (beforeId?: string) => {
    const request = ++historyRequest.current.generation;
    const controller = new AbortController();
    const reads = historyReads.current;
    reads.add(controller);
    setLoading(true);
    try {
      const result = await listZyraGraphChanges(projectId, 25, beforeId, controller.signal);
      if (historyRequest.current.generation !== request) return;
      setEntries(result.entries);
      setCursor(result.entries.length === 25 ? result.entries[result.entries.length - 1].id : undefined);
      setError(null);
    } catch (cause) {
      if (historyRequest.current.generation !== request) return;
      setError(cause instanceof Error ? cause.message : "Could not read change history.");
    } finally {
      reads.delete(controller);
      if (historyRequest.current.generation === request) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    mutationLifetime.current.generation++;
    setEntries([]);
    setCursor(undefined);
    setError(null);
    setNotice(null);
    setCapturing(false);
    notificationInFlight.current = null;
    captureInFlight.current = null;
    setNotifying(null);
    void load();
    const reads = historyReads.current;
    const requestState = historyRequest.current;
    const mutationState = mutationLifetime.current;
    return () => {
      requestState.generation++;
      mutationState.generation++;
      for (const controller of reads) controller.abort();
      reads.clear();
    };
  }, [load]);

  async function capture() {
    // A double-click can arrive before React commits the disabled state.
    // Source capture has its own lock; notification retry remains independent.
    if (captureInFlight.current) return;
    const mutation = mutationLifetime.current.generation;
    const attempt = { generation: mutation };
    captureInFlight.current = attempt;
    const isCurrent = () => activeProject.current === projectId &&
      mutationLifetime.current.generation === mutation &&
      captureInFlight.current === attempt;
    setCapturing(true);
    setNotice(null);
    try {
      const result = await captureZyraGraphChange(projectId);
      if (!isCurrent()) return;
      setNotice(result.stored
        ? result.reviewReceipt
          ? "A change was recorded for QA triage. No tests have been executed or approved."
          : "A source baseline or scope change was recorded. Impact is not yet comparable."
        : "No change to the observed graph content.");
      if (result.delivery?.status === "pending") {
        setNotice(`Graph recorded; ${result.delivery.pendingCount} reviewer notification(s) are pending delivery.`);
      }
      await load();
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : "Source capture unavailable.");
    } finally {
      if (isCurrent()) {
        captureInFlight.current = null;
        setCapturing(false);
      }
    }
  }

  async function retry(historyId: string) {
    // Only one native delivery attempt per page at a time. The database dedupes
    // committed notifications; this lock prevents conflicting UI outcomes.
    if (notificationInFlight.current) return;
    const mutation = mutationLifetime.current.generation;
    const attempt = { historyId, generation: mutation };
    notificationInFlight.current = attempt;
    const isCurrent = () => activeProject.current === projectId &&
      mutationLifetime.current.generation === mutation &&
      notificationInFlight.current === attempt;
    setNotifying(historyId);
    try {
      const result = await retryZyraGraphReviewNotification(projectId, historyId);
      if (!isCurrent()) return;
      setNotice(result.status === "delivered"
        ? `Reviewer notifications confirmed for ${result.recipientCount} recipient(s).`
        : result.status === "pending"
          ? `${result.pendingCount} reviewer notification(s) remain pending.`
          : "No eligible reviewer recipients are configured.");
      setError(null);
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : "Could not retry notification.");
    } finally {
      if (isCurrent()) {
        notificationInFlight.current = null;
        setNotifying(null);
      }
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-5 py-8 text-[var(--foreground)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm text-[var(--muted)] underline" href={`/projects/${projectId}/agents/zyra`}>Back to Zyra</Link>
          <h1 className="mt-2 text-2xl font-semibold">Change impact review</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Observed source and requirement changes, linked test-case candidates, and remaining verification gaps.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void capture()} disabled={capturing}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60">
            {capturing ? "Capturing…" : "Capture configured source"}
          </button>
          <Link href="#source-setup" className="text-sm underline">Configure source</Link>
        </div>
      </div>
      <section aria-label="Manual QA verification actions" className="rounded-lg border border-[var(--border)] p-4 text-sm">
        <h2 className="font-semibold">Continue verification in existing Tesbo records</h2>
        <p className="mt-1 text-[var(--muted)]">
          Inspect the affected requirement and case, select or create a test run, execute and attach actual
          evidence, log any verified defect, then complete human review. A graph link is not a test result.
        </p>
        <nav aria-label="Native QA workflow" className="mt-3 flex flex-wrap gap-4">
          <Link className="underline" href={`/projects/${projectId}/requirements`}>Requirements</Link>
          <Link className="underline" href={`/projects/${projectId}/testcases`}>Test cases</Link>
          <Link className="underline" href={`/projects/${projectId}/cycles`}>Test runs and execution</Link>
          <Link className="underline" href={`/projects/${projectId}/bugs`}>Defects</Link>
        </nav>
      </section>
      <p className="text-sm text-[var(--muted)]">
        Captures require an administrator-approved project source binding. A reference does not prove
        coverage; no case is failed, executed or approved from this page.
      </p>
      {error && <div role="alert" className="rounded-lg border border-[var(--border)] p-3 text-sm">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-[var(--border)] p-3 text-sm">{notice}</div>}
      {loading ? <p>Loading change history…</p> : entries.length === 0 ? (
        <p className="rounded-lg border border-[var(--border)] p-5 text-sm">No committed graph observations are available for this project.</p>
      ) : (
        <section aria-label="Graph change history" className="space-y-3">
          {entries.map((entry) => {
            const receipt = entry.reviewReceipt;
            const delta = receipt?.changed;
            return (
              <article key={entry.id} className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{entry.changeState === "baseline" ? "Initial observation" :
                    entry.changeState === "source_scope_changed" ? "Source scope changed — impact unknown" : "Change review"}</strong>
                  <span className="text-xs text-[var(--muted)]">{new Date(entry.capturedAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">Revision: <code>{entry.revision.slice(0, 16)}</code></p>
                {receipt ? (
                  <>
                    <section aria-label="Human QA review focus" data-testid={`qa-review-focus-${entry.id}`}
                      className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
                      <h3 className="font-semibold">
                        {receipt.candidates.length
                          ? "Assess nominated case references for this change"
                          : "Identify affected behavior before selecting tests"}
                      </h3>
                      <p>
                        The recorded source observation contains{" "}
                        {(delta?.modifiedNodeIds.length ?? 0) + (delta?.addedNodeIds.length ?? 0) + (delta?.removedNodeIds.length ?? 0)}
                        {" changed graph node(s) and "}
                        {receipt.candidates.length} nominated case reference(s). These are investigation leads,
                        not verified product outcomes or test coverage.
                      </p>
                      <p>
                        <strong>Still unknown:</strong> whether each candidate reflects the applicable approved
                        expectation, whether other behavior is affected, and whether any current build passed
                        an actual execution. Source freshness is unverified.
                      </p>
                      <p>
                        <strong>Next human action:</strong>{" "}
                        {receipt.candidates.length
                          ? "Inspect nominated case references and approved requirements, confirm applicability, then select eligible approved cases for a native run below."
                          : "Investigate the changed behavior and approved requirements, find or propose applicable cases, then prepare a native run."}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Authority: this page can help prepare QA work and notify reviewers. It does not
                        approve a requirement, test case, policy, execution result or release; each decision
                        remains with its authorized native owner.
                      </p>
                    </section>
                    {delta && [...delta.addedNodeIds, ...delta.modifiedNodeIds, ...delta.removedNodeIds].length > 0 && (
                      <details><summary className="cursor-pointer text-sm">Observed changed nodes</summary>
                        <ul className="mt-2 list-disc pl-5 text-xs">
                          {[...delta.addedNodeIds, ...delta.modifiedNodeIds, ...delta.removedNodeIds].map((id, index) =>
                            <li key={index} className="break-all"><code>{id}</code></li>)}
                        </ul>
                      </details>
                    )}
                    {receipt.candidates.length > 0 ? <ul className="space-y-2 text-sm">
                      {receipt.candidates.map((candidate) => {
                        const caseId = canonicalReviewCaseId(candidate.caseNodeId, projectId);
                        return <li key={candidate.caseNodeId} className="rounded border border-[var(--border)] p-2">
                          {caseId ? (
                            <>
                              <Link className="break-all text-sm underline"
                                href={`/projects/${projectId}/testcases/${caseId}`}>
                                Open existing test case
                              </Link>
                              <CaseCandidateDetails key={`${projectId}:${caseId}`}
                                projectId={projectId} caseId={caseId} inspectDefectHistory />
                            </>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs">Noncanonical or foreign-project case reference; no native case read was attempted.</p>
                              <code className="break-all text-xs">{candidate.caseNodeId}</code>
                            </div>
                          )}
                          <div className="text-xs text-[var(--muted)]">Review reason: {candidate.reasons.join(", ")}</div>
                          {candidate.requirementNodeIds.length > 0 && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer">Explicit requirement references ({candidate.requirementNodeIds.length})</summary>
                              <ul className="mt-1 list-disc pl-4">{candidate.requirementNodeIds.map((id) =>
                                <li key={id} className="break-all"><code>{id}</code></li>)}</ul>
                            </details>
                          )}
                        </li>;
                      })}
                    </ul> : <p className="text-sm text-[var(--muted)]">
                      No explicit case reference was identified. This does not establish that no tests are affected.
                    </p>}
                    <p className="text-xs text-[var(--muted)]">
                      Evidence basis: {receipt.evidence.basis}. Source freshness unverified;
                      execution and coverage unverified. QA must choose and run applicable cases separately.
                    </p>
                    <GraphConsequencePreview key={`${projectId}:${entry.id}:${receipt.id}`} projectId={projectId} historyId={entry.id} receiptId={receipt.id} />
                    <ReviewCaseRunSetup projectId={projectId} receiptId={entry.id}
                      candidateCaseIds={receipt.candidates.map((candidate) =>
                        canonicalReviewCaseId(candidate.caseNodeId, projectId)
                      ).filter((id): id is string => id !== null)} />
                    <button type="button" disabled={notifying !== null} onClick={() => void retry(entry.id)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60">
                      {notifying === entry.id ? "Checking notification…" : "Notify QA reviewers"}
                    </button>
                    <Link href={`/projects/${projectId}/agents/zyra`} className="text-sm underline">
                      Continue review with Zyra
                    </Link>
                  </>
                ) : <p className="text-sm text-[var(--muted)]">
                  {entry.changeState === "baseline"
                    ? "This is the first observation, not a validated change."
                    : "The source selection or projection scope changed. Impact must be reassessed before test selection."}
                </p>}
              </article>
            );
          })}
        </section>
      )}
      {cursor && <button type="button" onClick={() => void load(cursor)}
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm">
        Older observations
      </button>}
      <section id="source-setup" aria-label="Source configuration and draft model inspection" className="space-y-3">
        <h2 className="text-base font-semibold">Source setup and draft model inspection</h2>
        <p className="text-sm text-[var(--muted)]">
          Configure the observed source or inspect an unapproved model draft here.
          Neither action verifies an expected behavior or records a test result.
        </p>
        <SourceBindingSettings key={projectId} projectId={projectId} />
        <ModelDraftPreview key={projectId} projectId={projectId} />
      </section>
    </main>
  );
}
