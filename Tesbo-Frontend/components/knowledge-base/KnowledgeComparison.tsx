"use client";

import { StatusChip } from "@/components/ui";
import {
  orderedComparisonFields,
  type ComparisonField,
  type ComparisonResult,
} from "@/lib/kb-comparison";

const STATUS_LABEL: Record<ComparisonField["status"], string> = {
  unchanged: "Unchanged",
  changed: "Changed",
  added: "Added",
  removed: "Removed",
  cleared: "Cleared",
  inherited: "Inherited",
};

function tone(status: ComparisonField["status"]) {
  if (status === "unchanged" || status === "inherited") return "info" as const;
  if (status === "cleared" || status === "removed") return "error" as const;
  return "warning" as const;
}

function Lines({ lines, marker, toneClass }: { lines: string[]; marker: "−" | "+"; toneClass: string }) {
  if (!lines.length) return null;
  return (
    <div className={`rounded-[6px] border px-2.5 py-1.5 text-xs ${toneClass}`}>
      <pre className="whitespace-pre-wrap break-words">
        {lines.map((line, index) => (
          <span key={`${marker}-${index}`} className="block">
            <span className="mr-1 select-none opacity-70" aria-hidden>{marker}</span>
            {line || " "}
          </span>
        ))}
      </pre>
    </div>
  );
}

/**
 * Review surface for two exact document states. Interface labels sit outside the content; stored
 * HTML is always rendered as inert text, never injected. Excerpts are bounded; each field keeps its
 * complete values behind an explicit disclosure.
 */
export function KnowledgeComparison({
  testId,
  baseLabel,
  baseIdentity,
  targetLabel,
  targetIdentity,
  result,
  newDocument = false,
  onOpenBase,
  onOpenTarget,
}: {
  testId: string;
  baseLabel: string;
  baseIdentity: string;
  targetLabel: string;
  targetIdentity: string;
  result: ComparisonResult;
  newDocument?: boolean;
  onOpenBase?: () => void;
  onOpenTarget?: () => void;
}) {
  const fields = orderedComparisonFields(result);
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{newDocument ? "New governed document" : "Exact comparison"}</h3>
          <div className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
            <p><span className="font-medium text-[var(--foreground)]">Base:</span> {baseLabel} · <code data-testid={`${testId}-base-identity`}>{baseIdentity}</code>{onOpenBase && <button type="button" className="ml-2 underline" onClick={onOpenBase}>Open exact base</button>}</p>
            <p><span className="font-medium text-[var(--foreground)]">Compared:</span> {targetLabel} · <code data-testid={`${testId}-target-identity`}>{targetIdentity}</code>{onOpenTarget && <button type="button" className="ml-2 underline" onClick={onOpenTarget}>Open exact version</button>}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid={`${testId}-summary`}>
          {result.identical ? <StatusChip tone="info">Identical</StatusChip> : <StatusChip tone="warning">{result.changedFields.length} changed field{result.changedFields.length === 1 ? "" : "s"}</StatusChip>}
          {result.metadataOnly && <StatusChip tone="warning">Metadata only</StatusChip>}
          {result.representationOnly && <StatusChip tone="warning">Representation only (HTML/JSON)</StatusChip>}
        </div>
      </div>

      {result.identical && (
        <p className="mt-3 text-xs text-[var(--muted)]" data-testid={`${testId}-identical`}>
          No effective field changes. Expand a field to inspect its complete exact values.
        </p>
      )}
      <div className="mt-3 space-y-3">
          {fields.map((field) => (
            <div key={field.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3" data-testid={`${testId}-field-${field.key}`} data-status={field.status}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold">{field.label}</p>
                <StatusChip tone={tone(field.status)}>{STATUS_LABEL[field.status]}</StatusChip>
              </div>
              {field.status === "inherited" ? (
                <p className="mt-1 text-xs text-[var(--muted)]">Not supplied by the proposal; the pinned base value is retained on apply.</p>
              ) : field.status !== "unchanged" ? (
                <div className="mt-2 space-y-1.5">
                  <Lines lines={field.removedLines} marker="−" toneClass="border-[var(--error)]/25 bg-[var(--error-soft)] text-[var(--error-foreground)]" />
                  <Lines lines={field.addedLines} marker="+" toneClass="border-[var(--success)]/25 bg-[var(--success-soft)] text-[var(--success-foreground)]" />
                  {!field.removedLines.length && !field.addedLines.length && !field.truncated && (
                    <p className="text-xs text-[var(--muted)]">
                      {field.status === "cleared" ? "This value is explicitly empty in the compared revision." : "The stored length changed without a visible line difference."}
                    </p>
                  )}
                  {field.truncated && <p className="text-[11px] text-[var(--muted)]">Excerpt bounded; open the complete exact values below.</p>}
                </div>
              ) : null}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium">Complete exact values for {field.label}</summary>
                <div className="mt-1 space-y-2">
                  <div>
                    <p className="text-[11px] font-medium text-[var(--muted)]">Base · {field.oldLength.toLocaleString()} characters</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs" data-testid={`${testId}-old-${field.key}`}>{field.oldValue ?? "Not stored"}</pre>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-[var(--muted)]">Compared · {field.newLength.toLocaleString()} characters</p>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-xs" data-testid={`${testId}-new-${field.key}`}>{field.newValue ?? "Not stored"}</pre>
                  </div>
                </div>
              </details>
            </div>
          ))}
      </div>
    </section>
  );
}
