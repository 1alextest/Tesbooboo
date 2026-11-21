"use client";

import { useEffect, useRef, useState } from "react";
import {
  getZyraQaConsequencePreview,
  type GraphQaConsequencePreview
} from "@/lib/api";

/** Existing Zyra project review: an on-demand explanation, never a new AI approval surface. */
export function GraphConsequencePreview({ projectId, historyId }: {
  projectId: string;
  historyId: string;
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
  }, [projectId, historyId]);

  async function toggle(): Promise<void> {
    if (open) {
      setOpen(false);
      active.current?.abort();
      return;
    }
    setOpen(true);
    if (analysis || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const requestedGeneration = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getZyraQaConsequencePreview(projectId, historyId, controller.signal);
      if (controller.signal.aborted || generation.current !== requestedGeneration) return;
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
