"use client";

import { useRouter } from "next/navigation";
import { useParams } from "@/lib/routeParams";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  listCycleExecutions,
  getTestRun,
  updateExecution,
  listBugs,
  removeBugLink,
  type ExecutionItem,
  type BugItem,
  type TestRunDetail,
} from "@/lib/api";
import { IconBug } from "@tabler/icons-react";
import { Button, StatusChip, Input, PageLoader, Textarea, Select, ConfirmModal } from "@/components/ui";
import ExecutionEvidencePanel from "@/components/ExecutionEvidencePanel";
import { AutomationResultMeta } from "@/components/AutomationResultMeta";
import { RetestSourceObservation } from "@/components/testruns/RetestLineage";
import { useLogBugDialog } from "@/components/LogBugDialog";
import { Breadcrumbs } from "@/components/workflows";
import { useAppData } from "@/components/app/AppDataProvider";
import { useProjectData } from "@/components/project/ProjectDataProvider";

const STATUSES = ["Untested", "Passed", "Failed", "Skipped", "Blocked", "Retest"];

function statusToTone(status: string) {
  const map: Record<string, "success" | "error" | "blocked" | "skipped" | "retest" | "notRun"> = {
    Passed: "success",
    Failed: "error",
    Skipped: "skipped",
    Blocked: "blocked",
    Retest: "retest",
    Untested: "notRun",
  };
  return map[status] ?? "neutral";
}

function executionTitle(execution: ExecutionItem) {
  return execution.title || execution.snapshotTitle || "Untitled test case";
}

function normalizeSteps(value: unknown): Array<{ action: string; expected: string }> {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value.trim() ? [{ action: value, expected: "" }] : [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item, index) => {
    if (typeof item === "string") return { action: item, expected: "" };
    const row = item as Record<string, unknown>;
    return {
      action: String(row.action || row.step || row.description || `Step ${index + 1}`),
      expected: String(row.expected || row.expectedResult || row.result || "")
    };
  });
}

export default function ExecutionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const cycleId = params.cycleId as string;
  const { currentUser } = useAppData();
  const currentUserId = currentUser?.userId;
  const { projectMembers: members } = useProjectData();
  const executionId = params.executionId as string;
  const [execution, setExecution] = useState<ExecutionItem | null>(null);
  const [run, setRun] = useState<TestRunDetail | null>(null);
  const [loadedViewScope, setLoadedViewScope] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const viewScope = `${currentUserId || ""}:${projectId}:${cycleId}:${executionId}`;
  const currentViewScope = useRef(viewScope);
  currentViewScope.current = viewScope;
  const loadSequence = useRef(0);
  const [status, setStatus] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bugRefreshError, setBugRefreshError] = useState<string | null>(null);
  /* Bug Key / Bug Title shown for a linked execution — read from the real bug(s) filed via "Log
     bug" (bugs/bug_links), not the old free-text defectKey/defectUrl columns on the execution row.
     An execution can have more than one bug linked to it, so this is every bug linked to THIS
     execution specifically, not just the first bug linked to its testcase+cycle. */
  const [linkedBugs, setLinkedBugs] = useState<BugItem[]>([]);
  /* Confirm-then-unlink for a single already-persisted bug — separate from the "Report a Bug"
     dialog's own chip removal, which only discards an unsaved working pick and never calls this. */
  const [bugToUnlink, setBugToUnlink] = useState<BugItem | null>(null);
  const [unlinkingBug, setUnlinkingBug] = useState(false);
  const { dialog: bugDialog, openBugDialogFor } = useLogBugDialog({
    projectId,
    cycleId,
    members,
    // Use the execution the dialog actually operated on rather than this page's own `execution`
    // state — this page never nulls that state out, so both happen to agree today, but relying on
    // the dialog's own answer keeps this correct even if that stops being true.
    onLogged: (exec) => {
      loadLinkedBugs(exec);
      setBugRefreshError(null);
      listCycleExecutions(cycleId)
        .then((list) => {
          if (currentViewScope.current !== viewScope) return;
          const current = list.find((item) => item.id === exec.id);
          if (!current) throw new Error("Execution no longer available");
          setExecution(current);
          setStatus(current.status || "Untested");
        })
        .catch(() => { if (currentViewScope.current === viewScope) setBugRefreshError("Bug saved, but the execution could not be refreshed. Reload to see its current result."); });
    },
  });

  // Guards against an out-of-order response landing after a newer listBugs() call for this same
  // page — e.g. the initial-mount fetch resolving after a post-"Log bug" refresh — which would
  // otherwise overwrite the fresher result with a stale one.
  const linkedBugsRequestIdRef = useRef<string | null>(null);

  const loadLinkedBugs = useCallback((exec: ExecutionItem) => {
    const requestId = `${exec.id}:${Date.now()}`;
    linkedBugsRequestIdRef.current = requestId;
    // listBugs is scoped to testcase+cycle, not to this one execution (the API has no executionId
    // filter) — a testcase can be executed more than once in the same cycle, so this narrows to
    // the bugs actually linked to THIS execution via each bug's own links[].
    listBugs(projectId, { testcaseId: exec.testcaseId, cycleId })
      .then((bugs) => {
        if (linkedBugsRequestIdRef.current !== requestId || currentViewScope.current !== viewScope) return;
        setLinkedBugs(bugs.filter((bug) => bug.links.some((l) => l.executionId === exec.id)));
      })
      .catch(() => {
        if (linkedBugsRequestIdRef.current === requestId && currentViewScope.current === viewScope) setLinkedBugs([]);
      });
  }, [projectId, cycleId, viewScope]);

  /* ───── Unlink one bug from this execution — removes only the bug_links row tying it to this
   * testcase/cycle/execution via the existing addBugLink/removeBugLink pair; never deletes the
   * bug (or, for a Jira/Linear-originated bug, its external ticket). Reloads from the API rather
   * than just filtering linkedBugs locally so the list reflects the same state a refresh would. */
  function requestUnlinkBug(bug: BugItem) {
    setBugToUnlink(bug);
  }

  async function confirmUnlinkBug() {
    if (!bugToUnlink || !execution) return;
    const link = bugToUnlink.links.find((l) => l.executionId === execution.id);
    if (!link) {
      setBugToUnlink(null);
      return;
    }
    setUnlinkingBug(true);
    try {
      await removeBugLink(bugToUnlink.id, link.id);
      loadLinkedBugs(execution);
      setBugToUnlink(null);
    } finally {
      setUnlinkingBug(false);
    }
  }

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoadError(null);
    try {
      const [currentRun, list] = await Promise.all([getTestRun(cycleId), listCycleExecutions(cycleId)]);
      if (currentViewScope.current !== viewScope || sequence !== loadSequence.current) return;
      const item = list.find(value => value.id === executionId);
      if (!item || currentRun.id !== cycleId || currentRun.projectId !== projectId) throw new Error("This execution is unavailable in the selected Run.");
      setRun(currentRun);
      setLoadedViewScope(viewScope);
      setExecution(item);
      setStatus(item.status || "Untested");
      setActualResult(item.actualResult || "");
      setAssigneeId(item.assigneeId || "");
      loadLinkedBugs(item);
    } catch (error) {
      if (currentViewScope.current === viewScope && sequence === loadSequence.current) setLoadError(error instanceof Error ? error.message : "The execution could not be loaded.");
    } finally {
      if (currentViewScope.current === viewScope && sequence === loadSequence.current) setLoading(false);
    }
  }, [cycleId, executionId, projectId, viewScope, loadLinkedBugs]);

  useEffect(() => {
    if (!currentUserId) { router.replace("/login"); return; }
    setLoading(true);
    setExecution(null);
    setRun(null);
    setSaving(false);
    setSaveError(null);
    setLinkedBugs([]);
    void load();
    return () => { loadSequence.current += 1; linkedBugsRequestIdRef.current = null; };
  }, [currentUserId, load, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await updateExecution(cycleId, executionId, {
        status,
        actualResult,
        assigneeId: assigneeId || null,
      });
      if (currentViewScope.current !== viewScope) return;
      router.push(`/projects/${projectId}/cycles/${cycleId}`);
      router.refresh();
    } catch (error) {
      if (currentViewScope.current === viewScope) setSaveError(error instanceof Error ? error.message : "Failed to save execution.");
    } finally {
      if (currentViewScope.current === viewScope) setSaving(false);
    }
  }

  if (loading) {
    return <PageLoader variant="screen" />;
  }
  if (!execution || !run || loadedViewScope !== viewScope || run.id !== cycleId || run.projectId !== projectId) {
    return <section className="p-6" aria-label="Execution unavailable"><p role="alert" className="mb-3 text-sm text-[var(--error-foreground)]">{loadError || "This execution is unavailable."}</p>
      <Button variant="secondary" onClick={() => void load()}>Retry execution</Button>
      <Link href={`/projects/${projectId}/cycles/${cycleId}`} className="ml-4 text-sm text-[var(--accent-light)] hover:underline">Back to Run</Link>
    </section>;
  }

  const steps = normalizeSteps(execution.steps);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <Breadcrumbs
          items={[
            { label: "Test Runs", href: `/projects/${projectId}/cycles` },
            { label: "Run Detail", href: `/projects/${projectId}/cycles/${cycleId}` },
            { label: "Execute" },
          ]}
        />
      </header>

      <main className="w-full px-6 py-8">
        {loadError && <div className="mb-4 flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-[var(--error-foreground)]">The execution could not be refreshed. {loadError}</p><Button variant="secondary" onClick={() => void load()}>Retry execution</Button></div>}
        {bugRefreshError && <p role="alert" className="mb-4 text-sm text-[var(--error-foreground)]">{bugRefreshError}</p>}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {executionTitle(execution)}
          </h1>
          <StatusChip tone={statusToTone(status)}>{status}</StatusChip>
        </div>

        {execution.externalId && (
          <p className="text-xs text-[var(--muted-soft)] font-mono mb-4">{execution.externalId}</p>
        )}
        {run.retestManifest && <div className="mb-5"><RetestSourceObservation manifest={run.retestManifest} executionId={execution.id} /></div>}

        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Test case details</h2>
          <div className="space-y-4 text-sm">
            {execution.description && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Description</p>
                <p className="whitespace-pre-wrap text-[var(--foreground)]">{execution.description}</p>
              </div>
            )}
            {execution.preconditions && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Preconditions</p>
                <p className="whitespace-pre-wrap text-[var(--foreground)]">{execution.preconditions}</p>
              </div>
            )}
            {execution.testData && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Test data</p>
                <p className="whitespace-pre-wrap text-[var(--foreground)]">{execution.testData}</p>
              </div>
            )}
            {steps.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Steps</p>
                <ol className="space-y-2">
                  {steps.map((step, index) => (
                    <li key={`${step.action}-${index}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-3">
                      <p className="font-medium text-[var(--foreground)]">{index + 1}. {step.action}</p>
                      {step.expected && <p className="mt-1 text-[var(--muted)]">Expected: {step.expected}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {!execution.description && !execution.preconditions && !execution.testData && steps.length === 0 && (
              <p className="text-[var(--muted)]">No additional test case details were captured for this execution.</p>
            )}
          </div>
        </section>

        <form onSubmit={handleSave} className="space-y-5">
          {saveError && (
            <p role="alert" className="rounded-lg border border-[var(--error)]/20 bg-[var(--error-soft)] p-3 text-sm text-[var(--error-foreground)]">
              {saveError}
            </p>
          )}
          {/* Status buttons */}
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const active = status === s;
                const colors: Record<string, string> = {
                  Passed: active ? "bg-[var(--success)] text-white" : "border-[var(--success)]/30 text-[var(--success-foreground)] hover:bg-[var(--success-soft)]",
                  Failed: active ? "bg-[var(--error)] text-white" : "border-[var(--error)]/30 text-[var(--error-foreground)] hover:bg-[var(--error-soft)]",
                  Skipped: active ? "bg-[var(--status-skipped-dot)] text-white" : "border-[var(--status-skipped-dot)]/30 text-[var(--status-skipped-text)] hover:bg-[var(--status-skipped-fill)]",
                  Blocked: active ? "bg-[var(--status-blocked-dot)] text-white" : "border-[var(--status-blocked-dot)]/30 text-[var(--status-blocked-text)] hover:bg-[var(--status-blocked-fill)]",
                  Retest: active ? "bg-[var(--info)] text-white" : "border-[var(--info)]/30 text-[var(--info)] hover:bg-[var(--info-soft)]",
                  Untested: active ? "bg-[var(--muted)] text-white" : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-secondary)]",
                };
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${colors[s]}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              Assigned to
            </label>
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} aria-label="Assigned to">
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name || m.email}
                </option>
              ))}
              {/* Current assignee not among this project's members — an AI agent or a stale row.
                  Keep it visible as a disabled option rather than silently showing "Unassigned",
                  which would clear a real assignment on Save. */}
              {assigneeId && !members.some((m) => m.userId === assigneeId) && (
                <option value={assigneeId} disabled>
                  Unknown assignee (not a project member)
                </option>
              )}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              Actual Result / Notes
            </label>
            <Textarea
              value={actualResult}
              onChange={(e) => setActualResult(e.target.value)}
              rows={4}
              placeholder="Describe what actually happened…"
            />
          </div>

          {/*
            * Bug Key / Bug Title — associations remain visible for every recorded result.
            * A status alone never fabricates a bug association. Read-only:
            * these reflect the real bug(s), not a free-text value typed here. One execution can
            * now have several bugs linked (multi-select existing-bug picker) — a single linked
            * bug keeps the original "Bug Key"/"Bug Title" labels; more than one numbers them
            * ("Bug 1 Key", "Bug 2 Key", …) so none is silently dropped. Every row gets its own
            * Unlink action regardless of count.
            */}
          <div className="space-y-3" hidden={linkedBugs.length === 0}>
            {linkedBugs.map((bug, i) => {
              const keyLabel = linkedBugs.length > 1 ? `Bug ${i + 1} Key` : "Bug Key";
              const titleLabel = linkedBugs.length > 1 ? `Bug ${i + 1} Title` : "Bug Title";
              return (
                <div key={bug.id} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">{keyLabel}</label>
                    <Input type="text" aria-label={keyLabel} value={bug.integrationIssueKey || bug.externalId || ""} readOnly placeholder="e.g. PROJ-123" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">{titleLabel}</label>
                    <Input type="text" aria-label={titleLabel} value={bug.title || ""} readOnly placeholder="Title of the linked bug" />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label={`Unlink ${bug.title}`}
                    onClick={() => requestUnlinkBug(bug)}
                  >
                    Unlink
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Unlink-bug confirmation — unlink only, never deletes the bug or its Jira/Linear
              ticket. Distinct from the "Report a Bug" dialog's own chip ✕, which only discards an
              unsaved working pick and never reaches this or the removeBugLink API. */}
          <ConfirmModal
            open={!!bugToUnlink}
            title="Unlink bug"
            message={`Remove "${bugToUnlink?.title ?? ""}" from this test case? This only removes the link — the bug itself will not be deleted.`}
            confirmLabel="Unlink"
            loading={unlinkingBug}
            onConfirm={confirmUnlinkBug}
            onCancel={() => setBugToUnlink(null)}
          />

          {/*
            * The same two panels the run drawer shows, so a result looks the same wherever it is
            * opened. Both render nothing for a human-recorded result with no evidence, which is
            * every result that existed before the automation ingest (Basecamp 10189985971).
            */}
          <AutomationResultMeta execution={execution} />

          <div className="h-px bg-[var(--border)]" />

          <ExecutionEvidencePanel cycleId={cycleId} executionId={execution.id} />

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => openBugDialogFor(execution)}>
              <IconBug size={14} />
              Log bug
            </Button>
            <Link
              href={`/projects/${projectId}/cycles/${cycleId}`}
              className="rounded-lg border border-[var(--border)] py-2 px-5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
      {bugDialog}
    </div>
  );
}
