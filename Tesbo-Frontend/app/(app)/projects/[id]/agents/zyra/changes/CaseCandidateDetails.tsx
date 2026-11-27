"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getTestCase, listBugs } from "@/lib/api";

type DisplayCase = { title: string; status: string; approvalCurrent: boolean };

/**
 * A graph reference is not proof that a native case currently exists or is approved.
 * Fetch a case's real, project-authorized identity only when the reviewer requests it.
 * Avoid a potentially unbounded fan-out on a history page with many candidates.
 */
export function CaseCandidateDetails({ projectId, caseId, inspectDefectHistory = false }: {
  projectId: string;
  caseId: string;
  inspectDefectHistory?: boolean;
}) {
  const [caseDetails, setCaseDetails] = useState<DisplayCase | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "read" | "unavailable">("idle");
  const activeRead = useRef<AbortController | null>(null);
  const defectRead = useRef<AbortController | null>(null);
  const [defectState, setDefectState] = useState<"idle" | "loading" | "read" | "unavailable">("idle");
  const [defects, setDefects] = useState<{ total: number; items: Array<{ id: string; title: string; status: string }> } | null>(null);

  useEffect(() => {
    // The parent keys this component by project and case. An in-flight response
    // must never render under a later project or after leaving the review.
    return () => {
      activeRead.current?.abort();
      activeRead.current = null;
      defectRead.current?.abort();
      defectRead.current = null;
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
    defectRead.current?.abort();
    defectRead.current = null;
    setDefects(null);
    setDefectState("idle");
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

  async function inspectHistory(): Promise<void> {
    if (!inspectDefectHistory || state !== "read" || defectRead.current || activeRead.current) return;
    const controller = new AbortController();
    defectRead.current = controller;
    setDefects(null);
    setDefectState("loading");
    try {
      const rows = await listBugs(projectId, { testcaseId: caseId }, controller.signal);
      if (controller.signal.aborted || defectRead.current !== controller) return;
      // Do not fall back to the denormalized testcase_id or infer cause from a title.
      const ids = new Set<string>();
      if (!Array.isArray(rows) || rows.some(row => {
        if (!row || typeof row.id !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) ||
            ids.has(row.id) || typeof row.title !== "string" || !row.title.trim() ||
            typeof row.status !== "string" || !row.status.trim() ||
            !Array.isArray(row.links) || !row.links.some(link => link?.testcaseId === caseId)) return true;
        ids.add(row.id);
        return false;
      })) {
        setDefectState("unavailable");
        return;
      }
      // Bound display; no descriptions, attachments, reporter data or model context.
      setDefects({ total: rows.length, items: rows.slice(0, 10).map(row => ({
        id: row.id, title: row.title, status: row.status
      })) });
      setDefectState("read");
    } catch {
      if (!controller.signal.aborted && defectRead.current === controller) setDefectState("unavailable");
    } finally {
      if (defectRead.current === controller) defectRead.current = null;
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
          {inspectDefectHistory && (
            <section aria-label="Linked defect history" className="space-y-1 border-t border-[var(--border)] pt-2">
              <button type="button" className="underline disabled:opacity-60" disabled={defectState === "loading"}
                onClick={() => void inspectHistory()}>
                {defectState === "loading" ? "Reading linked defects…" :
                  defectState === "read" ? "Refresh linked defects" : "Inspect linked defect history"}
              </button>
              {defectState === "unavailable" && <p role="status">Linked defect history is unavailable or access has changed.</p>}
              {defectState === "read" && defects && <>
                <p>{defects.total} linked defect record(s) returned for this exact case.</p>
                {defects.items.length > 0 && <ul className="list-disc pl-5">
                  {defects.items.map(defect => <li key={defect.id}>
                    <Link className="underline break-words" href={`/projects/${projectId}/bugs/${defect.id}`}>{defect.title}</Link>
                    {" — "}{defect.status}
                  </li>)}
                </ul>}
                {defects.total > defects.items.length && <p>Showing the first {defects.items.length} returned records; open the existing Defects view to investigate further.</p>}
                <p className="text-[var(--muted)]">
                  Compare the original trigger, actor, state transition, durable effect and verified correction with this change.
                  A case link is a historical investigation lead, not a causal match or proof of recurrence.
                  Zero linked records does not establish that no similar defects exist.
                </p>
              </>}
            </section>
          )}

        </div>
      )}
    </section>
  );
}
