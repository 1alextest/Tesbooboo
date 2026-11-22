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
  listSkillAssignments,
  listSkills,
  submitSkillVersion,
  type SkillAssignmentRecord,
  type SkillModule,
  type SkillRecord,
  type SkillResolutionRecord
} from "@/lib/api";
import { Button, Card, Field, FieldError, FieldLabel, Input, Select, Textarea } from "@/components/ui";
import { PageHeader, StandardPageLayout, Breadcrumbs } from "@/components/workflows";
import { useAppData } from "@/components/app/AppDataProvider";
import { useProjectData } from "@/components/project/ProjectDataProvider";

const MODULES: SkillModule[] = ["requirements", "test_cases", "user_manuals", "policies", "tasks_issues", "files_evidence", "skills"];

/** The three contexts Work Package A's typed bundle actually needs. */
const WORK_PACKAGE_A_TARGETS = [
  { module: "requirements", subtype: "functional", operation: "requirement_revision" },
  { module: "requirements", subtype: "functional", operation: "requirement_case_link" },
  { module: "test_cases", subtype: "manual", operation: "testcase_create" }
] as const;

function normalizeRole(role: string): "owner" | "manager" | "qa_engineer" {
  const value = (role ?? "").trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  if (value === "owner") return "owner";
  if (["manager", "admin", "test_manager"].includes(value)) return "manager";
  return "qa_engineer";
}

function targetLabel(target: { module: string; subtype: string; operation: string }) {
  return `${target.module} / ${target.subtype} / ${target.operation}`;
}

function shortDigest(digest: string | null | undefined) {
  return digest ? `${digest.slice(0, 12)}…` : "—";
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
    if (!currentUser) {
      router.replace("/login");
      return;
    }
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

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The Skills action failed.");
    } finally {
      setBusy(false);
    }
  }

  function createAndSubmit() {
    void run(async () => {
      const created = await createSkillCandidate(projectId, {
        title: newTitle.trim(), module: newModule, subtype: newSubtype.trim() || "*",
        ...(newKey.trim() ? { skillKey: newKey.trim() } : {}),
        instructions: newInstructions.trim()
      });
      const version = await submitSkillVersion(projectId, created.id, created.editRevision);
      setNewTitle("");
      setNewKey("");
      setNewInstructions("");
      setMessage(`Skill candidate submitted as version ${version.versionNumber}. It is inert until a human approves it.`);
    });
  }

  function approve(skill: SkillRecord) {
    const version = skill.versions.find((entry) => entry.id === skill.submittedVersionId && entry.kind === "submitted");
    if (!version) {
      setError("This skill has no submitted version to approve.");
      return;
    }
    void run(async () => {
      await approveSkillVersion(projectId, skill.id, version.id);
      setMessage(`Approved ${skill.title} version ${version.versionNumber}. Approval does not assign it.`);
    });
  }

  function assign() {
    if (!selectedAssignSkill?.approvedVersionId) {
      setError("Choose a skill with an approved version.");
      return;
    }
    void run(async () => {
      await assignSkill(projectId, {
        skillDocumentId: selectedAssignSkill.id,
        versionId: selectedAssignSkill.approvedVersionId!,
        module: assignModule.trim(),
        subtype: assignSubtype.trim() || "*",
        operation: assignOperation.trim() || "*"
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
      subtitle="Inspect, approve and assign the exact skill versions that govern requirements and test-case publication."
      breadcrumb={
        <Breadcrumbs
          items={[
            { label: "Projects", href: "/projects" },
            { label: String(project.name || "Project"), href: `/projects/${projectId}/dashboard` },
            { label: "Settings", href: `/projects/${projectId}/settings` },
            { label: "Skills" }
          ]}
        />
      }
    />
  );

  return (
    <StandardPageLayout header={header}>
      <div className="space-y-4" data-testid="skills-settings">
        {(message || error) && (
          <Card className="p-3">
            <p className={error ? "text-sm text-[var(--danger-foreground)]" : "text-sm text-[var(--success-foreground)]"} role="status">
              {error || message}
            </p>
          </Card>
        )}

        <Card className="p-4 space-y-3" data-testid="skill-readiness">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Work Package A readiness</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Publication is blocked unless every context resolves to one active, approved version. Nothing here publishes automatically.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void run(async () => undefined)} disabled={busy}>
              <IconRefresh size={15} /> Refresh
            </Button>
          </div>
          <div className="space-y-2">
            {WORK_PACKAGE_A_TARGETS.map((target) => {
              const key = targetLabel(target);
              const current = resolution[key];
              const status = current?.status ?? "unassigned";
              return (
                <div key={key} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm" data-testid={`skill-readiness-${target.operation}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs">{key}</span>
                    <span className={status === "resolved" ? "text-[var(--success-foreground)]" : status === "conflict" ? "text-[var(--warning-foreground)]" : "text-[var(--danger-foreground)]"}>
                      {status === "resolved" ? "Effective" : status === "conflict" ? "Conflicting assignments" : "Unassigned"}
                    </span>
                  </div>
                  {status === "resolved" && current?.assignments[0] && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Effective: {current.assignments[0].skillKey} v{current.assignments[0].versionNumber} · {shortDigest(current.assignments[0].contentDigest)}
                    </p>
                  )}
                  {status === "unassigned" && <p className="mt-1 text-xs text-[var(--muted)]">No active assignment matches this exact context.</p>}
                  {status === "conflict" && (
                    <p className="mt-1 text-xs text-[var(--warning-foreground)]">
                      {current.conflicts.map((conflict) => `${targetLabel(conflict)} has ${conflict.matches} matches`).join("; ")}. Publication remains blocked.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2"><IconShieldCheck size={18} /> Skills library</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Candidates stay inert. Approval and assignment are separate human decisions.</p>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading skills…</p>
          ) : skills.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No skills in this project yet.</p>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => {
                const submitted = skill.versions.find((version) => version.id === skill.submittedVersionId);
                const approved = skill.versions.find((version) => version.id === skill.approvedVersionId);
                return (
                  <div key={skill.id} className="rounded-lg border border-[var(--border)] p-3" data-testid={`skill-${skill.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{skill.title}</p>
                        <p className="text-xs text-[var(--muted)]">
                          <span className="font-mono">{skill.skillKey || "no key"}</span> · {skill.module || "?"}/{skill.subtype || "*"} · status {skill.status}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {approved ? `Approved v${approved.versionNumber} (${shortDigest(approved.contentDigest)})` : "No approved version"}
                          {submitted ? ` · submitted v${submitted.versionNumber}` : " · no submitted version"}
                        </p>
                      </div>
                      {canManage && submitted && (
                        <Button size="sm" onClick={() => approve(skill)} disabled={busy} data-testid={`skill-approve-${skill.id}`}>
                          Approve submitted v{submitted.versionNumber}
                        </Button>
                      )}
                    </div>
                    <details className="mt-2 text-xs text-[var(--muted)]">
                      <summary className="cursor-pointer">Version history ({skill.versions.length})</summary>
                      <ul className="mt-1 space-y-1">
                        {skill.versions.map((version) => (
                          <li key={version.id}>
                            v{version.versionNumber} · {version.kind} · {version.createdAt ? new Date(version.createdAt).toLocaleString() : "—"} · {shortDigest(version.contentDigest)}
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

        <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2"><IconPlus size={18} /> New skill candidate</h2>
          <p className="text-sm text-[var(--muted)]">Creating and submitting a candidate does not approve or assign it. Agents may use the same API.</p>
          <div className="grid gap-3 md:grid-cols-2" data-testid="skill-candidate-form">
            <Field><FieldLabel>Title</FieldLabel><Input data-testid="skill-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={512} /></Field>
            <Field><FieldLabel>Skill key (optional)</FieldLabel><Input data-testid="skill-key" value={newKey} onChange={(event) => setNewKey(event.target.value)} placeholder="REQ-AUTHORING" maxLength={64} /></Field>
            <Field><FieldLabel>Module</FieldLabel>
              <Select data-testid="skill-module" value={newModule} onChange={(event) => setNewModule(event.target.value as SkillModule)}>
                {MODULES.map((module) => <option key={module} value={module}>{module}</option>)}
              </Select>
            </Field>
            <Field><FieldLabel>Subtype</FieldLabel><Input data-testid="skill-subtype" value={newSubtype} onChange={(event) => setNewSubtype(event.target.value)} placeholder="functional" maxLength={32} /></Field>
            <div className="md:col-span-2">
              <Field><FieldLabel>Instructions</FieldLabel><Textarea data-testid="skill-instructions" value={newInstructions} onChange={(event) => setNewInstructions(event.target.value)} rows={4} maxLength={20000} /></Field>
            </div>
          </div>
          {(!newTitle.trim() || !newInstructions.trim()) && <FieldError>A title and instructions are required.</FieldError>}
          <div>
            <Button onClick={createAndSubmit} disabled={busy || !newTitle.trim() || !newInstructions.trim()} data-testid="skill-create-submit">
              Create and submit candidate
            </Button>
          </div>
        </Card>

        {canManage && (
          <Card className="p-4 space-y-3">
            <h2 className="text-base font-semibold">Assign an approved version</h2>
            <p className="text-sm text-[var(--muted)]">One active assignment per exact module/subtype/operation. Replacing it deactivates the prior generation; history stays readable.</p>
            <div className="grid gap-3 md:grid-cols-2" data-testid="skill-assignment-form">
              <Field><FieldLabel>Approved skill</FieldLabel>
                <Select data-testid="skill-assignment-skill" value={assignSkillId} onChange={(event) => setAssignSkillId(event.target.value)}>
                  <option value="">Choose an approved skill…</option>
                  {approvedSkills.map((skill) => <option key={skill.id} value={skill.id}>{skill.skillKey || skill.title} ({skill.module}/{skill.subtype})</option>)}
                </Select>
              </Field>
              <Field><FieldLabel>Module</FieldLabel><Input data-testid="skill-assignment-module" value={assignModule} onChange={(event) => setAssignModule(event.target.value)} /></Field>
              <Field><FieldLabel>Subtype</FieldLabel><Input data-testid="skill-assignment-subtype" value={assignSubtype} onChange={(event) => setAssignSubtype(event.target.value)} /></Field>
              <Field><FieldLabel>Operation</FieldLabel><Input data-testid="skill-assignment-operation" value={assignOperation} onChange={(event) => setAssignOperation(event.target.value)} /></Field>
            </div>
            <Button onClick={assign} disabled={busy || !assignSkillId} data-testid="skill-assign">Assign approved version</Button>
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <h2 className="text-base font-semibold">Assignment history</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No assignments recorded.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm" data-testid={`skill-assignment-${assignment.id}`}>
                  <div className="min-w-0">
                    <p className="font-medium">{assignment.skillKey || assignment.skillTitle || assignment.skillDocumentId} v{assignment.versionNumber ?? "?"}</p>
                    <p className="text-xs text-[var(--muted)]">{targetLabel(assignment)} · {assignment.status === "active" ? "active" : "revoked"}</p>
                  </div>
                  {canManage && assignment.status === "active" && (
                    <Button variant="secondary" size="sm" onClick={() => revoke(assignment)} disabled={busy} data-testid={`skill-revoke-${assignment.id}`}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </StandardPageLayout>
  );
}
