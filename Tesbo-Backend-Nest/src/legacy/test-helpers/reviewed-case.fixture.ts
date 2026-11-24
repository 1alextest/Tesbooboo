import type { QueryRunner } from "../../request-cache/project-lookup.service";
import { TESTCASE_APPROVAL_REVISION_SQL, TESTCASE_EDIT_REVISION_SQL } from "../testcase-edit-revision";

/**
 * Technical database-fixture receipt for tests whose subject is a different native boundary.
 * This is not a human authentication/approval test. HTTP approval tests use the real endpoint.
 * Call only for an intentionally approved disposable fixture; never backfill product history.
 */
export async function recordReviewedCaseFixture(client: QueryRunner, testcaseId: string, reviewerId: string): Promise<void> {
  await client.query(
    `INSERT INTO testcase_approval_receipts
       (project_id,testcase_id,approved_revision,actor_id,semantic_revision,reviewed_snapshot,principal_kind)
     SELECT project_id,id,${TESTCASE_EDIT_REVISION_SQL},$2,${TESTCASE_APPROVAL_REVISION_SQL},
            testcase_approval_snapshot(id),'human_session'
       FROM testcases WHERE id=$1 AND status='Approved'
     ON CONFLICT (testcase_id,approved_revision) DO NOTHING`, [testcaseId,reviewerId]
  );
}
