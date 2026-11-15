import { BadRequestException } from "@nestjs/common";

// Hash native content in PostgreSQL, not a JavaScript timestamp rounded to
// milliseconds. Embedding workers change only these bookkeeping fields/time;
// they must not manufacture conflicts. All other stored row fields still count.
// Evaluate the same expression on the row at UPDATE time.
// This is an edit precondition, never an authorization credential or coverage of
// independently stored custom-field/tag/relationship records.
export const TESTCASE_EDIT_REVISION_SQL =
  "encode(sha256(convert_to((to_jsonb(testcases) - 'embedding_status' - 'embedding_content_hash' - 'updated_at')::text, 'UTF8')), 'hex')";

export function expectedTestcaseRevision(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw)) {
    throw new BadRequestException({ error: "expectedRevision must be the editRevision returned by the case detail read; omit it only for an unconditional edit" });
  }
  return raw;
}
