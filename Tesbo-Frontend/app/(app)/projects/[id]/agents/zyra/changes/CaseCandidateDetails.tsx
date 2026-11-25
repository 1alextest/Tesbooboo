"use client";

import { useEffect, useRef, useState } from "react";
import { getTestCase } from "@/lib/api";

type DisplayCase = { title: string; status: string; approvalCurrent: boolean };

/**
 * A graph reference is not proof that a native case currently exists or is approved.
 * Fetch a case's real, project-authorized identity only when the reviewer requests it.
 * Avoid a potentially unbounded fan-out on a history page with many candidates.
 */
export function CaseCandidateDetails({ projectId, caseId }: {
  projectId: string;
  caseId: string;
}) {
  const [caseDetails, setCaseDetails] = useState<DisplayCase | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "read" | "unavailable">("idle");
  const activeRead = useRef<AbortController | null>(null);

  useEffect(() => {
    // The parent keys this component by project and case. An in-flight response
    // must never render under a later project or after leaving the review.
    return () => {
      activeRead.current?.abort();
      activeRead.current = null;
    };
  }, [projectId, caseId]);

  async function inspect(): Promise<void> {
    if (activeRead.current) return;
    const controller = new AbortController();
    activeRead.current = controller;
    setState("loading");
    // Clear previous identity before rechecking permission and current state.
    // An earlier authorized read is not permission to keep showing stale details.
    setCaseDetails(null);
    try {
      const current = await getTestCase(projectId, caseId, controller.signal);
      if (controller.signal.aborted || activeRead.current !== controller) return;
      // Require the server's explicit identity; a fallback to the requested URL
      // would falsely verify a malformed or unrelated case response.
      if (current.id !== caseId || typeof current.title !== "string" ||
          !current.title.trim() || typeof current.status !== "string" ||
          !current.status.trim()) {
        setState("unavailable");
        return;
      }
      setCaseDetails({
        title: current.title,
        status: current.status,
        approvalCurrent: current.approvalCurrent === true,
      });
      setState("read");
    } catch {
      if (!controller.signal.aborted && activeRead.current === controller) {
        // Do not reveal another project's record, a private error payload or a
        // previous case identity after a 401/403/404 or transport failure.
        setState("unavailable");
      }
    } finally {
      if (activeRead.current === controller) activeRead.current = null;
    }
  }

  return (
    <section aria-label="Native case identity" className="mt-2 space-y-1 text-xs">
      <button type="button" onClick={() => void inspect()} disabled={state === "loading"}
        className="underline underline-offset-2 disabled:opacity-60">
        {state === "loading" ? "Reading authorized case…" :
          state === "read" ? "Refresh case details" : "Inspect case details"}
      </button>
      {state === "idle" && <p className="text-[var(--muted)]">
        This is a graph reference. Its title, current approval and applicability have not been checked.
      </p>}
      {state === "loading" && <p role="status">Checking the current case in this project…</p>}
      {state === "unavailable" && <p role="status">
        Case details are unavailable or access has changed. This reference is not verified;
        use the authorized Test Cases view to investigate.
      </p>}
      {caseDetails && state === "read" && (
        <div className="space-y-1 rounded border border-[var(--border)] p-2">
          <p><strong>Native case:</strong> {caseDetails.title}</p>
          <p>At this read: {caseDetails.status} ·{" "}
            {caseDetails.status === "Approved" && caseDetails.approvalCurrent
              ? "approval current" : "not currently approved for a new run"}
          </p>
          <p className="text-[var(--muted)]">
            Identity and approval are read-only snapshots, not proof of applicability,
            test execution or change coverage. Run attachment rechecks approval.
          </p>
        </div>
      )}
    </section>
  );
}
