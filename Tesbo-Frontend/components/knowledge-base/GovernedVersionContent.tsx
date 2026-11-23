import type { KnowledgeDocumentVersionDetail } from "@/lib/api";

/**
 * The complete stored representation of a governed version. Shared by the Skills review surface
 * and the native requirement review surface so both compare the same bytes: plain text is not
 * treated as authority over the JSON/HTML representations, and every body line is indented so
 * stored content cannot fabricate an unindented field boundary.
 */

export type VersionField = { key: string; label: string; value: string | null };

export function versionFields(detail: KnowledgeDocumentVersionDetail | null): VersionField[] {
  if (!detail) return [];
  const metadata = detail.snapshotMetadata || {};
  // The native content digest binds every stored representation and these source fields.
  // Display HTML as inert source; never choose plain text as authority over the JSON/HTML.
  const source = Object.fromEntries(["projectId", "folderId", "documentType", "sourceProvider", "sourceExternalId", "sourceUrl", "sourceRole", "isReadOnly"]
    .map((key) => [key, metadata[key] ?? null]));
  return [
    { key: "title", label: "Title", value: detail.title },
    { key: "text", label: detail.contentText == null ? "Plain text (not stored)" : "Plain text (stored)", value: detail.contentText ?? null },
    { key: "json", label: "Structured instructions (JSON)", value: JSON.stringify(detail.contentJson ?? null, null, 2) },
    { key: "html", label: detail.contentHtml == null ? "HTML source (not stored)" : "HTML source (stored; displayed as text)", value: detail.contentHtml ?? null },
    { key: "source", label: "Saved source details", value: JSON.stringify(source, null, 2) }
  ];
}

export function versionText(detail: KnowledgeDocumentVersionDetail | null): string {
  // Every body line is indented, including empty lines. Stored content cannot emit an
  // unindented field boundary and make different text/HTML fields compare as equal.
  return versionFields(detail).map(({ label, value }) => value === null ? label
    : `${label}\n${value.split("\n").map((line) => `  ${line}`).join("\n")}`).join("\n\n");
}

export function VersionContent({ detail }: { detail: KnowledgeDocumentVersionDetail }) {
  return <div className="space-y-3">
    {versionFields(detail).map((field) => <section key={field.key} data-version-field={field.key} data-skill-field={field.key}>
      <h4 className="mb-1 text-xs font-semibold">{field.label}</h4>
      {field.value !== null && <pre className="whitespace-pre-wrap break-words">{field.value}</pre>}
    </section>)}
  </div>;
}
