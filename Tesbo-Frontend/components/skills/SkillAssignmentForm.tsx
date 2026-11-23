"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError, assignSkillBatch, getSkillAssignmentBatch, listSkillAssignments,
  type SkillAssignmentBatchReceipt, type SkillAssignmentBatchRequest,
  type SkillAssignmentRecord, type SkillRecord,
} from "@/lib/api";
import { Button, Card, Field, FieldLabel, Input, Select } from "@/components/ui";

export const SKILL_MODULES = ["requirements", "test_cases", "user_manuals", "policies", "tasks_issues", "files_evidence", "skills"] as const;
export const SKILL_WORK_PACKAGE_A_TARGETS = [
  { module: "requirements", subtype: "functional", operation: "requirement_revision" },
  { module: "requirements", subtype: "functional", operation: "requirement_case_link" },
  { module: "test_cases", subtype: "manual", operation: "testcase_create" },
] as const;

type Target = SkillAssignmentBatchRequest["targets"][number];
type Draft = { skillId: string; versionId: string; module: string; subtype: string; operation: string; targets: Target[] };
export type SkillAssignmentSelection = { skillId: string; versionId: string; token: number };
const emptyDraft = (): Draft => ({ skillId: "", versionId: "", module: "requirements", subtype: "functional", operation: "requirement_revision", targets: [] });
const targetKey = (target: Pick<Target, "module" | "subtype" | "operation">) => JSON.stringify([target.module, target.subtype, target.operation]);
const targetLabel = (target: Pick<Target, "module" | "subtype" | "operation">) => `${target.module} / ${target.subtype} / ${target.operation}`;

/** Presentation over the shared native batch owner. Staged generation IDs are never silently
 * replaced by a background refresh; the human must review changed targets before another save.
 * An unresolved request is frozen and retained across tab/disclosure changes and reload.
 */
export function SkillAssignmentForm({ projectId, actorId, skills, assignments, canManage, loading, loadError, busy, onBusy, onRefresh, selection }: {
  projectId: string; actorId: string; skills: SkillRecord[]; assignments: SkillAssignmentRecord[];
  canManage: boolean; loading: boolean; loadError: string | null; busy: boolean;
  onBusy: (busy: boolean) => void; onRefresh: () => Promise<void>; selection: SkillAssignmentSelection | null;
}) {
  const storageKey = `tesbo-skill-assignment/v1/${actorId}/${projectId}`;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pending, setPending] = useState<SkillAssignmentBatchRequest | null>(null);
  const [receipt, setReceipt] = useState<SkillAssignmentBatchReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [denied, setDenied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const requestGeneration = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const lastSelection = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (stored?.draft && Array.isArray(stored.draft.targets)) setDraft(stored.draft);
      setNeedsReview(stored?.needsReview === true);
      if (stored?.pending?.requestKey && Array.isArray(stored.pending.targets)) {
        setPending(stored.pending);
        setOpen(true);
        setNotice("The earlier assignment outcome is unconfirmed. Checking the saved request.");
      }
      if (stored?.receipt?.projectId === projectId && stored.receipt.actorId === actorId) setReceipt(stored.receipt);
    } catch { setError("The saved assignment form could not be read. Keep this page open while recovering an uncertain request."); }
    setHydrated(true);
    return () => { mounted.current = false; requestGeneration.current++; inFlight.current = false; };
  }, [storageKey, projectId, actorId]);

  useEffect(() => {
    if (!hydrated) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ draft, pending, receipt, needsReview })); }
    catch { setError("This browser could not retain the assignment form. Saving is paused until request recovery can be retained."); }
  }, [hydrated, storageKey, draft, pending, receipt, needsReview]);

  const approvedSkills = skills.filter((skill) => skill.versions.some((version) => version.kind === "approved"));
  const skill = approvedSkills.find((entry) => entry.id === draft.skillId);
  const version = skill?.versions.find((entry) => entry.id === draft.versionId && entry.kind === "approved");
  const locked = busy || !hydrated || !!pending || !canManage || denied;
  const targetsMatchSkill = !!skill && draft.targets.every((target) => target.module === skill.module);
  const targetChanged = (target: Target) => (assignments.find((entry) => entry.status === "active" && targetKey(entry) === targetKey(target))?.id || null) !== target.expectedAssignmentId;
  const targetsChanged = draft.targets.some(targetChanged);

  useEffect(() => {
    if (!selection || !hydrated || lastSelection.current === selection.token) return;
    lastSelection.current = selection.token;
    setOpen(true);
    if (pending) {
      setError("Recover the pending assignment before choosing another version. Its exact request has been preserved.");
      return;
    }
    const selected = skills.find((entry) => entry.id === selection.skillId);
    if (!selected) return;
    setDraft({ ...emptyDraft(), skillId: selected.id, versionId: selection.versionId, module: selected.module || "requirements", subtype: selected.subtype || "*" });
    setNeedsReview(false);
    setError(null);
    setReceipt(null);
  }, [selection, hydrated, pending, skills]);

  useEffect(() => {
    if (!open) return;
    const field = document.getElementById(selection ? "skill-assignment-version" : "skill-assignment-skill");
    if (field && !field.closest("[hidden]")) field.focus();
  }, [open, selection]);

  function persist(nextPending: SkillAssignmentBatchRequest | null, nextReceipt: SkillAssignmentBatchReceipt | null, nextDraft = draft) {
    // Before the write, failure here is a refusal to start, not an uncertain network outcome.
    sessionStorage.setItem(storageKey, JSON.stringify({ draft: nextDraft, pending: nextPending, receipt: nextReceipt, needsReview }));
  }

  function capture(target: Pick<Target, "module" | "subtype" | "operation">, ledger = assignments): Target {
    const active = ledger.find((entry) => entry.status === "active" && targetKey(entry) === targetKey(target));
    // This form changes version bindings, not their recorded precedence. Keep an existing
    // value, including nonzero values set by another native client, across capture/refresh.
    return { ...target, expectedAssignmentId: active?.id || null, precedence: active?.precedence ?? 0 };
  }

  function addTarget(target: Pick<Target, "module" | "subtype" | "operation">) {
    if (locked || loading || loadError) return;
    if (draft.targets.some((entry) => targetKey(entry) === targetKey(target))) { setError("That exact target is already selected."); return; }
    if (draft.targets.length >= 50) { setError("Choose at most 50 targets for one assignment."); return; }
    setDraft({ ...draft, targets: [...draft.targets, capture(target)] });
    setError(null);
    setReceipt(null);
  }

  async function acknowledge(result: SkillAssignmentBatchReceipt, recovered: boolean, isCurrent: () => boolean) {
    if (!isCurrent()) return;
    const savedDraft = { ...draft, targets: [] };
    // Keep a receipt visible even if storage becomes unavailable after the native commit.
    setReceipt(result);
    setPending(null);
    setDraft(savedDraft);
    setNotice(`${recovered ? "Recovered" : "Assigned"} the exact approved version across ${result.targets.length} target${result.targets.length === 1 ? "" : "s"}. Current readiness is checked separately.`);
    setError(null);
    setNeedsReview(false);
    try { persist(null, result, savedDraft); }
    catch { setError("The assignment receipt was received, but this browser could not retain it for reload. The committed request key remains visible below."); }
    await onRefresh();
  }

  async function lookup(command: SkillAssignmentBatchRequest, isCurrent: () => boolean) {
    try {
      const result = await getSkillAssignmentBatch(projectId, command.requestKey);
      if (!isCurrent()) return false;
      const expected = command.targets.map((target) => JSON.stringify([target.module.trim(), target.subtype.trim(), target.operation.trim(), target.expectedAssignmentId, target.precedence ?? 0])).sort();
      const recorded = result.receipt.targets.map((entry) => JSON.stringify([entry.target.module, entry.target.subtype, entry.target.operation, entry.before?.id ?? null, entry.after.precedence ?? 0])).sort();
      if (result.receipt.projectId !== projectId || result.receipt.actorId !== actorId || result.receipt.requestKey !== command.requestKey || result.receipt.skillDocumentId !== command.skillDocumentId || result.receipt.skillVersionId !== command.versionId || JSON.stringify(expected) !== JSON.stringify(recorded)) {
        // A known receipt for another intent is not confirmation of the form on screen.
        setPending(null); setReceipt(result.receipt); setNeedsReview(true);
        setError("This key identifies a different saved assignment request. Review that receipt and refresh the selected targets before starting a separate request.");
        return false;
      }
      await acknowledge(result.receipt, true, isCurrent);
      return true;
    } catch (cause) {
      if (!isCurrent()) return false;
      if (cause instanceof ApiError && cause.status === 403) {
        setDenied(true);
        setError("Your current permission does not allow receipt recovery. The original request is preserved; after access is restored, reload this page to check it.");
      } else {
        setNotice("The assignment outcome could not be confirmed. Check the receipt again or retry the exact saved request; no new request will be created.");
        if (!(cause instanceof ApiError && cause.status === 404)) setError(cause instanceof Error ? cause.message : "The assignment receipt is unavailable.");
      }
      return false;
    }
  }

  async function recover(command: SkillAssignmentBatchRequest) {
    if (inFlight.current || !canManage || denied) return;
    inFlight.current = true;
    const generation = ++requestGeneration.current;
    const isCurrent = () => mounted.current && generation === requestGeneration.current;
    onBusy(true);
    try { await lookup(command, isCurrent); }
    finally { if (isCurrent()) { inFlight.current = false; onBusy(false); } }
  }

  // One read on restore. Subsequent recovery is explicit, with no automatic mutation retry.
  const restoredRequest = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !pending || restoredRequest.current || !canManage) return;
    restoredRequest.current = pending.requestKey;
    void recover(pending);
    // The restored command is immutable; changes in display data must not trigger another read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, canManage]);

  async function save(command?: SkillAssignmentBatchRequest) {
    if (inFlight.current || busy || !canManage || denied || loading || loadError) return;
    if (!command && (pending || needsReview || targetsChanged || !skill || !version || !draft.targets.length || !targetsMatchSkill)) return;
    const next = command || { requestKey: crypto.randomUUID(), skillDocumentId: draft.skillId, versionId: draft.versionId, targets: draft.targets.map((target) => ({ ...target })) };
    try { persist(next, null); }
    catch { setError("This browser cannot retain the request key. No assignment request was sent; enable session storage and try again."); return; }
    inFlight.current = true;
    const generation = ++requestGeneration.current;
    const isCurrent = () => mounted.current && generation === requestGeneration.current;
    setPending(next); setReceipt(null); setError(null); setNotice(null); onBusy(true);
    try {
      const result = await assignSkillBatch(projectId, next);
      await acknowledge(result.receipt, result.replayed, isCurrent);
    } catch (cause) {
      if (!isCurrent()) return;
      if (cause instanceof ApiError && ["SKILL_ASSIGNMENT_STALE", "SKILL_ASSIGNMENT_CONFLICT"].includes(cause.code || "")) {
        setPending(null);
        setNeedsReview(true);
        setError(`${cause.message} Refresh and review the selected targets before saving again.`);
        try { persist(null, null); } catch { /* Retained old key still cannot silently write. */ }
        await onRefresh();
      } else if (!command && cause instanceof ApiError && cause.status >= 400 && cause.status < 500 && ![403, 408, 429].includes(cause.status) && cause.code !== "SKILL_ASSIGNMENT_REQUEST_CONFLICT") {
        setPending(null);
        setError(cause.message);
        try { persist(null, null); } catch { /* Retain a visible refusal. */ }
      } else {
        // A refusal on an explicit retry cannot erase uncertainty about its earlier attempt.
        // Keep the original command and try its receipt even if live access/source now differs.
        setNotice("The assignment outcome is unconfirmed. The exact saved request is retained for recovery.");
        if (cause instanceof ApiError && cause.status === 403) setDenied(true);
        setError(cause instanceof Error ? cause.message : "The assignment response was lost.");
        await lookup(next, isCurrent);
      }
    } finally { if (isCurrent()) { inFlight.current = false; onBusy(false); } }
  }

  async function reviewTargets() {
    if (locked || inFlight.current) return;
    const generation = ++requestGeneration.current;
    const isCurrent = () => mounted.current && generation === requestGeneration.current;
    inFlight.current = true; onBusy(true);
    try {
      const ledger = await listSkillAssignments(projectId);
      if (!isCurrent()) return;
      setDraft({ ...draft, targets: draft.targets.map((target) => capture(target, ledger.list)) });
      setNeedsReview(false); setError(null);
      setNotice("The target preview has been refreshed. Review each current generation and its effect, then save the complete selection.");
      await onRefresh();
    } catch (cause) { if (isCurrent()) setError(cause instanceof Error ? cause.message : "Current target bindings are unavailable."); }
    finally { if (isCurrent()) { inFlight.current = false; onBusy(false); } }
  }

  if (!canManage) return null;
  return <Card className="p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold">Assign an approved version</h2>
      <Button variant="secondary" size="sm" data-testid={open ? "skill-assignment-close" : "skill-assignment-open"} onClick={() => setOpen(!open)}>{open ? "Close assignment form" : "Assign approved version"}</Button>
    </div>
    {notice && <p role="status" className="text-sm text-[var(--muted)]">{notice}</p>}
    {error && <p role="alert" data-testid="skill-assignment-error" className="text-sm text-[var(--danger-foreground)]">{error}</p>}
    {pending && <div className="space-y-2 rounded-lg border border-[var(--warning-border)] p-3" data-testid="skill-assignment-pending">
      <p className="text-sm">Assignment outcome unconfirmed. Keep the original request until the native receipt is available.</p>
      <p className="break-all text-xs font-mono">Request: {pending.requestKey} · version: {pending.versionId}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={busy || denied} onClick={() => void recover(pending)} data-testid="skill-assignment-recover">Check saved receipt</Button>
        <Button size="sm" disabled={busy || denied || loading || !!loadError} onClick={() => void save(pending)} data-testid="skill-assignment-retry">Retry exact request</Button>
      </div>
    </div>}
    {receipt && <div className="rounded-lg border border-[var(--border)] p-3 space-y-1 text-xs" data-testid="skill-assignment-receipt">
      <h3 className="font-semibold">Saved assignment receipt</h3>
      <p>Recorded <time dateTime={receipt.committedAt}>{new Date(receipt.committedAt).toLocaleString()}</time>. This records the completed request; current bindings may since have changed.</p>
      <p className="break-all">Request: <span className="font-mono">{receipt.requestKey}</span> · version: <span className="font-mono">{receipt.skillVersionId}</span></p>
      <p className="break-all">Content digest: <span className="font-mono">{receipt.contentDigest}</span></p>
      {receipt.targets.map((entry) => <p key={targetKey(entry.target)}>{targetLabel(entry.target)}: {entry.outcome.replaceAll("_", " ")} · generation <span className="font-mono">{entry.after.id}</span></p>)}
    </div>}
    {open && <div className="space-y-3" data-testid="skill-assignment-form">
      <p className="text-sm text-[var(--muted)]">Choose an exact approved version and its targets. All selected changes save together. Existing assignments outside this selection retain their version pins.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field><FieldLabel htmlFor="skill-assignment-skill">Approved skill</FieldLabel><Select id="skill-assignment-skill" data-testid="skill-assignment-skill" value={draft.skillId} disabled={locked} onChange={(event) => {
          const selected = skills.find((entry) => entry.id === event.target.value);
          setDraft({ ...emptyDraft(), skillId: selected?.id || "", versionId: selected?.approvedVersionId || "", module: selected?.module || "requirements", subtype: selected?.subtype || "*" });
          setNeedsReview(false); setError(null); setReceipt(null);
        }}><option value="">Choose an approved skill…</option>{approvedSkills.map((entry) => <option key={entry.id} value={entry.id}>{entry.skillKey || entry.title} ({entry.module}/{entry.subtype})</option>)}</Select></Field>
        <Field><FieldLabel htmlFor="skill-assignment-version">Exact approved version</FieldLabel><Select id="skill-assignment-version" data-testid="skill-assignment-version" value={draft.versionId} disabled={locked || !skill} onChange={(event) => { setDraft({ ...draft, versionId: event.target.value }); setReceipt(null); }}><option value="">Choose a version…</option>{skill?.versions.filter((entry) => entry.kind === "approved").map((entry) => <option key={entry.id} value={entry.id}>v{entry.versionNumber} · {new Date(entry.createdAt).toLocaleString()}{entry.id === skill.approvedVersionId ? " · latest approved" : " · historical approved"}</option>)}</Select></Field>
      </div>
      {version && <p className="text-xs break-all" data-testid="skill-assignment-exact-version">{skill?.title} · v{version.versionNumber} · version {version.id} · digest {version.contentDigest || "not recorded"}</p>}
      <fieldset disabled={locked || !skill || loading || !!loadError} className="space-y-2">
        <legend className="text-sm font-semibold">Applies when</legend>
        <p className="text-xs text-[var(--muted)]">Work Package A shortcuts use its three verified contexts. Other existing authoring contexts can be entered below.</p>
        {SKILL_WORK_PACKAGE_A_TARGETS.filter((target) => target.module === skill?.module).map((target) => <label key={target.operation} className="flex items-center gap-2 text-sm">
          <input type="checkbox" data-testid={`skill-target-${target.operation}`} checked={draft.targets.some((entry) => targetKey(entry) === targetKey(target))} onChange={(event) => event.target.checked ? addTarget(target) : setDraft({ ...draft, targets: draft.targets.filter((entry) => targetKey(entry) !== targetKey(target)) })} />
          {targetLabel(target)}
        </label>)}
        <div className="grid gap-3 md:grid-cols-3">
          <Field><FieldLabel htmlFor="skill-assignment-module">Module of the selected skill</FieldLabel><Select id="skill-assignment-module" data-testid="skill-assignment-module" value={skill?.module || draft.module} disabled>{SKILL_MODULES.map((module) => <option key={module} value={module}>{module}</option>)}</Select></Field>
          <Field><FieldLabel htmlFor="skill-assignment-subtype">Subtype</FieldLabel><Input id="skill-assignment-subtype" data-testid="skill-assignment-subtype" value={draft.subtype} maxLength={32} onChange={(event) => setDraft({ ...draft, subtype: event.target.value })} /></Field>
          <Field><FieldLabel htmlFor="skill-assignment-operation">Operation</FieldLabel><Input id="skill-assignment-operation" data-testid="skill-assignment-operation" value={draft.operation} maxLength={64} onChange={(event) => setDraft({ ...draft, operation: event.target.value })} /></Field>
        </div>
        <p className="text-xs text-[var(--muted)]">Blank subtype or operation means all (*). Targets use the selected skill&apos;s module; the native owner validates overlapping scopes.</p>
        <Button size="sm" variant="secondary" data-testid="skill-assignment-add-target" disabled={locked || !skill || draft.targets.length >= 50 || loading || !!loadError} onClick={() => addTarget({ module: skill?.module || draft.module, subtype: draft.subtype.trim() || "*", operation: draft.operation.trim() || "*" })}>Add context</Button>
      </fieldset>
      <div className="space-y-2" data-testid="skill-assignment-preview">
        <h3 className="text-sm font-semibold">Review {draft.targets.length} selected target{draft.targets.length === 1 ? "" : "s"}</h3>
        {draft.targets.map((target) => {
          const before = assignments.find((entry) => entry.id === target.expectedAssignmentId);
          const satisfied = before?.skillDocumentId === draft.skillId && before?.skillVersionId === draft.versionId && (before?.precedence || 0) === (target.precedence || 0);
          return <div key={targetKey(target)} className="rounded-lg border border-[var(--border)] p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><p>{targetLabel(target)} · {targetChanged(target) ? "Current generation changed — review again" : target.expectedAssignmentId === null ? "Add assignment" : satisfied ? "Already satisfied — preserve generation" : "Replace reviewed generation"}</p><Button size="sm" variant="secondary" disabled={locked} onClick={() => setDraft({ ...draft, targets: draft.targets.filter((entry) => targetKey(entry) !== targetKey(target)) })} aria-label={`Remove ${targetLabel(target)}`}>Remove</Button></div>
            <p className="break-all">Expected current generation: {target.expectedAssignmentId || "none"}{before ? ` · v${before.versionNumber ?? "?"} · version ${before.skillVersionId} · recorded priority ${target.precedence ?? 0} retained` : ""}</p>
          </div>;
        })}
      </div>
      {!!draft.targets.length && <Button size="sm" variant="secondary" disabled={locked} data-testid="skill-assignment-review-targets" onClick={() => void reviewTargets()}>Refresh and review targets</Button>}
      {(needsReview || targetsChanged) && <p className="text-sm text-[var(--warning-foreground)]">The reviewed effect changed. Refresh the target preview before saving this selection.</p>}
      {!targetsMatchSkill && !!draft.targets.length && <p className="text-sm text-[var(--danger-foreground)]">Remove targets outside the selected skill&apos;s module before saving.</p>}
      <Button data-testid="skill-assign" onClick={() => void save()} disabled={locked || loading || !!loadError || !version || !draft.targets.length || needsReview || targetsChanged || !targetsMatchSkill}>Assign approved version to selected targets</Button>
    </div>}
  </Card>;
}
