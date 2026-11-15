import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { notificationLinks, notificationMessages } from "../legacy/notification-events";
import { writeNotifications } from "../legacy/notification-writer";

const POSITIVE_ID = /^[1-9][0-9]{0,18}$/;
const BIGINT_MAX = 9223372036854775807n;

export interface GraphReviewDeliveryState {
  status: "delivered" | "pending" | "no_recipients";
  recipientCount: number;
  pendingCount: number;
}

/** Native per-user notifications for committed graph receipts; no new queue. */
@Injectable()
export class GraphChangeReviewDelivery {
  constructor(private readonly db: DatabaseService, private readonly legacy: LegacyService) {}

  async deliverForUser(
    userId: string | null | undefined, projectId: string, historyId: string
  ): Promise<GraphReviewDeliveryState> {
    if (!userId) throw new ForbiddenException({ error: "Project membership required for QA notifications" });
    if (!POSITIVE_ID.test(historyId) || BigInt(historyId) > BIGINT_MAX) {
      throw new NotFoundException({ error: "Change review not found" });
    }
    await this.legacy.requireProjectAccess(userId, projectId);
    return this.deliverCommitted(projectId, historyId, userId);
  }

  /**
   * Trusted internal background-recovery entrypoint. Never expose this method
   * from a controller or MCP tool. No caller identity is fabricated.
   */
  async recoverCommittedForSystem(projectId: string, historyId: string): Promise<GraphReviewDeliveryState> {
    if (!POSITIVE_ID.test(historyId) || BigInt(historyId) > BIGINT_MAX) {
      throw new NotFoundException({ error: "Change review not found" });
    }
    return this.deliverCommitted(projectId, historyId, null);
  }

  private async deliverCommitted(
    projectId: string, historyId: string, callerId: string | null
  ): Promise<GraphReviewDeliveryState> {
    const callerMembership = callerId
      ? `AND EXISTS (
          SELECT 1 FROM project_members caller
          JOIN organization_members caller_org ON caller_org.organization_id=p.organization_id
            AND caller_org.user_id=caller.user_id
          WHERE caller.project_id=p.id AND caller.user_id=$2::uuid
            AND (to_jsonb(caller)->>'deleted_at') IS NULL
            AND (to_jsonb(caller_org)->>'deleted_at') IS NULL
        )`
      : "AND $2::uuid IS NULL";
    const result = await this.db.query<{
      id: string; organization_id: string; recipient_ids: string[];
    }>(
      `WITH allowed AS MATERIALIZED (
         SELECT DISTINCT p.id, p.organization_id FROM projects p
          WHERE p.id=$1::uuid
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
            ${callerMembership}
       )
       SELECT h.id::text, a.organization_id::text AS organization_id,
              COALESCE((
                SELECT array_agg(DISTINCT pm.user_id::text)
                  FROM project_members pm
                  JOIN organization_members om ON om.user_id=pm.user_id
                  JOIN allowed a ON a.id=pm.project_id AND a.organization_id=om.organization_id
                 WHERE pm.role IN ('qa_engineer','manager','owner')
                   AND (to_jsonb(pm)->>'deleted_at') IS NULL
                   AND (to_jsonb(om)->>'deleted_at') IS NULL
              ), ARRAY[]::text[]) AS recipient_ids
         FROM graph_capture_history h
         JOIN allowed a ON a.id=h.project_id
        WHERE h.id=$3::bigint AND h.review_receipt_json IS NOT NULL`,
      [projectId, callerId, historyId]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException({ error: "Committed QA review receipt not found" });
    const recipients = row.recipient_ids;
    if (!recipients.length) return { status: "no_recipients", recipientCount: 0, pendingCount: 0 };

    const dedupeKey = `qa_change_review:${projectId}:${historyId}`;
    await writeNotifications(this.db, recipients, {
      type: "qa_change_review",
      title: notificationMessages.qaChangeReview(),
      link: notificationLinks.zyraChangeReview(projectId),
      dedupeKey,
      memberOf: { projectId, organizationId: row.organization_id, projectRoles: ["qa_engineer", "manager", "owner"] }
    });
    // The native writer intentionally catches/logs failures; verify durable
    // per-recipient notifications and surface partial delivery honestly.
    try {
      const confirmation = await this.db.query<{ user_id: string }>(
        `SELECT user_id::text FROM notifications
          WHERE user_id=ANY($1::uuid[]) AND type='qa_change_review' AND dedupe_key=$2`,
        [recipients, dedupeKey]
      );
      const delivered = new Set(confirmation.rows.map((item) => item.user_id));
      const pendingCount = recipients.filter((id) => !delivered.has(id)).length;
      return {
        status: pendingCount === 0 ? "delivered" : "pending",
        recipientCount: recipients.length,
        pendingCount
      };
    } catch {
      // The capture was already committed. Failure to confirm notification
      // rows cannot safely be converted into a failed source-capture verdict.
      // A repeated attempt is safe through the native per-user dedupe key.
      return { status: "pending", recipientCount: recipients.length, pendingCount: recipients.length };
    }
  }
}
