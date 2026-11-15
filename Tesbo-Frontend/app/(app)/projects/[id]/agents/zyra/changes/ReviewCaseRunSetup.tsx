"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addTestCasesToRun, createTestRun, listTestRuns, type TestRunListItem
} from "@/lib/api";

/**
 * A human-controlled handoff into Tesbo's canonical test runs. Candidate
 * references are only suggestions; selecting them is not test execution,
 * coverage verification, an approval, or an inferred failure.
 */
export function ReviewCaseRunSetup({
  projectId, receiptId, candidateCaseIds
}: {
  projectId: string; receiptId: string; candidateCaseIds: string[];
}) {
  const cases = [...new Set(candidateCaseIds)].slice(0, 200);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [runName, setRunName] = useState("QA impact review " + receiptId);
  const [environment, setEnvironment] = useState("");
  const [existingId, setExistingId] = useState("");
  const [openRuns, setOpenRuns] = useState<TestRunListItem[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [working, setWorking] = useState(false);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [complete, setComplete] = useState<{
    runId: string; selected: number; added: number; skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!cases.length) return null;

  async function loadRuns() {
    if (runsLoaded || loadingRuns) return;
    setLoadingRuns(true);
    try {
      const runs = await listTestRuns(projectId);
      // Do not suggest already-closed or automation-owned executions as a
      // destination for newly selected manual QA cases.
      setOpenRuns(runs.filter((run) => run.status !== "Completed" &&
        !run.closedAt && run.source !== "automation"));
      setRunsLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load existing test runs.");
    } finally {
      setLoadingRuns(false);
    }
  }

  function toggleCase(id: string, checked: boolean) {
    setComplete(null);
    setSelected((current) => checked
      ? [...new Set([...current, id])]
      : current.filter((item) => item !== id));
  }

  async function attachSelected() {
    if (working || !selected.length || (mode === "new" && !pendingRunId &&
        (!runName.trim() || !environment.trim())) || (mode === "existing" && !existingId)) return;
    setError(null);
    setComplete(null);
    setWorking(true);
    let runId = mode === "new" ? pendingRunId : existingId;
    try {
      if (mode === "new" && !runId) {
        // The native run is created once. If the following attachment request
        // fails or its response is lost, retry attaches to THIS same run.
        const run = await createTestRun(projectId, {
          name: runName.trim(),
          environment: environment.trim(),
          description: "Human-selected QA candidates from committed graph review receipt " + receiptId +
            ". Source references do not prove coverage or execution."
        });
        runId = run.id;
        setPendingRunId(runId);
      }
      if (!runId) throw new Error("Select a test run first.");
      const result = await addTestCasesToRun(runId, selected);
      setComplete({
        runId, selected: selected.length, added: result.added, skipped: result.skipped
      });
    } catch (cause) {
      setError((runId && mode === "new"
        ? "Test run " + runId + " already exists. Retry attaching to this same run; do not create another. "
        : "") + (cause instanceof Error ? cause.message : "Could not attach selected test cases."));
    } finally {
      setWorking(false);
    }
  }

  return (
    <details data-testid={"graph-review-run-" + receiptId}
      className="rounded border border-[var(--border)] p-3 text-sm"
      onToggle={(event) => { if (event.currentTarget.open) void loadRuns(); }}>
      <summary className="cursor-pointer font-semibold">Prepare a test run from linked candidates</summary>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Choose applicable cases explicitly. This adds them to an existing Tesbo test run or creates a
        new one; nothing is executed, failed, approved, or marked covered.
      </p>
      {candidateCaseIds.length > cases.length && (
        <p role="note" className="mt-2 text-xs">
          Only the first 200 distinct linked cases are shown here. Review the remainder in Test Cases.
        </p>
      )}
      <fieldset className="mt-3 space-y-2">
        <legend className="font-medium">Select cases to verify ({selected.length} selected)</legend>
        {cases.map((id, index) => (
          <label key={id} className="flex items-start gap-2">
            <input type="checkbox" checked={selected.includes(id)}
              aria-label={"Select linked case " + (index + 1)}
              onChange={(event) => toggleCase(id, event.target.checked)} />
            <span>
              Linked case {index + 1}: <code className="break-all text-xs">{id}</code>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="mt-3 flex flex-wrap gap-4" disabled={!!pendingRunId}>
        <legend className="font-medium">Destination</legend>
        <label><input type="radio" name={"destination-" + receiptId} checked={mode === "new"}
          onChange={() => { setMode("new"); setComplete(null); }} /> Create new test run</label>
        <label><input type="radio" name={"destination-" + receiptId} checked={mode === "existing"}
          onChange={() => { setMode("existing"); setComplete(null); }} /> Add to existing test run</label>
      </fieldset>
      {mode === "new" ? (
        <div className="mt-3 grid gap-2">
          <label>New run name
            <input aria-label="New run name" value={runName} maxLength={180}
              disabled={!!pendingRunId}
              onChange={(event) => setRunName(event.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-transparent p-2" />
          </label>
          <label>Execution environment
            <input aria-label="Execution environment" value={environment}
              disabled={!!pendingRunId}
              onChange={(event) => setEnvironment(event.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-transparent p-2" />
          </label>
        </div>
      ) : (
        <div className="mt-3">
          <label>Existing open test run
            <select aria-label="Existing open test run" value={existingId}
              onChange={(event) => setExistingId(event.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-transparent p-2">
              <option value="">Select a run</option>
              {openRuns.map((run) => (
                <option key={run.id} value={run.id}>{run.externalId || run.name}: {run.name}</option>
              ))}
            </select>
          </label>
          {loadingRuns && <p>Loading existing test runs…</p>}
          {runsLoaded && !openRuns.length && <p>No open manual runs are available.</p>}
          {!runsLoaded && !loadingRuns && (
            <button type="button" className="mt-2 underline" onClick={() => void loadRuns()}>
              Retry loading test runs
            </button>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={working || !selected.length ||
          (mode === "existing" && !existingId) ||
          (mode === "new" && !pendingRunId && (!runName.trim() || !environment.trim()))}
          onClick={() => void attachSelected()}
          className="rounded border border-[var(--border)] px-3 py-2 disabled:opacity-60">
          {working ? "Attaching cases…" : pendingRunId ? "Retry adding to same test run"
            : mode === "new" ? "Create run and add selected cases" : "Add selected cases to run"}
        </button>
        {(pendingRunId || complete) && (
          <Link className="underline" href={"/projects/" + projectId + "/cycles/" +
            (complete?.runId ?? pendingRunId)}>Open native test run</Link>
        )}
      </div>
      {error && <p role="alert" className="mt-2">{error}</p>}
      {complete && (
        <p role="status" className="mt-2">
          {complete.selected} case(s) requested; {complete.added} newly added; {complete.skipped}
          skipped (already present or no longer eligible). Open the run to verify assignments,
          record actual execution evidence, and obtain human review.
        </p>
      )}
    </details>
  );
}
