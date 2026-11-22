"use client";

import { useRouter } from "next/navigation";
import { useParams } from "@/lib/routeParams";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconBook, IconPlus, IconRefresh, IconShieldCheck } from "@tabler/icons-react";
import {
  ApiError,
  approveSkillVersion,
  assignSkill,
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
import { PageHeader, StandardPageLayout, Breadcrumbs } from "@/components/workflows";
import { useAppData } from "@/components/app/AppDataProvider";
import { useProjectData } from "@/components/project/ProjectDataProvider";

const MODULES: SkillModule[] = ["requirements", "test_cases", "user_manuals", "policies", "tasks_issues", "files_evidence", "skills"];

const WORK_PACKAGE_A_TARGETS = [
  { module: "requirements", subtype: "functional", operation: "requirement_revision" },
  { module: "requirements", subtype: "functional", operation: "requirement_case_link" },
  { module: "test_cases", subtype: "manual", operation: "testcase_create" }
] as const;

type DiffLine = { type: "same" | "add" | "remove"; text: string };
type Comparison = { left: KnowledgeDocumentVersionDetail; right: KnowledgeDocumentVersionDetail; lines: DiffLine[] };
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
function versionText(detail: KnowledgeDocumentVersionDetail | null): string {
  if (!detail) return "";
  if (detail.contentText) return detail.contentText;
  return detail.contentJson === null || detail.contentJson === undefined ? "" : JSON.stringify(detail.contentJson, null, 2);
}
function versionLabel(version: { versionNumber: number; kind?: string } | null | undefined) {
  return version ? `v${version.versionNumber} (${version.kind || "version"})` : "no version";
}

/** Line-level LCS diff. Additions and removals are shown as separate lines; edits appear as a pair. */
function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n"), b = after.split("\n");
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
  const projectId = params.id as string;
  const { currentUser } = useAppData();
  const { project, projectMembers } = useProjectData();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [assignments, setAssignments] = useState<SkillAssignmentRecord[]>([]);
  const [resolution, setResolution] = useState<Record<string, SkillResolutionRecord>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newModule, setNewModule] = useState<SkillModule>("requirements");
  const [newSubtype, setNewSubtype] = useState("functional");
  const [newInstructions, setNewInstructions] = useState("");

  const [assignSkillId, setAssignSkillId] = useState("");
  const [assignModule, setAssignModule] = useState("requirements");
  const [assignSubtype, setAssignSubtype] = useState("functional");
  const [assignOperation, setAssignOperation] = useState("requirement_revision");

  const [reviewSkillId, setReviewSkillId] = useState<string | null>(null);
  const [reviewVersion, setReviewVersion] = useState<KnowledgeDocumentVersionDetail | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    try {
      const [library, ledger] = await Promise.all([listSkills(projectId), listSkillAssignments(projectId)]);
      setSkills(library.skills);
      setAssignments(ledger.list);
      const resolved = await Promise.all(WORK_PACKAGE_A_TARGETS.map(async (target) => [targetLabel(target), await getEffectiveSkills(projectId, target)] as const));
      setResolution(Object.fromEntries(resolved));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Skills could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!currentUser) { router.replace("/login"); return; }
    setCurrentUserId(currentUser.userId);
    load().catch(() => undefined);
  }, [currentUser, load, router]);

  const currentUserRole = currentUserId
    ? normalizeRole(projectMembers.find((member) => member.userId === currentUserId)?.role ?? "qa_engineer")
    : "qa_engineer";
  const canManage = currentUserRole === "owner" || currentUserRole === "manager";
  const approvedSkills = useMemo(() => skills.filter((skill) => skill.approvedVersionId), [skills]);
  const selectedAssignSkill = approvedSkills.find((skill) => skill.id === assignSkillId) || null;

  useEffect(() => {
    if (!selectedAssignSkill) return;
    setAssignModule(selectedAssignSkill.module || "requirements");
    setAssignSubtype(selectedAssignSkill.subtype || "functional");
  }, [selectedAssignSkill]);

  const reviewSkill = skills.find((skill) => skill.id === reviewSkillId) || null;
  const governedVersions = useMemo(
    () => (reviewSkill?.versions || []).filter((version) => version.kind !== "autosave"),
    [reviewSkill]
  );
  const candidateVersion = governedVersions.find((version) => version.id === reviewSkill?.submittedVersionId) || null;
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
  const reviewText = versionText(reviewVersion);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try { await action(); await load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "The Skills action failed."); }
    finally { setBusy(false); }
  }

  async function loadComparison(skillId: string, leftId: string, rightId: string) {
    setCompareLoading(true);
    setCompareError(null);
    try {
      const [left, right] = await Promise.all([
        getKnowledgeDocumentVersion(projectId, skillId, leftId),
        getKnowledgeDocumentVersion(projectId, skillId, rightId)
      ]);
      setComparison({ left, right, lines: diffLines(versionText(left), versionText(right)) });
    } catch (err) {
      setComparison(null);
      setCompareError(err instanceof ApiError ? err.message : "The versions could not be compared.");
    } finally { setCompareLoading(false); }
  }

  async function openReview(skill: SkillRecord) {
    if (!skill.submittedVersionId) return;
    const contexts = new Map<string, string>();
    for (const assignment of skill.assignments.filter((item) => item.status === "active")) {
      contexts.set(contextKey(assignment), contextKey(assignment));
    }
    setReviewSkillId(skill.id);
    setReviewVersion(null);
    setReviewError(null);
    setReviewLoading(true);
    setComparison(null);
    setSuperseded(null);
    setOpenedVersion(null);
    setCompareError(null);
    const governed = skill.versions.filter((version) => version.kind !== "autosave");
    const candidate = governed.find((entry) => entry.id === skill.submittedVersionId);
    setCompareLeftId(governed.find((version) => version.versionNumber < (candidate?.versionNumber ?? 0))?.id || "");
    setCompareRightId(skill.submittedVersionId);
    setCompareContext([...contexts.values()][0] || "");
    try {
      const detail = await getKnowledgeDocumentVersion(projectId, skill.id, skill.submittedVersionId);
      setReviewVersion(detail);
      const previous = governed
        .filter((version) => version.versionNumber < (candidate?.versionNumber ?? 0))
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];
      if (previous) await loadComparison(skill.id, previous.id, skill.submittedVersionId);
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "The submitted content could not be loaded.");
    } finally { setReviewLoading(false); }
  }

  async function openVersion(skillId: string, versionId: string) {
    setOpenedError(null);
    setOpenedVersion(null);
    try { setOpenedVersion(await getKnowledgeDocumentVersion(projectId, skillId, versionId)); }
    catch (err) { setOpenedError(err instanceof ApiError ? err.message : "The version could not be loaded."); }
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
      setComparison(null);
      setCompareError(compareTarget === "active"
        ? "No version is assigned for this context."
        : "There is no earlier or approved version to compare.");
      return;
    }
    setCompareLeftId(target.id);
    setCompareRightId(candidateVersion.id);
    await loadComparison(reviewSkill.id, target.id, candidateVersion.id);
  }

  async function approveReviewed() {
    if (!reviewSkill || !reviewVersion) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await approveSkillVersion(projectId, reviewSkill.id, reviewVersion.id);
      setMessage(`Approved ${reviewSkill.title} version ${reviewVersion.versionNumber}. Active assignments were not changed; assignment remains a separate human action.`);
      setSuperseded(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.code === "SKILL_VERSION_SUPERSEDED") {
        setSuperseded({ currentVersionId: String(err.body?.currentVersionId || ""), currentVersionNumber: err.body?.currentVersionNumber });
      }
      setError(err instanceof ApiError ? err.message : "The version could not be approved.");
      await load();
    } finally { setBusy(false); }
  }

  function createAndSubmit() {
    void run(async () => {
      const created = await createSkillCandidate(projectId, {
        title: newTitle.trim(), module: newModule, subtype: newSubtype.trim() || "*",
        ...(newKey.trim() ? { skillKey: newKey.trim() } : {}),
        instructions: newInstructions.trim()
      });
      const version = await submitSkillVersion(projectId, created.id, created.editRevision);
      setNewTitle(""); setNewKey(""); setNewInstructions("");
      setMessage(`Skill candidate submitted as version ${version.versionNumber}. It is inert until a human approves it.`);
    });
  }

  function assign() {
    if (!selectedAssignSkill?.approvedVersionId) { setError("Choose a skill with an approved version."); return; }
    void run(async () => {
      await assignSkill(projectId, {
        skillDocumentId: selectedAssignSkill.id,
        versionId: selectedAssignSkill.approvedVersionId!,
        module: assignModule.trim(), subtype: assignSubtype.trim() || "*", operation: assignOperation.trim() || "*"
      });
      setMessage(`Assigned ${selectedAssignSkill.title} to ${assignModule}/${assignSubtype}/${assignOperation}.`);
    });
  }

  function revoke(assignment: SkillAssignmentRecord) {
    void run(async () => {
      await deactivateSkillAssignment(projectId, assignment.id);
      setMessage(`Revoked the ${assignment.module}/${assignment.subtype}/${assignment.operation} assignment. Prior versions and history remain.`);
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
      <div className="space-y-4" data-testid="skills-settings">
        {(message || error) && <Card className="p-3"><p className={error ? "text-sm text-[var(--danger-foreground)]" : "text-sm text-[var(--success-foreground)]"} role="status">{error || message}</p></Card>}

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
              const status = current?.status ?? "unassigned";
              return (
                <div key={targetLabel(target)} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" data-testid={`skill-readiness-${target.operation}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs">{targetLabel(target)}</span>
                    <span className={status === "resolved" ? "text-[var(--success-foreground)]" : status === "conflict" ? "text-[var(--warning-foreground)]" : "text-[var(--danger-foreground)]"}>
                      {status === "resolved" ? "Effective" : status === "conflict" ? "Conflicting assignments" : "Unassigned"}
                    </span>
                  </div>
                  {status === "resolved" && current?.assignments[0] && <p className="mt-1 text-xs text-[var(--muted)]">Effective: {current.assignments[0].skillKey} v{current.assignments[0].versionNumber} · {shortDigest(current.assignments[0].contentDigest)}</p>}
                  {status === "unassigned" && <p className="mt-1 text-xs text-[var(--muted)]">No active assignment matches this exact context.</p>}
                  {status === "conflict" && <p className="mt-1 text-xs text-[var(--warning-foreground)]">{current.conflicts.map((conflict) => `${targetLabel(conflict)} has ${conflict.matches} matches`).join("; ")}. Publication remains blocked.</p>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2"><IconShieldCheck size={18} /> Skills library</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Review submitted vN is the entry point. Candidates stay inert; approval and assignment are separate human decisions.</p>
          </div>
          {loading ? <p className="text-sm text-[var(--muted)]">Loading skills…</p> : skills.length === 0 ? <p className="text-sm text-[var(--muted)]">No skills in this project yet.</p> : (
            <div className="space-y-3">
              {skills.map((skill) => {
                const submitted = skill.versions.find((version) => version.id === skill.submittedVersionId);
                const approved = skill.versions.find((version) => version.id === skill.approvedVersionId);
                return (
                  <div key={skill.id} className="rounded-lg border border-[var(--border)] p-3" data-testid={`skill-${skill.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{skill.title}</p>
                        <p className="text-xs text-[var(--muted)]"><span className="font-mono">{skill.skillKey || "no key"}</span> · {skill.module || "?"}/{skill.subtype || "*"} · status {skill.status}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{approved ? `Approved v${approved.versionNumber}` : "No approved version"}{submitted ? ` · submitted v${submitted.versionNumber} awaiting review` : " · no submitted version"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {submitted && <Button size="sm" onClick={() => void openReview(skill)} data-testid={`skill-review-open-${skill.id}`}>Review submitted v{submitted.versionNumber}</Button>}
                      </div>
                    </div>
                    <details className="mt-2 text-xs text-[var(--muted)]">
                      <summary className="cursor-pointer">Version history ({skill.versions.length})</summary>
                      <ul className="mt-1 space-y-1">
                        {skill.versions.map((version) => (
                          <li key={version.id}>
                            v{version.versionNumber} · {version.kind} · {version.createdAt ? new Date(version.createdAt).toLocaleString() : "—"} · {shortDigest(version.contentDigest)} · {version.createdByName || version.createdBy || "unknown author"}
                            {version.id === skill.approvedVersionId ? " · current approved" : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {reviewSkill && (
          <Card className="p-4 space-y-4" data-testid="skill-review-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Review submitted {versionLabel(candidateVersion)} — {reviewSkill.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Approval applies to the exact content loaded below. Assignment is separate and unchanged by approval.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setReviewSkillId(null)}>Close review</Button>
            </div>
            {reviewLoading && <p className="text-sm text-[var(--muted)]" data-testid="skill-review-loading">Loading the exact submitted content…</p>}
            {reviewError && (
              <div className="rounded-lg border border-[var(--danger-border)] p-3" data-testid="skill-review-error">
                <p className="text-sm text-[var(--danger-foreground)]">{reviewError}</p>
                <Button size="sm" className="mt-2" onClick={() => void openReview(reviewSkill)} data-testid="skill-review-retry">Retry</Button>
              </div>
            )}
            {reviewVersion && !reviewError && (
              <>
                <div className="grid gap-2 text-xs text-[var(--muted)] md:grid-cols-2" data-testid="skill-review-version">
                  <p>Version: <span className="font-mono">v{reviewVersion.versionNumber}</span> · status {reviewVersion.snapshotKind || "submitted"}</p>
                  <p>Author: {reviewMeta?.createdByName || reviewMeta?.createdBy || reviewVersion.createdBy || "unknown"}</p>
                  <p>Submitted: {reviewVersion.createdAt ? new Date(reviewVersion.createdAt).toLocaleString() : "—"}</p>
                  <p>Digest: <span className="font-mono">{shortDigest(reviewMeta?.contentDigest)}</span></p>
                  <p className="md:col-span-2">Rationale: {String(reviewVersion.snapshotMetadata?.reason || "No rationale was recorded with this submission.")}</p>
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm" data-testid="skill-review-content">{reviewText || "(empty instructions)"}</pre>
                {!previousVersion && <p className="text-xs text-[var(--muted)]" data-testid="skill-review-first">This is the first saved version; there is no earlier version to compare.</p>}
                {superseded && (
                  <div className="rounded-lg border border-[var(--warning-border)] p-3" data-testid="skill-review-superseded">
                    <p className="text-sm">A newer submission superseded the version on screen.</p>
                    <Button size="sm" className="mt-2" onClick={() => void openReview(reviewSkill)} data-testid="skill-review-current">Open current submission</Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <Button onClick={() => void approveReviewed()} disabled={busy || reviewLoading} data-testid="skill-review-approve">
                      Approve submitted v{reviewVersion.versionNumber}
                    </Button>
                  )}
                  {previousVersion && <Button variant="secondary" onClick={() => void loadComparison(reviewSkill.id, previousVersion.id, reviewVersion.id)} data-testid="skill-review-compare-previous">Compare with previous v{previousVersion.versionNumber}</Button>}
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
                  <p className="text-xs text-[var(--muted)]">Full v{openedVersion.versionNumber} · {openedVersion.snapshotKind || "version"}</p>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm">{versionText(openedVersion) || "(empty)"}</pre>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-[var(--border)] p-3 space-y-2" data-testid="skill-compare">
              <h3 className="text-sm font-semibold">Compare versions</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <Field><FieldLabel>First version</FieldLabel>
                  <Select data-testid="skill-compare-left" value={compareLeftId} onChange={(event) => setCompareLeftId(event.target.value)}>
                    <option value="">Choose a version…</option>
                    {governedVersions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} ({version.kind})</option>)}
                  </Select>
                </Field>
                <Field><FieldLabel>Second version</FieldLabel>
                  <Select data-testid="skill-compare-right" value={compareRightId} onChange={(event) => setCompareRightId(event.target.value)}>
                    <option value="">Choose a version…</option>
                    {governedVersions.map((version) => <option key={version.id} value={version.id}>v{version.versionNumber} ({version.kind})</option>)}
                  </Select>
                </Field>
              </div>
              <Button size="sm" variant="secondary" disabled={!compareLeftId || !compareRightId || compareLoading} onClick={() => void loadComparison(reviewSkill.id, compareLeftId, compareRightId)} data-testid="skill-compare-run">Compare selected</Button>
              <div className="flex flex-wrap items-end gap-2">
                <Field><FieldLabel>Compare candidate against</FieldLabel>
                  <Select data-testid="skill-compare-target" value={compareTarget} onChange={(event) => setCompareTarget(event.target.value as typeof compareTarget)}>
                    <option value="previous">Previous saved version</option>
                    <option value="latestApproved">Latest approved version</option>
                    <option value="active">Active version for a context</option>
                  </Select>
                </Field>
                {compareTarget === "active" && (
                  <Field><FieldLabel>Assignment context</FieldLabel>
                    <Select data-testid="skill-compare-context" value={selectedContext?.key || ""} onChange={(event) => setCompareContext(event.target.value)}>
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
              {comparison && (
                <div data-testid="skill-diff">
                  <p className="text-xs text-[var(--muted)]">{versionLabel(comparison.left)} → {versionLabel(comparison.right)}</p>
                  <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border)] p-3 text-xs">
                    {comparison.lines.map((line, index) => (
                      <div key={index} data-diff={line.type} data-testid={`skill-diff-${line.type}`} className={line.type === "add" ? "bg-[var(--success-surface)] text-[var(--success-foreground)]" : line.type === "remove" ? "bg-[var(--danger-surface)] text-[var(--danger-foreground)]" : ""}>
                        {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}{line.text}
                      </div>
                    ))}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2"><IconPlus size={18} /> New skill candidate</h2>
          <p className="text-sm text-[var(--muted)]">Creating and submitting a candidate does not approve or assign it.</p>
          <div className="grid gap-3 md:grid-cols-2" data-testid="skill-candidate-form">
            <Field><FieldLabel>Title</FieldLabel><Input data-testid="skill-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={512} /></Field>
            <Field><FieldLabel>Skill key (optional)</FieldLabel><Input data-testid="skill-key" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="REQ-AUTHORING" maxLength={64} /></Field>
            <Field><FieldLabel>Module</FieldLabel><Select data-testid="skill-module" value={newModule} onChange={(event) => setNewModule(event.target.value as SkillModule)}>{MODULES.map((module) => <option key={module} value={module}>{module}</option>)}</Select></Field>
            <Field><FieldLabel>Subtype</FieldLabel><Input data-testid="skill-subtype" value={newSubtype} onChange={(event) => setNewSubtype(event.target.value)} placeholder="functional" maxLength={32} /></Field>
            <div className="md:col-span-2"><Field><FieldLabel>Instructions</FieldLabel><Textarea data-testid="skill-instructions" value={newInstructions} onChange={(event) => setNewInstructions(event.target.value)} rows={4} maxLength={20000} /></Field></div>
          </div>
          {(!newTitle.trim() || !newInstructions.trim()) && <FieldError>A title and instructions are required.</FieldError>}
          <Button onClick={createAndSubmit} disabled={busy || !newTitle.trim() || !newInstructions.trim()} data-testid="skill-create-submit">Create and submit candidate</Button>
        </Card>

        {canManage && (
          <Card className="p-4 space-y-3">
            <h2 className="text-base font-semibold">Assign an approved version</h2>
            <p className="text-sm text-[var(--muted)]">One active assignment per exact module/subtype/operation. Replacing it deactivates the prior generation; history stays readable.</p>
            <div className="grid gap-3 md:grid-cols-2" data-testid="skill-assignment-form">
              <Field><FieldLabel>Approved skill</FieldLabel><Select data-testid="skill-assignment-skill" value={assignSkillId} onChange={(event) => setAssignSkillId(event.target.value)}><option value="">Choose an approved skill…</option>{approvedSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.skillKey || skill.title} ({skill.module}/{skill.subtype})</option>)}</Select></Field>
              <Field><FieldLabel>Module</FieldLabel><Input data-testid="skill-assignment-module" value={assignModule} onChange={(event) => setAssignModule(event.target.value)} /></Field>
              <Field><FieldLabel>Subtype</FieldLabel><Input data-testid="skill-assignment-subtype" value={assignSubtype} onChange={(event) => setAssignSubtype(event.target.value)} /></Field>
              <Field><FieldLabel>Operation</FieldLabel><Input data-testid="skill-assignment-operation" value={assignOperation} onChange={(event) => setAssignOperation(event.target.value)} /></Field>
            </div>
            <Button onClick={assign} disabled={busy || !assignSkillId} data-testid="skill-assign">Assign approved version</Button>
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold">Assignment history</h2>
          {assignments.length === 0 ? <p className="text-sm text-[var(--muted)]">No assignments recorded.</p> : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm" data-testid={`skill-assignment-${assignment.id}`}>
                  <div className="min-w-0">
                    <p className="font-medium">{assignment.skillKey || assignment.skillTitle || assignment.skillDocumentId} v{assignment.versionNumber ?? "?"}</p>
                    <p className="text-xs text-[var(--muted)]">{targetLabel(assignment)} · {assignment.status === "active" ? "active" : "revoked"}</p>
                  </div>
                  {canManage && assignment.status === "active" && <Button variant="secondary" size="sm" onClick={() => revoke(assignment)} disabled={busy} data-testid={`skill-revoke-${assignment.id}`}>Revoke</Button>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </StandardPageLayout>
  );
}
