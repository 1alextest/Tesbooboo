import { Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { GraphChangeReviewDelivery } from "./graph-change-review.delivery";

/**
 * Existing graph receipts are the durable source of truth. Recovery does not
 * create an outbox, change test cases or impersonate a human user.
 *
 * Only comparable, committed receipts from the last 48 hours are eligible.
 * The native notification unique index provides idempotency across workers.
 */
export const GRAPH_QA_RECOVERY_BATCH = 100;

export interface GraphReviewRecoverySummary {
  eligible: number;
  delivered: number;
  pending: number;
  noRecipients: number;
  failed: number;
}

@Injectable()
export class GraphChangeReviewRecovery {
  private readonly logger = new Logger(GraphChangeReviewRecovery.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly delivery: GraphChangeReviewDelivery
  ) {}

  /** Optional internal project scope enables isolated replays and database-safe QA fixtures.
   * The legacy scheduled worker calls runOnce() without a scope; project mode's scoped processor
   * always supplies the configured project. No HTTP/MCP route accepts this argument.
   */
  async runOnce(projectId?: string): Promise<GraphReviewRecoverySummary> {
    const result = await this.db.query<{ project_id: string; history_id: string }>(
      `SELECT h.project_id::text AS project_id, h.id::text AS history_id
         FROM graph_capture_history h
         JOIN projects p ON p.id=h.project_id
        WHERE h.review_receipt_json IS NOT NULL
          AND ($2::uuid IS NULL OR h.project_id=$2::uuid)
          AND h.captured_at >= now() - interval '48 hours'
          AND (to_jsonb(p)->>'deleted_at') IS NULL
          AND (to_jsonb(p)->>'archived_at') IS NULL
          AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
          AND EXISTS (
            SELECT 1 FROM project_members pm
              JOIN organization_members om
                ON om.organization_id=p.organization_id AND om.user_id=pm.user_id
              LEFT JOIN notifications n
                ON n.user_id=pm.user_id AND n.type='qa_change_review'
                  AND n.dedupe_key=('qa_change_review:' || h.project_id::text || ':' || h.id::text)
             WHERE pm.project_id=h.project_id
               AND pm.role IN ('qa_engineer','manager','owner')
               AND (to_jsonb(pm)->>'deleted_at') IS NULL
               AND (to_jsonb(om)->>'deleted_at') IS NULL
               AND n.id IS NULL
          )
        ORDER BY h.id ASC
        LIMIT $1`,
      [GRAPH_QA_RECOVERY_BATCH, projectId ?? null]
    );

    const summary: GraphReviewRecoverySummary = {
      eligible: result.rows.length, delivered: 0, pending: 0, noRecipients: 0, failed: 0
    };
    // Deliberately bounded and sequential: delivery is a small indexed write;
    // a burst of receipts must not exhaust connections or block unrelated work.
    for (const receipt of result.rows) {
      try {
        const state = await this.delivery.recoverCommittedForSystem(receipt.project_id, receipt.history_id);
        if (state.status === "delivered") summary.delivered++;
        else if (state.status === "pending") summary.pending++;
        else summary.noRecipients++;
      } catch (error) {
        summary.failed++;
        this.logger.warn(
          `QA graph notification retry failed for receipt ${receipt.history_id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    // Heartbeat even for an empty backlog permits operators to detect a stalled
    // scheduler. A full batch is a capacity signal, not proof the queue is drained.
    this.logger.log(`QA graph notification recovery: ${JSON.stringify(summary)}`);
    if (summary.eligible === GRAPH_QA_RECOVERY_BATCH) {
      this.logger.warn("QA graph notification recovery reached batch cap; backlog may remain");
    }
    return summary;
  }
}
