import { ConflictException } from "@nestjs/common";
import type { PoolClient } from "pg";

/**
 * Canonical Approved-only gate for NEW additions to Tesbo test runs, shared by
 * manual REST, MCP and automated ingestion. Existing run items are historical
 * snapshots: re-attaching one is an idempotent no-op, not a new association.
 *
 * Call INSIDE the same transaction that inserts cycle_items, holding the
 * parent cycle's FOR UPDATE lock first. FOR SHARE blocks concurrent edits or
 * demotions of the selected canonical testcase rows until commit; the INSERT
 * also repeats the Approved predicate as defence in depth.
 *
 * Missing/foreign/invalid ids remain skipped by the legacy public API contract.
 * A known, active, same-project *unapproved* new case is a 409 for the WHOLE
 * batch, never a partial insert. Do not leak foreign case identities.
 */
export async function assertApprovedNewRunCases(
  client: PoolClient, projectId: string, cycleId: string, ids: readonly string[]
): Promise<void> {
  if (!ids.length) return;
  // Acquire parent locks before evaluating dependency-backed receipts. A separate statement
  // avoids using a pre-wait snapshot after a concurrent dependent edit commits.
  await client.query(
    `SELECT t.id::text AS id, t.status
       FROM testcases t
      WHERE t.project_id=$1::uuid AND t.id=ANY($2::uuid[])
        AND t.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM cycle_items ci
           WHERE ci.cycle_id=$3::uuid AND ci.testcase_id=t.id
             AND ci.deleted_at IS NULL
        )
      ORDER BY t.id FOR SHARE OF t`,
    [projectId, [...ids], cycleId]
  );
  const result = await client.query<{ id: string; status: string; approval_current: boolean }>(
    `SELECT t.id::text AS id, t.status,
            EXISTS (SELECT 1 FROM testcase_approval_receipts r
              WHERE r.testcase_id=t.id AND r.project_id=t.project_id
                AND r.principal_kind='human_session' AND r.reviewed_snapshot IS NOT NULL
                AND r.semantic_revision=encode(sha256(convert_to(testcase_approval_snapshot(t.id)::text,'UTF8')),'hex'))
              AS approval_current
       FROM testcases t
      WHERE t.project_id=$1::uuid AND t.id=ANY($2::uuid[]) AND t.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM cycle_items ci WHERE ci.cycle_id=$3::uuid
          AND ci.testcase_id=t.id AND ci.deleted_at IS NULL)`,
    [projectId, [...ids], cycleId]
  );
  const excluded = result.rows.filter((row) => row.status !== "Approved" || row.approval_current !== true)
    .map((row) => row.id);
  if (excluded.length) {
    throw new ConflictException({
      code: "TESTCASE_APPROVAL_REQUIRED",
      error: "Only Approved test cases with a current exact human-review receipt can be added to a test run",
      testcaseIds: excluded
    });
  }
}
