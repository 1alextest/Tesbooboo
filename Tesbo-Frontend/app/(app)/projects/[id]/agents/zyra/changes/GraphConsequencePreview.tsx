"use client";

import { useEffect, useRef, useState } from "react";
import {
  getZyraQaConsequencePreview,
  type GraphQaConsequencePreview
} from "@/lib/api";

function sourceLabel(id: string | null, index: number): string {
  if (id === null) return "Not present in this observation";
  try {
    const parts: unknown = JSON.parse(id);
    if (Array.isArray(parts) && typeof parts[index] === "string") return parts[index];
  } catch { /* preserve unknown rather than render an invented label */ }
  return "Reference unavailable";
}
function investigationPrompt(kind: string, change: string): string {
  if (change === "removed") return "Determine whether removal is intended, and verify affected callers, user alternatives and retained records.";
  switch (kind) {
    case "journey": return "Establish the user goal, approved outcome, alternate path and interrupted-work recovery. Check the durable outcome, not only the last screen.";
    case "state": return "Check allowed and refused transitions, delayed or repeated events, and the resulting durable state.";
    case "route": return "Check allowed and refused actors, invalid input, the intended effect and downstream observations.";
    default: return "Check the approved outcome, a nearby unchanged case, failure recovery and the independent result.";
  }
}

/** Existing Zyra project review: an on-demand explanation, never a new AI approval surface. */
export function GraphConsequencePreview({ projectId, historyId, receiptId }: {
  projectId: string;
  historyId: string;
  receiptId: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<GraphQaConsequencePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

  // Ignore a stale analysis response after leaving or switching the project/history row.
  useEffect(() => {
    const requestVersion = generation;
    return () => {
      requestVersion.current++;
      active.current?.abort();
      active.current = null;
    };
  }, [projectId, historyId, receiptId]);

  async function toggle(): Promise<void> {
    if (open) {
      setOpen(false);
      setAnalysis(null);
      setError(null);
      // A pending request can be abandoned and immediately reopened. Remove its active
      // identity and loading state synchronously, and fence its late completion.
      if (active.current) {
        active.current.abort();
        active.current = null;
        generation.current++;
      }
      setLoading(false);
      return;
    }
    setOpen(true);
    if (active.current) return;
    setAnalysis(null);
    const controller = new AbortController();
    active.current = controller;
    const requestedGeneration = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getZyraQaConsequencePreview(projectId, historyId, controller.signal);
      if (controller.signal.aborted || generation.current !== requestedGeneration) return;
      if (!result || result.projectId !== projectId || result.receiptId !== receiptId) {
        setError("Impact explanation unavailable for this review.");
        return;
      }
      setAnalysis(result);
    } catch (cause) {
      if (controller.signal.aborted || generation.current !== requestedGeneration) return;
      setError(cause instanceof Error ? cause.message : "Analysis could not be read.");
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted && generation.current === requestedGeneration) setLoading(false);
    }
  }

  return (
    <section aria-label="Evidence-bounded impact explanation" className="rounded-lg border border-[var(--border)] p-3 text-sm">
      <button type="button" aria-expanded={open} onClick={() => void toggle()}
        className="font-medium underline underline-offset-2">
        {open ? "Hide impact explanation" : "Explain possible impact (read-only)"}
      </button>
      {open && <div className="mt-3 space-y-2">
        {loading && <p role="status">Reading the authorized project&apos;s recorded QA change receipt…</p>}
        {error && <p role="alert" className="text-[var(--foreground)]">{error}</p>}
        {analysis && <>
          {analysis.cachedRequirementReview ? (
            <section aria-label="Changed requirement nomination review" className="space-y-2 border-b border-[var(--border)] pb-3">
              <h3 className="font-semibold">Review changed requirements</h3>
              {analysis.cachedRequirementReview.changedRequirementCount === 0 ? (
                <p>No changed cached requirement nodes were recorded. Other changes may still need review.</p>
              ) : (
                <>
                  <p>{analysis.cachedRequirementReview.withoutNomination.length} of{" "}
                    {analysis.cachedRequirementReview.changedRequirementCount} changed cached requirements have no case nomination in this receipt.</p>
                  {analysis.cachedRequirementReview.withoutNomination.length > 0 && <>
                    <p>Investigate the affected expectations and existing cases before proposing or selecting tests. For removed requirements, assess downstream effects of removal.</p>
                    <details>
                      <summary className="cursor-pointer text-sm underline">Inspect recorded requirement references</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {analysis.cachedRequirementReview.withoutNomination.map(item => (
                          <li key={item.requirementNodeId}>
                            <span className="font-medium capitalize">{item.change}</span>{" — "}
                            <code className="break-all text-xs">{item.requirementNodeId}</code>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>}
                </>
              )}
              <p className="text-xs text-[var(--muted)]">
                Receipt-time nominations are not current links, approved expectations or verified coverage.
                This inventory counts changed nodes only; link-only changes need separate review.
              </p>
            </section>
          ) : <p className="text-xs text-[var(--muted)]">Requirement-level nomination inventory is unavailable for this observation.</p>}
          {analysis.sourceDeclarationReview?.version === 1 && (
            <section aria-label="Source behavior review" className="space-y-3 border-b border-[var(--border)] pb-3">
              <h3 className="font-semibold">Investigate affected user behavior</h3>
              <p>{analysis.sourceDeclarationReview.declarationLeadCount} declaration review lead(s) and{" "}
                {analysis.sourceDeclarationReview.changedFileCount} changed source file(s) in the recorded comparison.</p>
              {analysis.sourceDeclarationReview.filesWithoutDeclarationCount > 0 && (
                <div className="space-y-1">
                  <p className="font-medium">{analysis.sourceDeclarationReview.filesWithoutDeclarationCount} changed file(s) have no associated declaration in either observation.</p>
                  <p>Identify the affected user goals and approved expectations before selecting tests. The absence of a declaration does not establish no impact.</p>
                  <details><summary className="cursor-pointer underline">Inspect unresolved source files</summary>
                    <ul className="list-disc pl-5">
                      {analysis.sourceDeclarationReview.filesWithoutDeclaration.map(id =>
                        <li key={id} className="break-all">{sourceLabel(id, 3)}</li>)}
                    </ul>
                    {analysis.sourceDeclarationReview.filesWithoutDeclarationCount > analysis.sourceDeclarationReview.filesWithoutDeclaration.length &&
                      <p className="text-xs">Showing the first {analysis.sourceDeclarationReview.filesWithoutDeclaration.length}; additional file references remain in scope.</p>}
                  </details>
                </div>
              )}
              {analysis.sourceDeclarationReview.leads.map(lead => {
                const kind = sourceLabel(lead.nodeId, 3);
                const label = sourceLabel(lead.nodeId, 4);
                return <div key={lead.nodeId} className="space-y-1 rounded border border-[var(--border)] p-2">
                  <p className="font-medium break-words">{kind}: {label}</p>
                  <p className="text-xs text-[var(--muted)]">{lead.change === "related_source_change"
                    ? "Supporting source changed; declaration itself not recorded as changed."
                    : "Declaration " + lead.change + " in the recorded comparison."}</p>
                  <p>{investigationPrompt(kind, lead.change)}</p>
                  <p className="text-xs">Reconcile these questions against applicable approved requirements and existing test cases. Missing semantic coverage is not established.</p>
                  <details><summary className="cursor-pointer underline text-xs">Source references</summary>
                    <p className="break-all text-xs">Before: {sourceLabel(lead.beforeFileId, 3)}</p>
                    <p className="break-all text-xs">After: {sourceLabel(lead.afterFileId, 3)}</p>
                    <code className="break-all text-xs">{lead.nodeId}</code>
                  </details>
                </div>;
              })}
              {analysis.sourceDeclarationReview.declarationLeadCount > analysis.sourceDeclarationReview.leads.length &&
                <p className="text-xs">Showing the first {analysis.sourceDeclarationReview.leads.length}; additional declaration leads remain in scope.</p>}
              <p className="text-xs text-[var(--muted)]">
                Direct declaration changes appear before related-source leads, not as a severity ranking.
                Declaration inventory, runtime semantics, historical defect relevance and test coverage remain unverified.
              </p>
            </section>
          )}
          {analysis.source?.contractId === "tesbo-implementation-declarations-v1" && !analysis.sourceDeclarationReview &&
            <p>Source behavior inventory is unavailable for this observation.</p>}
          <p>Possible test-case review effects, not confirmed business consequences or executed results.</p>
          {analysis.candidateEffects.length > 0 ? (
            <ul className="list-disc space-y-2 pl-5">
              {analysis.candidateEffects.map((effect) => <li key={effect.caseNodeId}>
                <span className="font-medium">Review existing test case</span>
                <code className="ml-2 break-all text-xs">{effect.caseNodeId}</code>
                <p className="text-xs text-[var(--muted)]">
                  Based on: {effect.observedReasons.join(", ")}. An independently accepted expected result and
                  applicable scope must still be verified.
                </p>
                {effect.requirementNodeIds.length > 0 && <p className="break-all text-xs text-[var(--muted)]">
                  Native cached requirement reference(s): {effect.requirementNodeIds.join(", ")}
                </p>}
              </li>)}
            </ul>
          ) : <p>No explicit test-case effect was identified. This does not mean no behavior is affected.</p>}
          {analysis.unlinkedOrUnprovenChange && <p role="status">
            The observed change still has unproven consequences. Candidate references do not establish
            complete mappings or verified test outcomes; QA must assess the remaining impact.
          </p>}
          <p className="text-xs text-[var(--muted)]">
            Evidence: {analysis.basis}. Source freshness, policy and user-manual consequences,
            semantic causality, deployment and executed coverage are unverified.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Next action: independent QA review in the existing Tesbo case and run workflow.
            No case or approval was modified by this explanation.
          </p>
        </>}
      </div>}
    </section>
  );
}
