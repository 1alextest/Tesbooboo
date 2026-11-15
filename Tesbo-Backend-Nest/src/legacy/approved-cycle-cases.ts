import { ConflictException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";

type ActiveCaseStatus = { id: string; status: string; already_attached: boolean };

/**
 * Single canonical business rule for manual REST/MCP and automation
 * attachments. Call within the SAME transaction as the cycle_items INSERT.
 * FOR SHARE OF t prevents concurrent status demotion between check and write.
 * Unknown/deleted/foreign IDs retain the native skipped/unknown behavior.
 * Already-present historical cases can be replayed without changing results
 * even if they were demoted since original attachment.
 */
export async function assertApprovedCycleCasesAtWrite(
  client: PoolClient | DatabaseService,
  projectId: string,
  cycleId: string,
  testcaseIds: readonly string[]
): Promise<void> {
  if (!testcaseIds.length) return;
  const result = await (client as DatabaseService).query<ActiveCaseStatus>(
    `SELECT t.id::text AS id, t.status,
            EXISTS (
              SELECT 1 FROM cycle_items ci
               WHERE ci.testcase_id=t.id AND ci.cycle_id=$3::uuid
                 AND ci.deleted_at IS NULL
            ) AS already_attached
       FROM testcases t
      WHERE t.project_id=$1::uuid AND t.id=ANY($2::uuid[])
        AND t.deleted_at IS NULL
      FOR SHARE OF t`,
    [projectId, [...testcaseIds], cycleId]
  );
  const ineligibleTestcaseIds = result.rows
    .filter((row) => row.status !== "Approved" && !row.already_attached)
    .map((row) => row.id);
  if (ineligibleTestcaseIds.length) {
    throw new ConflictException({
      error: "Only Approved test cases can be added to a test run",
      ineligibleTestcaseIds
    });
  }
}
