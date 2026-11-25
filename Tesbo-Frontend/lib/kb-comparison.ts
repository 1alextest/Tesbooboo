/**
 * Exact comparison for governed documents and agent proposals.
 *
 * Values are compared as stored, never by rendering one representation through another: plain
 * text, stored HTML and editor JSON can each differ independently and the approval digest binds
 * all of them. Displayed excerpts are bounded, but every field keeps its complete old/new value so
 * the reviewer can expand the exact bytes.
 */

export type ComparableDocument = {
  title: string;
  contentText: string | null;
  contentHtml: string | null;
  contentJson: unknown;
  governedMetadata: Record<string, unknown> | null;
};

export type ComparisonFieldKey = "title" | "text" | "html" | "json" | "metadata";

export type ComparisonField = {
  key: ComparisonFieldKey;
  label: string;
  status: "unchanged" | "changed" | "added" | "removed" | "cleared" | "inherited";
  oldValue: string | null;
  newValue: string | null;
  oldLength: number;
  newLength: number;
  removedLines: string[];
  addedLines: string[];
  truncated: boolean;
};

export type ComparisonResult = {
  fields: ComparisonField[];
  changedFields: ComparisonField[];
  metadataOnly: boolean;
  representationOnly: boolean;
  identical: boolean;
};

const LABELS: Record<ComparisonFieldKey, string> = {
  title: "Title",
  text: "Plain text",
  html: "Stored HTML (shown as text)",
  json: "Editor JSON",
  metadata: "Governance metadata",
};

const EXCERPT_LINES = 12;
const EXCERPT_CHARS = 600;

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function jsonText(value: unknown): string | null {
  // A top-level null means the editor representation was cleared. Nested
  // nulls remain part of the stored JSON representation.
  if (value === undefined || value === null) return null;
  return JSON.stringify(value, null, 2);
}

function metadataText(value: Record<string, unknown> | null | undefined): string | null {
  return JSON.stringify(value ?? {}, null, 2);
}

function boundedLines(lines: string[], start: number, end: number): { lines: string[]; truncated: boolean } {
  const selected = lines.slice(start, end);
  let used = 0;
  let cutoff = selected.length;
  for (let index = 0; index < selected.length; index++) {
    used += selected[index].length + 1;
    if (index >= EXCERPT_LINES || used > EXCERPT_CHARS) {
      cutoff = index;
      break;
    }
  }
  return { lines: selected.slice(0, cutoff), truncated: cutoff < selected.length };
}

function diffLines(oldText: string | null, newText: string | null) {
  const oldLines = (oldText ?? "").split("\n");
  const newLines = (newText ?? "").split("\n");
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix && suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) suffix++;
  const removed = boundedLines(oldLines, prefix, oldLines.length - suffix);
  const added = boundedLines(newLines, prefix, newLines.length - suffix);
  return {
    removedLines: removed.lines,
    addedLines: added.lines,
    truncated: removed.truncated || added.truncated
  };
}

function statusOf(base: string | null, next: string | null, inherited: boolean): ComparisonField["status"] {
  if (inherited) return "inherited";
  if ((base ?? null) === (next ?? null)) return "unchanged";
  const baseEmpty = base === null || base === "";
  const nextEmpty = next === null || next === "";
  if (baseEmpty && !nextEmpty) return "added";
  if (!baseEmpty && nextEmpty) return "cleared";
  return "changed";
}

/**
 * Compare a base document with a target. `omittedKeys` marks proposal representations the agent
 * did not supply; their effective value already equals the base and they are labelled "inherited"
 * rather than "unchanged", so a reviewer can tell preservation from a deliberate no-op.
 * `base === null` means a new document proposal: every supplied field is an addition.
 */
export function compareDocuments(
  base: ComparableDocument | null,
  target: ComparableDocument,
  omittedKeys: ReadonlySet<ComparisonFieldKey> = new Set()
): ComparisonResult {
  const values: Array<{ key: ComparisonFieldKey; before: string | null; after: string | null }> = [
    { key: "title", before: base ? base.title : null, after: target.title },
    { key: "text", before: base ? asText(base.contentText) : null, after: asText(target.contentText) },
    { key: "html", before: base ? asText(base.contentHtml) : null, after: asText(target.contentHtml) },
    { key: "json", before: base ? jsonText(base.contentJson) : null, after: jsonText(target.contentJson) },
    { key: "metadata", before: base ? metadataText(base.governedMetadata) : null, after: metadataText(target.governedMetadata) }
  ];
  const fields = values.map(({ key, before, after }) => {
    const inherited = omittedKeys.has(key);
    const effectiveAfter = inherited ? before : after;
    const diff = diffLines(before, effectiveAfter);
    return {
      key,
      label: LABELS[key],
      status: !base && !inherited && (effectiveAfter ?? "") !== "" ? "added" : statusOf(before, effectiveAfter, inherited),
      oldValue: before,
      newValue: effectiveAfter,
      oldLength: before?.length ?? 0,
      newLength: effectiveAfter?.length ?? 0,
      ...diff
    };
  });
  const changedFields = fields.filter((field) => field.status !== "unchanged");
  const changedKeys = new Set(changedFields.map((field) => field.key));
  const contentKeys: ComparisonFieldKey[] = ["text", "html", "json"];
  const representationOnly = changedFields.length > 0 && changedKeys.size > 0
    && [...changedKeys].every((key) => contentKeys.includes(key))
    && (changedKeys.has("html") || changedKeys.has("json"));
  return {
    fields,
    changedFields,
    metadataOnly: changedFields.length === 1 && changedKeys.has("metadata"),
    representationOnly,
    identical: changedFields.length === 0
  };
}

/** Stable display ordering: changed fields first, then the stored order. */
export function orderedComparisonFields(result: ComparisonResult): ComparisonField[] {
  return [...result.changedFields, ...result.fields.filter((field) => field.status === "unchanged")];
}

/** A short exact identity for labels/buttons; never used as document content. */
export function shortIdentity(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 14)}…` : value;
}
