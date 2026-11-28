"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "@/lib/routeParams";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  API_BASE,
  closeZyraTask,
  ApiError,
  deleteZyraTaskDraft,
  getJiraStatus,
  getLinearStatus,
  getNotionStatus,
  getZyraTask,
  listJiraTickets,
  listLinearTickets,
  listNotionPages,
  listSuites,
  listZyraTaskTicketComments,
  applyRequirementProposal,
  rejectRequirementProposal,
  applyManagedDocumentProposal,
  rejectManagedDocumentProposal,
  retryZyraTicketComment,
  saveZyraTask,
  withdrawRequirementProposal,
  sendZyraFeedback,
  type JiraTicket,
  type LinearTicket,
  type NotionPage,
  type SuiteNode,
  type ZyraTask,
  type ZyraTicketComment,
  integrationProviderLabel,
  notionPageKey,
  zyraTaskTicketKeys,
} from "@/lib/api";
import { IconChevronDown, IconChevronUp, IconSparkles, IconUser } from "@tabler/icons-react";
import { Button, Card, CopyButton, Field, FieldError, FieldHint, FieldLabel, Input, Modal, PageLoader, Select, StatusChip, Textarea, type Severity } from "@/components/ui";
import { PageHeader, StandardPageLayout, Breadcrumbs } from "@/components/workflows";
import { toTsv } from "@/lib/tsv";
import { SUITE_NAME_MAX_LENGTH, validateSuiteName } from "@/lib/validation";
import { isMarkdownSource, renderMarkdown } from "@/lib/markdown";
import { TechniqueBadges } from "@/components/agents/ZyraChatReviewPanel";
import { ZyraSeverityBadge } from "@/components/agents/ZyraContextDrawer";
import { RequirementReviewPanel } from "@/components/agents/RequirementReviewPanel";
import { RequirementCarryForwardReview } from "@/components/agents/RequirementCarryForwardReview";
import { ManagedDocumentProposalPanel } from "@/components/agents/ManagedDocumentProposalPanel";
import { sortActivitiesNewestFirst } from "@/components/agents/TaskQuickViewPanel";
import { isKnowledgeOwnerOrManager } from "@/lib/knowledge-permissions";
import { ZyraLanguageContext, zyraLanguage, zyraText } from "@/lib/zyra-i18n";
import { formatDateTime } from "@/lib/date";
import { summarizeZyraTaskOutput } from "@/lib/zyra-task-output-summary";
import { useAppData } from "@/components/app/AppDataProvider";
import { useProjectData } from "@/components/project/ProjectDataProvider";

// "" is the unchosen "Select suite" placeholder — never submittable. "none" saves unassigned.
type SaveMode = "" | "none" | "existing" | "new";
type DetailTab = "testcases" | "feedback" | "activities" | "sources";

// `label` is the English text; the page renders the localized "task.commentStatus.<status>" key.
const TICKET_COMMENT_STATUS: Record<ZyraTicketComment["status"], { label: string; tone: "neutral" | "info" | "success" | "warning" | "error" }> = {
  pending: { label: "Posting…", tone: "info" },
  posted: { label: "Posted", tone: "success" },
  failed: { label: "Failed", tone: "error" },
  skipped_disabled: { label: "Not posted — auto-comment off", tone: "neutral" },
  skipped_not_connected: { label: "Not posted — not connected", tone: "warning" },
};

function AutomationHandoffInstructions({ projectId, taskId, target }: {
  projectId: string;
  taskId: string;
  target: { repository: string; path: string; framework: string };
}) {
  const [command, setCommand] = useState("");
  const showCommand = () => {
    const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
    const origin = window.location.origin;
    const taskUrl = new URL(`/projects/${encodeURIComponent(projectId)}/agents/tasks/${encodeURIComponent(taskId)}`, origin);
    setCommand([
      "node scripts/qa-approved-handoff.mjs",
      "--task-url " + quote(taskUrl.href),
      "--api-origin " + quote(new URL(API_BASE, origin).origin),
      '--repo "$TARGET_REPO" --branch "$TARGET_BRANCH" --revision "$TARGET_COMMIT"',
      '--harness "$HARNESS_DIR" --investigation "$INVESTIGATION_ID" --case "$PLAN_CASE"',
    ].join(" "));
  };
  return (
    <details className="rounded-lg border border-[var(--border)] p-3" onToggle={event => { if (event.currentTarget.open) showCommand(); }}>
      <summary className="cursor-pointer text-sm font-medium">Set up an automation handoff</summary>
      <p className="my-2 text-sm">After approving the requirement and test case and activating their link, choose the existing Playwright spec and investigation case to send to your generator.</p>
      <p className="my-2 text-xs text-[var(--muted)]" data-testid="automation-handoff-approved-target">
        Approved target: <code className="break-all">{target.repository}</code> · <code className="break-all">{target.path}</code> · {target.framework}. The CLI verifies the local checkout, published branch and full commit against this approved case.
      </p>
      <a className="text-sm underline" href="https://github.com/1alextest/Tesbooboo/blob/development/docs/qa-orchestration/examples/approved-automation-handoff.md" target="_blank" rel="noreferrer">Setup and command arguments</a>
      {command && <div className="mt-2 space-y-2"><pre className="whitespace-pre-wrap break-all text-xs">{command}</pre><CopyButton value={command} label="Copy handoff command" /></div>}
    </details>
  );
}

function normalizeStatus(status: string): string {
  if (status === "accepted") return "done";
  if (status === "rejected") return "todo";
  return status || "todo";
}

function tone(status: string): "neutral" | "info" | "success" | "warning" | "error" {
  const normalized = normalizeStatus(status);
  if (normalized === "done") return "success";
  if (normalized === "in_review") return "info";
  if (normalized === "in_progress") return "warning";
  if (normalized === "failed") return "error";
  return "neutral";
}

function latestFailureDetail(activities: ZyraTask["activities"], fallback: string): string | null {
  for (let i = activities.length - 1; i >= 0; i -= 1) {
    if (activities[i].stage === "failed") return activities[i].detail || fallback;
  }
  return null;
}

// Mirrors TaskQuickViewPanel's isFeedbackActivity: only the entry carrying a reviewer's actual
// words counts as "Feedback", not the status/process narration that shares the same activity log.
// Rows written before `kind` existed fall back to matching the fixed title zyraFeedback writes.
function isFeedbackActivity(activity: ZyraTask["activities"][number]): boolean {
  return activity.kind === "feedback" || activity.title === "Review feedback submitted";
}

// Collapsed height of the task description, in px (16rem). A ticket synced from Jira/Linear — or
// several of them in one task — can run to pages, which pushed the testcase tabs far below the fold.
const DESCRIPTION_COLLAPSED_PX = 256;

/**
 * The rendered description, height-capped with a View more / View less toggle. The cap is a CSS
 * max-height on the full HTML, never a cut of the text: slicing Markdown/HTML by characters would
 * break tables, lists and links mid-element, and line-clamp doesn't apply to headings and lists.
 * Whether the toggle shows at all is measured, not guessed — re-measured on resize and whenever the
 * content changes — so a short description renders exactly as before, with no toggle and no fade.
 */
function CollapsibleDescription({ html, moreLabel, lessLabel }: { html: string; moreLabel: string; lessLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight is the full content height whether or not the max-height is applied.
    const measure = () => setOverflows(el.scrollHeight > DESCRIPTION_COLLAPSED_PX + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [html]);

  const collapsed = overflows && !expanded;
  return (
    <>
      <div
        ref={ref}
        id="task-description-content"
        className="zyra-prose mt-1.5 break-words text-sm text-[var(--muted)]"
        // Starts capped (overflow unknown until measured) so a long description never flashes in full.
        // The fade is a mask on the content itself rather than an overlay, because the card behind it
        // is a translucent glass surface that no solid gradient colour would match.
        style={
          expanded
            ? undefined
            : {
                maxHeight: DESCRIPTION_COLLAPSED_PX,
                overflow: "hidden",
                ...(collapsed ? { maskImage: "linear-gradient(to bottom, black 75%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 75%, transparent)" } : {}),
              }
        }
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {overflows && (
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={expanded}
          aria-controls="task-description-content"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3"
        >
          {expanded ? lessLabel : moreLabel}
          {expanded ? <IconChevronUp size={14} stroke={1.75} /> : <IconChevronDown size={14} stroke={1.75} />}
        </Button>
      )}
    </>
  );
}

// Status labels are "taskStatus.<status>" in lib/zyra-i18n.ts; an unknown status reads as its own words.
function statusLabel(status: string, t: ReturnType<typeof zyraText>): string {
  const normalized = normalizeStatus(status);
  return t.opt(`taskStatus.${normalized}`) ?? normalized.replaceAll("_", " ");
}

const KNOWN_SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low"];
// See ZyraChatReviewPanel/TaskQuickViewPanel's identical guard — a draft's severity is only
// guaranteed to match this set once actually saved (normalizeZyraSeverity).
function knownSeverity(value?: string | null): Severity | null {
  return KNOWN_SEVERITIES.includes(value as Severity) ? (value as Severity) : null;
}

function stepCount(stepsJson: string): number {
  try {
    const parsed = JSON.parse(stepsJson);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function stepsText(stepsJson: string): string {
  try {
    const parsed = JSON.parse(stepsJson);
    if (!Array.isArray(parsed)) return "";
    return parsed
      .map((step, index) => {
        if (typeof step === "string") return `${index + 1}. ${step}`;
        if (step && typeof step === "object") {
          const action = step.action || step.step || step.description || "";
          const expected = step.expectedResult || step.expected || "";
          if (!action && !expected) return "";
          return expected ? `${index + 1}. ${action} -> ${expected}` : `${index + 1}. ${action}`;
        }
        return "";
      })
      .filter(Boolean)
      .join(" | ");
  } catch {
    return "";
  }
}

export default function ZyraTaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const taskId = params.taskId as string;
  const { currentUser } = useAppData();
  const { project, projectMembers } = useProjectData();
  const projectName = String(project.name || "");
  const [task, setTask] = useState<ZyraTask | null>(null);
  const [suites, setSuites] = useState<SuiteNode[]>([]);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);
  const [linearTickets, setLinearTickets] = useState<LinearTicket[]>([]);
  const [notionPages, setNotionPages] = useState<NotionPage[]>([]);
  const [ticketComments, setTicketComments] = useState<ZyraTicketComment[]>([]);
  const [retryingCommentId, setRetryingCommentId] = useState<string | null>(null);
  const [selectedDrafts, setSelectedDrafts] = useState<number[]>([]);
  const [feedback, setFeedback] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [selectedJiraKeys, setSelectedJiraKeys] = useState<string[]>([]);
  const [selectedLinearKeys, setSelectedLinearKeys] = useState<string[]>([]);
  // Full Notion page ids (what the API links by), shown to the user as their short keys.
  const [selectedNotionIds, setSelectedNotionIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>("testcases");
  const [savingOpen, setSavingOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode>("");
  const [targetSuiteId, setTargetSuiteId] = useState("");
  const [newSuiteName, setNewSuiteName] = useState("");
  const [savingDraftIndexes, setSavingDraftIndexes] = useState<number[] | null>(null);
  const [savingProposal, setSavingProposal] = useState<Pick<ZyraTask, "proposalRevision" | "proposalSnapshot"> | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [bundleWorking, setBundleWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A save failure renders inside the Save modal: the page-level `error` banner sits under the
  // modal's backdrop, so a failed save looked like the button had done nothing.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNeedsReload, setSaveNeedsReload] = useState(false);
  const [draftNeedsReload, setDraftNeedsReload] = useState(false);
  const taskRef = useRef<ZyraTask | null>(null);
  const taskReadSequenceRef = useRef(0);
  const taskMutationRef = useRef(false);
  const draftNeedsReloadRef = useRef(false);
  const pollInFlightRef = useRef(false);
  // The task's own language (set server-side from the script of what the user typed); English
  // until the task has loaded, or when it carries none.
  const lang = zyraLanguage(task?.language);
  const t = zyraText(lang);
  // For loadData, which is memoized and so can't read `t` from a later render.
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // An index is meaningful only within the proposal it was selected from. Only our own
  // acknowledged deletion can safely translate it into the next snapshot.
  const acceptTask = useCallback((next: ZyraTask, deletion?: { revision: string; index: number }) => {
    const previous = taskRef.current;
    const sameProposal = previous?.id === next.id && Boolean(next.proposalRevision) &&
      previous.proposalRevision === next.proposalRevision && next.taskStatus === "in_review";
    const acknowledgedDeletion = previous?.id === next.id && previous.proposalRevision === deletion?.revision &&
      next.taskStatus === "in_review";
    taskRef.current = next;
    setTask(next);
    setSelectedDrafts((selected) => {
      if (sameProposal) return selected;
      if (acknowledgedDeletion && deletion) {
        return selected.filter((index) => index !== deletion.index).map((index) => index > deletion.index ? index - 1 : index);
      }
      return [];
    });
  }, []);

  function beginTaskMutation() {
    taskMutationRef.current = true;
    // A GET started before the write must never replace its acknowledged result.
    taskReadSequenceRef.current += 1;
  }

  function requireDraftReload(err: unknown) {
    draftNeedsReloadRef.current = true;
    setDraftNeedsReload(true);
    setSelectedDrafts([]);
    setError(err instanceof ApiError && err.status < 500
      ? `${err.message} ${t("draft.refreshRequired")}`
      : t("draft.mutationUnconfirmed"));
  }

  const loadData = useCallback(async (reconcileDrafts = false) => {
    const sequence = ++taskReadSequenceRef.current;
    try {
      const [taskData, suiteList, jiraStatus, linearStatus, notionStatus, comments] = await Promise.all([
        getZyraTask(projectId, taskId),
        listSuites(projectId).catch(() => []),
        getJiraStatus(projectId).catch(() => ({ connected: false })),
        getLinearStatus(projectId).catch(() => ({ connected: false })),
        getNotionStatus(projectId).catch(() => ({ connected: false })),
        listZyraTaskTicketComments(projectId, taskId).catch(() => [] as ZyraTicketComment[]),
      ]);
      if (sequence !== taskReadSequenceRef.current) return;
      acceptTask(taskData);
      setSuites(suiteList);
      setTicketComments(comments);
      if (reconcileDrafts) {
        draftNeedsReloadRef.current = false;
        setDraftNeedsReload(false);
        setSelectedDrafts([]);
      }
      if (jiraStatus.connected) {
        const tickets = await listJiraTickets(projectId, { limit: 50 }).catch(() => ({ list: [], total: 0 }));
        setJiraTickets(tickets.list || []);
      } else {
        setJiraTickets([]);
      }
      if (linearStatus.connected) {
        const tickets = await listLinearTickets(projectId, { limit: 50 }).catch(() => ({ list: [], total: 0 }));
        setLinearTickets(tickets.list || []);
      } else {
        setLinearTickets([]);
      }
      if (notionStatus.connected) {
        const pages = await listNotionPages(projectId, { limit: 50 }).catch(() => ({ list: [], total: 0 }));
        setNotionPages(pages.list || []);
      } else {
        setNotionPages([]);
      }
      if (sequence === taskReadSequenceRef.current && !draftNeedsReloadRef.current) setError(null);
    } catch (err) {
      if (sequence === taskReadSequenceRef.current) setError(err instanceof Error ? err.message : zyraText(langRef.current)("task.err.load"));
    } finally {
      if (sequence === taskReadSequenceRef.current) setLoading(false);
    }
  }, [projectId, taskId, acceptTask]);

  useEffect(() => {
    if (!currentUser) router.replace("/login");
    else void loadData();
  }, [loadData, router, projectId, currentUser]);

  // Lighter than loadData (skips suites/Jira) — just re-reads this task so Zyra finishing (or
  // failing) generation server-side shows up here without a manual reload.
  const refreshTask = useCallback(async (afterRejectedDecision = false) => {
    if (pollInFlightRef.current || (taskMutationRef.current && !afterRejectedDecision) || draftNeedsReloadRef.current) return;
    pollInFlightRef.current = true;
    const sequence = ++taskReadSequenceRef.current;
    try {
      const taskData = await getZyraTask(projectId, taskId);
      if (sequence === taskReadSequenceRef.current) acceptTask(taskData);
    } catch {
      // A missed poll tick isn't worth surfacing; the next one usually succeeds.
    } finally {
      pollInFlightRef.current = false;
    }
  }, [projectId, taskId, acceptTask]);

  useEffect(() => {
    if (!task) return;
    const status = normalizeStatus(task.taskStatus);
    if (status !== "todo" && status !== "in_progress") return;
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshTask();
    }, 5000);
    return () => clearInterval(timer);
  }, [task, refreshTask]);

  // A ticket comment is posted in the background after a save, so it can still read "Posting…" when
  // the save returns — re-read until none is pending, then stop.
  const hasPendingTicketComment = ticketComments.some((comment) => comment.status === "pending");
  useEffect(() => {
    if (!hasPendingTicketComment) return;
    const timer = setInterval(() => {
      void Promise.all([
        listZyraTaskTicketComments(projectId, taskId).then(setTicketComments),
        refreshTask(),
      ]).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [hasPendingTicketComment, projectId, taskId, refreshTask]);

  async function handleRetryTicketComment(comment: ZyraTicketComment) {
    setRetryingCommentId(comment.id);
    setMessage(null);
    setError(null);
    try {
      const result = await retryZyraTicketComment(projectId, taskId, comment.id);
      const label = integrationProviderLabel(result.provider);
      if (result.status === "posted") setMessage(t("task.commentPosted", { label, key: result.issueKey }));
      else setError(t("task.commentStillFailed", { label, key: result.issueKey, reason: result.reason || "" }));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("task.err.retryComment"));
      await loadData();
    } finally {
      setRetryingCommentId(null);
    }
  }

  async function handleRequirementBundleDecision(decision: "rejected" | "withdrawn") {
    if (!task || done || bundleWorking || taskMutationRef.current) return;
    if (!task.proposalRevision) {
      setError("Reload this bundle to verify the exact content before deciding.");
      return;
    }
    const reviewedRevision = task.proposalRevision;
    beginTaskMutation();
    setBundleWorking(true);
    setMessage(null);
    setError(null);
    try {
      const updated = decision === "rejected"
        ? await rejectRequirementProposal(projectId, taskId, reviewedRevision)
        : await withdrawRequirementProposal(projectId, taskId, reviewedRevision);
      acceptTask(updated);
      if (!updated.requirementDecision) {
        setError("The recorded decision could not be verified. Reload this task before continuing.");
        return;
      }
      setMessage(updated.requirementDecision.decision === "rejected"
        ? "Requirement change bundle rejected. Nothing was published."
        : "Requirement change bundle withdrawn. Nothing was published.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The requirement change bundle could not be updated.");
      if (err instanceof ApiError && err.status === 409) await refreshTask(true);
    } finally {
      taskMutationRef.current = false;
      setBundleWorking(false);
    }
  }

  async function handleRequirementBundleApply() {
    if (!task || done || bundleWorking || taskMutationRef.current || !task.proposalRevision || task.skillContext?.status !== "resolved") return;
    beginTaskMutation();
    setBundleWorking(true);
    setMessage(null);
    setError(null);
    try {
      const applied = await applyRequirementProposal(projectId, taskId, task.proposalRevision);
      await loadData();
      const requirementId = applied.receipt?.requirement?.documentId;
      setMessage(`Requirement change bundle applied as an immutable submitted version${requirementId ? ` (${requirementId})` : ""}. Requirement approval remains a separate human decision.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The requirement change bundle could not be applied.");
    } finally {
      taskMutationRef.current = false;
      setBundleWorking(false);
    }
  }

  async function handleManagedDocumentApply() {
    if (!task || done || bundleWorking || taskMutationRef.current || !task.proposalRevision) return;
    beginTaskMutation();
    setBundleWorking(true);
    setMessage(null);
    setError(null);
    try {
      const applied = await applyManagedDocumentProposal(projectId, taskId, task.proposalRevision);
      await loadData();
      setMessage(`Candidate applied as native ${applied.receipt?.document?.status || "Draft"} document${applied.receipt?.document?.documentId ? ` (${applied.receipt.document.documentId})` : ""}. Submission and approval remain separate human decisions.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The governed document candidate could not be applied.");
    } finally {
      taskMutationRef.current = false;
      setBundleWorking(false);
    }
  }

  async function handleManagedDocumentReject(reason: string) {
    if (!task || done || bundleWorking || taskMutationRef.current || !task.proposalRevision) return;
    beginTaskMutation();
    setBundleWorking(true);
    setMessage(null);
    setError(null);
    try {
      await rejectManagedDocumentProposal(projectId, taskId, task.proposalRevision, reason.trim() || undefined);
      await loadData();
      setMessage("Candidate rejected. Nothing was published.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The governed document candidate could not be rejected.");
    } finally {
      taskMutationRef.current = false;
      setBundleWorking(false);
    }
  }

  function toggleDraft(index: number) {
    if (!canReviewDrafts) return;
    setSelectedDrafts((prev) => prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]);
  }

  function selectAllDrafts() {
    if (!task || !canReviewDrafts) return;
    setSelectedDrafts(task.drafts.map((_, index) => index));
  }

  function clearDraftSelection() {
    if (done) return;
    setSelectedDrafts([]);
  }

  // The one rule for whether the Save modal can submit — the button's disabled state and
  // handleSave's guard both read it, so they can't drift apart.
  const newSuiteNameError = saveMode === "new" ? validateSuiteName(newSuiteName) : "";
  const saveTargetValid =
    saveMode === "none" ||
    (saveMode === "existing" && Boolean(targetSuiteId)) ||
    (saveMode === "new" && !newSuiteNameError);
  const canSave = !working && !bundleWorking && !saveNeedsReload && !draftNeedsReload && task?.taskStatus === "in_review" && Boolean(savingProposal?.proposalRevision) &&
    (savingDraftIndexes || selectedDrafts).length > 0 && saveTargetValid;

  function openSaveModal(indexes?: number[]) {
    if (!canReviewDrafts) return;
    if (!task?.proposalRevision || !task.proposalSnapshot) {
      setError("The current proposal could not be verified. Reload this task before reviewing it.");
      return;
    }
    setSavingDraftIndexes(indexes || selectedDrafts);
    // Keep the revision paired with the content the reviewer opened. Background task updates
    // must never silently authorize a newer proposal while this decision is visible.
    setSavingProposal({ proposalRevision: task.proposalRevision, proposalSnapshot: task.proposalSnapshot });
    // Every save starts from "Select suite": a target left over from a cancelled attempt would
    // otherwise be one click from filing these drafts somewhere nobody chose this time.
    setSaveMode("");
    setTargetSuiteId("");
    setNewSuiteName("");
    setSaveError(null);
    setSaveNeedsReload(false);
    setSnapshotOpen(false);
    setSavingOpen(true);
  }

  function closeSaveModal() {
    // Held open while a save is in flight, as Cancel already is, so its outcome can't land unseen.
    if (working) return;
    setSavingOpen(false);
    setSaveError(null);
  }

  async function handleFeedback() {
    if (!task || !feedback.trim() || taskMutationRef.current) return;
    beginTaskMutation();
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const result = await sendZyraFeedback(projectId, task.id, {
        feedback: feedback.trim(),
        referenceNote: referenceNote.trim() || undefined,
        jiraIssueKeys: selectedJiraKeys,
        linearIssueKeys: selectedLinearKeys,
        notionPageIds: selectedNotionIds,
      });
      acceptTask(result.task);
      setFeedback("");
      setReferenceNote("");
      setSelectedJiraKeys([]);
      setSelectedLinearKeys([]);
      setSelectedNotionIds([]);
      setMessage(t("task.feedbackSent"));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("task.err.feedback"));
    } finally {
      taskMutationRef.current = false;
      setWorking(false);
    }
  }

  async function handleDeleteDraft(index: number) {
    if (!task?.proposalRevision || !canReviewDrafts || taskMutationRef.current) return;
    const revision = task.proposalRevision;
    beginTaskMutation();
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await deleteZyraTaskDraft(projectId, task.id, index, revision);
      acceptTask(updated, { revision, index });
      setMessage(t("task.draftDeleted"));
    } catch (err) {
      requireDraftReload(err);
    } finally {
      taskMutationRef.current = false;
      setWorking(false);
    }
  }

  async function handleDeleteSelectedDrafts() {
    if (!task?.proposalRevision || !canReviewDrafts || selectedDrafts.length === 0 || taskMutationRef.current) return;
    beginTaskMutation();
    setWorking(true);
    setMessage(null);
    setError(null);
    let confirmed = 0;
    try {
      let updated = task;
      const indexes = [...selectedDrafts].sort((a, b) => b - a);
      for (const index of indexes) {
        const revision = updated.proposalRevision;
        if (!revision || updated.taskStatus !== "in_review") throw new Error(t("draft.refreshRequired"));
        updated = await deleteZyraTaskDraft(projectId, task.id, index, revision);
        // Commit each acknowledgement to the visible list before sending the next deletion.
        // Never fetch a new revision and replay indexes after an intervening change.
        acceptTask(updated, { revision, index });
        confirmed += 1;
      }
      setSelectedDrafts([]);
      setMessage(t("task.draftsDeleted", { n: indexes.length }));
    } catch (err) {
      if (confirmed) setMessage(t("task.draftsDeleted", { n: confirmed }));
      requireDraftReload(err);
    } finally {
      taskMutationRef.current = false;
      setWorking(false);
    }
  }

  async function handleSave() {
    if (!task || !canSave || !savingProposal?.proposalRevision || taskMutationRef.current) return;
    const indexes = savingDraftIndexes || selectedDrafts;
    beginTaskMutation();
    setWorking(true);
    setMessage(null);
    setError(null);
    setSaveError(null);
    try {
      // Only the chosen path contributes a suite, so a pick abandoned by switching to "No suite"
      // can't ride along.
      const result = await saveZyraTask(projectId, task.id, {
        expectedProposalRevision: savingProposal.proposalRevision,
        selectedDraftIndexes: indexes,
        suiteId: saveMode === "none" ? null : saveMode === "existing" ? targetSuiteId : undefined,
        // The native Save transaction creates a requested suite only after revision validation.
        suiteName: saveMode === "new" ? newSuiteName.trim() : undefined,
      });
      setMessage(t("task.saved", { n: result.savedCount }));
      setSavingOpen(false);
      setSavingDraftIndexes(null);
      setSavingProposal(null);
      await loadData();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("task.err.save"));
      const needsReload = !(err instanceof ApiError) || err.status === 409 || err.status >= 500;
      setSaveNeedsReload(needsReload);
      if (needsReload) requireDraftReload(err);
    } finally {
      taskMutationRef.current = false;
      setWorking(false);
    }
  }

  async function handleCloseTask() {
    if (!task || taskMutationRef.current) return;
    beginTaskMutation();
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await closeZyraTask(projectId, task.id);
      acceptTask(updated);
      setSelectedDrafts([]);
      setMessage(t("task.closed"));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("task.err.close"));
    } finally {
      taskMutationRef.current = false;
      setWorking(false);
    }
  }

  const taskBreadcrumb = (
    <Breadcrumbs
      items={[
        { label: "Projects", href: "/projects" },
        { label: projectName || "Project", href: `/projects/${projectId}/dashboard` },
        { label: "Agents", href: `/projects/${projectId}/agents` },
        { label: "Tasks", href: `/projects/${projectId}/agents/tasks` },
        { label: "Zyra task" },
      ]}
    />
  );

  if (loading || !task) {
    return (
      <StandardPageLayout header={<PageHeader title={t("task.pageTitle")} breadcrumb={taskBreadcrumb} />}>
        <PageLoader label={t("task.loading")} />
      </StandardPageLayout>
    );
  }

  const done = normalizeStatus(task.taskStatus) === "done";
  const taskStatusNow = normalizeStatus(task.taskStatus);
  const canReviewDrafts = taskStatusNow === "in_review" && Boolean(task.proposalRevision) && !working && !bundleWorking && !draftNeedsReload;
  // Defensive: activity_log is jsonb server-side and not schema-enforced, so a malformed or
  // missing value must render an empty history rather than throw.
  const feedbackActivities = Array.isArray(task.activities) ? task.activities.filter(isFeedbackActivity) : [];
  // Mirrors the backend guard in zyraFeedback: feedback only makes sense once there's something
  // to review, or to retry after a failure. Disabling it here for todo/in_progress avoids a
  // pointless round trip that the server would reject with a 409 anyway.
  const output = summarizeZyraTaskOutput(task);
  const isRequirementBundle = output.isRequirementBundle;
  const isManagedDocumentProposal = output.isManagedDocumentProposal;
  const requirementApplyReceipt = task.requirementApplyReceipt;
  // Rejected and withdrawn bundles also end as `done`; only an apply receipt means publication.
  const requirementApplied = done && Boolean(requirementApplyReceipt);
  const currentProjectRole = projectMembers.find((member) => member.userId === currentUser?.userId)?.role;
  const canApproveRequirement = isKnowledgeOwnerOrManager(currentProjectRole);
  const canGiveFeedback = !isRequirementBundle && !isManagedDocumentProposal && (taskStatusNow === "in_review" || taskStatusNow === "failed");
  type RequirementBundleEntry = {
    opType?: string; title?: string; description?: string; reason?: string;
    criteria?: Array<{ key?: string; text?: string; normative?: boolean }>;
    draft?: Record<string, unknown> & { title?: string };
    criterionKeys?: string[];
    carryForwardLinks?: unknown;
  };
  const requirementOps: RequirementBundleEntry[] = Array.isArray(task.requirementBundle)
    ? (task.requirementBundle as RequirementBundleEntry[]) : [];
  const bundleRequirement = requirementOps.find((entry) => entry.opType === "requirement_revision");
  const bundleCase = requirementOps.find((entry) => entry.opType === "testcase_create");
  const bundleLink = requirementOps.find((entry) => entry.opType === "requirement_case_link");
  const bundleCriteria = Array.isArray(bundleRequirement?.criteria) ? bundleRequirement.criteria : [];
  const skillsResolved = task.skillContext?.status === "resolved";
  const bundleSkillAssignments = Array.isArray(task.skillContext?.assignments) ? task.skillContext.assignments : [];
  const missingSkillTargets = Array.isArray(task.skillContext?.missing) ? task.skillContext.missing : [];
  const conflictingSkillTargets = Array.isArray(task.skillContext?.conflicts) ? task.skillContext.conflicts : [];
  const allDraftsSelected = task.drafts.length > 0 && selectedDrafts.length === task.drafts.length;
  const copyableDrafts = selectedDrafts.length > 0 ? selectedDrafts.map((i) => task.drafts[i]) : task.drafts;
  const draftsTsv = toTsv(
    [t("col.title"), t("col.priority"), t("col.severity"), t("col.component"), t("col.preconditions"), t("col.steps"), t("col.expectedResultCap"), t("col.tags")],
    copyableDrafts.map((draft) => [
      draft.title,
      draft.priority,
      draft.severity ? t.value("severity", draft.severity) : "",
      draft.component ?? "",
      draft.preconditions,
      stepsText(draft.stepsJson),
      draft.expectedSummary,
      draft.tags?.join(", ") ?? "",
    ])
  );
  const tabItems: Array<{ key: DetailTab; label: string; count?: number }> = [
    { key: "testcases", label: isRequirementBundle || isManagedDocumentProposal ? "Proposal summary" : t("task.tab.generated"),
      count: isRequirementBundle || isManagedDocumentProposal ? output.operationCount ?? undefined : task.drafts.length },
    { key: "feedback", label: t("task.tab.feedback"), count: feedbackActivities.length },
    { key: "activities", label: t("task.tab.activities"), count: task.activities.length },
    { key: "sources", label: t("task.tab.sources"), count: task.sources.length },
  ];

  return (
    // Shared badges inside (techniques, severity) read the task's language from this context.
    <ZyraLanguageContext.Provider value={lang}>
    <StandardPageLayout
      header={
        <PageHeader
          title={t("task.pageTitle")}
          subtitle={t("task.subtitle")}
          breadcrumb={taskBreadcrumb}
          actions={<Link href={`/projects/${projectId}/agents/tasks`} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)]">{t("task.backToBoard")}</Link>}
        />
      }
    >
      {message && <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-foreground)]">{error}</p>}
      {draftNeedsReload && <Button variant="secondary" disabled={working || bundleWorking} onClick={() => void loadData(true)}>{t("draft.reload")}</Button>}

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <StatusChip tone={tone(task.taskStatus)}>{statusLabel(task.taskStatus, t)}</StatusChip>
            <h2 className="mt-3 text-lg font-semibold text-[var(--foreground)]">{task.userStory}</h2>
            {normalizeStatus(task.taskStatus) === "failed" && (
              <p className="mt-2 rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-foreground)]">
                {latestFailureDetail(task.activities, t("task.failedDefault"))}
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--muted)]">
              {isRequirementBundle || isManagedDocumentProposal
                ? `${output.primary} · ${output.secondary} · ${task.tokenUsage.total} tokens · ${formatDateTime(task.updatedAt, t.locale)}`
                : t("task.summary", {
                  generated: task.generatedCount,
                  saved: task.savedCount,
                  tokens: task.tokenUsage.total,
                  date: formatDateTime(task.updatedAt, t.locale),
                })}
            </p>
            {zyraTaskTicketKeys(task).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {zyraTaskTicketKeys(task).map((key) => (
                  <span key={key} className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent-light)]">
                    {key}
                  </span>
                ))}
              </div>
            )}
            {/* The task's description — for a Jira/Linear task, the ticket description captured into
                `context` when the task was created from Requirements. The quick-view popup always
                rendered it; this page never did, so "View full task" dropped it and only a
                320-character excerpt survived, as a Sources entry. Same field and same Markdown
                renderer as the popup (escaped, http(s)-only links), so the two can't disagree. */}
            <div data-testid="task-description" className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{t("drawer.description")}</p>
              {task.context?.trim() ? (
                <CollapsibleDescription
                  html={renderMarkdown(task.context)}
                  moreLabel={t("task.viewMore")}
                  lessLabel={t("task.viewLess")}
                />
              ) : (
                <p className="mt-1.5 text-sm text-[var(--muted-soft)]">{t("task.noDescription")}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!done && !isRequirementBundle && !isManagedDocumentProposal && (
              <Button variant="secondary" onClick={() => void handleCloseTask()} disabled={working}>{t("task.closeTask")}</Button>
            )}
          </div>
        </div>
      </Card>

      {ticketComments.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">{t("task.ticketComments")}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("task.ticketCommentsHint")}
          </p>
          <ul className="mt-3 space-y-2">
            {ticketComments.map((comment) => {
              const status = TICKET_COMMENT_STATUS[comment.status] ?? { label: comment.status, tone: "neutral" as const };
              return (
                <li key={comment.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-[var(--foreground)]">{integrationProviderLabel(comment.provider)} {comment.provider === "notion" ? notionPageKey(comment.issueKey) : comment.issueKey}</span>
                      <StatusChip tone={status.tone}>{t.opt(`task.commentStatus.${comment.status}`) ?? status.label}</StatusChip>
                      <span className="text-xs text-[var(--muted)]">
                        {t("task.commentCount", { n: comment.testcaseCount })} · {formatDateTime(comment.postedAt || comment.updatedAt, t.locale)}
                      </span>
                    </div>
                    {comment.status === "failed" && comment.reason && (
                      <p className="text-xs text-[var(--error-foreground)]">{comment.reason}</p>
                    )}
                  </div>
                  {comment.status === "failed" && (
                    <Button variant="secondary" onClick={() => void handleRetryTicketComment(comment)} disabled={retryingCommentId !== null}>
                      {retryingCommentId === comment.id ? t("task.retrying") : t("task.retryComment")}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {requirementOps.length > 0 && (
        <Card className="p-4" data-testid="requirement-change-bundle">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Requirement change bundle</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {requirementApplied
                    ? "Applied. The persisted apply receipt points to the exact submitted requirement version in the review panel below; approval, case activation and execution remain separate human decisions."
                    : done
                      ? "This bundle closed without publication. The recorded outcome below is authoritative; no requirement version, case or link was created."
                      : "Staging only. No requirement version, test case, active link or approval exists until a human publishes it."}
                </p>
              </div>
              {bundleRequirement && (
                <div data-testid="requirement-bundle-candidate">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Requirement revision candidate</p>
                  <p className="mt-1 font-medium text-[var(--foreground)]">{String(bundleRequirement.title || "Untitled requirement")}</p>
                  {bundleRequirement.description && <p className="mt-1 text-sm text-[var(--muted)]">{String(bundleRequirement.description)}</p>}
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--foreground)]">
                    {bundleCriteria.map((criterion) => (
                      <li key={String(criterion.key)}><span className="font-mono text-xs text-[var(--muted)]">{String(criterion.key)}</span> {String(criterion.text)}{criterion.normative === false && <span className="ml-2 text-xs text-[var(--muted)]">Context only</span>}</li>
                    ))}
                  </ul>
                </div>
              )}
              <RequirementCarryForwardReview selections={bundleRequirement?.carryForwardLinks} skillContext={task.skillContext} />
              {bundleCase && (
                <div data-testid="requirement-bundle-case">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Testcase candidate (Draft proposal)</p>
                  <p className="mt-1 text-sm text-[var(--foreground)]">{String(bundleCase.draft?.title || "Untitled test case")}</p>
                  <dl className="mt-2 space-y-2 text-sm" data-testid="requirement-bundle-case-fields">
                    {Object.entries(bundleCase.draft || {}).filter(([field]) => field !== "title").map(([field, value]) => (
                      <div key={field}>
                        <dt className="font-medium text-[var(--foreground)]">{field.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt>
                        <dd className="whitespace-pre-wrap break-words text-[var(--muted)]">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {bundleLink && (
                <div data-testid="requirement-bundle-link">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Link intent</p>
                  {Array.isArray(bundleLink.criterionKeys) && bundleLink.criterionKeys.length > 0 ? (
                    <ul aria-label="Proposed case link criteria" className="mt-1 space-y-1 text-sm text-[var(--foreground)]">
                      {bundleLink.criterionKeys.map((key, index) => {
                        const criterion = bundleCriteria.find((item) => item.key === key);
                        return (
                          <li key={`${key}-${index}`}>
                            <span className="font-mono">{key}</span>{" · "}
                            {criterion ? (criterion.normative === false ? "Context only" : "Acceptance criterion") : "Criterion details unavailable"}
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="mt-1 text-sm text-[var(--muted)]">No criterion keys recorded.</p>}
                </div>
              )}
              {bundleSkillAssignments.length > 0 && (
                <div data-testid="requirement-bundle-skills">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Pinned effective skills</p>
                  <ul className="mt-1 space-y-1 text-sm text-[var(--foreground)]">
                    {bundleSkillAssignments.map((assignment) => (
                      <li key={assignment.assignmentId}>
                        <span className="font-mono text-xs">{assignment.skillKey || assignment.skillDocumentId}</span>
                        {assignment.versionNumber !== undefined ? ` · v${assignment.versionNumber}` : ""}
                        {assignment.target ? ` · ${assignment.target.module}/${assignment.target.subtype}/${assignment.target.operation}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <details className="rounded-lg border border-[var(--border)] p-3 text-sm" data-testid="requirement-bundle-full-content">
                <summary className="cursor-pointer font-medium">Complete staged content</summary>
                <p className="mt-2 text-[var(--muted)]">These are all the requirement, test case and link fields in this reviewed revision, including their exact references and reasons.</p>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(requirementOps, null, 2)}</pre>
              </details>
              {task.requirementDecision && (
                <p data-testid="requirement-bundle-recorded-decision" className="text-sm">
                  Recorded outcome: {task.requirementDecision.decision}. Nothing was published.
                  {task.requirementDecision.reason && ` Reason: ${task.requirementDecision.reason}`}
                </p>
              )}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm" data-testid="requirement-bundle-publication-gate">
                <p>
                {requirementApplied
                  ? "This bundle is published. Open the exact submitted version and its truthful coverage in the review panel below."
                  : done
                    ? "This bundle was not published. No requirement version, case or link was created; the recorded outcome above is authoritative."
                    : skillsResolved
                      ? "Publication uses the pinned, conflict-free effective skills shown above. Apply creates the exact submitted requirement revision and only the case/link candidates included in the bundle. Requirement approval and selected existing link activation remain separate human decisions."
                      : task.skillContext?.status === "conflict"
                        ? "Publication is blocked. Multiple Skill assignments matched a required operation when this proposal was staged."
                        : task.skillContext?.status === "unassigned" && missingSkillTargets.length > 0
                          ? "Publication is blocked. A required operation had no approved Skill assigned when this proposal was staged."
                          : "Publication is blocked. This proposal has no verified record of the required Skill assignments."}
                </p>
                {!done && !skillsResolved && <>
                  {(missingSkillTargets.length > 0 || conflictingSkillTargets.length > 0) && (
                    <ul className="mt-2 list-disc pl-5" aria-label="Skill assignments at staging">
                      {missingSkillTargets.map(({ module, subtype, operation }) => (
                        <li key={`${module}/${subtype}/${operation}`}>{module} / {subtype} / {operation} · Unassigned</li>
                      ))}
                      {conflictingSkillTargets.map(({ module, subtype, operation, matches }) => (
                        <li key={`${module}/${subtype}/${operation}`}>{module} / {subtype} / {operation} · {matches} matching assignments</li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2">
                    A project owner or manager can review the current assignments. Once each required operation resolves to exactly one approved Skill, stage a refreshed proposal for review.
                  </p>
                  <Link className="mt-1 inline-block underline" href={`/projects/${projectId}/settings/skills?tab=assignments`}>View current Skill assignments</Link>
                </>}
              </div>
            </div>
            {!done && (
              <div className="flex shrink-0 gap-2">
                {skillsResolved && (
                  <Button onClick={() => void handleRequirementBundleApply()} disabled={bundleWorking} data-testid="requirement-bundle-apply">
                    Apply reviewed bundle
                  </Button>
                )}
                <Button variant="secondary" onClick={() => void handleRequirementBundleDecision("withdrawn")} disabled={bundleWorking}>
                  Withdraw
                </Button>
                <Button variant="secondary" onClick={() => void handleRequirementBundleDecision("rejected")} disabled={bundleWorking}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {isRequirementBundle && requirementApplyReceipt?.requirement.documentId && requirementApplyReceipt.requirement.versionId && (
        <RequirementReviewPanel
          key={`${requirementApplyReceipt.requirement.documentId}:${requirementApplyReceipt.requirement.versionId}`}
          projectId={projectId}
          documentId={requirementApplyReceipt.requirement.documentId}
          versionId={requirementApplyReceipt.requirement.versionId}
          canApprove={canApproveRequirement}
          automationHandoff={requirementApplied && requirementApplyReceipt.id && requirementApplyReceipt.testcase?.id
            && requirementApplyReceipt.link?.criterionKeys.length && bundleCase?.draft?.automationRepo && bundleCase.draft.automationPath
            && String(bundleCase.draft.automationFramework ?? "").trim().toLowerCase() === "playwright"
            ? { testcaseId: requirementApplyReceipt.testcase.id, criterionKeys: requirementApplyReceipt.link.criterionKeys,
                setup: <AutomationHandoffInstructions projectId={projectId} taskId={taskId} target={{
                  repository: String(bundleCase.draft.automationRepo),
                  path: String(bundleCase.draft.automationPath),
                  framework: String(bundleCase.draft.automationFramework)
                }} /> } : undefined}
        />
      )}

      {isManagedDocumentProposal && task.managedDocumentProposal && (
        <ManagedDocumentProposalPanel
          projectId={projectId}
          task={task}
          canApprove={canApproveRequirement}
          working={bundleWorking}
          onApply={() => void handleManagedDocumentApply()}
          onReject={(reason) => void handleManagedDocumentReject(reason)}
        />
      )}

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)]">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${activeTab === tab.key ? "border-[var(--brand-primary)] text-[var(--accent-light)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}
          >
            {tab.label}{tab.count != null ? ` (${tab.count})` : ""}
          </button>
        ))}
      </div>

      {activeTab === "testcases" && (
        isRequirementBundle || isManagedDocumentProposal ? (
          <Card className="p-4" data-testid="native-proposal-output-summary">
            <h3 className="font-semibold text-[var(--foreground)]">{output.primary}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{output.secondary}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              These are proposed artifact operations, not generated Test Cases.
              The reviewed bundle or document panel above owns the authoritative
              decision and native receipt. No test case can be saved from this summary.
            </p>
          </Card>
        ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3">
              <div className="text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">{selectedDrafts.length}</span>{t("task.selectedOf", { n: task.drafts.length })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={allDraftsSelected ? clearDraftSelection : selectAllDrafts} disabled={!canReviewDrafts || task.drafts.length === 0}>
                  {allDraftsSelected ? t("review.unselectAll") : t("review.selectAll")}
                </Button>
                {!allDraftsSelected && (
                  <Button variant="secondary" onClick={clearDraftSelection} disabled={!canReviewDrafts || selectedDrafts.length === 0}>{t("task.clearSelection")}</Button>
                )}
                {task.drafts.length > 0 && (
                  <span title={selectedDrafts.length > 0 ? t("task.copySelectedTitle") : t("task.copyAllTitle")}>
                    <CopyButton
                      value={draftsTsv}
                      label={selectedDrafts.length > 0 ? t("task.copySelected", { n: selectedDrafts.length }) : t("task.copyAll")}
                      copiedLabel={t("copied")}
                    />
                  </span>
                )}
                <Button variant="secondary" onClick={() => openSaveModal()} disabled={!canReviewDrafts || selectedDrafts.length === 0}>{t("task.saveSelected")}</Button>
                <Button variant="secondary" onClick={() => void handleDeleteSelectedDrafts()} disabled={!canReviewDrafts || selectedDrafts.length === 0}>{t("task.deleteSelected")}</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-secondary)] text-xs uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={allDraftsSelected}
                        onChange={allDraftsSelected ? clearDraftSelection : selectAllDrafts}
                        disabled={!canReviewDrafts || task.drafts.length === 0}
                        aria-label={t("task.selectAllAria")}
                      />
                    </th>
                    <th className="px-3 py-3">{t("col.testcase")}</th>
                    <th className="px-3 py-3">{t("col.priority")}</th>
                    <th className="px-3 py-3">{t("col.severity")}</th>
                    <th className="px-3 py-3">{t("col.component")}</th>
                    <th className="px-3 py-3">{t("col.preconditions")}</th>
                    <th className="px-3 py-3">{t("col.steps")}</th>
                    <th className="px-3 py-3">{t("col.expectedResultCap")}</th>
                    <th className="px-3 py-3 text-right">{t("col.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {task.drafts.map((draft, index) => (
                    <tr key={`${task.id}-${index}`} className="border-t border-[var(--border)] align-top">
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedDrafts.includes(index)} onChange={() => toggleDraft(index)} disabled={!canReviewDrafts} aria-label={t("task.selectRow", { n: index + 1 })} />
                      </td>
                      <td className="max-w-[260px] px-3 py-3">
                        {draft.action && (
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <StatusChip tone="info" className="!rounded-[5px] !px-1.5 !py-0 !text-[10px] !font-medium">
                              {t.opt(`draftAction.${draft.action}`) || draft.action}
                            </StatusChip>
                            {draft.externalId && <span className="font-mono text-[11px] text-[var(--muted-soft)]">{draft.externalId}</span>}
                          </div>
                        )}
                        <div className="font-semibold text-[var(--foreground)]">{draft.title}</div>
                        {draft.tags?.length ? <div className="mt-2 text-xs text-[var(--muted-soft)]">{draft.tags.join(", ")}</div> : null}
                        {draft.techniques?.length ? <div className="mt-2"><TechniqueBadges techniques={draft.techniques} /></div> : null}
                        {/* Only present on a normalized update/archive draft (formatAiTask) — why
                            the sweep or the chat turn flagged this, shown right on the card so a
                            reviewer doesn't have to open the Activities tab to find out. */}
                        {draft.reason && <div className="mt-1 text-xs italic text-[var(--muted)]">{draft.reason}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded bg-[var(--surface-secondary)] px-2 py-1 text-xs font-medium text-[var(--muted)]">{draft.priority}</span>
                      </td>
                      <td className="px-3 py-3">{knownSeverity(draft.severity) && <ZyraSeverityBadge severity={knownSeverity(draft.severity)!} />}</td>
                      <td className="px-3 py-3 text-[var(--muted)]">{draft.component || ""}</td>
                      <td className="max-w-[220px] px-3 py-3 text-[var(--muted)]">{draft.preconditions}</td>
                      <td className="px-3 py-3 text-[var(--muted)]">{t("task.stepCount", { n: stepCount(draft.stepsJson) })}</td>
                      <td className="max-w-[260px] px-3 py-3 text-[var(--muted)]">{draft.expectedSummary}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => openSaveModal([index])} disabled={!canReviewDrafts}>{t("save")}</Button>
                          <Button variant="secondary" onClick={() => void handleDeleteDraft(index)} disabled={!canReviewDrafts}>{t("task.delete")}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {task.drafts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-sm text-[var(--muted)]">{t("task.noDrafts")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        )
      )}

      {activeTab === "feedback" && (
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            {feedbackActivities.map((activity, index) => {
              const isAgent = activity.actor === "agent";
              return (
                <div
                  key={`${activity.title}-${index}`}
                  className={`rounded-lg border border-[var(--border)] p-3 ${isAgent ? "border-l-[3px] border-l-[var(--brand-primary)]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">
                      {isAgent ? <IconSparkles size={12} stroke={1.75} /> : <IconUser size={12} stroke={1.75} />}
                      {isAgent ? "Zyra" : t("you")}
                    </span>
                    <span className="text-[11px] text-[var(--muted-soft)]">
                      {activity.createdAt ? formatDateTime(activity.createdAt, t.locale) : ""}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{activity.detail || activity.title}</p>
                </div>
              );
            })}
            {feedbackActivities.length === 0 && <p className="text-sm text-[var(--muted)]">{t("task.noFeedback")}</p>}
          </Card>

          <Card className="p-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">{t("task.sendFeedbackTitle")}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("task.sendFeedbackHint")}</p>
            </div>
            <Field>
              <FieldLabel>{t("task.feedbackLabel")}</FieldLabel>
              <Textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={5} placeholder={t("task.feedbackPlaceholder")} />
            </Field>
            <Field>
              <FieldLabel>{t("task.refsLabel")}</FieldLabel>
              <Textarea value={referenceNote} onChange={(event) => setReferenceNote(event.target.value)} rows={3} placeholder={t("task.refsPlaceholder")} />
            </Field>
            {jiraTickets.length > 0 && (
              <Field>
                <FieldLabel>{t("task.attachJira")}</FieldLabel>
                <Select
                  value=""
                  onChange={(event) => {
                    const key = event.target.value;
                    if (key && !selectedJiraKeys.includes(key)) setSelectedJiraKeys((prev) => [...prev, key]);
                  }}
                >
                  <option value="">{t("task.selectTicket")}</option>
                  {jiraTickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.jiraIssueKey}>{ticket.jiraIssueKey} - {ticket.summary}</option>
                  ))}
                </Select>
                {selectedJiraKeys.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedJiraKeys.map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setSelectedJiraKeys((prev) => prev.filter((item) => item !== key))}
                        className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]"
                      >
                        {key} x
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            )}
            {linearTickets.length > 0 && (
              <Field>
                <FieldLabel>{t("task.attachLinear")}</FieldLabel>
                <Select
                  value=""
                  onChange={(event) => {
                    const key = event.target.value;
                    if (key && !selectedLinearKeys.includes(key)) setSelectedLinearKeys((prev) => [...prev, key]);
                  }}
                >
                  <option value="">{t("task.selectTicket")}</option>
                  {linearTickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.linearIssueKey}>{ticket.linearIssueKey} - {ticket.summary}</option>
                  ))}
                </Select>
                {selectedLinearKeys.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedLinearKeys.map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setSelectedLinearKeys((prev) => prev.filter((item) => item !== key))}
                        className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]"
                      >
                        {key} x
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            )}
            {notionPages.length > 0 && (
              <Field>
                <FieldLabel>{t("task.attachNotion")}</FieldLabel>
                <Select
                  value=""
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id && !selectedNotionIds.includes(id)) setSelectedNotionIds((prev) => [...prev, id]);
                  }}
                >
                  <option value="">{t("task.selectTicket")}</option>
                  {notionPages.map((page) => (
                    <option key={page.id} value={page.notionPageId}>{page.notionPageKey} - {page.summary}</option>
                  ))}
                </Select>
                {selectedNotionIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedNotionIds.map((id) => (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setSelectedNotionIds((prev) => prev.filter((item) => item !== id))}
                        className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]"
                      >
                        {notionPageKey(id)} x
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            )}
            {!canGiveFeedback && (
              <p className="text-xs text-[var(--muted)]">
                {isManagedDocumentProposal ? "Document proposals are reviewed through their dedicated panel above. Use its Apply or Reject action on the exact proposal instead of case-generation feedback."
                  : isRequirementBundle ? "Requirement bundles are immutable. Use their exact review, Reject or Withdraw actions above."
                  : taskStatusNow === "in_progress" || taskStatusNow === "todo"
                  ? t("task.feedbackLocked")
                  : t("task.feedbackClosed")}
              </p>
            )}
            <Button variant="secondary" onClick={handleFeedback} disabled={working || !canGiveFeedback || !feedback.trim()}>{working ? t("task.sending") : t("task.sendFeedback")}</Button>
          </Card>
        </div>
      )}

      {activeTab === "activities" && (
        <Card className="p-4 space-y-3">
          {sortActivitiesNewestFirst(task.activities).map(({ activity, index }) => (
            <div key={`${activity.title}-${index}`} data-testid="task-activity-entry" className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">{activity.actor} - {(activity.stage || "").replaceAll("_", " ")}</span>
                <span className="text-[11px] text-[var(--muted-soft)]">{activity.createdAt ? formatDateTime(activity.createdAt, t.locale) : ""}</span>
              </div>
              <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">{activity.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{activity.detail}</p>
            </div>
          ))}
          {task.activities.length === 0 && <p className="text-sm text-[var(--muted)]">{t("task.noActivity")}</p>}
        </Card>
      )}

      {activeTab === "sources" && (
        <Card className="p-4 space-y-3">
          {task.sources.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("task.noSources")}</p>
          ) : (
            task.sources.map((source, index) => (
              <div key={`${source.type}-${index}`} className="rounded-lg border border-[var(--border)] p-3">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted-soft)]">{source.type.replaceAll("_", " ")}</span>
                <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">{source.title}</h3>
                {isMarkdownSource(source.type) ? (
                  <div
                    className="zyra-prose zyra-prose-compact break-words mt-1 text-sm text-[var(--muted)]"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(source.detail) }}
                  />
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{source.detail}</p>
                )}
              </div>
            ))
          )}
        </Card>
      )}

      <Modal open={savingOpen} onClose={closeSaveModal} title={t("task.saveModal.title")}>
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">{t("task.saveModal.body", { n: (savingDraftIndexes || selectedDrafts).length })}</p>
          {saveError && <p role="alert" className="rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error-foreground)]">{saveError}</p>}
          {saveNeedsReload && <p className="text-sm text-[var(--muted)]">Close this dialog and reload the task to check what was saved before reviewing again.</p>}
          {savingProposal?.proposalSnapshot && <details open={snapshotOpen} onToggle={(event) => setSnapshotOpen(event.currentTarget.open)} className="rounded-lg border border-[var(--border)] p-3 text-sm">
            <summary>Inspect the saved proposal and target content</summary>
            {snapshotOpen && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(savingProposal.proposalSnapshot, null, 2)}</pre>}
          </details>}
          <Field>
            <FieldLabel>{t("task.suiteTarget")}</FieldLabel>
            <Select value={saveMode} disabled={working} onChange={(event) => setSaveMode(event.target.value as SaveMode)}>
              {/* Disabled so it can't be re-picked once a real target is chosen. */}
              <option value="" disabled>{t("task.selectSuite")}</option>
              <option value="none">{t("task.noSuite")}</option>
              <option value="existing">{t("task.existingSuite")}</option>
              <option value="new">{t("task.createSuite")}</option>
            </Select>
          </Field>
          {saveMode === "existing" && (
            <Field>
              <FieldLabel>{t("task.selectExistingSuite")}</FieldLabel>
              <Select value={targetSuiteId} disabled={working} onChange={(event) => setTargetSuiteId(event.target.value)}>
                <option value="" disabled>{t("task.selectASuite")}</option>
                {suites.map((suite) => <option key={suite.id} value={suite.id}>{suite.name}</option>)}
              </Select>
              {suites.length === 0 && <FieldHint>{t("task.noSuitesHint")}</FieldHint>}
            </Field>
          )}
          {saveMode === "new" && (
            <Field>
              <FieldLabel>{t("task.newSuiteName")}</FieldLabel>
              <Input value={newSuiteName} disabled={working} onChange={(event) => setNewSuiteName(event.target.value)} placeholder={t("task.newSuitePlaceholder")} maxLength={SUITE_NAME_MAX_LENGTH} />
              {/* Shown once something is typed, so a freshly opened field isn't already in error. */}
              {newSuiteName && newSuiteNameError && <FieldError>{newSuiteNameError}</FieldError>}
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeSaveModal} disabled={working}>{t("cancel")}</Button>
            <Button onClick={handleSave} disabled={!canSave}>{working ? t("savingDots") : t("save")}</Button>
          </div>
        </div>
      </Modal>
    </StandardPageLayout>
    </ZyraLanguageContext.Provider>
  );
}
