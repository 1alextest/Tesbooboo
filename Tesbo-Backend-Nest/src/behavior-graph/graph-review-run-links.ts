import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { StorageService } from "../storage/storage.service";
import { summarizeQaVerificationGaps, type QaVerificationGaps } from "./qa-verification-gaps";

/** Opt-in, because each check costs one storage HEAD/stat per attachment. */
export interface QaEvidenceByteCheck {
  checked: number;
  available: number;
  unavailable: number;
  byteMismatch: number;
  truncated: boolean;
  note: string;
}

const MAX_EVIDENCE_BYTE_CHECKS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_ID = /^[1-9][0-9]{0,18}$/;
const MAX_HISTORY = 9223372036854775807n;

export interface QaRunCaseExecution {
  id: string;
  /** Native result, not a graph-inferred pass/fail or approval. */
  status: string;
  executedAt: string | null;
  /** Temporal relationship only; does not prove matching deployed build. */
  executedAfterHandoff: boolean;
  actualResultRecorded: boolean;
  defectKey: string | null;
  /** Count of active native attachment metadata, not verification of stored file bytes. */
  evidenceFileCount: number;
  evidenceAddedAfterHandoffCount: number;
  /** Present only when the caller asked for byte verification. */
  evidenceBytes?: QaEvidenceByteCheck;
}

/** Compare an internally pinned source commit to the commit REPORTED by a run.
 * Equality cannot establish which build the target actually deployed.
 */
export interface QaRunCommitComparison {
  sourceCommitSha: string | null;
  runReportedCommitSha: string | null;
  comparison: "unknown" | "reported_equal_unverified" | "reported_different";
}
export interface QaRunCaseLink {
  commitProvenance?: QaRunCommitComparison;
  runId: string;
  caseId: string;
  linkedAt: string;
  runName: string;
  runStatus: string;
  /** A historical handoff may outlive a soft-removed case in that run. */
  caseStillInRun: boolean;
  execution: QaRunCaseExecution | null;
}

/**
 * Stores ONLY relationships to canonical run/case/receipt rows, not their copies.
 * A prepared run is not a passed test or a coverage claim.
 *
 * Every write rechecks current organization/project membership, run ownership,
 * active cycle items AND nomination in the immutable committed review receipt.
 */
@Injectable()
export class GraphReviewRunLinks {
  constructor(
    private readonly db: DatabaseService,
    private readonly legacy: LegacyService,
    private readonly storage: StorageService
  ) {}

  private validHistory(id: string): void {
    if (!HISTORY_ID.test(id) || BigInt(id) > MAX_HISTORY) {
      throw new NotFoundException({ error: "Change review not found" });
    }
  }

  async listForUser(userId: string | null | undefined, projectId: string, historyId: string,
    options: { verifyEvidenceBytes?: boolean } = {}):
    Promise<{ links: QaRunCaseLink[]; summary: QaVerificationGaps }> {
    if (!userId) throw new ForbiddenException({ error: "Project membership required" });
    this.validHistory(historyId);
    await this.legacy.requireProjectAccess(userId, projectId);
    const result = await this.db.query<{
      allowed: boolean; links: QaRunCaseLink[]; review_receipt: unknown;
    }>(
      `WITH allowed AS MATERIALIZED (
         SELECT p.id FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=pm.user_id
          WHERE p.id=$1::uuid
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
            AND (to_jsonb(pm)->>'deleted_at') IS NULL
            AND (to_jsonb(om)->>'deleted_at') IS NULL
       )
       SELECT EXISTS(
         SELECT 1 FROM allowed a JOIN graph_capture_history h
           ON h.project_id=a.id AND h.id=$3::bigint AND h.review_receipt_json IS NOT NULL
       ) AS allowed,
       (SELECT h.review_receipt_json FROM graph_capture_history h
         JOIN allowed a ON a.id=h.project_id
        WHERE h.id=$3::bigint AND h.review_receipt_json IS NOT NULL) AS review_receipt,
       COALESCE((
         SELECT jsonb_agg(jsonb_build_object(
           'runId', l.cycle_id::text, 'caseId', l.testcase_id::text,
           'linkedAt', l.linked_at, 'runName', c.name, 'runStatus', c.status,
           'caseStillInRun', ci.id IS NOT NULL,
           'commitProvenance', jsonb_build_object(
             'sourceCommitSha', provenance.source_sha,
             'runReportedCommitSha', provenance.run_sha,
             'comparison', CASE
               WHEN provenance.source_sha IS NULL OR provenance.run_sha IS NULL THEN 'unknown'
               WHEN provenance.source_sha=provenance.run_sha THEN 'reported_equal_unverified'
               ELSE 'reported_different' END
           ),
           'execution', CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', e.id::text, 'status', e.status, 'executedAt', e.executed_at,
             'executedAfterHandoff', (
               e.executed_at IS NOT NULL AND e.executed_at >= l.linked_at
             ),
             'actualResultRecorded', NULLIF(btrim(e.actual_result), '') IS NOT NULL,
             'defectKey', e.defect_key,
             'evidenceFileCount', (
               SELECT COUNT(*)::int FROM attachments att
                WHERE att.project_id=l.project_id
                  AND att.entity_type='execution' AND att.entity_id=e.id
                  AND att.deleted_at IS NULL
             ),
             'evidenceAddedAfterHandoffCount', (
               SELECT COUNT(*)::int FROM attachments att
                WHERE att.project_id=l.project_id
                  AND att.entity_type='execution' AND att.entity_id=e.id
                  AND att.deleted_at IS NULL AND att.created_at >= l.linked_at
             )
           ) END
         ) ORDER BY l.linked_at, l.cycle_id, l.testcase_id)
           FROM graph_review_run_case_links l
           JOIN graph_capture_history h ON h.id=l.history_id AND h.project_id=l.project_id
           JOIN cycles c ON c.id=l.cycle_id AND c.project_id=l.project_id
           CROSS JOIN LATERAL (
             SELECT
               CASE WHEN h.capture_json->>'sourceByteEvidence'='verified_pinned_git'
                 AND length(h.capture_json->>'observedCommitSha') IN (40,64)
                 AND translate(lower(h.capture_json->>'observedCommitSha'),
                   '0123456789abcdef','')=''
                 THEN lower(h.capture_json->>'observedCommitSha') ELSE NULL END AS source_sha,
               CASE WHEN length(c.commit_sha) IN (40,64)
                 AND translate(lower(c.commit_sha),'0123456789abcdef','')=''
                 THEN lower(c.commit_sha) ELSE NULL END AS run_sha
           ) provenance
           LEFT JOIN testcases tc ON tc.id=l.testcase_id
             AND tc.project_id=l.project_id AND tc.deleted_at IS NULL
           LEFT JOIN cycle_items ci ON ci.cycle_id=l.cycle_id
             AND ci.testcase_id=l.testcase_id AND ci.deleted_at IS NULL
             AND c.deleted_at IS NULL AND tc.id IS NOT NULL
           LEFT JOIN executions e ON e.cycle_item_id=ci.id AND e.deleted_at IS NULL
           JOIN allowed a ON a.id=l.project_id
          WHERE l.history_id=$3::bigint
       ), '[]'::jsonb) AS links`,
      [projectId, userId, historyId]
    );
    const row = result.rows[0];
    if (!row?.allowed) throw new NotFoundException({ error: "Committed change review not found" });
    if (options.verifyEvidenceBytes) await this.annotateEvidenceBytes(row.links, projectId);
    return { links: row.links,
      summary: summarizeQaVerificationGaps(projectId, row.review_receipt, row.links) };
  }

  /**
   * Metadata rows prove a row exists, not that its object is readable. This resolves each active
   * attachment once (bounded) and reports what the storage backend actually answered. It never
   * changes an attachment, an execution, a case or a result; verification is not content review.
   */
  private async annotateEvidenceBytes(links: QaRunCaseLink[], projectId: string): Promise<void> {
    const executionIds = [...new Set(links.flatMap((link) => link.execution ? [link.execution.id] : []))];
    if (!executionIds.length) return;
    const attachments = await this.db.query<{ entity_id: string; storage_path: string; file_size: string | null }>(
      `SELECT entity_id, storage_path, file_size FROM attachments
       WHERE project_id = $1 AND entity_type = 'execution' AND entity_id = ANY($2::uuid[])
         AND deleted_at IS NULL
       ORDER BY created_at, id`,
      [projectId, executionIds]
    );
    const checkedRows = attachments.rows.slice(0, MAX_EVIDENCE_BYTE_CHECKS);
    const truncated = attachments.rows.length > checkedRows.length;
    const checks = await Promise.all(checkedRows.map(async (row) => ({
      executionId: String(row.entity_id),
      check: await this.storage.verify(row.storage_path, row.file_size == null ? null : Number(row.file_size))
    })));
    for (const link of links) {
      const execution = link.execution;
      if (!execution) continue;
      const mine = checks.filter((entry) => entry.executionId === execution.id).map((entry) => entry.check);
      execution.evidenceBytes = {
        checked: mine.length,
        available: mine.filter((check) => check.available).length,
        unavailable: mine.filter((check) => !check.available).length,
        byteMismatch: mine.filter((check) => check.byteMismatch).length,
        truncated,
        note: "Storage availability and recorded size only; does not prove the evidence supports the result."
      };
    }
  }

  async linkForUser(
    userId: string | null | undefined, projectId: string,
    historyId: string, cycleId: string, raw: unknown
  ): Promise<{ historyId: string; runId: string; selected: number; newlyLinked: number }> {
    if (!userId) throw new ForbiddenException({ error: "Project membership required" });
    this.validHistory(historyId);
    if (!UUID.test(cycleId)) throw new NotFoundException({ error: "Test run not found" });
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        Object.keys(raw).length !== 1 || !Object.prototype.hasOwnProperty.call(raw, "testcaseIds")) {
      throw new BadRequestException({ error: "Only testcaseIds may be submitted" });
    }
    const ids = (raw as { testcaseIds?: unknown }).testcaseIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200 ||
        ids.some((id) => typeof id !== "string" || !UUID.test(id)) ||
        new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) {
      throw new BadRequestException({ error: "Select 1–200 distinct canonical testcaseIds" });
    }
    await this.legacy.requireProjectAccess(userId, projectId);
    // Entire candidate/run/membership check and persistence is one atomic
    // transaction: a stale/deleted/foreign case cannot partially link a batch.
    const linked = await this.db.transaction(async (client) => {
      const result = await client.query<{ eligible_count: number; newly_linked: number }>(
        `WITH authorized AS MATERIALIZED (
           SELECT p.id FROM projects p
             JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid
             JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=pm.user_id
            WHERE p.id=$1::uuid AND pm.role IN ('owner','manager','qa_engineer')
              AND (to_jsonb(p)->>'deleted_at') IS NULL
              AND (to_jsonb(p)->>'archived_at') IS NULL
              AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
              AND (to_jsonb(pm)->>'deleted_at') IS NULL
              AND (to_jsonb(om)->>'deleted_at') IS NULL
            FOR SHARE OF p, pm, om
         ),
         eligible AS MATERIALIZED (
           SELECT a.id AS project_id, h.id AS history_id,
                  c.id AS cycle_id, ci.testcase_id
             FROM authorized a
             JOIN graph_capture_history h ON h.project_id=a.id AND h.id=$3::bigint
                  AND h.review_receipt_json IS NOT NULL
             JOIN cycles c ON c.project_id=a.id AND c.id=$4::uuid
                  AND c.deleted_at IS NULL
             JOIN cycle_items ci ON ci.cycle_id=c.id AND ci.deleted_at IS NULL
                  AND ci.testcase_id=ANY($5::uuid[])
             JOIN testcases tc ON tc.id=ci.testcase_id AND tc.project_id=a.id
                  AND tc.deleted_at IS NULL AND tc.status='Approved'
            WHERE EXISTS (
              SELECT 1
                FROM jsonb_array_elements(COALESCE(h.review_receipt_json->'candidates', '[]'::jsonb)) candidate
               WHERE (candidate->>'caseNodeId')::jsonb =
                 jsonb_build_array('test_case', a.id::text, ci.testcase_id::text)
            )
         ),
         written AS (
           INSERT INTO graph_review_run_case_links
             (project_id, history_id, cycle_id, testcase_id, linked_by_user_id)
           SELECT project_id, history_id, cycle_id, testcase_id, $2::uuid FROM eligible
           ON CONFLICT (project_id, history_id, cycle_id, testcase_id) DO NOTHING
           RETURNING testcase_id
         )
         SELECT (SELECT COUNT(DISTINCT testcase_id)::int FROM eligible) AS eligible_count,
                (SELECT COUNT(*)::int FROM written) AS newly_linked`,
        [projectId, userId, historyId, cycleId, ids]
      );
      const counts = result.rows[0];
      if (!counts || counts.eligible_count !== ids.length) {
        throw new ConflictException({
          error: "Every selected case must be Approved, active, nominated and present in this project's test run"
        });
      }
      return counts.newly_linked;
    });
    return { historyId, runId: cycleId, selected: ids.length, newlyLinked: linked };
  }
}
