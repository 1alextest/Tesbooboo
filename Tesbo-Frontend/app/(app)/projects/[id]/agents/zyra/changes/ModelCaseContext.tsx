"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTestCase } from "@/lib/api";
import { parseSteps } from "@/lib/reviewBoard";

/** A current native case read, never a model mapping, snapshot or requirements oracle. */
export function ModelCaseContext({ projectId, caseRef }: { projectId: string; caseRef: string }) {
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const validRef = /^[A-Za-z0-9_-]{1,100}$/.test(caseRef);
  const [error, setError] = useState(!validRef);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    if (!validRef) return () => { alive = false; controller.abort(); };
    void getTestCase(projectId, caseRef, controller.signal).then(data => {
      if (data.projectId !== projectId || typeof data.id !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) throw new Error("Case identity unavailable");
      if (alive) setRecord(data);
    }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; controller.abort(); };
  }, [projectId, caseRef, retry, validRef]);
  const text = (value: unknown) => typeof value === "string" ? value : "";
  const steps = record ? parseSteps(record.steps) : [];
  return <section aria-label="Saved test case context" className="min-w-0 space-y-3 rounded-lg border border-[var(--border)] p-4 text-sm">
    <h2 className="font-semibold">Saved test case context</h2>
    <p className="text-xs text-[var(--muted)]">Saved record as loaded; unsaved edits in another tab are not included.
      This reference does not map or approve the model, verify an expectation, or change the test case.</p>
    {!record && !error && <p role="status">Loading saved case…</p>}
    {error && <><p role="alert">Saved case is unavailable in this project. It may be missing or inaccessible.</p>
      {validRef && <button type="button" onClick={() => { setRecord(null); setError(false); setRetry(value => value + 1); }} className="underline">Retry saved case</button>}</>}
    {record && <>
      <h3 className="break-words font-medium">{text(record.externalId)} · {text(record.title)}</h3>
      <p>Saved status: {text(record.status) || "Unavailable"}</p>
      <details><summary className="cursor-pointer">Inspect saved case content</summary>
        <dl className="mt-2 space-y-2 break-words">
          <dt className="font-medium">Description</dt><dd className="whitespace-pre-wrap">{text(record.description) || "Not recorded"}</dd>
          <dt className="font-medium">Preconditions</dt><dd className="whitespace-pre-wrap">{text(record.preconditions) || "Not recorded"}</dd>
          <dt className="font-medium">Postconditions</dt><dd className="whitespace-pre-wrap">{text(record.postconditions) || "Not recorded"}</dd>
        </dl>
        <ol className="mt-3 list-decimal space-y-2 pl-5">{steps.map((step, index) => <li key={index} className="break-words whitespace-pre-wrap">
          {step.action}<br />Expected result (case text): {step.expected || "Not recorded"}
        </li>)}</ol>
        {!steps.length && <p>No saved steps recorded.</p>}
      </details>
      <details><summary className="cursor-pointer">Saved case edit revision</summary>
        <p className="break-all font-mono text-xs">{text(record.editRevision) || "Unavailable"}</p>
        <p className="text-xs">Current case edit token; not a model revision or an immutable model binding.</p>
      </details>
      <Link href={`/projects/${projectId}/testcases/${encodeURIComponent(text(record.id))}`} className="underline">Return to saved test case</Link>
      <button type="button" onClick={() => { setRecord(null); setError(false); setRetry(value => value + 1); }}
        className="ml-3 underline">Refresh saved case context</button>
    </>}
  </section>;
}
