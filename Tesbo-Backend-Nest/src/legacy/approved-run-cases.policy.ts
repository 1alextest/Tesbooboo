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
  const result = await client.query<{ id: string; status: string }>(
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
  const excluded = result.rows.filter((row) => row.status !== "Approved")
    .map((row) => row.id);
  if (excluded.length) {
    throw new ConflictException({
      error: "Only Approved test cases can be added to a test run",
      testcaseIds: excluded
    });
  }
}
