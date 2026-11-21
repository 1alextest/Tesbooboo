"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ApiError, cancelNativeRetestRequest, createNativeRetest, previewNativeRetest, readNativeRetestRequest,
  type NativeRetestCancellation, type NativeRetestDisposition, type NativeRetestPreview, type NativeRetestReceipt, type TestRunDetail,
} from "@/lib/api";
import { clearRetestIntent, readRetestIntent, retestIntentDigest, retestRouteHint, saveRetestIntent, type RetestIntent } from "@/lib/nativeRetestIntent";
import { Button, Field, FieldLabel, Input, Modal, StatusChip } from "@/components/ui";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readable(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
}

function fieldLabel(key: string): string {
  const labels: Record<string, string> = {
    external_id: "Case ID", test_data: "Test data", testData: "Test data", attachments: "Notes",
    field_type: "Type", fieldType: "Type", config: "Configuration", maxLength: "Maximum length", minLength: "Minimum length",
  };
  return labels[key] || key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, letter => letter.toUpperCase());
}

function DefinitionFields({ value }: { value: Record<string, unknown> }) {
  return <dl className="space-y-2">
    {Object.entries(value).map(([key, item]) => <div key={key}>
      <dt className="font-medium text-[var(--muted)]">{fieldLabel(key)}</dt>
      <dd className="whitespace-pre-wrap break-words text-[var(--foreground)]">
        {item && typeof item === "object" && !Array.isArray(item)
          ? <div className="ml-2 border-l border-[var(--border)] pl-2"><DefinitionFields value={record(item)} /></div>
          : readable(item)}
      </dd>
    </div>)}
  </dl>;
}

/** Display the actual saved fields, including custom values, rather than inventing a summary. */
function Definition({ value }: { value: Record<string, unknown> }) {
  const definition = Object.keys(record(value.case)).length ? record(value.case) : value;
  let steps: unknown = definition.steps;
  if (typeof steps === "string") {
    try { steps = JSON.parse(steps); } catch { /* Plain-text legacy steps remain readable. */ }
  }
  const fields = Object.entries(definition).filter(([key, item]) =>
    !["id", "project_id", "review_dependency_revision", "deleted_at", "steps"].includes(key) && item !== null && item !== "");
  return (
    <div className="min-w-0 space-y-3 text-[12px]">
      <dl className="space-y-2">
        {fields.map(([key, item]) => <div key={key}>
          <dt className="font-medium text-[var(--muted)]">{fieldLabel(key)}</dt>
          <dd className="whitespace-pre-wrap break-words text-[var(--foreground)]">{readable(item)}</dd>
        </div>)}
      </dl>
      {Array.isArray(steps) ? <ol className="space-y-2" aria-label="Saved steps">
        {steps.map((item, index) => {
          const step = record(item);
          return <li key={index} className="rounded border border-[var(--border)] p-2">
            <p>{index + 1}. {typeof item === "string" ? item : readable(step.action ?? step.step ?? step.description)}</p>
            {typeof item !== "string" && <p className="mt-1 text-[var(--muted)]">Expected: {readable(step.expectedResult ?? step.expected ?? step.result)}</p>}
            {Object.keys(step).some(key => !["action", "step", "description", "expectedResult", "expected", "result"].includes(key)) &&
              <div className="mt-2"><DefinitionFields value={Object.fromEntries(Object.entries(step).filter(([key]) => !["action", "step", "description", "expectedResult", "expected", "result"].includes(key)))} /></div>}
          </li>;
        })}
      </ol> : steps ? <p className="whitespace-pre-wrap break-words">Steps: {readable(steps)}</p> : null}
      {Array.isArray(value.customFields) && value.customFields.length > 0 && <dl className="space-y-2">
        {value.customFields.map((item, index) => {
          const custom = record(item);
          const field = record(custom.definition);
          const name = String(field.name || "Custom field");
          return <div key={index}>
            <dt className="font-medium text-[var(--muted)]">{name}</dt>
            <dd className="space-y-2">
              <p className="whitespace-pre-wrap break-words">{readable(custom.value)}</p>
              <details className="rounded border border-[var(--border)] p-2">
                <summary className="cursor-pointer font-medium">Field definition: {name}</summary>
                <div className="mt-2"><DefinitionFields value={field} /></div>
              </details>
            </dd>
          </div>;
        })}
      </dl>}
      {Array.isArray(value.customTags) && value.customTags.length > 0 && <p>Tags: {value.customTags.map(item => String(record(item).name || "Unnamed tag")).join(", ")}</p>}
      <details className="rounded border border-[var(--border)] p-2">
        <summary className="cursor-pointer font-medium">Complete saved definition</summary>
        <p className="mt-2 text-[var(--muted)]">All saved fields, step details, field definitions, and tag identities used by this review.</p>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px]">{JSON.stringify(value, null, 2)}</pre>
      </details>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onRestoreFocus: () => void;
  onCreated: (cycleId: string) => void;
  projectId: string;
  userId: string;
  sourceRun: Pick<TestRunDetail, "id" | "name" | "environment">;
  executionIds: string[];
  allowCreate?: boolean;
};

export default function RetestRunDialog({ open, onOpen, onClose, onRestoreFocus, onCreated, projectId, userId, sourceRun, executionIds, allowCreate = true }: Props) {
  const scope = useMemo(() => ({ userId, projectId, sourceCycleId: sourceRun.id }), [userId, projectId, sourceRun.id]);
  const scopeKey = `${userId}:${projectId}:${sourceRun.id}`;
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const mounted = useRef(true);
  const operationSequence = useRef(0);
  const previewSequence = useRef(0);
  const inFlight = useRef(false);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const dialog = useRef<HTMLDivElement>(null);
  const recoveryBanner = useRef<HTMLElement>(null);
  const restoreRecoveryFocus = useRef(false);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [pending, setPending] = useState<RetestIntent | null>(null);
  const [receipt, setReceipt] = useState<NativeRetestReceipt | null>(null);
  const [cancellation, setCancellation] = useState<NativeRetestCancellation | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<NativeRetestPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewReload, setPreviewReload] = useState(0);
  const [name, setName] = useState(() => `${sourceRun.name} — retest`.slice(0, 255));
  const [environment, setEnvironment] = useState(sourceRun.environment || "");
  const [buildVersion, setBuildVersion] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const defaultsAssigned = useRef(allowCreate);
  const selected = [...executionIds].sort();
  const selectionKey = selected.join(",");

  useEffect(() => {
    // Recovery mounts before the source read finishes. Initialize editable defaults only once
    // an available source is known, without replacing details the user already entered.
    if (!allowCreate || defaultsAssigned.current) return;
    defaultsAssigned.current = true;
    setName(`${sourceRun.name} — retest`.slice(0, 255));
    setEnvironment(sourceRun.environment || "");
  }, [allowCreate, sourceRun.name, sourceRun.environment]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; inFlight.current = false; operationSequence.current += 1; previewSequence.current += 1; };
  }, []);

  const acceptReceipt = useCallback((value: NativeRetestReceipt, intent: RetestIntent, navigate: boolean) => {
    if (value.outcome !== "created" || value.sourceCycleId !== scope.sourceCycleId || value.requestKey !== intent.request.requestKey ||
        value.manifest?.projectId !== scope.projectId || value.manifest.createdBy !== scope.userId ||
        value.manifest.sourceCycleId !== scope.sourceCycleId || value.manifest.cycleId !== value.cycleId ||
        value.manifest.sourcePreviewDigest !== intent.request.expectedPreviewDigest ||
        value.manifest.targetRun.name !== intent.request.name.trim() ||
        (value.manifest.targetRun.environment || "") !== (intent.request.environment || "").trim() ||
        (value.manifest.targetRun.buildVersion || "") !== (intent.request.buildVersion || "").trim() ||
        value.manifest.occurrences.map(item => item.sourceExecutionId).sort().join(",") !== [...intent.request.executionIds].sort().join(",")) {
      throw new Error("The returned retest does not match this saved request. Keep the request and check again.");
    }
    setReceipt(value);
    setRecoveryMessage(null);
    try {
      clearRetestIntent(window.localStorage, intent);
      setPending(null);
      setStorageError(null);
    } catch {
      setStorageError("The retest was found, but this browser could not clear its recovery record. Open the retest below; keep this request until browser storage is available.");
      return;
    }
    if (navigate && value.available) onCreatedRef.current(value.cycleId);
  }, [scope]);

  const acceptDisposition = useCallback(async (value: NativeRetestDisposition, intent: RetestIntent, navigate: boolean, sequence: number) => {
    if (value.outcome === "created") {
      acceptReceipt(value, intent, navigate);
      return;
    }
    const expectedDigest = await retestIntentDigest(intent);
    if (!mounted.current || currentScope.current !== scopeKey || sequence !== operationSequence.current) return;
    if (value.outcome !== "cancelled" || value.projectId !== scope.projectId || value.sourceCycleId !== scope.sourceCycleId ||
        value.requestedBy !== scope.userId || value.requestKey !== intent.request.requestKey || value.requestDigest !== expectedDigest ||
        typeof value.cancelledAt !== "string" || !Number.isFinite(Date.parse(value.cancelledAt))) {
      throw new Error("The returned outcome does not match this saved request. Keep the request and check again.");
    }
    clearRetestIntent(window.localStorage, intent);
    setPending(null);
    setStorageError(null);
    setCancellation(value);
    setPreview(null);
    setPreviewError(null);
    setAcknowledged(false);
    setName(intent.request.name);
    setEnvironment(intent.request.environment || "");
    setBuildVersion(intent.request.buildVersion || "");
    setRecoveryMessage(null);
  }, [acceptReceipt, scope, scopeKey]);

  const lookup = useCallback(async (intent: RetestIntent, sequence: number) => {
    try {
      const value = await readNativeRetestRequest(scope.sourceCycleId, intent.request.requestKey);
      if (!mounted.current || currentScope.current !== scopeKey || sequence !== operationSequence.current) return;
      await acceptDisposition(value, intent, false, sequence);
    } catch (error) {
      if (!mounted.current || currentScope.current !== scopeKey || sequence !== operationSequence.current) return;
      setRecoveryMessage(error instanceof ApiError && error.status === 404
        ? "No confirmed outcome is visible yet. The earlier request may still be running. Check again, retry the saved request, or stop it before reviewing again."
        : `The retest outcome could not be checked. ${error instanceof Error ? error.message : "Please try again."}`);
    }
  }, [scope.sourceCycleId, scopeKey, acceptDisposition]);

  const recover = useCallback(async (intent: RetestIntent) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setRecoveryMessage("Checking the saved retest request…");
    const sequence = ++operationSequence.current;
    try { await lookup(intent, sequence); }
    finally {
      if (mounted.current && currentScope.current === scopeKey && sequence === operationSequence.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }, [lookup, scopeKey]);

  useEffect(() => {
    try {
      const saved = readRetestIntent(window.localStorage, scope);
      setPending(saved);
      setStorageReady(true);
      if (saved) void recover(saved);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Browser storage is unavailable. A retest request cannot be safely retained.");
      setStorageReady(true);
    }
    // Another tab can leave an unresolved request. The submission path checks storage again.
    function storageChanged() {
      try {
        const saved = readRetestIntent(window.localStorage, scope);
        if (saved) setPending(saved);
      } catch (error) { setStorageError(error instanceof Error ? error.message : "The saved request could not be read."); }
    }
    window.addEventListener("storage", storageChanged);
    return () => window.removeEventListener("storage", storageChanged);
  }, [scope, recover]);

  useEffect(() => {
    if (!open || !allowCreate || !storageReady || pending || receipt || cancellation || storageError) return;
    const sequence = ++previewSequence.current;
    setPreview(null);
    setPreviewError(null);
    setAcknowledged(false);
    if (selected.length < 1 || selected.length > 100) {
      setPreviewError("Select between 1 and 100 source observations for a retest.");
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    void previewNativeRetest(scope.sourceCycleId, selected).then(value => {
      if (!mounted.current || currentScope.current !== scopeKey || sequence !== previewSequence.current) return;
      if (value.projectId !== projectId || value.sourceCycleId !== scope.sourceCycleId ||
          value.occurrences.map(item => item.sourceExecutionId).sort().join(",") !== selectionKey ||
          !/^[a-f0-9]{64}$/.test(value.previewDigest)) throw new Error("The preview did not match the selected source observations. Reload it before creating a retest.");
      setPreview(value);
    }).catch(error => {
      if (mounted.current && currentScope.current === scopeKey && sequence === previewSequence.current) {
        setPreviewError(error instanceof Error ? error.message : "The retest preview could not be loaded.");
      }
    }).finally(() => {
      if (mounted.current && currentScope.current === scopeKey && sequence === previewSequence.current) setPreviewLoading(false);
    });
    return () => { previewSequence.current += 1; };
    // selectionKey represents the exact sorted selection; a new array on a parent render is not new work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allowCreate, storageReady, pending, receipt, cancellation, storageError, previewReload, selectionKey, scope.sourceCycleId, scopeKey, projectId]);

  useLayoutEffect(() => {
    if (!open) {
      // Opening recovery removes its banner before this effect can capture the trigger.
      // Restore to the newly mounted button after the closed render has attached its refs.
      if (restoreRecoveryFocus.current) {
        const trigger = recoveryBanner.current?.querySelector<HTMLButtonElement>("button");
        if (trigger) trigger.focus();
        else onRestoreFocus();
        restoreRecoveryFocus.current = false;
      }
      return;
    }
    const before = document.activeElement;
    const root = dialog.current;
    if (!root) return;
    root.focus();
    function containFocus(event: FocusEvent) {
      if (!root!.contains(event.target as Node)) root!.focus();
    }
    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const controls = Array.from(root!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], summary, [tabindex="0"]'))
        .filter(item => item.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      const focused = document.activeElement;
      if (!controls.length) { event.preventDefault(); root!.focus(); }
      else if (event.shiftKey && (focused === first || focused === root || !root!.contains(focused))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (focused === last || focused === root || !root!.contains(focused))) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("focusin", containFocus, true);
    document.addEventListener("keydown", trapTab, true);
    return () => {
      document.removeEventListener("focusin", containFocus, true);
      document.removeEventListener("keydown", trapTab, true);
      if (!restoreRecoveryFocus.current && before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, [open, onRestoreFocus]);

  // Replacing a form or error removes its focused control without firing focusin. Keep focus on
  // the surviving dialog root during every phase transition, including phases with no controls.
  useLayoutEffect(() => {
    const root = dialog.current;
    const focused = document.activeElement;
    if (open && root && (!root.contains(focused) || focused instanceof HTMLButtonElement && focused.disabled)) root.focus();
  });

  async function stopRequest(intent: RetestIntent) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setRecoveryMessage("Stopping the saved request and checking whether it already created a retest…");
    const sequence = ++operationSequence.current;
    try {
      saveRetestIntent(window.localStorage, intent);
      const value = await cancelNativeRetestRequest(scope.sourceCycleId, intent.request);
      if (mounted.current && currentScope.current === scopeKey && sequence === operationSequence.current) {
        await acceptDisposition(value, intent, false, sequence);
      }
    } catch {
      if (!mounted.current || currentScope.current !== scopeKey || sequence !== operationSequence.current) return;
      setRecoveryMessage("The stop request is unconfirmed. Keeping the saved request and checking its outcome…");
      await lookup(intent, sequence);
    } finally {
      if (mounted.current && currentScope.current === scopeKey && sequence === operationSequence.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  async function submit(intent: RetestIntent) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const sequence = ++operationSequence.current;
    try {
      // This synchronous durable write precedes the first POST, including verification readback.
      saveRetestIntent(window.localStorage, intent);
      setPending(intent);
      setRecoveryMessage("Creating the retest from your reviewed selection…");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The browser could not retain this request. Nothing was sent.";
      try {
        const retained = readRetestIntent(window.localStorage, scope);
        if (retained) {
          setPending(retained);
          setRecoveryMessage("A saved retest request needs recovery. Nothing new was sent; check that request before continuing.");
        } else setStorageError(message);
      } catch { setStorageError(message); }
      inFlight.current = false;
      setBusy(false);
      return;
    }
    try {
      const value = await createNativeRetest(scope.sourceCycleId, intent.request);
      if (mounted.current && currentScope.current === scopeKey && sequence === operationSequence.current) acceptReceipt(value, intent, true);
    } catch {
      if (!mounted.current || currentScope.current !== scopeKey || sequence !== operationSequence.current) return;
      // A refusal in this tab cannot rule out another arrival of the same saved request. Only
      // an exact created/cancelled disposition releases it after a POST has been attempted.
      setRecoveryMessage("The creation outcome is unconfirmed. Checking the saved request…");
      await lookup(intent, sequence);
    } finally {
      if (mounted.current && currentScope.current === scopeKey && sequence === operationSequence.current) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  const changed = preview?.occurrences.filter(item => item.definitionChanged || item.sourceDefinitionBasis !== "reviewed_snapshot") ?? [];
  const eligible = Boolean(preview?.occurrences.length && preview.occurrences.every(item => item.eligible));
  const canCreate = allowCreate && storageReady && !storageError && !pending && !receipt && !cancellation && !busy && !previewLoading &&
    eligible && Boolean(name.trim()) && (changed.length === 0 || acknowledged);
  function close() {
    if (inFlight.current) return;
    // A positively recovered receipt resolves the request. Closing it is an explicit return to
    // source selection; unresolved requests remain retained and cannot be replaced.
    if (receipt && !pending && !storageError) setReceipt(null);
    if (cancellation && !pending && !storageError) setCancellation(null);
    onClose();
  }
  function freshPreview() { setPreviewReload(value => value + 1); }

  return <>
    {(pending || receipt || cancellation || storageError) && !open && <section ref={recoveryBanner} data-testid="retest-recovery-banner" aria-label="Retest request recovery"
      className="mb-3 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-[13px]">
      <p role="status">{receipt ? (receipt.available ? "Your saved retest request was created." : "Your saved retest was created, but that Run is no longer available.")
        : cancellation ? "Your saved retest request was stopped. You can review a new selection." : storageError || "A retest request is awaiting confirmation. Check its outcome before starting another."}</p>
      {recoveryMessage && <p className="mt-1 text-[var(--muted)]">{recoveryMessage}</p>}
      <Button variant="secondary" className="mt-2" onClick={() => { restoreRecoveryFocus.current = true; onOpen(); }}>Review retest request</Button>
      {receipt?.available && <Button className="ml-2 mt-2" onClick={() => onCreatedRef.current(receipt.cycleId)}>Open retest</Button>}
    </section>}
    <Modal open={open} onClose={close} className="max-w-[920px]">
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Create retest" tabIndex={-1} className="outline-none">
        <h2 className="text-xl font-semibold">{pending || receipt || cancellation ? "Recover retest request" : "Create retest"}</h2>
        {storageError && <p role="alert" className="mt-3 text-sm text-[var(--error-foreground)]">{storageError}</p>}
        {receipt ? <div className="mt-4 space-y-3">
          <p role="status">{receipt.available ? `Retest “${receipt.manifest.targetRun.name}” was created.` : "This request created a retest, but that Run is no longer available."}</p>
          <p className="text-sm text-[var(--muted)]">Its original source is {receipt.manifest.sourceRun.name}.</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={close}>Close</Button>
            {receipt.available && <Button onClick={() => onCreatedRef.current(receipt.cycleId)}>Open retest</Button>}
          </div>
        </div> : cancellation ? <div className="mt-4 space-y-3">
          <p role="status">This saved request was stopped. It cannot create a Run, even if an earlier attempt arrives later.</p>
          <p className="text-sm text-[var(--muted)]">{allowCreate && selected.length > 0
            ? "Review the current definitions again before starting a new request."
            : "Close this dialog and select observations from an available source Run to start again."}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Close</Button>
            {allowCreate && selected.length > 0 && <Button disabled={busy || Boolean(pending) || Boolean(storageError)} onClick={() => { setCancellation(null); freshPreview(); }}>Review again</Button>}
          </div>
        </div> : pending ? <div className="mt-4 space-y-4">
          <p className="text-sm">The saved request keeps your exact reviewed selection and target details.</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-[var(--muted)]">Run name</dt><dd>{pending.request.name}</dd></div>
            <div><dt className="text-[var(--muted)]">Selected observations</dt><dd>{pending.request.executionIds.length}</dd></div>
            <div><dt className="text-[var(--muted)]">Environment</dt><dd>{pending.request.environment || "Not set"}</dd></div>
            <div><dt className="text-[var(--muted)]">Build to test</dt><dd>{pending.request.buildVersion || "Not set"}</dd></div>
          </dl>
          {recoveryMessage && <p role="status" className="rounded border border-[var(--border)] p-3 text-sm">{recoveryMessage}</p>}
          <p className="text-sm text-[var(--muted)]">Retry uses the same request. To change your selection or review changed definitions, stop this request first. If it already created a retest, stopping will recover that Run and will not undo it.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={close}>Close and keep request</Button>
            <Button variant="secondary" disabled={busy} onClick={() => void recover(pending)}>Check outcome</Button>
            <Button disabled={busy || Boolean(storageError)} onClick={() => void submit(pending)}>Retry saved request</Button>
            <Button variant="secondary" disabled={busy || Boolean(storageError)} onClick={() => void stopRequest(pending)}>Stop request and review again</Button>
          </div>
        </div> : !allowCreate ? <div className="mt-4 space-y-3">
          <p className="text-sm">The source Run is unavailable. Existing saved requests can still be checked; a fresh retest needs an available source.</p>
          <Button variant="secondary" onClick={close}>Close</Button>
        </div> : <form onSubmit={event => {
          event.preventDefault();
          if (!canCreate || !preview || inFlight.current) return;
          void submit({ ...scope, version: 1, routeHint: retestRouteHint(window.location.pathname), request: {
            requestKey: crypto.randomUUID(), executionIds: preview.occurrences.map(item => item.sourceExecutionId).sort(),
            expectedPreviewDigest: preview.previewDigest, name: name.trim(), environment: environment.trim(), buildVersion: buildVersion.trim(),
          } });
        }} className="mt-4 space-y-4">
          <p className="text-sm text-[var(--muted)]">Create a new Run from selected observations in <strong>{sourceRun.name}</strong>. New results start Untested, using each case’s current human-approved definition. Original results and evidence remain on the source Run.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2"><FieldLabel htmlFor="retest-name">Run name</FieldLabel><Input id="retest-name" value={name} onChange={event => setName(event.target.value)} required maxLength={255} disabled={busy} /></Field>
            <Field><FieldLabel htmlFor="retest-environment">Environment</FieldLabel><Input id="retest-environment" value={environment} onChange={event => setEnvironment(event.target.value)} maxLength={128} disabled={busy} /></Field>
            <Field><FieldLabel htmlFor="retest-build">Build to test</FieldLabel><Input id="retest-build" value={buildVersion} onChange={event => setBuildVersion(event.target.value)} maxLength={128} disabled={busy} /></Field>
          </div>
          {previewLoading && <p role="status">Loading the selected observations and current definitions…</p>}
          {previewError && <div><p role="alert" className="text-sm text-[var(--error-foreground)]">{previewError}</p><Button variant="secondary" className="mt-2" onClick={freshPreview}>Reload preview</Button></div>}
          {preview && <section aria-label="Retest preview" className="space-y-3">
            <p className="text-sm">{preview.occurrences.length} selected observation{preview.occurrences.length === 1 ? "" : "s"}{" · source environment: "}{preview.sourceRun.environment || "Not set"}{" · source build: "}{preview.sourceRun.buildVersion || "Not set"}</p>
            {preview.occurrences.map(item => <article key={item.sourceExecutionId} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.sourceTitle || item.sourceExternalId || "Source test case"}</h3>
                <StatusChip tone={item.eligible ? "success" : "warning"}>{item.eligible ? "Current definition approved" : "Current approval required"}</StatusChip>
              </div>
              <p className="mt-1 text-sm">Source result: {String(item.sourceResult.status || "Unknown")}</p>
              {item.sourceResult.actual_result ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--muted)]">{String(item.sourceResult.actual_result)}</p> : null}
              <p className="mt-1 text-xs text-[var(--muted)]">{item.sourceEvidence.length} evidence file{item.sourceEvidence.length === 1 ? "" : "s"}{" · "}{item.sourceBugLinks.length} defect link{item.sourceBugLinks.length === 1 ? "" : "s"}{" · "}<Link className="text-[var(--accent-light)] hover:underline" href={`/projects/${projectId}/cycles/${sourceRun.id}/execute/${item.sourceExecutionId}`}>Open source observation</Link></p>
              {!item.eligible && <p className="mt-2 text-sm text-[var(--error-foreground)]">{item.currentCase ? "Review and approve this case’s current definition in Test Cases, then reload the preview." : "This case is no longer available. Close this dialog and change your selection."}</p>}
              {item.sourceDefinitionBasis !== "reviewed_snapshot" && <p className="mt-2 text-sm text-[var(--muted)]">The source snapshot has no verified approval identity. Compare it with the current approved definition.</p>}
              {item.definitionChanged && <p className="mt-2 text-sm font-medium">The case definition changed since this source observation.</p>}
              <details className="mt-2" open={item.definitionChanged || item.sourceDefinitionBasis !== "reviewed_snapshot"}>
                <summary className="cursor-pointer text-sm font-medium">Compare saved definitions</summary>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <section aria-label="Source definition"><h4 className="mb-2 font-medium">Source definition</h4><Definition value={item.sourceDefinition} /></section>
                  <section aria-label="Current approved definition"><h4 className="mb-2 font-medium">{item.eligible ? "Current approved definition" : "Current definition — approval required"}</h4>
                    {item.currentCase ? <Definition value={item.currentCase.reviewedContent} /> : <p className="text-sm">Unavailable</p>}
                  </section>
                </div>
              </details>
            </article>)}
            {changed.length > 0 && <label className="flex items-start gap-2 rounded-lg border border-[var(--border)] p-3 text-sm">
              <input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} className="mt-0.5 accent-[var(--brand-primary)]" />
              I reviewed the definition differences and want to retest the current approved definitions.
            </label>}
          </section>}
          <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={!canCreate}>Create retest</Button></div>
        </form>}
      </div>
    </Modal>
  </>;
}
