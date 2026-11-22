"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError, getTestCase, listTestCases, type TestCaseListItem } from "@/lib/api";
import {
  createNativeRequirement, getNativeRequirement, linkNativeRequirement, listNativeRequirements,
  nativeRequirementPath, retireNativeRequirementLink, reviseNativeRequirement, stageNativeRequirementCases,
  type NativeCaseFields, type NativeCaseProposalOperation, type NativeRequirementCapability,
  type NativeRequirementContent, type NativeRequirementDetail, type NativeRequirementSubmission, type NativeRequirementVersion,
} from "@/lib/nativeRequirements";
import { Button, Card, ConfirmModal, Field, FieldLabel, Input, Modal, PageLoader, Select, StatusChip, Textarea } from "@/components/ui";
import { formatDateTime } from "@/lib/date";

const linkClass = "font-medium text-[var(--accent-light)] underline underline-offset-2";
const errorClass = "rounded-lg border border-[var(--error)]/40 bg-[var(--error-soft)] p-3 text-sm text-[var(--error-foreground)]";
const text = (value: unknown) => typeof value === "string" ? value : "";
const message = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed.";
const uncertainWrite = (error: unknown) => !(error instanceof ApiError) || (error.status >= 500 && error.status !== 501);

function ExactValue({ label, value }: { label: string; value: string | null }) {
  return <div className="min-w-0"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 break-all font-mono text-xs">{value || "Not available"}</dd></div>;
}

function VersionContent({ version }: { version: NativeRequirementVersion }) {
  return <div className="space-y-3">
    <h3 className="text-lg font-semibold">{version.title}</h3>
    {version.description && <p className="whitespace-pre-wrap text-sm">{version.description}</p>}
    <ul className="space-y-2 text-sm">{version.criteria.map(criterion => <li key={criterion.key} className="rounded-lg border border-[var(--border)] p-3"><strong>{criterion.key}</strong><p className="mt-1 whitespace-pre-wrap">{criterion.text}</p></li>)}</ul>
    {version.rationale && <p className="whitespace-pre-wrap text-sm"><strong>Rationale: </strong>{version.rationale}</p>}
    {version.sourceRefs.length > 0 && <div className="space-y-1 text-sm"><h4 className="font-semibold">Authoring sources</h4>{version.sourceRefs.map((source, index) => /^https?:\/\//i.test(source.url)
      ? <p key={`${source.url}-${index}`}><a href={source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{source.label}</a></p>
      : <p key={`${source.url}-${index}`}>{source.label}: {source.url}</p>)}</div>}
    <dl className="grid gap-3 rounded-lg bg-[var(--surface-secondary)] p-3 sm:grid-cols-2">
      <ExactValue label="Proposal operation ID" value={version.id} />
      <ExactValue label="Content digest" value={version.contentDigest} />
      <ExactValue label="Previous proposal operation ID" value={version.parentVersionId} />
      <ExactValue label="Author ID" value={version.createdBy} />
    </dl>
    <details className="text-sm"><summary className="cursor-pointer font-medium">Authoring provenance</summary><dl className="mt-2 grid gap-3 sm:grid-cols-2"><ExactValue label="Producer kind" value={version.provenance.kind} /><ExactValue label="Attributed actor ID" value={version.provenance.actorId} /><ExactValue label="Credential issuer ID" value={version.provenance.issuerId} /><ExactValue label="Transport" value={version.provenance.transport} /></dl>{!version.provenance.actorId && <p className="mt-2 text-xs text-[var(--muted)]">The credential issuer is recorded; an authoring actor has not been attributed.</p>}</details>
    <p className="text-xs text-[var(--muted)]">Saved {formatDateTime(version.createdAt)}. Unpublished; effective skill authority was unavailable.</p>
  </div>;
}

type EditorBase = { requirementId: string; key: string; version: NativeRequirementVersion };
type EditorStart = { base?: EditorBase; content: NativeRequirementContent; submissionKey: string; openedRequirementId: string | null };

function contentOf(version: NativeRequirementVersion): NativeRequirementContent {
  return { title: version.title, description: version.description, criteria: version.criteria.map(item => ({ ...item })), rationale: version.rationale, sourceRefs: version.sourceRefs.map(item => ({ ...item })) };
}

function RequirementEditor({ projectId, initial, onClose, onSaved }: {
  projectId: string; initial: EditorStart; onClose: () => void; onSaved: (detail: NativeRequirementSubmission) => void;
}) {
  const [content, setContent] = useState(initial.content);
  const [base, setBase] = useState(initial.base);
  const [submissionKey, setSubmissionKey] = useState(initial.submissionKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<NativeRequirementVersion | null>(null);
  const alive = useRef(true);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLFormElement>(null);
  const title = base ? "Revise requirement proposal" : "New requirement proposal";
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLElement>("input")?.focus();
    return () => { alive.current = false; if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);

  async function save() {
    if (inFlight.current || conflict) return;
    if (!content.title.trim() || !content.criteria.length || content.criteria.some(item => !item.key.trim() || !item.text.trim()) || new Set(content.criteria.map(item => item.key.trim())).size !== content.criteria.length) {
      setError("Add a title and at least one acceptance criterion. Each criterion needs a unique key and text.");
      return;
    }
    if (content.sourceRefs.some(source => !source.label.trim() || !/^https?:\/\//i.test(source.url))) {
      setError("Each source needs a label and an http or https URL.");
      return;
    }
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const body = { ...content, submissionKey };
      const result = base
        ? await reviseNativeRequirement(projectId, base.requirementId, { ...body, expectedVersionId: base.version.id, expectedContentDigest: base.version.contentDigest })
        : await createNativeRequirement(projectId, body);
      if (alive.current) onSaved(result);
    } catch (cause) {
      if (!alive.current) return;
      setError(message(cause));
      setUnconfirmed(uncertainWrite(cause));
      setConflict(cause instanceof ApiError && cause.status === 409);
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  async function readLatest() {
    if (!base || inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const result = await getNativeRequirement(projectId, base.requirementId);
      if (alive.current) setLatest(result.requirement.currentVersion);
    } catch (cause) { if (alive.current) setError(message(cause)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  const locked = busy || unconfirmed;
  return <Modal open onClose={() => { if (!busy) onClose(); }} title={title} className="max-w-3xl">
    <form ref={dialog} role="dialog" aria-modal="true" aria-label={title} className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => {
      if (event.key !== "Tab") return;
      const fields = Array.from(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),textarea:not(:disabled),button:not(:disabled),a[href]') || []);
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <p className="text-sm text-[var(--muted)]">Save this requirement candidate in a shared proposal review task. Publication and approval are blocked while effective skill authority is unavailable.</p>
      {base && <p className="break-all text-xs">Editing {base.key}, version {base.version.versionNumber} · {base.version.id}</p>}
      {error && <p role="alert" className={errorClass}>{error}</p>}
      {unconfirmed && <p className="text-sm">The save outcome is unconfirmed. Your text and submission key are preserved. Check the same submission before changing it.</p>}
      {conflict && <div className="space-y-3 rounded-lg border border-[var(--warning-border)] p-3">
        <p className="text-sm">Your text is preserved. Review the current saved revision before choosing a new editing base.</p>
        {base && <Button variant="secondary" disabled={busy} onClick={() => void readLatest()}>Review latest saved revision</Button>}
        {latest && <><VersionContent version={latest} /><Button variant="secondary" onClick={() => { setBase(current => current && ({ ...current, version: latest })); setSubmissionKey(crypto.randomUUID()); setConflict(false); setUnconfirmed(false); setError(null); setLatest(null); }}>Keep my text and use this base</Button></>}
      </div>}
      <Field><FieldLabel htmlFor="native-requirement-title">Title</FieldLabel><Input id="native-requirement-title" value={content.title} disabled={locked} onChange={event => setContent({ ...content, title: event.target.value })} required /></Field>
      <Field><FieldLabel htmlFor="native-requirement-description">Description</FieldLabel><Textarea id="native-requirement-description" rows={4} value={content.description} disabled={locked} onChange={event => setContent({ ...content, description: event.target.value })} /></Field>
      <fieldset disabled={locked} className="space-y-3"><legend className="mb-2 text-sm font-semibold">Acceptance criteria</legend>
        {content.criteria.map((criterion, index) => <div key={index} className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[8rem_1fr_auto]">
          <Field><FieldLabel htmlFor={`native-criterion-key-${index}`}>Criterion {index + 1} key</FieldLabel><Input id={`native-criterion-key-${index}`} value={criterion.key} required onChange={event => setContent({ ...content, criteria: content.criteria.map((item, row) => row === index ? { ...item, key: event.target.value } : item) })} /></Field>
          <Field><FieldLabel htmlFor={`native-criterion-text-${index}`}>Criterion {index + 1} text</FieldLabel><Textarea id={`native-criterion-text-${index}`} rows={2} value={criterion.text} required onChange={event => setContent({ ...content, criteria: content.criteria.map((item, row) => row === index ? { ...item, text: event.target.value } : item) })} /></Field>
          <Button variant="ghost" className="self-end" aria-label={`Remove criterion ${index + 1}`} disabled={locked || content.criteria.length === 1} onClick={() => setContent({ ...content, criteria: content.criteria.filter((_, row) => row !== index) })}>Remove</Button>
        </div>)}
        <Button variant="secondary" onClick={() => { let next = content.criteria.length + 1; while (content.criteria.some(item => item.key === `AC-${next}`)) next += 1; setContent({ ...content, criteria: [...content.criteria, { key: `AC-${next}`, text: "" }] }); }}>Add criterion</Button>
      </fieldset>
      <Field><FieldLabel htmlFor="native-requirement-rationale">Rationale</FieldLabel><Textarea id="native-requirement-rationale" rows={2} value={content.rationale} disabled={locked} onChange={event => setContent({ ...content, rationale: event.target.value })} /></Field>
      <fieldset disabled={locked} className="space-y-2"><legend className="mb-2 text-sm font-semibold">Authoring sources (optional)</legend>
        {content.sourceRefs.map((source, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Field><FieldLabel htmlFor={`native-source-label-${index}`}>Source {index + 1} label</FieldLabel><Input id={`native-source-label-${index}`} value={source.label} onChange={event => setContent({ ...content, sourceRefs: content.sourceRefs.map((item, row) => row === index ? { ...item, label: event.target.value } : item) })} /></Field>
          <Field><FieldLabel htmlFor={`native-source-url-${index}`}>Source {index + 1} URL</FieldLabel><Input id={`native-source-url-${index}`} type="url" value={source.url} onChange={event => setContent({ ...content, sourceRefs: content.sourceRefs.map((item, row) => row === index ? { ...item, url: event.target.value } : item) })} /></Field>
          <Button variant="ghost" className="self-end" aria-label={`Remove source ${index + 1}`} onClick={() => setContent({ ...content, sourceRefs: content.sourceRefs.filter((_, row) => row !== index) })}>Remove</Button>
        </div>)}
        <Button variant="secondary" onClick={() => setContent({ ...content, sourceRefs: [...content.sourceRefs, { label: "", url: "" }] })}>Add source</Button>
      </fieldset>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || conflict}>{busy ? "Saving…" : unconfirmed ? "Check saved submission" : "Save proposal"}</Button></div>
    </form>
  </Modal>;
}

export default function NativeRequirementProposals({ projectId, active, requirementId, versionId }: {
  projectId: string; active: boolean; requirementId: string | null; versionId: string | null;
}) {
  const router = useRouter();
  const [list, setList] = useState<Awaited<ReturnType<typeof listNativeRequirements>> | null>(null);
  const [detail, setDetail] = useState<NativeRequirementDetail | null>(null);
  const [listLoading, setListLoading] = useState(active);
  const [detailLoading, setDetailLoading] = useState(active && Boolean(requirementId));
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<EditorStart | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [readScope, setReadScope] = useState({ active, projectId, offset, requirementId, refresh });
  const listRequest = useRef(0), detailRequest = useRef(0);
  const currentRoute = useRef({ active, requirementId });
  useLayoutEffect(() => { currentRoute.current = { active, requirementId }; }, [active, requirementId]);

  // Read inputs change before an effect starts its request. Mark retained data as unverified
  // in that same render, so a newly selected project/version cannot briefly authorize a write.
  if (readScope.active !== active || readScope.projectId !== projectId || readScope.offset !== offset || readScope.requirementId !== requirementId || readScope.refresh !== refresh) {
    setReadScope({ active, projectId, offset, requirementId, refresh });
    if (readScope.active !== active || readScope.projectId !== projectId || readScope.offset !== offset || readScope.refresh !== refresh) { setListLoading(active); setListError(null); }
    if (readScope.active !== active || readScope.projectId !== projectId || readScope.requirementId !== requirementId || readScope.refresh !== refresh) { setDetailLoading(active && Boolean(requirementId)); setDetailError(null); }
  }

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const generation = ++listRequest.current;
    void listNativeRequirements(projectId, offset, controller.signal).then(result => {
      if (generation === listRequest.current && !controller.signal.aborted) setList(result);
    }).catch(cause => { if (!controller.signal.aborted && generation === listRequest.current) setListError(message(cause)); })
      .finally(() => { if (!controller.signal.aborted && generation === listRequest.current) setListLoading(false); });
    return () => { controller.abort(); listRequest.current += 1; };
  }, [active, projectId, offset, refresh]);

  useEffect(() => {
    if (!active || !requirementId) return;
    const controller = new AbortController();
    const generation = ++detailRequest.current;
    void getNativeRequirement(projectId, requirementId, controller.signal).then(result => {
      if (generation === detailRequest.current && !controller.signal.aborted) setDetail(result);
    }).catch(cause => { if (!controller.signal.aborted && generation === detailRequest.current) setDetailError(message(cause)); })
      .finally(() => { if (!controller.signal.aborted && generation === detailRequest.current) setDetailLoading(false); });
    return () => { controller.abort(); detailRequest.current += 1; };
  }, [active, projectId, requirementId, refresh]);

  const selected = detail?.requirement.id === requirementId ? detail : null;
  const capability = list?.capability || selected?.capability;
  const canAuthor = list?.capability.mode === "unpublished_proposals_only" && list.capability.enabled && !listError && !listLoading;
  const version = versionId ? selected?.versions.find(item => item.id === versionId) : selected?.requirement.currentVersion;
  const currentVersion = version?.id === selected?.requirement.currentVersion.id;
  const detailReady = Boolean(selected && !detailError && !detailLoading);

  function startNew() {
    setEditor({ submissionKey: crypto.randomUUID(), openedRequirementId: requirementId, content: { title: "", description: "", criteria: [{ key: "AC-1", text: "" }], rationale: "", sourceRefs: [] } });
  }

  function saved(result: NativeRequirementSubmission) {
    setEditor(null); setDetail(result); setDetailError(null); setRefresh(value => value + 1);
    const accepted = result.versions.find(item => item.id === result.submission.versionId);
    const acceptedLabel = accepted ? `version ${accepted.versionNumber}` : `version ${result.submission.versionId}`;
    const newerHead = result.submission.versionId !== result.requirement.currentVersion.id;
    setNotice(`${result.requirement.key} ${acceptedLabel} ${result.submission.replayed ? "was already saved; the same submission is confirmed" : "saved as an unpublished proposal"}.${newerHead ? ` Current head is version ${result.requirement.currentVersion.versionNumber}; this submission did not create that later revision.` : ""}`);
    // A completed write must not navigate a user who switched to another requirement meanwhile.
    const origin = editor?.openedRequirementId;
    if (currentRoute.current.active && currentRoute.current.requirementId === origin) router.replace(nativeRequirementPath(projectId, result.requirement.id, newerHead ? result.submission.versionId : undefined), { scroll: false });
  }

  return <div className="space-y-5" data-testid="native-requirement-proposals">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Native requirement proposals</h2><p className="mt-1 text-sm text-[var(--muted)]">Prepare requirement candidates and case changes together for review.</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => setRefresh(value => value + 1)} disabled={listLoading || detailLoading}>Refresh proposals</Button><Button onClick={startNew} disabled={!canAuthor}>New requirement proposal</Button></div></div>
    {capability && <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm" data-testid="native-requirement-governance"><p className="font-semibold">Publication and approval are blocked</p><p className="mt-1">Effective skill authority is unavailable. Requirements, case changes and proposed associations share one review task. No requirement has been published to the Knowledge Base; existing testcase approval and run results remain separate.</p>{!capability.enabled && <p className="mt-2 font-medium">Native proposal authoring is disabled for this deployment. Saved history remains readable.</p>}</div>}
    {notice && <p role="status" className="rounded-lg border border-[var(--border)] p-3 text-sm">{notice}</p>}
    {listError && <p role="alert" className={errorClass}>{listError} Proposal availability is unknown; this does not mean the project has no proposals.</p>}
    {listLoading && !list && <PageLoader variant="content" />}
    {list && <Card className="overflow-hidden"><div className="border-b border-[var(--border)] px-4 py-3 text-sm">{listError || listLoading ? "Last loaded proposals" : `${list.total} unpublished proposal${list.total === 1 ? "" : "s"}`}</div>
      {list.list.length ? <ul className="divide-y divide-[var(--border)]">{list.list.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4"><div><Link className={linkClass} href={nativeRequirementPath(projectId, item.id)}>{item.key}: {item.currentVersion.title}</Link><p className="mt-1 text-xs text-[var(--muted)]">Version {item.currentVersion.versionNumber} · {formatDateTime(item.updatedAt)}</p></div><StatusChip tone="neutral">{item.state === "retired" ? "Retired proposal" : "Unpublished"}</StatusChip></li>)}</ul>
        : !listError && !listLoading && <p className="p-5 text-sm text-[var(--muted)]">No native requirement proposals have been saved in this project.</p>}
      {list.total > 25 && <div className="flex items-center justify-center gap-3 border-t border-[var(--border)] p-3"><Button variant="secondary" disabled={!offset || listLoading} onClick={() => setOffset(value => Math.max(0, value - 25))}>Previous proposals</Button><span className="text-sm">Page {Math.floor(offset / 25) + 1}</span><Button variant="secondary" disabled={offset + 25 >= list.total || listLoading} onClick={() => setOffset(value => value + 25)}>Next proposals</Button></div>}
    </Card>}
    {detailError && <p role="alert" className={errorClass}>{detailError} Any displayed version is last-known content. Refresh before making a change.</p>}
    {requirementId && detailLoading && !selected && <PageLoader variant="content" />}
    {selected && <>
      <Card className="space-y-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.requirement.key}: {selected.requirement.currentVersion.title}</h2><p className="mt-1 text-sm text-[var(--muted)]">{selected.requirement.state === "retired" ? "Retired unpublished proposal" : "Unpublished requirement proposal"}</p></div><Button variant="secondary" disabled={!canAuthor || !detailReady || selected.requirement.state !== "draft"} onClick={() => setEditor({ submissionKey: crypto.randomUUID(), openedRequirementId: requirementId, base: { requirementId: selected.requirement.id, key: selected.requirement.key, version: selected.requirement.currentVersion }, content: contentOf(selected.requirement.currentVersion) })}>Revise proposal</Button></div>
        <div className="flex flex-wrap items-center gap-3 text-sm"><Link href={`/projects/${projectId}/agents/tasks/${selected.requirement.taskId}`} className={linkClass}>Review this shared proposal task</Link><span className="text-[var(--muted)]">Requirement publication: blocked</span></div>
        <div><h3 className="text-sm font-semibold">Revision history</h3><div className="mt-2 flex flex-wrap gap-3">{selected.versions.map(item => <Link key={item.id} aria-current={item.id === version?.id ? "page" : undefined} className={linkClass} href={nativeRequirementPath(projectId, selected.requirement.id, item.id)}>Version {item.versionNumber}{item.id === selected.requirement.currentVersion.id ? " (current)" : ""}</Link>)}</div></div>
        {version ? <><StatusChip tone={currentVersion ? "neutral" : "warning"}>{currentVersion ? "Current proposal revision" : "Historical proposal revision"}</StatusChip><VersionContent version={version} /></> : <p role="alert" className={errorClass}>This version was not found in the proposal history. Choose a saved revision.</p>}
      </Card>
      <Card className="space-y-3 p-5"><h3 className="font-semibold">Proposal traceability and verification</h3><p className="text-sm text-[var(--muted)]">These readings describe the current proposal revision. Proposed associations do not establish approved requirement coverage.</p><dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Proposed associations", selected.coverage.proposedLinkCount],
          ["Current associations", selected.coverage.currentProposedLinkCount],
          ["Stale associations", selected.coverage.staleProposedLinkCount],
          ["Approval", "Blocked"], ["Execution", "Unavailable"], ["Passing", "Unavailable"],
        ].map(([label, value]) => <div key={label} className="rounded-lg border border-[var(--border)] p-3"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 text-lg font-semibold">{detailReady ? value : "Unverified"}</dd></div>)}
        </dl><p className="text-sm text-[var(--muted)]">No requirement-bound execution evidence is available in this proposal flow. Re-linking a case never makes an older Passed run verify a new criterion revision.</p>
      </Card>
      <Card className="space-y-4 p-5"><h3 className="font-semibold">Proposed case associations</h3>
        {selected.links.length ? <ul className="space-y-3">{selected.links.map(link => <li key={link.id} data-testid={`native-requirement-association-${link.id}`} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <div className="flex flex-wrap justify-between gap-2"><Link href={`/projects/${projectId}/testcases/${encodeURIComponent(link.testcaseId)}`} className={linkClass}>{link.case ? `${link.case.externalId}: ${link.case.title}` : link.testcaseId}</Link><StatusChip tone={link.retiredAt || link.staleReasons.length ? "warning" : "neutral"}>{!detailReady ? "Unverified" : link.retiredAt ? "Retired association" : link.current ? "Current proposal association" : "Stale association"}</StatusChip></div>
          <p className="text-sm">Criteria: {link.criterionKeys.join(", ")} · <Link className={linkClass} href={nativeRequirementPath(projectId, selected.requirement.id, link.requirementVersionId)}>Inspect linked proposal revision</Link></p>
          {link.staleReasons.length > 0 && <p className="break-words text-sm text-[var(--warning-foreground)]">Stale reasons: {link.staleReasons.join(", ")}</p>}
          <dl className="grid gap-2 sm:grid-cols-2"><ExactValue label="Linked testcase revision" value={link.testcaseRevision} /><ExactValue label="Linked testcase approval revision" value={link.testcaseApprovalRevision} /><ExactValue label="Linked requirement digest" value={link.requirementContentDigest} /></dl>
          <p className="text-xs text-[var(--muted)]">Saved case status: {detailReady ? link.case?.status || "Unavailable" : "Unverified"}. Case approval: {!detailReady ? "Unverified" : link.case ? link.case.approvalCurrent ? "Current exact human approval" : "No current exact human approval" : "Unavailable"}. Requirement approval remains blocked.</p>
          <details className="text-sm"><summary className="cursor-pointer font-medium">Inspect saved association content and provenance</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify({ submissionKey: link.submissionKey, caseSnapshot: link.caseSnapshot, provenance: link.provenance, retirementProvenance: link.retirementProvenance }, null, 2)}</pre></details>
          {!link.retiredAt && <RetireAssociation projectId={projectId} requirementId={selected.requirement.id} linkId={link.id} enabled={Boolean(canAuthor && detailReady)} onRetired={() => { setNotice("Proposed association retired. Its history remains available; a new exact association can now be prepared."); setRefresh(value => value + 1); }} />}
        </li>)}</ul> : <p className="text-sm text-[var(--muted)]">{detailReady ? "No proposed case associations are recorded." : "Association status is unverified."}</p>}
        <div hidden={!currentVersion}><CasePreparation key={selected.requirement.id} projectId={projectId} requirementId={selected.requirement.id} requirementKey={selected.requirement.key} version={selected.requirement.currentVersion} capability={selected.capability} retired={selected.requirement.state === "retired"} enabled={Boolean(canAuthor && detailReady && selected.capability.enabled && currentVersion && selected.requirement.state === "draft")} onRefresh={() => setRefresh(value => value + 1)} onSaved={notice => { setNotice(notice); setRefresh(value => value + 1); }} /></div>
        {!currentVersion && selected.requirement.state === "draft" && <p className="text-sm">Open the current revision to prepare case changes. Any unsaved case preparation is kept while you inspect this history.</p>}
      </Card>
      <Card className="space-y-3 p-5"><h3 className="font-semibold">Staged case changes</h3>{selected.caseProposals.length ? <ul className="space-y-3">{selected.caseProposals.map(proposal => <li key={proposal.id} className="rounded-lg border border-[var(--border)] p-3"><p className="font-medium">{proposal.title}</p><p className="mt-1 text-sm text-[var(--muted)]">{proposal.taskStatus} · Criteria {proposal.criterionKeys.join(", ")} · {proposal.requirementVersionId === selected.requirement.currentVersion.id ? "Current requirement revision" : "Historical requirement revision"}</p><div className="mt-2 flex flex-wrap gap-3"><Link href={`/projects/${projectId}/agents/tasks/${proposal.id}`} className={linkClass}>Open shared proposal review</Link><Link href={nativeRequirementPath(projectId, selected.requirement.id, proposal.requirementVersionId)} className={linkClass}>Inspect requirement basis</Link></div></li>)}</ul> : <p className="text-sm text-[var(--muted)]">No staged case changes are recorded for this proposal.</p>}</Card>
    </>}
    {editor && <RequirementEditor key={editor.submissionKey} projectId={projectId} initial={editor} onClose={() => setEditor(null)} onSaved={saved} />}
  </div>;
}

function RetireAssociation({ projectId, requirementId, linkId, enabled, onRetired }: {
  projectId: string; requirementId: string; linkId: string; enabled: boolean; onRetired: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true), inFlight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function retire() {
    if (inFlight.current || !enabled) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      await retireNativeRequirementLink(projectId, requirementId, linkId);
      if (alive.current) { setOpen(false); onRetired(); }
    } catch (cause) { if (alive.current) setError(message(cause)); }
    finally { inFlight.current = false; if (alive.current) setBusy(false); }
  }

  return <>
    <Button variant="secondary" size="sm" disabled={!enabled || busy} onClick={() => { setError(null); setOpen(true); }}>Retire proposed association</Button>
    <ConfirmModal open={open} title="Retire proposed association?" message="The association will remain in history and stop being active. You can then associate the current exact case revision. The testcase and its executions are unchanged." confirmLabel="Retire association" loadingLabel="Retiring…" loading={busy} error={error} onConfirm={() => void retire()} onCancel={() => { if (!busy) setOpen(false); }} />
  </>;
}

interface PinnedCase {
  id: string;
  externalId: string;
  title: string;
  editRevision: string;
  approvalRevision: string | null;
  approvalCurrent: boolean;
  record: Record<string, unknown>;
}

function pinCase(id: string, record: Record<string, unknown>): PinnedCase {
  if (!text(record.editRevision) || !text(record.approvalRevision)) throw new Error("The saved case revision could not be verified. Reload the case before preparing an association or change.");
  return { id, externalId: text(record.externalId), title: text(record.title), editRevision: text(record.editRevision), approvalRevision: record.approvalCurrent === true ? text(record.approvalRevision) : null, approvalCurrent: record.approvalCurrent === true, record };
}

function caseFields(record: Record<string, unknown> = {}): NativeCaseFields {
  let rawSteps = record.steps;
  if (typeof rawSteps === "string") { try { rawSteps = JSON.parse(rawSteps); } catch { rawSteps = []; } }
  const steps = Array.isArray(rawSteps) ? rawSteps.filter(item => item && typeof item === "object").map(item => ({ action: text(item.action), expectedResult: text(item.expectedResult) })) : [];
  return { title: text(record.title), description: text(record.description), preconditions: text(record.preconditions), postconditions: text(record.postconditions), testData: text(record.testData), steps: steps.length ? steps : [{ action: "", expectedResult: "" }] };
}

type PreparationMode = "associate" | "create" | "update" | "archive";
type StageBody = Parameters<typeof stageNativeRequirementCases>[2];
type AssociationBody = Parameters<typeof linkNativeRequirement>[2];
type PendingWrite = { mode: "associate"; body: AssociationBody } | { mode: "stage"; body: StageBody };

function CasePreparation({ projectId, requirementId, requirementKey, version, capability, retired, enabled, onSaved, onRefresh }: {
  projectId: string; requirementId: string; requirementKey: string; version: NativeRequirementVersion;
  capability: NativeRequirementCapability; retired: boolean; enabled: boolean; onSaved: (notice: string) => void; onRefresh: () => void;
}) {
  const [basis, setBasis] = useState(version);
  const [mode, setMode] = useState<PreparationMode>("associate");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TestCaseListItem[] | null>(null);
  const [target, setTarget] = useState<PinnedCase | null>(null);
  const [targetReviewed, setTargetReviewed] = useState(false);
  const [createFields, setCreateFields] = useState<NativeCaseFields>(() => caseFields());
  const [updateFields, setUpdateFields] = useState<NativeCaseFields>(() => caseFields());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [recoverableStaging, setRecoverableStaging] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<{ version: NativeRequirementVersion; target: PinnedCase | null } | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submittedOperationId, setSubmittedOperationId] = useState<string | null>(null);
  const alive = useRef(true), mutation = useRef(false);
  const searchRequest = useRef(0), targetRequest = useRef(0);
  const pending = useRef<PendingWrite | null>(null);
  const stageIdentity = useRef<{ content: string; requestKey: string } | null>(null);
  const associationIdentity = useRef<{ content: string; submissionKey: string } | null>(null);
  const fields = mode === "create" ? createFields : updateFields;
  const setFields = mode === "create" ? setCreateFields : setUpdateFields;
  const changedBasis = basis.id !== version.id;
  const locked = busy || unconfirmed || retired;
  const canCheckSubmission = unconfirmed && (!retired || recoverableStaging);
  const ready = enabled && !retired && !busy && !loadingTarget && criteria.length > 0 && (mode === "create" || Boolean(target && targetReviewed)) && !conflict && !changedBasis && (mode === "associate" || capability.canStageCaseProposals);
  useEffect(() => { alive.current = true; return () => { alive.current = false; searchRequest.current += 1; targetRequest.current += 1; }; }, []);

  async function searchCases() {
    if (locked) return;
    const generation = ++searchRequest.current;
    setSearching(true); setError(null);
    try {
      const response = await listTestCases(projectId, { search: search.trim(), limit: 20, offset: 0 });
      if (alive.current && generation === searchRequest.current) setResults(response.list);
    } catch (cause) { if (alive.current && generation === searchRequest.current) { setResults(null); setError(message(cause)); } }
    finally { if (alive.current && generation === searchRequest.current) setSearching(false); }
  }

  async function chooseCase(id: string) {
    if (locked) return;
    const generation = ++targetRequest.current;
    setLoadingTarget(true); setTargetReviewed(false); setError(null);
    try {
      const selected = pinCase(id, await getTestCase(projectId, id));
      if (!alive.current || generation !== targetRequest.current) return;
      setTarget(selected); setUpdateFields(caseFields(selected.record)); setTaskId(null);
    } catch (cause) { if (alive.current && generation === targetRequest.current) setError(message(cause)); }
    finally { if (alive.current && generation === targetRequest.current) setLoadingTarget(false); }
  }

  async function reviewLatest() {
    if (mutation.current || locked) return;
    mutation.current = true; setBusy(true); setError(null);
    try {
      const [requirement, testcase] = await Promise.all([
        getNativeRequirement(projectId, requirementId),
        target ? getTestCase(projectId, target.id).then(record => pinCase(target.id, record)) : Promise.resolve(null),
      ]);
      if (alive.current) setLatest({ version: requirement.requirement.currentVersion, target: testcase });
    } catch (cause) { if (alive.current) setError(message(cause)); }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }

  async function save() {
    if (mutation.current || (!ready && !canCheckSubmission)) return;
    // Staging's server owner replays an already recorded exact request before checking the
    // retired requirement. Without that receipt it refuses; never construct a new retired write.
    if (retired && (!unconfirmed || pending.current?.mode !== "stage")) return;
    if (!pending.current || !unconfirmed) {
      const shared = { requirementVersionId: basis.id, requirementContentDigest: basis.contentDigest, criterionKeys: [...criteria] };
      if (mode === "associate") {
        if (!target) return;
        const association = { ...shared, testcaseId: target.id, testcaseRevision: target.editRevision, testcaseApprovalRevision: target.approvalRevision };
        const content = JSON.stringify(association);
        if (associationIdentity.current?.content !== content) associationIdentity.current = { content, submissionKey: crypto.randomUUID() };
        pending.current = { mode: "associate", body: { ...association, submissionKey: associationIdentity.current.submissionKey } };
      } else {
        if (mode !== "archive" && (!fields.title.trim() || !fields.steps.length || fields.steps.some(step => !step.action.trim() || !step.expectedResult.trim()))) {
          setError("Add a testcase title and steps with an action and observable expected result."); return;
        }
        const operation: NativeCaseProposalOperation | null = mode === "create"
          ? { opType: "create", draft: fields, reason }
          : target ? mode === "update"
            ? { opType: "update", testcaseId: target.id, expectedRevision: target.editRevision, fields, reason }
            : { opType: "archive", testcaseId: target.id, expectedRevision: target.editRevision, reason }
          : null;
        if (!operation) return;
        const draft = { ...shared, title: `${requirementKey}: ${mode === "archive" ? "Proposed archive" : fields.title}`, operations: [operation] };
        const content = JSON.stringify(draft);
        if (stageIdentity.current?.content !== content) stageIdentity.current = { content, requestKey: crypto.randomUUID() };
        pending.current = { mode: "stage", body: { ...draft, requestKey: stageIdentity.current.requestKey } };
      }
    }
    const attempt = pending.current;
    mutation.current = true; setBusy(true); setError(null); setTaskId(null); setSubmittedOperationId(null);
    try {
      if (attempt.mode === "associate") {
        const result = await linkNativeRequirement(projectId, requirementId, attempt.body);
        if (alive.current) {
          onSaved(result.link.retiredAt
            ? "Association submission confirmed. The original association is retired and remains in history; no active association was restored."
            : !result.link.current
              ? "Association submission confirmed. Its saved basis is stale; inspect the recorded reasons before preparing a new association."
              : "Proposed case association saved. Requirement approval remains blocked; execution and passing are unavailable.");
          // Only a later deliberate submission may allocate a fresh identity. An uncertain
          // retry keeps pending.body and its original key, including after another actor retires it.
          associationIdentity.current = null;
        }
      } else {
        const result = await stageNativeRequirementCases(projectId, requirementId, attempt.body);
        if (alive.current) {
          setTaskId(result.taskId); setSubmittedOperationId(result.task.proposalSubmission?.operationId || null);
          onSaved(result.task.proposalSubmission?.replayed
            ? "The original case submission is confirmed in the shared proposal history. No duplicate candidate was added; it remains unpublished."
            : "Case change added to the shared proposal review. Earlier candidates are preserved. It remains unpublished; the live testcase was not changed.");
        }
      }
      if (alive.current) { setUnconfirmed(false); setRecoverableStaging(false); setConflict(false); pending.current = null; }
    } catch (cause) {
      if (!alive.current) return;
      setError(message(cause)); setUnconfirmed(uncertainWrite(cause));
      setRecoverableStaging(uncertainWrite(cause) && attempt.mode === "stage");
      setConflict(cause instanceof ApiError && cause.status === 409);
      if (!uncertainWrite(cause)) pending.current = null;
    } finally { mutation.current = false; if (alive.current) setBusy(false); }
  }

  return <div className="space-y-4 border-t border-[var(--border)] pt-4" data-testid="native-case-preparation">
    <h4 className="font-semibold">Prepare a case change or association</h4>
    {retired && <div role="status" data-testid="native-case-preparation-retired" className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-sm">
      <p className="font-semibold">This requirement proposal is retired.</p>
      <p className="mt-1">Your case-preparation text is preserved here in read-only form. New associations and case proposals are disabled.</p>
      {unconfirmed && recoverableStaging && <p className="mt-2">You can check the original submission to recover a case proposal saved before retirement. Its exact request key and content will be reused.</p>}
      {unconfirmed && !recoverableStaging && <p className="mt-2">Refresh the proposal to inspect any saved association. This retired proposal cannot accept another association.</p>}
    </div>}
    <p className="text-sm text-[var(--muted)]">Select exact criteria and an existing saved case, or prepare a new case proposal for the existing review workflow.</p>
    <Field><FieldLabel htmlFor="native-case-operation">Case proposal operation</FieldLabel><Select id="native-case-operation" value={mode} disabled={locked} onChange={event => { setMode(event.target.value as PreparationMode); setTaskId(null); setError(null); }}><option value="associate">Associate an existing case</option><option value="create">Propose a new case</option><option value="update">Propose a case update</option><option value="archive">Propose archiving a case</option></Select></Field>
    <fieldset disabled={locked} className="space-y-2"><legend className="mb-2 text-sm font-semibold">Requirement criteria</legend>{basis.criteria.map(criterion => <label key={criterion.key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={criteria.includes(criterion.key)} onChange={event => setCriteria(current => event.target.checked ? [...current, criterion.key] : current.filter(key => key !== criterion.key))} />{criterion.key}: {criterion.text}</label>)}</fieldset>
    <p className="break-all text-xs text-[var(--muted)]">Pinned requirement: version {basis.versionNumber} · {basis.id} · digest {basis.contentDigest}</p>
    {mode !== "create" && <div className="space-y-3">
      <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); void searchCases(); }}><Field className="min-w-0 flex-1"><FieldLabel htmlFor="native-case-search">Find an existing case</FieldLabel><Input id="native-case-search" value={search} disabled={locked} onChange={event => setSearch(event.target.value)} placeholder="Case title or ID" /></Field><Button type="submit" variant="secondary" disabled={locked || searching}>{searching ? "Searching…" : "Search cases"}</Button></form>
      {results && <div className="max-h-56 overflow-auto rounded-lg border border-[var(--border)]">{results.length ? <ul className="divide-y divide-[var(--border)]">{results.map(item => <li key={item.id}><button type="button" disabled={locked || loadingTarget} className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-secondary)] disabled:opacity-50" onClick={() => void chooseCase(item.id)}>{item.externalId}: {item.title} <span className="text-xs text-[var(--muted)]">({item.status})</span></button></li>)}</ul> : <p className="p-3 text-sm text-[var(--muted)]">No matching cases found.</p>}<p className="border-t border-[var(--border)] p-2 text-xs text-[var(--muted)]">Showing up to 20 matching cases. Refine the search for another case.</p></div>}
      {loadingTarget && <p role="status" className="text-sm">Loading the saved case revision…</p>}
      {target && <div className="space-y-3 rounded-lg bg-[var(--surface-secondary)] p-3"><p className="font-medium">Selected case: {target.externalId}: {target.title}</p><dl className="grid gap-3 sm:grid-cols-2"><ExactValue label="Selected testcase revision" value={target.editRevision} /><ExactValue label="Selected testcase approval revision" value={target.approvalRevision} /></dl><p className="text-sm">{target.approvalCurrent ? "This case has a current exact human approval." : "This case does not have a current exact human approval."} A proposed association does not approve the requirement.</p><details><summary className="cursor-pointer text-sm font-medium">Inspect the saved testcase content</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(target.record.approvalSnapshot || target.record, null, 2)}</pre></details><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={targetReviewed} disabled={locked || loadingTarget} onChange={event => setTargetReviewed(event.target.checked)} />Use this saved testcase revision</label></div>}
    </div>}
    {mode !== "associate" && mode !== "archive" && <fieldset disabled={locked} className="space-y-3"><legend className="mb-2 text-sm font-semibold">Proposed testcase content</legend>
      <Field><FieldLabel htmlFor="native-case-title">Case title</FieldLabel><Input id="native-case-title" value={fields.title} onChange={event => setFields({ ...fields, title: event.target.value })} /></Field>
      {([ ["description", "Case purpose"], ["preconditions", "Preconditions"], ["testData", "Test data"], ["postconditions", "Postconditions and cleanup"] ] as const).map(([name, label]) => <Field key={name}><FieldLabel htmlFor={`native-case-${name}`}>{label}</FieldLabel><Textarea id={`native-case-${name}`} rows={2} value={fields[name]} onChange={event => setFields({ ...fields, [name]: event.target.value })} /></Field>)}
      {fields.steps.map((step, index) => <div key={index} className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1fr_1fr_auto]"><Field><FieldLabel htmlFor={`native-step-action-${index}`}>Step {index + 1} action</FieldLabel><Textarea id={`native-step-action-${index}`} rows={2} value={step.action} onChange={event => setFields({ ...fields, steps: fields.steps.map((item, row) => row === index ? { ...item, action: event.target.value } : item) })} /></Field><Field><FieldLabel htmlFor={`native-step-expected-${index}`}>Step {index + 1} expected result</FieldLabel><Textarea id={`native-step-expected-${index}`} rows={2} value={step.expectedResult} onChange={event => setFields({ ...fields, steps: fields.steps.map((item, row) => row === index ? { ...item, expectedResult: event.target.value } : item) })} /></Field><Button variant="ghost" className="self-end" disabled={fields.steps.length === 1} aria-label={`Remove step ${index + 1}`} onClick={() => setFields({ ...fields, steps: fields.steps.filter((_, row) => row !== index) })}>Remove</Button></div>)}
      <Button variant="secondary" onClick={() => setFields({ ...fields, steps: [...fields.steps, { action: "", expectedResult: "" }] })}>Add step</Button>
    </fieldset>}
    {mode !== "associate" && <Field><FieldLabel htmlFor="native-case-reason">Reason for the proposed change</FieldLabel><Textarea id="native-case-reason" rows={2} value={reason} disabled={locked} onChange={event => setReason(event.target.value)} /></Field>}
    {mode === "archive" && <p className="text-sm">This stages an archive proposal for review. The saved case and its approval are unchanged.</p>}
    {mode !== "associate" && !capability.canStageCaseProposals && <p className="text-sm text-[var(--warning-foreground)]">Case proposal staging is disabled for this deployment or project. Existing testcase workflows remain available.</p>}
    {error && <p role="alert" className={errorClass}>{error}</p>}
    {unconfirmed && <p className="text-sm">The outcome is unconfirmed. Your exact submission is preserved. Check the same submission before making another change.</p>}
    {(conflict || changedBasis) && <div className="space-y-3 rounded-lg border border-[var(--warning-border)] p-3"><p className="text-sm">The saved requirement or testcase may have changed. Your proposed content is preserved. Review current versions before continuing.</p><Button variant="secondary" disabled={locked} onClick={() => void reviewLatest()}>Review current requirement and case</Button>{latest && <><VersionContent version={latest.version} />{latest.target && <details><summary>Current testcase revision {latest.target.editRevision}</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(latest.target.record.approvalSnapshot || latest.target.record, null, 2)}</pre></details>}<Button variant="secondary" disabled={locked} onClick={() => { setBasis(latest.version); setCriteria(current => current.filter(key => latest.version.criteria.some(item => item.key === key))); setTarget(latest.target); setTargetReviewed(false); setConflict(false); setLatest(null); onRefresh(); }}>Use these requirement and testcase versions</Button></>}</div>}
    <div className="flex flex-wrap items-center gap-3"><Button disabled={(!ready && !canCheckSubmission) || busy} onClick={() => void save()}>{busy ? "Saving…" : unconfirmed ? "Check saved submission" : mode === "associate" ? "Save proposed association" : "Stage case proposal"}</Button>{taskId && <Link className={linkClass} href={`/projects/${projectId}/agents/tasks/${taskId}${submittedOperationId ? `#proposal-operation-${submittedOperationId}` : ""}`}>Open shared proposal review</Link>}</div>
  </div>;
}
