import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";

// Compute the edit precondition in PostgreSQL so JSON key ordering and sub-millisecond
// timestamps cannot make the HTTP representation disagree with the locked document row.
export const KNOWLEDGE_DOCUMENT_REVISION_SQL =
  "encode(sha256(convert_to((to_jsonb(knowledge_documents) - ARRAY['updated_at', 'search_vector', 'embedding_status', 'embedding_content_hash', 'embedding_queued_at']::text[])::text, 'UTF8')), 'hex')";

// Matches String.trim(), which the existing embedding worker applies before hashing. Using the
// exact whitespace set avoids treating a stale chunk as current or excluding valid Unicode text.
const EMBEDDING_TRIM_CHARACTERS_SQL = "U&'\\0009\\000A\\000B\\000C\\000D\\0020\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF'";

/**
 * Governing AI context only. Human list/get/history access remains independent of this rule.
 * Existing non-memory documents keep their current retrieval behavior; this is not a Skills
 * resolver. A historical approved flag or a readable candidate cannot substitute for an exact
 * same-document human review. Native content/source comparisons also reject a stale binding.
 * The optional chunk hash fences asynchronous ANN indexes to the same currently reviewed text.
 */
export function knowledgeDocumentAiContextSql(alias: "knowledge_documents" | "d" = "knowledge_documents", chunkHash?: "c.content_hash"): string {
  return `((${alias}.document_type != 'ai_memory' AND ${alias}.document_type NOT IN ('user_manual','policy')) OR (
    ${alias}.document_type = 'ai_memory'
    AND ${alias}.status = 'approved' AND ${alias}.reviewed_by IS NOT NULL AND ${alias}.reviewed_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM knowledge_document_versions reviewed
      WHERE reviewed.id = ${alias}.reviewed_version_id AND reviewed.document_id = ${alias}.id
        AND reviewed.snapshot_kind = 'approved' AND reviewed.created_by = ${alias}.reviewed_by
        AND reviewed.title IS NOT DISTINCT FROM ${alias}.title
        AND reviewed.content_json IS NOT DISTINCT FROM ${alias}.content_json
        AND reviewed.content_html IS NOT DISTINCT FROM ${alias}.content_html
        AND reviewed.content_text IS NOT DISTINCT FROM ${alias}.content_text
        AND reviewed.snapshot_metadata @> jsonb_build_object(
          'actorKind', 'human_session', 'actorId', ${alias}.reviewed_by,
          'authority', 'ai_memory_review', 'documentType', ${alias}.document_type,
          'projectId', ${alias}.project_id, 'folderId', ${alias}.folder_id,
          'sourceProvider', ${alias}.source_provider, 'sourceExternalId', ${alias}.source_external_id,
          'sourceUrl', ${alias}.source_url, 'sourceRole', ${alias}.source_role, 'isReadOnly', ${alias}.is_read_only)
    )
    ${chunkHash ? `AND ${chunkHash} = encode(sha256(convert_to(btrim(COALESCE(${alias}.content_text, ''), ${EMBEDDING_TRIM_CHARACTERS_SQL}), 'UTF8')), 'hex')` : ""}
  ))`;
}

export function expectedKnowledgeDocumentRevision(raw: unknown, required = false): string | null {
  if (raw === undefined && !required) return null;
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw)) {
    throw new BadRequestException({ error: "expectedRevision must be the editRevision returned by the document read" });
  }
  return raw;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
}

/** Exact relied-on content and semantic/source metadata, independent of mutable review fields. */
export function knowledgeDocumentContentDigest(doc: Record<string, unknown>): string {
  const keys = ["project_id", "folder_id", "title", "content_json", "content_html", "content_text", "document_type", "source_provider", "source_external_id", "source_url", "source_role", "is_read_only"];
  // Legacy/non-governed rows have an empty object; including it would change every historical
  // digest. A governed document always has non-empty metadata, so its exact metadata is bound.
  const governed = doc.governed_metadata;
  if (governed && typeof governed === "object" && !Array.isArray(governed) && Object.keys(governed as Record<string, unknown>).length) {
    keys.push("governed_metadata");
  }
  const value = Object.fromEntries(keys.map((key) => [key, doc[key] ?? null]));
  return createHash("sha256").update(JSON.stringify(canonical(value)), "utf8").digest("hex");
}
