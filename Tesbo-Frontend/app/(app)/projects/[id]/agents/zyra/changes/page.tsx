"use client";

import Link from "next/link";
import { SourceBindingSettings } from "./SourceBindingSettings";
import { useParams } from "@/lib/routeParams";
import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async (beforeId?: string) => {
    setLoading(true);
    try {
      const result = await listZyraGraphChanges(projectId, 25, beforeId);
      setEntries(result.entries);
      setCursor(result.entries.length === 25 ? result.entries[result.entries.length - 1].id : undefined);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read change history.");
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function capture() {
    setCapturing(true);
    setNotice(null);
    try {
      const result = await captureZyraGraphChange(projectId);
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
      setError(cause instanceof Error ? cause.message : "Source capture unavailable.");
    } finally { setCapturing(false); }
  }

  async function retry(historyId: string) {
    setNotifying(historyId);
    try {
      const result = await retryZyraGraphReviewNotification(projectId, historyId);
      setNotice(result.status === "delivered"
        ? `Reviewer notifications confirmed for ${result.recipientCount} recipient(s).`
        : result.status === "pending"
          ? `${result.pendingCount} reviewer notification(s) remain pending.`
          : "No eligible reviewer recipients are configured.");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not retry notification.");
    } finally { setNotifying(null); }
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
        <button type="button" onClick={() => void capture()} disabled={capturing}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60">
          {capturing ? "Capturing…" : "Capture configured source"}
        </button>
      </div>
      <SourceBindingSettings projectId={projectId} />
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
                    <p className="text-sm">
                      {receipt.candidates.length} linked case candidate(s) ·
                      {(delta?.modifiedNodeIds.length ?? 0) + (delta?.addedNodeIds.length ?? 0) + (delta?.removedNodeIds.length ?? 0)} changed node(s)
                    </p>
                    {delta && [...delta.addedNodeIds, ...delta.modifiedNodeIds, ...delta.removedNodeIds].length > 0 && (
                      <details><summary className="cursor-pointer text-sm">Observed changed nodes</summary>
                        <ul className="mt-2 list-disc pl-5 text-xs">
                          {[...delta.addedNodeIds, ...delta.modifiedNodeIds, ...delta.removedNodeIds].map((id, index) =>
                            <li key={index} className="break-all"><code>{id}</code></li>)}
                        </ul>
                      </details>
                    )}
                    {receipt.candidates.length > 0 ? <ul className="space-y-2 text-sm">
                      {receipt.candidates.map((candidate) =>
                        <li key={candidate.caseNodeId} className="rounded border border-[var(--border)] p-2">
                          {canonicalReviewCaseId(candidate.caseNodeId, projectId) ? (
                            <Link className="break-all text-sm underline"
                              href={`/projects/${projectId}/testcases/${canonicalReviewCaseId(candidate.caseNodeId, projectId)}`}>
                              Open existing test case
                            </Link>
                          ) : <code className="break-all">{candidate.caseNodeId}</code>}
                          <div className="text-xs text-[var(--muted)]">Review reason: {candidate.reasons.join(", ")}</div>
                          {candidate.requirementNodeIds.length > 0 && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer">Explicit requirement references ({candidate.requirementNodeIds.length})</summary>
                              <ul className="mt-1 list-disc pl-4">{candidate.requirementNodeIds.map((id) =>
                                <li key={id} className="break-all"><code>{id}</code></li>)}</ul>
                            </details>
                          )}
                        </li>)}
                    </ul> : <p className="text-sm text-[var(--muted)]">
                      No explicit case reference was identified. This does not establish that no tests are affected.
                    </p>}
                    <p className="text-xs text-[var(--muted)]">
                      Evidence basis: {receipt.evidence.basis}. Source freshness unverified;
                      execution and coverage unverified. QA must choose and run applicable cases separately.
                    </p>
                    <button type="button" disabled={notifying === entry.id} onClick={() => void retry(entry.id)}
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
    </main>
  );
}
