"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useParams } from "@/lib/routeParams";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconBook, IconPlus, IconRefresh, IconShieldCheck } from "@tabler/icons-react";
import {
  ApiError,
  approveSkillVersion,
  createSkillCandidate,
  deactivateSkillAssignment,
  getEffectiveSkills,
  getKnowledgeDocumentVersion,
  listSkillAssignments,
  listSkills,
  submitSkillVersion,
  type KnowledgeDocumentVersionDetail,
  type SkillAssignmentRecord,
  type SkillModule,
  type SkillRecord,
  type SkillResolutionRecord,
  type SkillVersionRecord
} from "@/lib/api";
import { Button, Card, Field, FieldError, FieldLabel, Input, Select, Textarea } from "@/components/ui";
import { VersionContent, versionText } from "@/components/knowledge-base/GovernedVersionContent";
import { SkillAssignmentForm, SKILL_MODULES, SKILL_WORK_PACKAGE_A_TARGETS, type SkillAssignmentSelection } from "@/components/skills/SkillAssignmentForm";
import { PageHeader, StandardPageLayout, Breadcrumbs } from "@/components/workflows";
import { useAppData } from "@/components/app/AppDataProvider";
import { useProjectData } from "@/components/project/ProjectDataProvider";

const MODULES = SKILL_MODULES;
const WORK_PACKAGE_A_TARGETS = SKILL_WORK_PACKAGE_A_TARGETS;

type DiffLine = { type: "same" | "add" | "remove"; text: string };
type Comparison = { left: KnowledgeDocumentVersionDetail; right: KnowledgeDocumentVersionDetail; label: string; lines: DiffLine[] | null };
type ReviewSelection = { projectId: string; skillId: string; versionId: string; mode: "inspect" | "review" };
type ContextRow = { key: string; module: string; subtype: string; operation: string; assignment?: SkillAssignmentRecord };

function normalizeRole(role: string): "owner" | "manager" | "qa_engineer" {
  const value = (role ?? "").trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  if (value === "owner") return "owner";
  if (["manager", "admin", "test_manager"].includes(value)) return "manager";
  return "qa_engineer";
}
function targetLabel(target: { module: string; subtype: string; operation: string }) {
  return `${target.module} / ${target.subtype} / ${target.operation}`;
}
function contextKey(target: { module: string; subtype: string; operation: string }) {
  return `${target.module}::${target.subtype}::${target.operation}`;
}
function shortDigest(digest: string | null | undefined) {
  return digest ? `${digest.slice(0, 12)}…` : "—";
}
function savedVersionOrder(a: SkillVersionRecord, b: SkillVersionRecord) {
  const date = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return (Number.isFinite(date) ? date : 0) || a.versionNumber - b.versionNumber || a.id.localeCompare(b.id);
}

/** One logical initial submission per actor and saved draft, including after a reload.
 * This is an idempotency key, never authority: the native owner rechecks the actor and revision.
 */
async function draftSubmissionKey(actorId: string, projectId: string, documentId: string, revision: string) {
  const input = JSON.stringify(["tesbo-skill-initial-submission/v1", actorId, projectId, documentId, revision]);
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function versionLabel(version: { versionNumber: number; kind?: string; snapshotKind?: string } | null | undefined) {
  return version ? `v${version.versionNumber} (${version.kind || version.snapshotKind || "version"})` : "no version";
}

/** Bound both LCS work and output nodes; larger inputs retain complete side-by-side text. */
function diffLines(before: string, after: string): DiffLine[] | null {
  if (before.length + after.length > 100_000) return null;
  const a = before.split("\n"), b = after.split("\n");
  if (a.length + b.length > 2_000 || (a.length + 1) * (b.length + 1) > 250_000) return null;
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const lines: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { lines.push({ type: "same", text: a[i] }); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { lines.push({ type: "remove", text: a[i] }); i++; }
    else { lines.push({ type: "add", text: b[j] }); j++; }
  }
  while (i < a.length) lines.push({ type: "remove", text: a[i++] });
  while (j < b.length) lines.push({ type: "add", text: b[j++] });
  return lines;
}

export default function SkillsSettingsPage() {
  const params = useParams();
  const router = useRouter();
  // RouteParamsProvider may first expose an uppercase UUID, then its canonical spelling.
  // Both identify the same project and must retain one draft/request/recovery scope.
  const projectId = (params.id as string).toLowerCase();
  const { currentUser } = useAppData();
  const { project, projectMembers } = useProjectData();

  const currentUserId = currentUser?.userId || null;
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [assignments, setAssignments] = useState<SkillAssignmentRecord[]>([]);
  const [resolution, setResolution] = useState<Record<string, SkillResolutionRecord>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const tab = useSearchParams().get("tab") === "assignments" ? "assignments" : "library";
  function setTab(next: "library" | "assignments") {
    const url = new URL(window.location.href);
    if (next === "assignments") url.searchParams.set("tab", next);
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  }
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [subtypeFilter, setSubtypeFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [historySort, setHistorySort] = useState<"newest" | "oldest">("newest");
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [assignmentSelection, setAssignmentSelection] = useState<SkillAssignmentSelection | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newModule, setNewModule] = useState<SkillModule>("requirements");
  const [newSubtype, setNewSubtype] = useState("functional");
  const [newInstructions, setNewInstructions] = useState("");
  // Stable across an uncertain create response; cleared only after creation is acknowledged or the
  // candidate content changes, so a retry reads the same native candidate instead of creating one.
  const creationRequestKey = useRef<string | null>(null);

  const [candidateStorageScope, setCandidateStorageScope] = useState<string | null>(null);

  const [reviewSelection, setReviewSelection] = useState<ReviewSelection | null>(null);
  const [reviewVersion, setReviewVersion] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareLeftId, setCompareLeftId] = useState("");
  const [compareRightId, setCompareRightId] = useState("");
  const [compareTarget, setCompareTarget] = useState<"previous" | "latestApproved" | "active">("previous");
  const [compareContext, setCompareContext] = useState("");
  const [openedVersion, setOpenedVersion] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [openedError, setOpenedError] = useState<string | null>(null);
  const [superseded, setSuperseded] = useState<{ currentVersionId: string; currentVersionNumber?: number } | null>(null);
  const activeProject = useRef<string | null>(projectId);
  const activeReview = useRef<ReviewSelection | null>(null);
  const libraryRequest = useRef(0);
  const comparisonRequest = useRef(0);
  const openedRequest = useRef(0);
  const mutationRequest = useRef(0);
  const reviewOrigin = useRef<HTMLElement | null>(null);
  const reviewPosition = useRef<{ main: HTMLElement | null; top: number; left: number; windowTop: number; windowLeft: number } | null>(null);
  const assignmentSelectionSequence = useRef(0);

  const clearComparison = useCallback(() => {
    comparisonRequest.current++;
    setComparison(null);
    setCompareLoading(false);
    setCompareError(null);
  }, []);

  useEffect(() => {
    activeProject.current = projectId;
    setSkills([]);
    setAssignments([]);
    setResolution({});
    setReviewSelection(null);
    setReviewVersion(null);
    setAssignmentSelection(null);
    setQuery(""); setModuleFilter(""); setSubtypeFilter(""); setAssignmentFilter(""); setReviewFilter("");
    setCandidateOpen(false);
    setMessage(null);
    setError(null);
    setLoadError(null);
    setLoading(true);
    setBusy(false);
    mutationRequest.current++;
    return () => {
      activeProject.current = null;
      activeReview.current = null;
      libraryRequest.current++;
      comparisonRequest.current++;
      openedRequest.current++;
      mutationRequest.current++;
    };
  }, [projectId, currentUserId]);

  const load = useCallback(async () => {
    if (activeProject.current !== projectId) return;
    const request = ++libraryRequest.current;
    const isCurrent = () => activeProject.current === projectId && libraryRequest.current === request;
    setLoading(true);
    try {
      const [library, ledger, resolved] = await Promise.all([
        listSkills(projectId), listSkillAssignments(projectId),
        Promise.all(WORK_PACKAGE_A_TARGETS.map(async (target) => [targetLabel(target), await getEffectiveSkills(projectId, target)] as const))
      ]);
      if (!isCurrent()) return;
      clearComparison();
      setSkills(library.skills);
      setAssignments(ledger.list);
      setResolution(Object.fromEntries(resolved));
      setLoadError(null);
    } catch (err) {
      if (isCurrent()) {
        clearComparison();
        setLoadError(err instanceof Error ? err.message : "Skills could not be loaded.");
        setResolution({});
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [projectId, clearComparison]);

  useEffect(() => {
    if (!currentUser) { router.replace("/login"); return; }
    load().catch(() => undefined);
  }, [currentUser, load, router]);

  const currentUserRole = currentUserId
    ? normalizeRole(projectMembers.find((member) => member.userId === currentUserId)?.role ?? "qa_engineer")
    : "qa_engineer";
  const canManage = currentUserRole === "owner" || currentUserRole === "manager";
  const filteredSkills = useMemo(() => skills.filter((skill) => {
    const search = query.trim().toLocaleLowerCase();
    if (search && ![skill.title, skill.skillKey, skill.contentText, JSON.stringify(skill.contentJson), skill.contentHtml].filter(Boolean).join("\n").toLocaleLowerCase().includes(search)) return false;
    if (moduleFilter && skill.module !== moduleFilter) return false;
    if (subtypeFilter && skill.subtype !== subtypeFilter) return false;
    const assigned = skill.assignments.some((assignment) => assignment.status === "active");
    if (assignmentFilter === "assigned" && !assigned || assignmentFilter === "unassigned" && assigned) return false;
    const reviewed = skill.versions.some((version) => version.kind === "approved" && version.sourceVersionId === skill.submittedVersionId);
    if (reviewFilter === "awaiting_review" && (!skill.submittedVersionId || reviewed)) return false;
    if (reviewFilter === "approved" && !skill.approvedVersionId) return false;
    if (reviewFilter === "draft" && skill.submittedVersionId) return false;
    return true;
  }), [skills, query, moduleFilter, subtypeFilter, assignmentFilter, reviewFilter]);
  const subtypes = useMemo(() => [...new Set(skills.filter((skill) => !moduleFilter || skill.module === moduleFilter).map((skill) => skill.subtype).filter((subtype): subtype is string => !!subtype))].sort(), [skills, moduleFilter]);

  useEffect(() => {
    if (!currentUserId) return;
    const scope = `tesbo-skill-candidate/v1/${currentUserId}/${projectId}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(scope) || "null");
      setNewTitle(saved?.title || ""); setNewKey(saved?.key || ""); setNewInstructions(saved?.instructions || "");
      setNewModule(MODULES.includes(saved?.module) ? saved.module : "requirements"); setNewSubtype(saved?.subtype ?? "functional");
      creationRequestKey.current = typeof saved?.requestKey === "string" ? saved.requestKey : null;
    } catch { setError("The saved candidate form could not be recovered in this browser."); }
    setCandidateStorageScope(scope);
  }, [currentUserId, projectId]);

  useEffect(() => {
    if (!currentUserId || candidateStorageScope !== `tesbo-skill-candidate/v1/${currentUserId}/${projectId}`) return;
    try { sessionStorage.setItem(candidateStorageScope, JSON.stringify({ title: newTitle, key: newKey, module: newModule, subtype: newSubtype, instructions: newInstructions, requestKey: creationRequestKey.current })); }
    catch { /* Keep entered work in memory; creation checks durable request retention before sending. */ }
  }, [currentUserId, projectId, candidateStorageScope, newTitle, newKey, newModule, newSubtype, newInstructions]);

  useEffect(() => {
    if (candidateOpen) document.getElementById("skill-title")?.focus();
  }, [candidateOpen]);

  const reviewSkill = reviewSelection?.projectId === projectId
    ? skills.find((skill) => skill.id === reviewSelection.skillId) || null : null;
  const governedVersions = useMemo(
    () => (reviewSkill?.versions || []).filter((version) => version.kind !== "autosave"),
    [reviewSkill]
  );
  const candidateVersion = governedVersions.find((version) => version.id === reviewSelection?.versionId) || reviewVersion;
  const previousVersion = useMemo(() => {
    if (!candidateVersion) return null;
    return governedVersions
      .filter((version) => version.versionNumber < candidateVersion.versionNumber)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0] || null;
  }, [governedVersions, candidateVersion]);
  const latestApproved = useMemo(
    () => governedVersions.find((version) => version.kind === "approved") || null,
    [governedVersions]
  );
  const activeContexts = useMemo<ContextRow[]>(() => {
    if (!reviewSkill) return [];
    const seen = new Set<string>();
    const rows: ContextRow[] = [];
    for (const assignment of reviewSkill.assignments.filter((item) => item.status === "active")) {
      const key = contextKey(assignment);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ key, module: assignment.module, subtype: assignment.subtype, operation: assignment.operation, assignment });
    }
    return rows;
  }, [reviewSkill]);
  const selectedContext = activeContexts.find((context) => context.key === compareContext) || activeContexts[0] || null;
  const reviewMeta = reviewSkill?.versions.find((version) => version.id === reviewVersion?.id) || null;
  const reviewApproval = governedVersions.find((version) => version.kind === "approved" && version.sourceVersionId === reviewVersion?.id);
  const currentSubmission = governedVersions.find((version) => version.id === reviewSkill?.submittedVersionId);
  const knownNewerSubmission = reviewVersion?.snapshotKind === "submitted" && currentSubmission && currentSubmission.versionNumber > reviewVersion.versionNumber
    ? { currentVersionId: currentSubmission.id, currentVersionNumber: currentSubmission.versionNumber } : null;
  const reviewSuperseded = superseded || knownNewerSubmission;

  async function run(action: (isCurrent: () => boolean) => Promise<void>, reconcileOnFailure = false) {
    if (busy) return;
    const request = ++mutationRequest.current;
    const isCurrent = () => activeProject.current === projectId && mutationRequest.current === request;
    setBusy(true);
    setError(null);
    setMessage(null);
    try { await action(isCurrent); if (isCurrent()) await load(); }
    catch (err) {
      if (isCurrent()) {
        setError(err instanceof Error ? err.message : "The Skills action failed.");
        if (reconcileOnFailure) await load();
      }
    }
    finally { if (isCurrent()) setBusy(false); }
  }

  function closeReview() {
    if (busy) return;
    activeReview.current = null;
    openedRequest.current++;
    clearComparison();
    setReviewSelection(null);
    setReviewVersion(null);
    setReviewLoading(false);
    setOpenedVersion(null);
    setOpenedError(null);
    const origin = reviewOrigin.current;
    const position = reviewPosition.current;
    requestAnimationFrame(() => {
      if (position) {
        if (position.main?.isConnected) position.main.scrollTo({ top: position.top, left: position.left });
        window.scrollTo({ top: position.windowTop, left: position.windowLeft });
      }
      if (origin?.isConnected && !origin.closest("[hidden]")) origin.focus({ preventScroll: true });
      else document.getElementById(`skills-${tab}-tab`)?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    if (!reviewSelection) return;
    document.getElementById("skills-close-review")?.focus({ preventScroll: true });
  }, [reviewSelection]);

  useEffect(() => {
    if (!reviewSelection) return;
    function escape(event: KeyboardEvent) {
      const activeDialog = document.activeElement?.closest('[role="dialog"]');
      if (event.key !== "Escape" || busy || (activeDialog && activeDialog.getAttribute("data-testid") !== "skill-review-panel")) return;
      event.preventDefault();
      closeReview();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
    // The exact selection controls focus entry; data/compare responses never steal it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewSelection, busy, tab]);

  async function loadComparison(skillId: string, leftId: string, rightId: string, label = "Selected versions") {
    const selection = activeReview.current;
    if (!selection || selection.projectId !== projectId || selection.skillId !== skillId) return;
    const request = ++comparisonRequest.current;
    const isCurrent = () => activeProject.current === projectId && activeReview.current === selection && comparisonRequest.current === request;
    setCompareLoading(true);
    setCompareError(null);
    setComparison(null);
    try {
      const [left, right] = await Promise.all([
        getKnowledgeDocumentVersion(projectId, skillId, leftId),
        getKnowledgeDocumentVersion(projectId, skillId, rightId)
      ]);
      if (!isCurrent()) return;
      setComparison({ left, right, label, lines: diffLines(versionText(left), versionText(right)) });
    } catch (err) {
      if (isCurrent()) setCompareError(err instanceof Error ? err.message : "The versions could not be compared.");
    } finally { if (isCurrent()) setCompareLoading(false); }
  }

  async function openReview(skill: SkillRecord, versionId = skill.submittedVersionId, mode: "inspect" | "review" = "review") {
    if (busy || !versionId || activeProject.current !== projectId) return;
    if (document.activeElement instanceof HTMLElement && !document.activeElement.closest('[data-testid="skill-review-panel"]')) {
      reviewOrigin.current = document.activeElement;
      const main = document.querySelector("main");
      reviewPosition.current = { main, top: main?.scrollTop || 0, left: main?.scrollLeft || 0, windowTop: window.scrollY, windowLeft: window.scrollX };
    }
    const selection = { projectId, skillId: skill.id, versionId, mode };
    activeReview.current = selection;
    const isCurrent = () => activeProject.current === projectId && activeReview.current === selection;
    openedRequest.current++;
    clearComparison();
    const initialComparisonRequest = comparisonRequest.current;
    const contexts = new Map<string, string>();
    for (const assignment of skill.assignments.filter((item) => item.status === "active")) {
      contexts.set(contextKey(assignment), contextKey(assignment));
    }
    setReviewSelection(selection);
    setReviewVersion(null);
    setReviewError(null);
    setReviewActionError(null);
    setReviewLoading(true);
    setComparison(null);
    setSuperseded(null);
    setOpenedVersion(null);
    setOpenedError(null);
    setCompareError(null);
    const governed = skill.versions.filter((version) => version.kind !== "autosave");
    const candidate = governed.find((entry) => entry.id === versionId);
    setCompareLeftId(governed.find((version) => version.versionNumber < (candidate?.versionNumber ?? 0))?.id || "");
    setCompareRightId(versionId);
    setCompareTarget("previous");
    setCompareContext([...contexts.values()][0] || "");
    try {
      const detail = await getKnowledgeDocumentVersion(projectId, skill.id, versionId);
      if (!isCurrent()) return;
      setReviewVersion(detail);
      const previous = governed
        .filter((version) => version.versionNumber < detail.versionNumber)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];
      if (previous && comparisonRequest.current === initialComparisonRequest) {
        setCompareLeftId(previous.id);
        await loadComparison(skill.id, previous.id, versionId, "Previous saved version");
      }
    } catch (err) {
      if (isCurrent()) setReviewError(err instanceof Error ? err.message : "The submitted content could not be loaded.");
    } finally { if (isCurrent()) setReviewLoading(false); }
  }

  async function openVersion(skillId: string, versionId: string) {
    const selection = activeReview.current;
    if (!selection || selection.projectId !== projectId || selection.skillId !== skillId) return;
    const request = ++openedRequest.current;
    const isCurrent = () => activeProject.current === projectId && activeReview.current === selection && openedRequest.current === request;
    setOpenedError(null);
    setOpenedVersion(null);
    try {
      const detail = await getKnowledgeDocumentVersion(projectId, skillId, versionId);
      if (isCurrent()) setOpenedVersion(detail);
    }
    catch (err) { if (isCurrent()) setOpenedError(err instanceof Error ? err.message : "The version could not be loaded."); }
  }

  async function compareTargetVersion() {
    if (!reviewSkill || !candidateVersion) return;
    let target: SkillVersionRecord | null = null;
    if (compareTarget === "previous") target = previousVersion;
    else if (compareTarget === "latestApproved") target = latestApproved;
    else target = selectedContext?.assignment
      ? governedVersions.find((version) => version.id === selectedContext.assignment?.skillVersionId) || null
      : null;
    if (!target) {
      clearComparison();
      setCompareError(compareTarget === "active"
        ? "No version is assigned for this context."
        : "There is no earlier or approved version to compare.");
      return;
    }
    setCompareLeftId(target.id);
    setCompareRightId(candidateVersion.id);
    const label = compareTarget === "active" && selectedContext
      ? `Active version for ${targetLabel(selectedContext)}`
      : compareTarget === "latestApproved" ? "Latest approved version" : "Previous saved version";
    await loadComparison(reviewSkill.id, target.id, candidateVersion.id, label);
  }

  async function approveReviewed() {
    const selection = activeReview.current;
    if (!canManage || selection?.mode !== "review" || reviewVersion?.snapshotKind !== "submitted" || busy || loading || loadError || reviewApproval || reviewSuperseded || !reviewSkill || !reviewVersion || !selection ||
      selection.projectId !== projectId || selection.skillId !== reviewSkill.id || selection.versionId !== reviewVersion.id) return;
    const request = ++mutationRequest.current;
    const ownsMutation = () => activeProject.current === projectId && mutationRequest.current === request;
    const isCurrent = () => ownsMutation() && activeReview.current === selection;
    setBusy(true);
    setError(null);
    setReviewActionError(null);
    setMessage(null);
    try {
      await approveSkillVersion(projectId, reviewSkill.id, reviewVersion.id);
      if (isCurrent()) {
        setMessage(`Approved ${reviewVersion.title} version ${reviewVersion.versionNumber}. Active assignments were not changed; assignment remains a separate human action.`);
        setSuperseded(null);
      }
      if (ownsMutation()) await load();
    } catch (err) {
      if (isCurrent()) {
        if (err instanceof ApiError && err.code === "SKILL_VERSION_SUPERSEDED") {
          setSuperseded({ currentVersionId: String(err.body?.currentVersionId || ""), currentVersionNumber: err.body?.currentVersionNumber });
        }
        setReviewActionError(err instanceof Error ? err.message : "The approval outcome could not be confirmed. Refresh to check before trying again.");
      }
      if (ownsMutation()) await load();
    } finally { if (ownsMutation()) setBusy(false); }
  }

  function createAndSubmit() {
    if (!currentUserId) return;
    void run(async (isCurrent) => {
      const requestKey = creationRequestKey.current ?? crypto.randomUUID();
      creationRequestKey.current = requestKey;
      // Retain the original key and unchanged form before sending a potentially uncertain write.
      if (!candidateStorageScope) throw new Error("The candidate form is still loading. Try again when it is ready.");
      try { sessionStorage.setItem(candidateStorageScope, JSON.stringify({ title: newTitle, key: newKey, module: newModule, subtype: newSubtype, instructions: newInstructions, requestKey })); }
      catch { throw new Error("This browser cannot retain the candidate request. No candidate was created; enable session storage and try again."); }
      const created = await createSkillCandidate(projectId, {
        title: newTitle.trim(), module: newModule, subtype: newSubtype.trim() || "*",
        ...(newKey.trim() ? { skillKey: newKey.trim() } : {}),
        instructions: newInstructions.trim(), requestKey
      });
      if (!isCurrent()) return;
      creationRequestKey.current = null;
      // Creation has committed. Never present the old form as another create attempt when the
      // separate submission fails; the native library owns recovery of this exact draft.
      setNewTitle(""); setNewKey(""); setNewInstructions("");
      if (created.replayed) setMessage("Recovered the candidate saved by the earlier creation request.");
      await submitSavedDraft(created, currentUserId, isCurrent);
    }, true);
  }

  function canSubmitDraft(skill: SkillRecord) {
    return !!currentUserId && !!skill.skillKey && !!skill.module && !skill.submittedVersionId
      && skill.state === "draft" && skill.status === "draft"
      && !skill.isReadOnly && (canManage || skill.createdBy === currentUserId);
  }

  async function submitSavedDraft(skill: Pick<SkillRecord, "id" | "title" | "editRevision">, actorId: string, isCurrent: () => boolean) {
    try {
      const submissionKey = await draftSubmissionKey(actorId, projectId, skill.id, skill.editRevision);
      if (!isCurrent()) return;
      const version = await submitSkillVersion(projectId, skill.id, skill.editRevision, submissionKey);
      if (isCurrent()) setMessage(`Skill candidate submitted as version ${version.versionNumber}. It is inert until a human approves it.`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "The submission outcome could not be confirmed.";
      throw new Error(`${skill.title} is saved. ${detail} Check its current status in the Skills library before trying submission again.`);
    }
  }

  function resumeSubmission(skill: SkillRecord) {
    if (loading || loadError || !currentUserId || !canSubmitDraft(skill)) return;
    const actorId = currentUserId;
    void run((isCurrent) => submitSavedDraft(skill, actorId, isCurrent), true);
  }

  function selectAssignment(skillId: string, versionId: string) {
    if (!canManage || busy) return;
    closeReview();
    setTab("assignments");
    setAssignmentSelection({ skillId, versionId, token: ++assignmentSelectionSequence.current });
    requestAnimationFrame(() => document.getElementById("skill-assignment-version")?.focus({ preventScroll: true }));
  }

  function revoke(assignment: SkillAssignmentRecord) {
    if (!canManage || loading || loadError) return;
    void run(async (isCurrent) => {
      await deactivateSkillAssignment(projectId, assignment.id);
      if (isCurrent()) setMessage(`Revoked the ${assignment.module}/${assignment.subtype}/${assignment.operation} assignment. Prior versions and history remain.`);
    });
  }

  const header = (
    <PageHeader
      title={<><IconBook size={26} stroke={1.75} /> Skills &amp; Authoring Governance</>}
      subtitle="Inspect the exact submitted content, compare versions and assignments, then approve as a separate human decision."
      breadcrumb={<Breadcrumbs items={[
        { label: "Projects", href: "/projects" },
        { label: String(project.name || "Project"), href: `/projects/${projectId}/dashboard` },
        { label: "Settings", href: `/projects/${projectId}/settings` },
        { label: "Skills" }
      ]} />}
    />
  );

  return (
    <StandardPageLayout header={header}>
      <div className={reviewSkill ? "space-y-4 md:pr-[min(50vw,800px)]" : "space-y-4"} data-testid="skills-settings">
        {(message || error || loadError) && <Card className="p-3"><p className={error || loadError ? "text-sm text-[var(--danger-foreground)]" : "text-sm text-[var(--success-foreground)]"} role="status">{error || loadError || message}</p></Card>}

        <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Skills views" className="flex flex-wrap items-center gap-2" onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "library" : event.key === "End" ? "assignments" : tab === "library" ? "assignments" : "library";
          setTab(next); document.getElementById(`skills-${next}-tab`)?.focus();
        }}>
          <Button role="tab" id="skills-library-tab" aria-controls="skills-library-panel" aria-selected={tab === "library"} tabIndex={tab === "library" ? 0 : -1} variant={tab === "library" ? "primary" : "secondary"} onClick={() => setTab("library")}>Library{!loading && !loadError ? ` (${skills.length})` : ""}</Button>
          <Button role="tab" id="skills-assignments-tab" aria-controls="skills-assignments-panel" aria-selected={tab === "assignments"} tabIndex={tab === "assignments" ? 0 : -1} variant={tab === "assignments" ? "primary" : "secondary"} onClick={() => setTab("assignments")}>Assignments{!loading && !loadError ? ` (${assignments.filter((entry) => entry.status === "active").length})` : ""}</Button>
        </div>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(async () => undefined)} data-testid="skills-refresh"><IconRefresh size={15} /> Refresh</Button>
        </div>

        <section role="tabpanel" id="skills-library-panel" aria-labelledby="skills-library-tab" hidden={tab !== "library"} className="space-y-4">
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-base font-semibold flex items-center gap-2"><IconShieldCheck size={18} /> Skills library</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Browse saved content across this project. Review a submission, approve it and assign its approved snapshot as separate decisions.</p></div>
            <Button size="sm" variant="secondary" onClick={() => setCandidateOpen(!candidateOpen)} data-testid={candidateOpen ? "skill-candidate-close" : "skill-candidate-open"}><IconPlus size={15} /> {candidateOpen ? "Close candidate form" : "New skill candidate"}</Button>
          </div>
          <div className={reviewSkill ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-5"}>
            <Field><FieldLabel htmlFor="skill-library-search">Search name, key or instructions</FieldLabel><Input id="skill-library-search" data-testid="skill-library-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a skill…" /></Field>
            <Field><FieldLabel htmlFor="skill-library-module-filter">Module</FieldLabel><Select id="skill-library-module-filter" data-testid="skill-library-module-filter" value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setSubtypeFilter(""); }}><option value="">All modules</option>{MODULES.map((module) => <option key={module} value={module}>{module}</option>)}</Select></Field>
            <Field><FieldLabel htmlFor="skill-library-subtype-filter">Subtype</FieldLabel><Select id="skill-library-subtype-filter" data-testid="skill-library-subtype-filter" value={subtypeFilter} onChange={(event) => setSubtypeFilter(event.target.value)}><option value="">All subtypes</option>{subtypes.map((subtype) => <option key={subtype} value={subtype}>{subtype}</option>)}</Select></Field>
            <Field><FieldLabel htmlFor="skill-library-assignment-filter">Assignment</FieldLabel><Select id="skill-library-assignment-filter" data-testid="skill-library-assignment-filter" value={assignmentFilter} onChange={(event) => setAssignmentFilter(event.target.value)}><option value="">Any assignment state</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option></Select></Field>
            <Field><FieldLabel htmlFor="skill-library-review-filter">Review state</FieldLabel><Select id="skill-library-review-filter" data-testid="skill-library-review-filter" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option value="">Any review state</option><option value="awaiting_review">Awaiting review</option><option value="approved">Has approved version</option><option value="draft">Unsubmitted draft</option></Select></Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted)]" role="status" data-testid="skill-library-result-count">{loading ? "Loading inventory…" : loadError ? "Inventory unavailable" : `${filteredSkills.length} result${filteredSkills.length === 1 ? "" : "s"} of ${skills.length} skills`}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" data-testid="skill-library-clear" onClick={() => { setQuery(""); setModuleFilter(""); setSubtypeFilter(""); setAssignmentFilter(""); setReviewFilter(""); }}>Clear filters</Button>
              <label className="text-xs" htmlFor="skill-history-sort">History order</label><Select id="skill-history-sort" data-testid="skill-history-sort" value={historySort} onChange={(event) => setHistorySort(event.target.value as typeof historySort)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></Select>
            </div>
          </div>
          {loading ? <p className="text-sm text-[var(--muted)]">Loading skills…</p> : loadError ? <p className="text-sm text-[var(--muted)]" data-testid="skill-library-unavailable">The current Skills library is unavailable. Refresh to check.</p> : skills.length === 0 ? <p className="text-sm text-[var(--muted)]">No skills in this project yet.</p> : filteredSkills.length === 0 ? <p className="text-sm text-[var(--muted)]" data-testid="skill-library-empty">No skills match these filters. Clear filters to see the authorized inventory.</p> : (
            <div className="space-y-3">
              {filteredSkills.map((skill) => {
                const submitted = skill.versions.find((version) => version.id === skill.submittedVersionId);
                const approved = skill.versions.find((version) => version.id === skill.approvedVersionId);
                const submissionApproval = submitted && skill.versions.find((version) => version.kind === "approved" && version.sourceVersionId === submitted.id);
                const newest = [...skill.versions].sort(savedVersionOrder).at(-1);
                const submittedDate = (version: SkillVersionRecord) => skill.versions.find((entry) => entry.id === version.sourceVersionId && entry.kind === "submitted")?.createdAt || version.createdAt;
                const ordered = [...skill.versions].sort((a, b) => savedVersionOrder({ ...a, createdAt: submittedDate(a) }, { ...b, createdAt: submittedDate(b) }));
                return (
                  <div key={skill.id} className="rounded-lg border border-[var(--border)] p-3" data-testid={`skill-${skill.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {newest ? <button type="button" className="text-left font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2" data-testid={`skill-open-latest-${skill.id}`} disabled={busy} onClick={() => void openReview(skill, newest.id, "inspect")}>{skill.title}</button> : <p className="font-medium">{skill.title}</p>}
                        <p className="text-xs text-[var(--muted)]"><span className="font-mono">{skill.skillKey || "no key"}</span> · {skill.module || "?"}/{skill.subtype || "*"} · status {skill.status}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{approved ? `Approved v${approved.versionNumber}` : "No approved version"}{submitted ? ` · submitted v${submitted.versionNumber}${submissionApproval ? ` approved as v${submissionApproval.versionNumber}` : " awaiting review"}` : " · no submitted version"} · {skill.assignments.filter((entry) => entry.status === "active").length} active bindings</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {submitted && <Button size="sm" disabled={busy} onClick={() => void openReview(skill)} data-testid={`skill-review-open-${skill.id}`}>Review submitted v{submitted.versionNumber}</Button>}
                        {canSubmitDraft(skill) && <Button size="sm" variant="secondary" disabled={busy || loading || !!loadError} onClick={() => resumeSubmission(skill)} data-testid={`skill-submit-draft-${skill.id}`}>Submit draft</Button>}
                      </div>
                    </div>
                    <details className="mt-2 text-xs text-[var(--muted)]" data-testid={`skill-history-${skill.id}`}>
                      <summary className="cursor-pointer">Version history ({skill.versions.length})</summary>
                      <p className="mt-1">Ordered by recorded submission date when available, then version number. Each saved and approved snapshot keeps its own date and identity.</p>
                      <ul className="mt-2 space-y-2">
                        {(historySort === "oldest" ? ordered : [...ordered].reverse()).map((version) => {
                          const source = skill.versions.find((entry) => entry.id === version.sourceVersionId);
                          const active = skill.assignments.filter((entry) => entry.status === "active" && entry.skillVersionId === version.id);
                          return <li key={version.id} data-skill-history-version={version.id} className="rounded border border-[var(--border)] p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2"><span>v{version.versionNumber} · {version.kind} · {version.createdByName || version.createdBy || "unknown author"}{version.id === skill.approvedVersionId ? " · latest approved" : ""}</span><Button size="sm" variant="secondary" disabled={busy} data-testid={`skill-history-view-${version.id}`} onClick={() => void openReview(skill, version.id, "inspect")}>View</Button></div>
                            <p>Saved: <time data-testid={`skill-saved-at-${version.id}`} dateTime={version.createdAt}>{version.createdAt ? new Date(version.createdAt).toLocaleString() : "Date not recorded"}</time>{version.kind === "approved" ? " · approval snapshot" : ""}</p>
                            {source && <p>Source submission v{source.versionNumber}: <time data-testid={`skill-submitted-at-${version.id}`} dateTime={source.createdAt}>{new Date(source.createdAt).toLocaleString()}</time></p>}
                            <p className="break-all">Version ID: <span className="font-mono">{version.id}</span> · digest {shortDigest(version.contentDigest)}</p>
                            {active.length > 0 && <p>Active usage: {active.map(targetLabel).join("; ")}</p>}
                          </li>;
                        })}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        {candidateOpen && candidateStorageScope === `tesbo-skill-candidate/v1/${currentUserId}/${projectId}` && <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2"><IconPlus size={18} /> New skill candidate</h2>
          <p className="text-sm text-[var(--muted)]">Creating and submitting a candidate does not approve or assign it.</p>
          <div className="grid gap-3 md:grid-cols-2" data-testid="skill-candidate-form">
            <Field><FieldLabel htmlFor="skill-title">Title</FieldLabel><Input id="skill-title" data-testid="skill-title" value={newTitle} onChange={(event) => { creationRequestKey.current = null; setNewTitle(event.target.value); }} maxLength={512} disabled={busy} /></Field>
            <Field><FieldLabel htmlFor="skill-key">Skill key (optional)</FieldLabel><Input id="skill-key" data-testid="skill-key" value={newKey} onChange={(event) => { creationRequestKey.current = null; setNewKey(event.target.value); }} placeholder="REQ-AUTHORING" maxLength={64} disabled={busy} /></Field>
            <Field><FieldLabel htmlFor="skill-module">Module</FieldLabel><Select id="skill-module" data-testid="skill-module" value={newModule} onChange={(event) => { creationRequestKey.current = null; setNewModule(event.target.value as SkillModule); }} disabled={busy}>{MODULES.map((module) => <option key={module} value={module}>{module}</option>)}</Select></Field>
            <Field><FieldLabel htmlFor="skill-subtype">Subtype</FieldLabel><Input id="skill-subtype" data-testid="skill-subtype" value={newSubtype} onChange={(event) => { creationRequestKey.current = null; setNewSubtype(event.target.value); }} placeholder="functional" maxLength={32} disabled={busy} /></Field>
            <div className="md:col-span-2"><Field><FieldLabel htmlFor="skill-instructions">Instructions</FieldLabel><Textarea id="skill-instructions" data-testid="skill-instructions" value={newInstructions} onChange={(event) => { creationRequestKey.current = null; setNewInstructions(event.target.value); }} rows={4} maxLength={20000} disabled={busy} /></Field></div>
          </div>
          {(!newTitle.trim() || !newInstructions.trim()) && <FieldError>A title and instructions are required.</FieldError>}
          <Button onClick={createAndSubmit} disabled={busy || !currentUserId || !newTitle.trim() || !newInstructions.trim()} data-testid="skill-create-submit">Create and submit candidate</Button>
        </Card>}
        </section>

        {reviewSelection?.projectId === projectId && reviewActionError && !reviewSkill && (
          <Card className="p-3">
            <p className="text-sm text-[var(--danger-foreground)]" role="alert" data-testid="skill-review-action-error">{reviewActionError}</p>
            {!reviewSkill && <Button variant="secondary" size="sm" disabled={busy} className="mt-2" onClick={closeReview}>Dismiss review message</Button>}
          </Card>
        )}

        {reviewSkill && (
          <Card role="dialog" aria-modal="false" aria-labelledby="skill-review-heading" className="fixed inset-y-4 right-0 z-40 w-full overflow-y-auto overscroll-contain rounded-l-xl border-l border-[var(--border)] bg-[var(--surface-overlay)] p-4 shadow-[var(--shadow-elevated)] space-y-4 md:w-[min(50vw,800px)]" data-testid="skill-review-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 id="skill-review-heading" className="text-base font-semibold break-words">{reviewSelection?.mode === "inspect" ? "Inspect saved" : "Review submitted"} {versionLabel(reviewVersion || candidateVersion)} — {reviewVersion?.title || reviewSkill.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{reviewSelection?.mode === "inspect" ? "Viewing and comparing this exact saved version is read-only." : "Approval applies to the exact submitted content loaded below."} Assignment is a separate decision; approval preserves existing version pins.</p>
              </div>
              <Button id="skills-close-review" variant="secondary" size="sm" disabled={busy} onClick={closeReview}>Close review</Button>
            </div>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(async () => undefined)} data-testid="skill-review-refresh"><IconRefresh size={15} /> Refresh current status</Button>
            {reviewActionError && <p className="text-sm text-[var(--danger-foreground)]" role="alert" data-testid="skill-review-action-error">{reviewActionError}</p>}
            {reviewLoading && <p className="text-sm text-[var(--muted)]" data-testid="skill-review-loading">Loading the exact saved content…</p>}
            {reviewError && (
              <div className="rounded-lg border border-[var(--danger-border)] p-3" data-testid="skill-review-error">
                <p className="text-sm text-[var(--danger-foreground)]">{reviewError}</p>
                <Button size="sm" disabled={busy} className="mt-2" onClick={() => void openReview(reviewSkill, reviewSelection?.versionId, reviewSelection?.mode)} data-testid="skill-review-retry">Retry</Button>
              </div>
            )}
            {reviewVersion && !reviewError && (
              <>
                <div className="grid gap-2 text-xs text-[var(--muted)] md:grid-cols-2" data-testid="skill-review-version">
                  <p>Version: <span className="font-mono">v{reviewVersion.versionNumber}</span> · status {reviewVersion.snapshotKind || "submitted"}</p>
                  <p>Author: {reviewMeta?.createdByName || reviewMeta?.createdBy || reviewVersion.createdBy || "unknown"}</p>
                  <p>Saved: <time dateTime={reviewVersion.createdAt}>{reviewVersion.createdAt ? new Date(reviewVersion.createdAt).toLocaleString() : "Date not recorded"}</time></p>
                  <p className="break-all">Project: <span className="font-mono">{projectId}</span></p>
                  <p className="break-all">Skill document: <span className="font-mono">{reviewSkill.id}</span></p>
                  <p className="break-all">Version ID: <span className="font-mono">{reviewVersion.id}</span></p>
                  <p className="break-all">Snapshot digest: <span className="font-mono">{String(reviewVersion.snapshotMetadata?.contentDigest || reviewMeta?.contentDigest || "Not recorded")}</span></p>
                  <p className="md:col-span-2">Rationale: {String(reviewVersion.snapshotMetadata?.reason || "No rationale was recorded for this version.")}</p>
                  {!!(reviewMeta?.sourceVersionId || reviewVersion.snapshotMetadata?.sourceVersionId) && <p className="break-all md:col-span-2">Source submission ID: <span className="font-mono">{String(reviewMeta?.sourceVersionId || reviewVersion.snapshotMetadata?.sourceVersionId)}</span>. This approval snapshot has its own identity and saved date.</p>}
                </div>
                <div className="max-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm" data-testid="skill-review-content"><VersionContent detail={reviewVersion} /></div>
                {!previousVersion && <p className="text-xs text-[var(--muted)]" data-testid="skill-review-first">This is the first saved version; there is no earlier version to compare.</p>}
                {reviewSuperseded && (
                  <div className="rounded-lg border border-[var(--warning-border)] p-3" data-testid="skill-review-superseded">
                    <p className="text-sm">A newer submission superseded the version on screen.</p>
                    <Button size="sm" disabled={busy} className="mt-2" onClick={() => void openReview(reviewSkill, reviewSuperseded.currentVersionId || reviewSkill.submittedVersionId, reviewSelection?.mode)} data-testid="skill-review-current">Open current submission</Button>
                  </div>
                )}
                {reviewApproval && <p className="text-sm text-[var(--success-foreground)] break-all" data-testid="skill-review-approved">Approved as v{reviewApproval.versionNumber} ({reviewApproval.id}) on <time dateTime={reviewApproval.createdAt}>{new Date(reviewApproval.createdAt).toLocaleString()}</time>. Active assignments remain separate.</p>}
                <div className="flex flex-wrap gap-2">
                  {canManage && reviewSelection?.mode === "review" && reviewVersion.snapshotKind === "submitted" && !reviewApproval && (
                    <Button onClick={() => void approveReviewed()} disabled={busy || reviewLoading || loading || !!loadError || !!reviewSuperseded} data-testid="skill-review-approve">
                      Approve submitted v{reviewVersion.versionNumber}
                    </Button>
                  )}
                  {canManage && reviewSelection?.mode === "inspect" && reviewVersion.id === reviewSkill.submittedVersionId && !reviewApproval && reviewVersion.snapshotKind === "submitted" && <Button disabled={busy || loading || !!loadError} onClick={() => void openReview(reviewSkill, reviewVersion.id, "review")}>Review this submission</Button>}
                  {canManage && reviewVersion.snapshotKind === "approved" && <Button disabled={busy || loading || !!loadError} data-testid="skill-review-assign" onClick={() => selectAssignment(reviewSkill.id, reviewVersion.id)}>Assign v{reviewVersion.versionNumber}</Button>}
                  {previousVersion && <Button variant="secondary" onClick={() => { setCompareLeftId(previousVersion.id); setCompareRightId(reviewVersion.id); void loadComparison(reviewSkill.id, previousVersion.id, reviewVersion.id, "Previous saved version"); }} data-testid="skill-review-compare-previous">Compare with previous v{previousVersion.versionNumber}</Button>}
                </div>
              </>
            )}

            <div className="rounded-lg border border-[var(--border)] p-3" data-testid="skill-timeline">
              <h3 className="text-sm font-semibold">Version timeline</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {[...governedVersions].sort((a, b) => a.versionNumber - b.versionNumber).map((version) => (
                  <li key={version.id} className="flex flex-wrap items-center justify-between gap-2" data-testid={`skill-version-${version.id}`}>
                    <span>v{version.versionNumber} · {version.kind} · {version.createdAt ? new Date(version.createdAt).toLocaleString() : "—"} · {version.createdByName || version.createdBy || "unknown author"}</span>
                    <Button size="sm" variant="secondary" onClick={() => void openVersion(reviewSkill.id, version.id)} data-testid={`skill-version-open-${version.id}`}>Open full version</Button>
                  </li>
                ))}
              </ul>
              {openedError && <p className="mt-2 text-sm text-[var(--danger-foreground)]">{openedError}</p>}
              {openedVersion && (
                <div className="mt-3" data-testid="skill-version-full">
                  <p className="text-xs text-[var(--muted)] break-all">Full v{openedVersion.versionNumber} · {openedVersion.snapshotKind || "version"} · ID {openedVersion.id} · saved <time dateTime={openedVersion.createdAt}>{new Date(openedVersion.createdAt).toLocaleString()}</time> · digest {String(openedVersion.snapshotMetadata?.contentDigest || "not recorded")}</p>
                  <p className="text-xs text-[var(--muted)] break-all">Reason: {String(openedVersion.snapshotMetadata?.reason || "Not recorded")}{openedVersion.snapshotMetadata?.sourceVersionId ? ` · Source submission: ${String(openedVersion.snapshotMetadata.sourceVersionId)}` : ""}</p>
                  <div className="mt-1 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm"><VersionContent detail={openedVersion} /></div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border)] p-3 space-y-2" data-testid="skill-compare">
              <h3 className="text-sm font-semibold">Compare versions</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <Field><FieldLabel htmlFor="skill-compare-left">First version</FieldLabel>
                  <Select id="skill-compare-left" data-testid="skill-compare-left" value={compareLeftId} onChange={(event) => { clearComparison(); setCompareLeftId(event.target.value); }}>
                    <option value="">Choose a version…</option>
                    {reviewSkill.versions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} ({version.kind})</option>)}
                  </Select>
                </Field>
                <Field><FieldLabel htmlFor="skill-compare-right">Second version</FieldLabel>
                  <Select id="skill-compare-right" data-testid="skill-compare-right" value={compareRightId} onChange={(event) => { clearComparison(); setCompareRightId(event.target.value); }}>
                    <option value="">Choose a version…</option>
                    {reviewSkill.versions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} ({version.kind})</option>)}
                  </Select>
                </Field>
              </div>
              <Button size="sm" variant="secondary" disabled={!compareLeftId || !compareRightId || compareLoading} onClick={() => void loadComparison(reviewSkill.id, compareLeftId, compareRightId)} data-testid="skill-compare-run">Compare selected</Button>
              <div className="flex flex-wrap items-end gap-2">
                <Field><FieldLabel htmlFor="skill-compare-target">Compare viewed version against</FieldLabel>
                  <Select id="skill-compare-target" data-testid="skill-compare-target" value={compareTarget} onChange={(event) => { clearComparison(); setCompareTarget(event.target.value as typeof compareTarget); }}>
                    <option value="previous">Previous saved version</option>
                    <option value="latestApproved">Latest approved version</option>
                    <option value="active">Active version for a context</option>
                  </Select>
                </Field>
                {compareTarget === "active" && (
                  <Field><FieldLabel htmlFor="skill-compare-context">Assignment context</FieldLabel>
                    <Select id="skill-compare-context" data-testid="skill-compare-context" value={selectedContext?.key || ""} onChange={(event) => { clearComparison(); setCompareContext(event.target.value); }}>
                      {activeContexts.length === 0 && <option value="">No active assignment</option>}
                      {activeContexts.map((context) => <option key={context.key} value={context.key}>{targetLabel(context)} · v{context.assignment?.versionNumber ?? "?"}</option>)}
                    </Select>
                  </Field>
                )}
                <Button size="sm" onClick={() => void compareTargetVersion()} data-testid="skill-compare-target-run">Compare</Button>
              </div>
              <div data-testid="skill-review-assignments" className="text-xs text-[var(--muted)]">
                {activeContexts.length === 0 ? "No version is assigned for this Skill." : activeContexts.map((context) => (
                  <p key={context.key}>{targetLabel(context)}: {context.assignment ? `v${context.assignment.versionNumber} active` : "unassigned"}</p>
                ))}
              </div>
              {compareError && <p className="text-sm text-[var(--danger-foreground)]" data-testid="skill-compare-error">{compareError}</p>}
              {compareLoading && <p className="text-sm text-[var(--muted)]" data-testid="skill-compare-loading">Loading the selected versions…</p>}
              {comparison && (
                <div data-testid="skill-diff">
                  <p className="text-xs text-[var(--muted)]">{comparison.label}: {comparison.left.title} {versionLabel(comparison.left)} → {comparison.right.title} {versionLabel(comparison.right)}</p>
                  {comparison.lines === null ? (
                    <div className="mt-2 space-y-2" data-testid="skill-diff-fallback">
                      <p className="text-sm text-[var(--muted)]">These versions are too large for an inline line comparison. Full versions are shown below without truncation.</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div><p className="text-xs font-medium">First: {versionLabel(comparison.left)}</p><div data-testid="skill-diff-before" className="mt-1 max-h-80 overflow-auto rounded-lg border border-[var(--border)] p-3 text-xs"><VersionContent detail={comparison.left} /></div></div>
                        <div><p className="text-xs font-medium">Second: {versionLabel(comparison.right)}</p><div data-testid="skill-diff-after" className="mt-1 max-h-80 overflow-auto rounded-lg border border-[var(--border)] p-3 text-xs"><VersionContent detail={comparison.right} /></div></div>
                      </div>
                    </div>
                  ) : <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] p-3 text-xs">
                    {comparison.lines.map((line, index) => (
                      <div key={index} data-diff={line.type} data-testid={`skill-diff-${line.type}`} className={line.type === "add" ? "bg-[var(--success-surface)] text-[var(--success-foreground)]" : line.type === "remove" ? "bg-[var(--danger-surface)] text-[var(--danger-foreground)]" : ""}>
                        {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}{line.text}
                      </div>
                    ))}
                  </pre>}
                </div>
              )}
            </div>
          </Card>
        )}

        <section role="tabpanel" id="skills-assignments-panel" aria-labelledby="skills-assignments-tab" hidden={tab !== "assignments"} className="space-y-4">
        <Card className="p-4 space-y-3" data-testid="skill-readiness">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Work Package A readiness</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Publication is blocked unless every context resolves to one active, approved version.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void run(async () => undefined)} disabled={busy}><IconRefresh size={15} /> Refresh</Button>
          </div>
          <div className="space-y-2">
            {WORK_PACKAGE_A_TARGETS.map((target) => {
              const current = resolution[targetLabel(target)];
              const status = loading ? "loading" : loadError ? "unavailable" : current?.status ?? "unavailable";
              const effective = status === "resolved" ? current?.assignments[0] : null;
              const assignedSkill = skills.find((skill) => skill.id === effective?.skillDocumentId);
              const generation = assignments.find((assignment) => assignment.id === effective?.assignmentId);
              return (
                <div key={targetLabel(target)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" data-testid={`skill-readiness-${target.operation}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs">{targetLabel(target)}</span>
                    <span className={status === "resolved" ? "text-[var(--success-foreground)]" : status === "conflict" ? "text-[var(--warning-foreground)]" : "text-[var(--danger-foreground)]"}>
                      {status === "loading" ? "Checking…" : status === "unavailable" ? "Unavailable" : status === "resolved" ? "Effective" : status === "conflict" ? "Conflicting assignments" : "Unassigned"}
                    </span>
                  </div>
                  {effective && <div className="mt-1 space-y-1 text-xs text-[var(--muted)]">
                    <p>Effective: {effective.skillKey} v{effective.versionNumber} · {shortDigest(effective.contentDigest)}</p>
                    <p className="break-all">Current generation: <span className="font-mono">{effective.assignmentId}</span></p>
                    <div className="flex flex-wrap gap-2">
                      {assignedSkill && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void openReview(assignedSkill, effective.skillVersionId, "inspect")}>View exact assigned version</Button>}
                      {canManage && generation && <Button size="sm" variant="secondary" disabled={busy} onClick={() => revoke(generation)} data-testid={`skill-readiness-revoke-${target.operation}`}>Revoke this generation</Button>}
                    </div>
                  </div>}
                  {status === "unassigned" && <p className="mt-1 text-xs text-[var(--muted)]">No active assignment matches this exact context.</p>}
                  {status === "conflict" && <div className="mt-1 text-xs text-[var(--warning-foreground)]"><p>{current?.conflicts.map((conflict) => `${targetLabel(conflict)} has ${conflict.matches} matches`).join("; ")}. Publication remains blocked.</p><a className="underline" href="#skill-assignment-history">Review exact generations in assignment history</a></div>}
                  {status === "unavailable" && <p className="mt-1 text-xs text-[var(--muted)]">Current assignment readiness could not be confirmed. Refresh to check.</p>}
                </div>
              );
            })}
          </div>
        </Card>

        {currentUserId && <SkillAssignmentForm key={`${projectId}/${currentUserId}`} projectId={projectId} actorId={currentUserId} skills={skills} assignments={assignments} canManage={canManage} loading={loading} loadError={loadError} busy={busy} onBusy={setBusy} onRefresh={load} selection={assignmentSelection} />}

        <Card className="p-4 space-y-3" id="skill-assignment-history">
          <h2 className="text-base font-semibold">Assignment history</h2>
          {loading ? <p className="text-sm text-[var(--muted)]">Loading assignments…</p> : loadError ? <p className="text-sm text-[var(--muted)]" data-testid="skill-history-unavailable">Current assignment history is unavailable. Refresh to check.</p> : assignments.length === 0 ? <p className="text-sm text-[var(--muted)]">No assignments recorded.</p> : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm" data-testid={`skill-assignment-${assignment.id}`}>
                  <div className="min-w-0">
                    <p className="font-medium">{assignment.skillKey || assignment.skillTitle || assignment.skillDocumentId} v{assignment.versionNumber ?? "?"}</p>
                    <p className="text-xs text-[var(--muted)]">{targetLabel(assignment)} · {assignment.status === "active" ? "active" : "revoked"}</p>
                    <p className="text-xs text-[var(--muted)] break-all">Generation: <span className="font-mono">{assignment.id}</span> · version: <span className="font-mono">{assignment.skillVersionId}</span></p>
                    <p className="text-xs text-[var(--muted)]">Assigned by {assignment.assignedBy || "unknown"} · <time dateTime={assignment.assignedAt}>{new Date(assignment.assignedAt).toLocaleString()}</time>{assignment.deactivatedAt && <> · deactivated by {assignment.deactivatedBy || "unknown"} · <time dateTime={assignment.deactivatedAt}>{new Date(assignment.deactivatedAt).toLocaleString()}</time></>}</p>
                    <p className="text-xs text-[var(--muted)] break-all">Content digest: {assignment.contentDigest || "not recorded"}</p>
                  </div>
                  {canManage && assignment.status === "active" && <Button variant="secondary" size="sm" onClick={() => revoke(assignment)} disabled={busy || loading || !!loadError} data-testid={`skill-revoke-${assignment.id}`}>Revoke</Button>}
                </div>
              ))}
            </div>
          )}
        </Card>
        </section>
      </div>
    </StandardPageLayout>
  );
}
