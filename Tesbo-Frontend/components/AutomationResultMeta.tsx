"use client";

import { IconAlertTriangle, IconGitBranch, IconRepeat, IconRobot, IconClock, IconExternalLink } from "@tabler/icons-react";
import type { ExecutionItem, TestRunDetail, TestRunListItem } from "@/lib/api";
import { formatDateTime } from "@/lib/date";

/*
 * Provenance and failure detail for results and runs that came from an automation SDK
 * (Basecamp 10189985971).
 *
 * Every field these render is null on a manual run or a human-recorded result, so both components
 * return null rather than an empty shell — a manually executed run should look exactly as it did
 * before this feature existed.
 */

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** Short commit display, the length every git UI settled on. */
function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

/**
 * The one-line "how this run was produced" strip: trigger, branch, commit, and a link out to the
 * CI build. Card §4: this is what lets a QA lead trace a failure back to the exact commit without
 * leaving Tesbo.
 */
export function AutomationRunProvenance({ run }: { run: TestRunDetail | TestRunListItem }) {
  if (run.source !== "automation") return null;
  const incomplete = run.closeStatus === "incomplete";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        title="Results in this run were reported by an automation SDK, not entered by hand"
      >
        <IconRobot size={13} />
        Automated
        {run.triggeredBy && <span className="text-[var(--muted-soft)]">· {run.triggeredBy}</span>}
      </span>

      {run.branchName && (
        <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
          <IconGitBranch size={13} />
          <span className="font-mono">{run.branchName}</span>
        </span>
      )}

      {run.commitSha && (
        <span className="font-mono text-[var(--muted)]" title={run.commitSha}>
          {shortSha(run.commitSha)}
        </span>
      )}

      {run.buildUrl && (
        <a
          href={run.buildUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:underline"
          style={{ color: "var(--accent-light)" }}
        >
          Build <IconExternalLink size={12} />
        </a>
      )}

      {/*
       * An incomplete close means the SDK never called close — the process died, or CI killed the
       * job. The run still reads "Completed" (its status vocabulary is only Planning / In Progress /
       * Completed, and adding a fourth value would drop these out of every existing filter), so
       * this badge is the only place the difference is visible.
       */}
      {incomplete && (
        <span
          className="inline-flex items-center gap-1.5 font-medium"
          style={{ color: "var(--warning)" }}
          title="The test process never reported that it finished, so this run was closed for it. Some results may be missing."
        >
          <IconAlertTriangle size={13} />
          Incomplete
        </span>
      )}
    </div>
  );
}

const STEP_STATUS_COLOR: Record<string, string> = {
  Passed: "var(--success)",
  Failed: "var(--error)",
  Blocked: "var(--warning)",
  Skipped: "var(--muted)",
  Retest: "var(--warning)",
  Untested: "var(--muted-soft)",
};

function statusColor(status: string): string {
  return STEP_STATUS_COLOR[status] ?? "var(--muted)";
}

/**
 * Per-result facts: how long the test took, how many attempts it needed, the framework's own failure
 * message and stack, and, for a result carried over from another tool, each step's outcome and the
 * earlier results of the same case in this run.
 *
 * `errorMessage` is shown separately from Actual Result on purpose — that field is the tester's own
 * prose and the ingest never writes it, so showing them in one box would blur who said what.
 *
 * Returns null when there is nothing to show, so a plain manual result looks as it always did.
 */
export function AutomationResultMeta({ execution }: { execution: ExecutionItem }) {
  const isAutomated = execution.reportedBy === "automation";
  const hasDuration = execution.durationMs != null;
  const hasRetries = (execution.retryCount ?? 0) > 0;
  const stepResults = Array.isArray(execution.stepResults) ? execution.stepResults : [];
  const history = Array.isArray(execution.history) ? execution.history : [];
  if (!isAutomated && !hasDuration && !hasRetries && !execution.errorMessage && !execution.errorStack && !stepResults.length && !history.length) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid="result-meta">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--muted)]">
        {isAutomated && (
          <span className="inline-flex items-center gap-1.5" title="Reported by an automation SDK">
            <IconRobot size={13} />
            Automated
          </span>
        )}
        {hasDuration && (
          <span className="inline-flex items-center gap-1.5" title="Time the test took">
            <IconClock size={13} />
            {formatDuration(execution.durationMs as number)}
          </span>
        )}
        {execution.executedAt && (
          <span className="inline-flex items-center gap-1.5" title="When this result was recorded">
            Executed {formatDateTime(execution.executedAt)}
          </span>
        )}
        {hasRetries && (
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--warning)" }}
            title="Attempts before the recorded one — a result that needed retries is a flakiness signal even when it passed"
          >
            <IconRepeat size={13} />
            {execution.retryCount} {execution.retryCount === 1 ? "retry" : "retries"}
          </span>
        )}
      </div>

      {execution.errorMessage && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
            Failure reported by automation
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-2.5 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]">
            {execution.errorMessage}
          </pre>
        </div>
      )}

      {execution.errorStack && (
        <details>
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Stack trace</summary>
          <pre
            data-testid="result-stack"
            className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-2.5 font-mono text-[11.5px] leading-relaxed text-[var(--foreground)]"
          >
            {execution.errorStack}
          </pre>
        </details>
      )}

      {stepResults.length > 0 && (
        <div data-testid="result-step-results">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Step results</p>
          <ul className="space-y-1 text-[12px]">
            {[...stepResults]
              .sort((a, b) => a.position - b.position)
              .map((step) => (
                <li key={step.position} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[var(--muted)]">Step {step.position}</span>
                  <span className="font-medium" style={{ color: statusColor(step.status) }}>
                    {step.status}
                  </span>
                  {step.comment && <span className="whitespace-pre-wrap text-[var(--foreground)]">{step.comment}</span>}
                </li>
              ))}
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <details data-testid="result-history">
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
            Earlier results ({history.length})
          </summary>
          <ul className="mt-1 space-y-1.5 text-[12px]">
            {history.map((entry, index) => (
              <li key={index} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium" style={{ color: statusColor(entry.status) }}>
                  {entry.status}
                </span>
                {entry.executedAt && <span className="text-[var(--muted)]">{formatDateTime(entry.executedAt)}</span>}
                {entry.durationMs != null && <span className="text-[var(--muted)]">{formatDuration(entry.durationMs)}</span>}
                {entry.comment && <span className="whitespace-pre-wrap text-[var(--foreground)]">{entry.comment}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
