import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";
import { prepareQaChangeReviewReceipt, type QaChangeReviewReceipt } from "./qa-change-review-receipt";
import type { CurrentCacheGraphCapture } from "./current-cache-graph-projection";

/** Internal history entry. This does not signal delivery or user acceptance. */
export interface PersistedGraphObservation {
  id: string;
  revision: string;
  stored: boolean;
  reviewReceipt: QaChangeReviewReceipt | null;
}

/**
 * A project-serialized, authorized, database-backed capture path. It is never
 * exposed through REST/MCP and never accepts a client-supplied snapshot.
 * No notifications or approvals are issued from this writer.
 */
@Injectable()
export class CurrentCacheGraphHistory {
  constructor(
    private readonly db: DatabaseService,
    private readonly reader: CurrentCacheGraphReader
  ) {}

  async captureForUser(userId: string | null | undefined, projectId: string): Promise<PersistedGraphObservation> {
    if (!userId) throw new ForbiddenException({ error: "Authenticated project membership required" });
    return this.db.transaction(async (client) => {
      // Serialize all history writers for one project. The source is captured
      // after the lock on this same transaction client, not on a separate pool
      // connection where another commit could reorder our observations.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [projectId]);
      const capture = await this.reader.captureForUserInTransaction(userId, projectId, client);
      if (capture.inventoryStatus !== "complete" || !capture.snapshot ||
          capture.unresolvedDiagnostics.length !== 0) {
        throw new ConflictException({
          error: "Graph capture not comparable: cached source inventory incomplete or ambiguous",
          diagnostics: capture.unresolvedDiagnostics
        });
      }

      const previous = await client.query<{ id: string; capture_json: CurrentCacheGraphCapture }>(
        `SELECT id::text, capture_json
           FROM graph_capture_history
          WHERE project_id = $1::uuid ORDER BY id DESC LIMIT 1`,
        [projectId]
      );
      const before = previous.rows[0]?.capture_json ?? null;
      if (before?.contractId === capture.contractId &&
          before.sourceScopeFingerprint === capture.sourceScopeFingerprint &&
          before.snapshot?.revision === capture.snapshot.revision) {
        return { id: previous.rows[0].id, revision: capture.snapshot.revision,
          stored: false, reviewReceipt: null };
      }

      // Repointed/missing source scopes are discontinuities, not a clean delta.
      // Keep the new observation, but never claim QA candidates across scopes.
      const receipt = before?.snapshot && before.inventoryStatus === "complete" &&
        before.contractId === capture.contractId &&
        before.sourceScopeFingerprint === capture.sourceScopeFingerprint
          ? prepareQaChangeReviewReceipt(before, capture)
          : null;

      // Second membership recheck in the INSERT itself: a revoked principal
      // cannot persist a capture even if authorization changed after the SELECT.
      const saved = await client.query<{ id: string }>(
        `INSERT INTO graph_capture_history
           (project_id, captured_by_user_id, contract_id, source_scope_fingerprint,
            revision, capture_json, review_receipt_json)
         SELECT p.id, $2::uuid, $3, $4, $5, $6::jsonb, $7::jsonb
           FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=$2::uuid
          WHERE p.id=$1::uuid
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
            AND (to_jsonb(pm)->>'deleted_at') IS NULL
            AND (to_jsonb(om)->>'deleted_at') IS NULL
          RETURNING id::text`,
        [projectId, userId, capture.contractId, capture.sourceScopeFingerprint,
          capture.snapshot.revision, JSON.stringify(capture), receipt ? JSON.stringify(receipt) : null]
      );
      if (saved.rows.length !== 1) {
        throw new ForbiddenException({ error: "Project membership changed before graph history commit" });
      }
      return { id: saved.rows[0].id, revision: capture.snapshot.revision,
        stored: true, reviewReceipt: receipt };
    });
  }
}
