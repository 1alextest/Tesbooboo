"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  addTestCasesToRun, createTestRun, getTestCase, listTestRuns, listZyraGraphReviewRunLinks,
  linkZyraGraphReviewRunCases, type GraphReviewRunCaseLink,
  type QaVerificationGapSummary, type TestRunListItem
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
  const [recordedLinks, setRecordedLinks] = useState<GraphReviewRunCaseLink[]>([]);
  const [gapSummary, setGapSummary] = useState<QaVerificationGapSummary | null>(null);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [verifyingBytes, setVerifyingBytes] = useState(false);
  const [working, setWorking] = useState(false);
  // React state disables the button on render; this synchronous ref also
  // rejects a second event in the same render/commit window.
  const submitting = useRef(false);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [creationUnconfirmed, setCreationUnconfirmed] = useState(false);
  const [checkedForDuplicate, setCheckedForDuplicate] = useState(false);
  const [complete, setComplete] = useState<{
    runId: string; selected: number; added: number; skipped: number; linked: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRuns(force = false) {
    if ((runsLoaded && !force) || loadingRuns) return;
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

  /**
   * Verification is a separate, explicit action: it costs one storage HEAD/stat per attachment.
   * A normal refresh deliberately drops it, so a previous check is never displayed as if it
   * described newly recorded evidence.
   */
  async function loadRecordedLinks(verifyBytes = false) {
    if (verifyBytes) setVerifyingBytes(true);
    else setLoadingLinks(true);
    try {
      const { links, summary } = await listZyraGraphReviewRunLinks(projectId, receiptId, { verifyEvidenceBytes: verifyBytes });
      setRecordedLinks(links);
      setGapSummary(summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load recorded QA handoffs.");
    } finally {
      if (verifyBytes) setVerifyingBytes(false);
      else setLoadingLinks(false);
    }
  }

  function toggleCase(id: string, checked: boolean) {
    setComplete(null);
    setSelected((current) => checked
      ? [...new Set([...current, id])]
      : current.filter((item) => item !== id));
  }

  async function attachSelected() {
    if (submitting.current || working || !selected.length || (mode === "new" && !pendingRunId &&
        (!runName.trim() || !environment.trim() ||
         (creationUnconfirmed && !checkedForDuplicate))) ||
        (mode === "existing" && !existingId)) return;
    submitting.current = true;
    setError(null);
    setComplete(null);
    setWorking(true);
    let runId = mode === "new" ? pendingRunId : existingId;
    let attemptedCreate = false;
    try {
      // The normal Tesbo run picker only permits Approved test cases. Reuse
      // its canonical case records before any non-idempotent CREATE/attachment;
      // review nominations alone must not bypass this policy.
      for (let offset = 0; offset < selected.length; offset += 8) {
        const current = await Promise.all(selected.slice(offset, offset + 8).map(async (caseId) => ({
          caseId, record: await getTestCase(projectId, caseId)
        })));
        const ineligible = current.filter(({ record }) => record.status !== "Approved" || record.approvalCurrent !== true);
        if (ineligible.length) {
          throw new Error("Only Approved test cases can be added to a test run. Review: " +
            ineligible.map(({ caseId }) => caseId).join(", "));
        }
      }
      if (mode === "new" && !runId) {
        // The native run is created once. If the following attachment request
        // fails or its response is lost, retry attaches to THIS same run.
        attemptedCreate = true;
        const run = await createTestRun(projectId, {
          name: runName.trim(),
          environment: environment.trim(),
          description: "Human-selected QA candidates from committed graph review receipt " + receiptId +
            ". Source references do not prove coverage or execution."
        });
        runId = run.id;
        setPendingRunId(runId);
        setCreationUnconfirmed(false);
        setCheckedForDuplicate(false);
      }
      if (!runId) throw new Error("Select a test run first.");
      const result = await addTestCasesToRun(runId, selected);
      // Persist one relationship per actually selected canonical case AFTER
      // native case attachment. A failed link does not undo or falsify a run.
      // Re-attachment and repeated link insertion are both idempotent.
      const linked = await linkZyraGraphReviewRunCases(projectId, receiptId, runId, selected);
      setComplete({
        runId, selected: selected.length, added: result.added, skipped: result.skipped,
        linked: linked.selected
      });
      await loadRecordedLinks();
    } catch (cause) {
      if (mode === "new" && !runId && attemptedCreate) {
        // A lost response to createTestRun could follow a successful DB commit.
        // Never retry this non-idempotent CREATE automatically or blindly.
        setCreationUnconfirmed(true);
        setCheckedForDuplicate(false);
        setError("Run creation outcome unconfirmed. Check existing runs before another creation. " +
          (cause instanceof Error ? cause.message : "Run creation could not be confirmed."));
      } else {
        setError((runId && mode === "new"
          ? "Test run " + runId + " already exists. Retry attaching to this same run; do not create another. "
          : "") + (cause instanceof Error ? cause.message : "Could not attach selected test cases."));
      }
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }

  return (
    <details data-testid={"graph-review-run-" + receiptId}
      className="rounded border border-[var(--border)] p-3 text-sm"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          if (cases.length) void loadRuns();
          void loadRecordedLinks();
        }
      }}>
      <summary className="cursor-pointer font-semibold">
        {cases.length ? "Prepare a test run from linked candidates" : "Review source-only QA gaps"}
      </summary>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {cases.length
          ? "Choose applicable cases explicitly. This uses canonical Tesbo test runs; no execution, failure or approval is inferred."
          : "No explicitly nominated cases were found. QA must investigate affected behavior and derive applicable cases before preparing a run."}
      </p>
      {candidateCaseIds.length > cases.length && (
        <p role="note" className="mt-2 text-xs">
          Only the first 200 distinct linked cases are shown here. Review the remainder in Test Cases.
        </p>
      )}
      <section aria-label="Persisted QA handoffs" className="mt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Recorded QA run handoffs</h3>
          <div className="flex items-center gap-3">
            <button type="button" disabled={loadingLinks || verifyingBytes}
              onClick={() => void loadRecordedLinks()}
              className="underline disabled:opacity-60">
              Refresh recorded handoffs
            </button>
            <button type="button" disabled={loadingLinks || verifyingBytes}
              onClick={() => void loadRecordedLinks(true)}
              className="underline disabled:opacity-60">
              {verifyingBytes ? "Checking evidence bytes…" : "Verify evidence bytes"}
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--muted)]">
          A persisted handoff is evidence of human test selection, not passed tests,
          verified coverage, or approval.
        </p>
        {loadingLinks && <p className="text-xs">Loading recorded handoffs…</p>}
        {!loadingLinks && !recordedLinks.length &&
          <p className="text-xs">No run/case handoffs have been recorded yet.</p>}
        {recordedLinks.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs">
            {recordedLinks.map((link) => (
              <li key={link.runId + ":" + link.caseId}>
                <Link className="underline" href={"/projects/" + projectId + "/cycles/" + link.runId}>
                  {link.runName || "Open native run"}
                </Link>
                {" — selected case "}<code>{link.caseId}</code>
                <span className="block text-[var(--muted)]">
                  {link.commitProvenance?.comparison === "reported_equal_unverified"
                    ? "Run-reported commit matches pinned source; deployment and target build are NOT verified."
                    : link.commitProvenance?.comparison === "reported_different"
                      ? "Run-reported commit differs from pinned source; investigate target build before verification."
                      : "Source/run commit provenance unavailable; target build NOT verified."}
                  {link.commitProvenance?.sourceCommitSha && (
                    <span>{" Pinned source: "}<code className="break-all">{link.commitProvenance.sourceCommitSha}</code></span>
                  )}
                  {link.commitProvenance?.runReportedCommitSha && (
                    <span>{" Run reported: "}<code className="break-all">{link.commitProvenance.runReportedCommitSha}</code></span>
                  )}
                </span>
                {link.caseStillInRun ? (
                  link.execution ? (
                    <span>
                      {" — native status: "}<strong>{link.execution.status}</strong>
                      {link.execution.executedAt &&
                        <span>{"; recorded "}{new Date(link.execution.executedAt).toLocaleString()}</span>}
                      {"; active evidence metadata: "}{link.execution.evidenceFileCount}
                      {" ("}{link.execution.evidenceAddedAfterHandoffCount}
                      {" added after handoff)"}
                      {link.execution.evidenceBytes && (
                        <span>
                          {"; evidence bytes: "}{link.execution.evidenceBytes.available}
                          {" of "}{link.execution.evidenceBytes.checked}{" readable"}
                          {link.execution.evidenceBytes.unavailable > 0 &&
                            `; ${link.execution.evidenceBytes.unavailable} unavailable`}
                          {link.execution.evidenceBytes.byteMismatch > 0 &&
                            `; ${link.execution.evidenceBytes.byteMismatch} size mismatch`}
                          {link.execution.evidenceBytes.truncated && "; check truncated"}
                          {"; availability is not content review"}
                        </span>
                      )}
                      {link.execution.executedAfterHandoff
                        ? "; recorded after handoff; build provenance not verified"
                        : "; earlier or undated execution; not evidence for this change"}
                      {link.execution.actualResultRecorded && "; actual-result notes recorded"}
                      {link.execution.defectKey && <span>{"; defect reference: "}{link.execution.defectKey}</span>}
                      {" — execution status and attachment metadata are not verification or approval"}
                      <Link className="ml-2 underline"
                        href={"/projects/" + projectId + "/cycles/" + link.runId +
                          "/execute/" + link.execution.id}>
                        Open native execution
                      </Link>
                    </span>
                  ) : <span>{" — no active execution record; no result inferred"}</span>
                ) : <span>{" — case no longer active in this run; handoff retained as history"}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {gapSummary && (
        <section aria-label="QA verification gaps" className="mt-3 border-t border-[var(--border)] pt-3">
          <h3 className="font-medium">Verification gaps</h3>
          <p className="mt-1 text-xs">
            {gapSummary.nominatedCaseCount} nominated case(s); {gapSummary.selectedCaseCount}
            {" currently attached to active native runs; "}{gapSummary.notSelectedCount}{" not currently attached."}
          </p>
          {gapSummary.historicalSelectionOnlyCount > 0 && (
            <p className="mt-1 text-xs">
              {gapSummary.historicalSelectionOnlyCount}
              {" nominated case(s) have only historical, no-longer-active run handoffs. Reassess selection."}
            </p>
          )}
          <p className="mt-1 text-xs">
            {gapSummary.withSubsequentResultCount}{" with a subsequently recorded native result; "}
            {gapSummary.withoutSubsequentResultCount}{" without one; "}
            {gapSummary.withLaterEvidenceMetadataCount}{" with later evidence-file metadata."}
          </p>
          {gapSummary.historicalResultOnlyCount > 0 && (
            <p className="mt-1 text-xs">
              {gapSummary.historicalResultOnlyCount}{" nominated case(s) have only historical, pre-handoff results."}
            </p>
          )}
          {gapSummary.unlinkedCaseNodeCount > 0 && (
            <p className="mt-1 text-xs">
              {gapSummary.unlinkedCaseNodeCount}{" unlinked case node(s) still require traceability review."}
            </p>
          )}
          {gapSummary.invalidOrRepeatedNominationCount > 0 && (
            <p className="mt-1 text-xs">
              {gapSummary.invalidOrRepeatedNominationCount}{" malformed or repeated nominations require investigation."}
            </p>
          )}
          {gapSummary.sourceOnlyChangeNeedsTriage && (
            <p className="mt-1 text-xs">Changed graph nodes have no nominated cases. QA triage is required.</p>
          )}
          <p className="mt-1 text-xs text-[var(--muted)]">
            No coverage, deployed build match, actual file bytes or human QA approval has been verified.
          </p>
        </section>
      )}
      {cases.length > 0 && (
        <>
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
      {creationUnconfirmed && !pendingRunId && (
        <div className="mt-3 space-y-2 rounded border border-[var(--border)] p-3">
          <p role="alert">
            Run creation outcome unconfirmed. It may already have committed. Check the native{" "}
            <Link href={"/projects/" + projectId + "/cycles"} className="underline">
              Test Runs
            </Link>{" "}
            list, refresh existing runs below, and attach to the run if it exists.
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={checkedForDuplicate}
              aria-label="I checked that no duplicate run exists"
              onChange={(event) => setCheckedForDuplicate(event.target.checked)} />
            I checked and confirmed that no matching run exists before trying to create another.
          </label>
        </div>
      )}
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
          <button type="button" disabled={loadingRuns}
            className="mt-2 underline disabled:opacity-60"
            onClick={() => void loadRuns(true)}>
            Refresh available test runs
          </button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" disabled={working || !selected.length ||
          (mode === "existing" && !existingId) ||
          (mode === "new" && !pendingRunId && (!runName.trim() || !environment.trim() ||
            (creationUnconfirmed && !checkedForDuplicate)))}
          onClick={() => void attachSelected()}
          className="rounded border border-[var(--border)] px-3 py-2 disabled:opacity-60">
          {working ? "Preparing cases…" : pendingRunId
            ? complete ? "Add selected cases to same run" : "Retry adding to same test run"
            : mode === "new" ? "Create run and add selected cases" : "Add selected cases to run"}
        </button>
        {(pendingRunId || complete) && (
          <Link className="underline" href={"/projects/" + projectId + "/cycles/" +
            (complete?.runId ?? pendingRunId)}>Open native test run</Link>
        )}
      </div>
        </>
      )}
      {error && <p role="alert" className="mt-2">{error}</p>}
      {complete && (
        <p role="status" className="mt-2">
          {complete.selected} case(s) requested; {complete.added} newly added; {complete.skipped}
          {" skipped (already present or no longer eligible). Open the run to verify assignments,"}
          {" Recorded "}{complete.linked}{" durable QA handoff reference(s). Actual execution and approval still require evidence."}
        </p>
      )}
    </details>
  );
}
