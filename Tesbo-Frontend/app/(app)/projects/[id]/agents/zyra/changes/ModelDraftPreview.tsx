"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getModelPreviewAvailability, previewModelDraft } from "@/lib/api";
import type { ModelDraftPreview as Preview, ModelPreviewAvailability } from "@/lib/model-draft-preview";

const EXAMPLE = JSON.stringify({ schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "ready",
  states: [{ id: "ready", label: "Ready" }, { id: "done", label: "Done" }],
  transitions: [{ id: "complete", from: "ready", to: "done", action: "Complete the action", expectedObservation: "Completion is visible" }] }, null, 2);

/** Local component state only. A result belongs to one exact input and project. */
export function ModelDraftPreview({ projectId }: { projectId: string }) {
  const editorId = useId();
  const helpId = editorId + "-help";
  const [availability, setAvailability] = useState<ModelPreviewAvailability | null>(null);
  const [checking, setChecking] = useState(true);
  const [check, setCheck] = useState(0);
  const [text, setText] = useState("");
  const [result, setResult] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lifecycle = useRef<{ mounted: boolean; generation: number; operation: AbortController | null }>({
    mounted: false, generation: 0, operation: null
  });

  useEffect(() => {
    const current = lifecycle.current;
    current.mounted = true;
    return () => { current.mounted = false; current.generation++; current.operation?.abort(); };
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setChecking(true);
    setAvailability(null);
    setError(null);
    void getModelPreviewAvailability(projectId, controller.signal).then(value => {
      if (alive) setAvailability(value);
    }).catch(cause => {
      if (alive) setError(cause instanceof Error ? cause.message : "Preview availability could not be checked.");
    }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; controller.abort(); };
  }, [projectId, check]);

  function invalidate(message: string | null = null) {
    lifecycle.current.generation++;
    lifecycle.current.operation?.abort();
    lifecycle.current.operation = null;
    setBusy(false);
    setResult(null);
    setError(null);
    setNotice(message);
  }

  async function submit() {
    if (lifecycle.current.operation || !availability?.enabled || !text.trim()) return;
    invalidate();
    let candidate: unknown;
    try { candidate = JSON.parse(text); }
    catch { setError("Enter valid JSON before previewing this draft."); return; }
    const current = ++lifecycle.current.generation, controller = new AbortController();
    lifecycle.current.operation = controller;
    setBusy(true);
    try {
      const preview = await previewModelDraft(projectId, candidate, controller.signal);
      if (lifecycle.current.mounted && lifecycle.current.generation === current) setResult(preview);
    } catch (cause) {
      if (lifecycle.current.mounted && lifecycle.current.generation === current) {
        setError(cause instanceof Error ? cause.message : "The draft could not be previewed.");
      }
    } finally {
      if (lifecycle.current.mounted && lifecycle.current.generation === current) { lifecycle.current.operation = null; setBusy(false); }
    }
  }

  return (
    <details data-testid="model-draft-preview" className="rounded-lg border border-[var(--border)] p-4 text-sm">
      <summary className="cursor-pointer font-semibold">Draft model preview</summary>
      <div className="mt-3 space-y-3">
        <p className="text-[var(--muted)]">Inspect a sequential state model without saving it. Draft expectations remain unapproved;
          no tests are run and no coverage or target behavior is verified. Leaving this page discards the draft.</p>
        {checking && <p role="status">Checking preview availability…</p>}
        {!checking && !availability?.enabled && <>
          {availability && <p role="status">Draft model preview is not enabled.</p>}
          <button type="button" onClick={() => setCheck(value => value + 1)} className="underline">Check preview availability</button>
        </>}
        {availability?.enabled && <form onSubmit={event => { event.preventDefault(); void submit(); }} className="space-y-3">
          <div>
            <label className="block" htmlFor={editorId}>Draft model JSON</label>
            <textarea id={editorId} aria-describedby={helpId} value={text} rows={12} maxLength={1000000}
              onChange={event => { invalidate(); setText(event.target.value); }}
              className="mt-1 w-full min-w-0 rounded border border-[var(--border)] bg-transparent p-2 font-mono text-xs" />
          </div>
          <p id={helpId} className="text-xs text-[var(--muted)]">
            Use the draft format shown by the example: 1–32 states and up to 64 transitions. Labels, actions and expected observations are inert draft text.
            An example does not establish requirements or an approved oracle.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => { invalidate("Example loaded. Review and replace its expectations before use."); setText(EXAMPLE); }}
              className="rounded border border-[var(--border)] px-3 py-2">Load example draft</button>
            <button type="submit" disabled={busy || !text.trim()} className="rounded border border-[var(--border)] px-3 py-2 disabled:opacity-60">
              {busy ? "Previewing draft…" : "Preview draft"}
            </button>
            <button type="button" disabled={!busy} onClick={() => invalidate("Preview cancelled. The draft remains here; no result was accepted.")}
              className="rounded border border-[var(--border)] px-3 py-2 disabled:opacity-60">Cancel preview</button>
            <button type="button" disabled={!text && !result} onClick={() => { invalidate("Draft cleared."); setText(""); }}
              className="rounded border border-[var(--border)] px-3 py-2 disabled:opacity-60">Clear draft</button>
          </div>
        </form>}
        {busy && <p role="status">Inspecting this draft only…</p>}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {result && <section aria-label="Draft model preview result" className="space-y-3">
          <p role="status">Structure accepted for preview. Unapproved draft; source unverified; runtime evidence: none.</p>
          <p className="text-xs text-[var(--muted)]">Reachability describes this draft only. It does not prove application behavior. Nothing was saved, published or activated.</p>
          <div className="max-h-80 overflow-auto rounded border border-[var(--border)]" tabIndex={0} role="region" aria-label="Draft states and transitions">
            <table className="w-full text-left text-xs">
              <caption className="p-2 text-left font-semibold">Draft states</caption>
              <thead><tr><th scope="col" className="p-2">State</th><th scope="col" className="p-2">ID</th><th scope="col" className="p-2">Reachability</th></tr></thead>
              <tbody>{result.states.map(state => <tr key={state.id}>
                <td className="break-words p-2">{state.label}{state.id === result.definition.initialStateId ? " (initial)" : ""}</td>
                <td className="break-all p-2">{state.id}</td><td className="p-2">{state.reachable ? "Reachable" : "Unreachable"}</td>
              </tr>)}</tbody>
            </table>
            <table className="w-full table-fixed text-left text-xs">
              <caption className="p-2 text-left font-semibold">Draft transitions</caption>
              <thead><tr><th scope="col" className="p-2">Transition</th><th scope="col" className="p-2">Action</th><th scope="col" className="p-2">Expected observation</th></tr></thead>
              <tbody>{result.transitions.map(edge => <tr key={edge.id}>
                <td className="break-words p-2">{edge.id}: {edge.from} → {edge.to}<br />{edge.reachable ? "Reachable" : "Unreachable"}</td>
                <td className="break-words p-2">{edge.action}</td><td className="break-words p-2">{edge.expectedObservation}</td>
              </tr>)}</tbody>
            </table>
            {!result.transitions.length && <p className="p-2">This draft has no transitions.</p>}
          </div>
          <h3 className="font-medium">Structural diagnostics</h3>
          {result.diagnostics.length ? <ul className="list-disc space-y-1 pl-5">{result.diagnostics.map(item =>
            <li key={item.code + item.elementId} className="break-words">{item.code === "TERMINAL_STATE" ? "Terminal state" :
              item.code === "UNREACHABLE_STATE" ? "Unreachable state" : "Unreachable transition"}: {item.elementId}</li>)}</ul>
            : <p>No structural diagnostics. This is not a passing test result.</p>}
          <details><summary className="cursor-pointer">Candidate fingerprint</summary>
            <p className="mt-1 break-all font-mono text-xs">{result.candidateDigest}</p>
            <p className="text-xs">Fingerprint of normalized draft data; not a saved or approved model version.</p>
          </details>
        </section>}
      </div>
    </details>
  );
}
