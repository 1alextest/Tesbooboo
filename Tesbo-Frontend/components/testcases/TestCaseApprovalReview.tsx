"use client";

import { useEffect, useRef } from "react";
import { Button, Modal } from "@/components/ui";

export interface TestCaseApprovalSnapshot {
  case: Record<string, unknown>;
  customFields: Array<{ definition: Record<string, unknown>; value: unknown }>;
  customTags: Array<{ id: string; name: string }>;
}

function display(value: unknown): string {
  if (value == null || value === "") return "Not set";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(display).join("\n");
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${label(key)}: ${display(item)}`).join("\n");
  return String(value);
}

function label(key: string): string {
  return key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

/** The review uses the exact server snapshot that produced the approval revision. */
export function TestCaseApprovalReview({ snapshot, busy, error, onApprove, onClose }: {
  snapshot: TestCaseApprovalSnapshot;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  const ignored = new Set(["id", "project_id", "review_dependency_revision", "deleted_at", "embedding", "search_vector"]);
  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="Review test case for approval" className="max-w-3xl">
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="Review saved test case" tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), summary, a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
          );
          if (!controls?.length) { event.preventDefault(); return; }
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
          }
        }}>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Approve the saved content below, including its custom field definitions and tags. Any later change requires a new review.
        </p>
        <dl className="space-y-3">
          {Object.entries(snapshot.case).filter(([key]) => !ignored.has(key)).map(([key, value]) => {
            let rendered = value;
            if (key === "steps" && typeof value === "string") {
              try { rendered = JSON.parse(value); } catch { /* Original text remains reviewable. */ }
            }
            return <div key={key} className="rounded border border-[var(--border)] p-3">
              <dt className="text-sm font-semibold">{label(key)}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{display(rendered)}</dd>
            </div>;
          })}
        </dl>
        <h3 className="mt-5 font-semibold">Custom fields</h3>
        {snapshot.customFields.length === 0 ? <p className="text-sm text-[var(--muted)]">No custom fields</p> : snapshot.customFields.map(({ definition, value }) => (
          <div key={String(definition.id)} className="mt-2 rounded border border-[var(--border)] p-3 text-sm">
            <p className="font-semibold">{String(definition.name || definition.key)}</p>
            <p className="whitespace-pre-wrap break-words">{display(value)}</p>
            <details className="mt-2"><summary>Field definition</summary><p className="whitespace-pre-wrap break-words">{display(definition)}</p></details>
          </div>
        ))}
        <h3 className="mt-5 font-semibold">Tags</h3>
        <p className="text-sm">{snapshot.customTags.map((tag) => tag.name).join(", ") || "No tags"}</p>
        {error && <p role="alert" className="mt-4 text-sm text-[var(--error-foreground)]">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button type="button" variant="primary" disabled={busy || !!error} onClick={onApprove}>
            {busy ? "Approving…" : "Approve this version"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-[var(--muted)]">Close this review and reload the case to check its current state before trying again.</p>}
      </div>
    </Modal>
  );
}
