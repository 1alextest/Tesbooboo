import { BadRequestException } from "@nestjs/common";

// Hash native content in PostgreSQL, not a JavaScript timestamp rounded to
// milliseconds. Embedding workers change only these bookkeeping fields/time;
// they must not manufacture conflicts. All other stored row fields still count.
// Evaluate the same expression on the row at UPDATE time.
// This is an edit precondition, never an authorization credential or coverage of
// independently stored custom-field/tag/relationship records.
export const TESTCASE_EDIT_REVISION_SQL =
  "encode(sha256(convert_to((to_jsonb(testcases) - 'embedding_status' - 'embedding_content_hash' - 'embedding_queued_at' - 'updated_at')::text, 'UTF8')), 'hex')";

/** Native content plus exact custom-field/tag dependencies; excludes approval bookkeeping. */
export const TESTCASE_APPROVAL_REVISION_SQL =
  "encode(sha256(convert_to(testcase_approval_snapshot(testcases.id)::text, 'UTF8')), 'hex')";

export const TESTCASE_APPROVAL_CURRENT_SQL = `(testcases.status='Approved' AND EXISTS (
  SELECT 1 FROM testcase_approval_receipts r WHERE r.testcase_id=testcases.id
    AND r.project_id=testcases.project_id AND r.principal_kind='human_session'
    AND r.reviewed_snapshot IS NOT NULL AND r.semantic_revision=${TESTCASE_APPROVAL_REVISION_SQL}
))`;

export function expectedApprovalRevision(raw: unknown): string {
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw)) {
    throw new BadRequestException({
      error: "expectedApprovalRevision must be the approvalRevision returned by the case detail read"
    });
  }
  return raw;
}

export function assertNotGenericApproval(status: unknown): void {
  if (typeof status === "string" && status.trim().toLowerCase() === "approved") {
    throw new BadRequestException({
      code: "USE_TESTCASE_APPROVAL",
      error: "Approve the exact reviewed test case through its approval action"
    });
  }
}

export function expectedTestcaseRevision(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw)) {
    throw new BadRequestException({ error: "expectedRevision must be the editRevision returned by the case detail read; omit it only for an unconditional edit" });
  }
  return raw;
}
