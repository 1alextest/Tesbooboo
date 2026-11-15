import { ConflictException } from "@nestjs/common";
import type { PoolClient } from "pg";

/**
 * The canonical Approved-only policy for adding existing cases to any native
 * Test Run (manual API, MCP, and automation SDK).
 *
 * Run this inside the SAME transaction as the cycle-item INSERT. FOR SHARE
 * blocks concurrent status changes and soft deletions until commit. Unknown,
 * deleted and foreign-project cases retain the existing "skipped/unknown"
 * behavior; any *known active* non-Approved case rejects the entire selection.
 */
export async function assertApprovedRunCases(
  client: Pick<PoolClient, "query">,
  projectId: string,
  ids: readonly string[]
): Promise<void> {
  if (!ids.length) return;
  const rows = await client.query<{ id: string; status: string }>(
    `SELECT id::text AS id, status FROM testcases
      WHERE project_id=$1::uuid AND id=ANY($2::uuid[]) AND deleted_at IS NULL
      ORDER BY id FOR SHARE`,
    [projectId, [...ids]]
  );
  const rejected = rows.rows.filter((row) => row.status !== "Approved");
  if (rejected.length) {
    throw new ConflictException({
      error: "Only Approved test cases can be added to a test run",
      ineligibleTestcaseIds: rejected.map((row) => row.id)
    });
  }
}
