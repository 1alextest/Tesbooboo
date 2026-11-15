import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";
import { prepareQaChangeReviewReceipt, type QaChangeReviewReceipt } from "./qa-change-review-receipt";
import type { GraphCaptureForComparison } from "./graph-comparison-gate";
import { projectImplementationObservations, type TrustedSourceObservation } from "./implementation-observation-graph";
import type { ProjectSourceBinding } from "./project-source-binding";

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

  /**
   * Read-only, bounded review feed. This is not a new public QA inbox.
   * Authorization and data selection happen in the SAME SQL statement so a
   * revoked member never receives an earlier captured private snapshot.
   */
  async listForUser(
    userId: string | null | undefined,
    projectId: string,
    limit = 25,
    beforeId?: string
  ): Promise<Array<{
    id: string;
    revision: string;
    capturedAt: string;
    reviewReceipt: QaChangeReviewReceipt | null;
    changeState: "baseline" | "source_scope_changed" | "changed";
  }>> {
    if (!userId) throw new ForbiddenException({ error: "Authenticated project membership required" });
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ConflictException({ error: "Graph history limit must be 1–100" });
    }
    if (beforeId !== undefined && (!/^[1-9][0-9]*$/.test(beforeId) ||
        beforeId.length > 19 || BigInt(beforeId) > 9223372036854775807n)) {
      throw new ConflictException({ error: "Invalid history cursor" });
    }
    const result = await this.db.query<{
      authorized: boolean;
      entries: Array<{
        id: string; revision: string; capturedAt: string; reviewReceipt: QaChangeReviewReceipt | null;
        changeState: "baseline" | "source_scope_changed" | "changed"
      }>;
    }>(
      `WITH allowed AS MATERIALIZED (
         SELECT DISTINCT p.id FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=$2::uuid
          WHERE p.id=$1::uuid
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
            AND (to_jsonb(pm)->>'deleted_at') IS NULL
            AND (to_jsonb(om)->>'deleted_at') IS NULL
       )
       , authorized_history AS MATERIALIZED (
         SELECT h.id, h.revision, h.captured_at, h.review_receipt_json,
                h.contract_id, h.source_scope_fingerprint
           FROM graph_capture_history h JOIN allowed a ON a.id=h.project_id
       ), sequenced AS (
         SELECT h.*,
           LAG(h.contract_id) OVER (ORDER BY h.id) AS prior_contract,
           LAG(h.source_scope_fingerprint) OVER (ORDER BY h.id) AS prior_scope
           FROM authorized_history h
       )
       SELECT EXISTS(SELECT 1 FROM allowed) AS authorized,
              COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                   'id', x.id::text, 'revision', x.revision,
                   'capturedAt', x.captured_at, 'reviewReceipt', x.review_receipt_json,
                   'changeState', CASE
                     WHEN x.prior_contract IS NULL THEN 'baseline'
                     WHEN x.prior_contract IS DISTINCT FROM x.contract_id
                       OR x.prior_scope IS DISTINCT FROM x.source_scope_fingerprint
                       THEN 'source_scope_changed'
                     ELSE 'changed' END
                 ) ORDER BY x.id DESC)
                   FROM (
                     SELECT h.* FROM sequenced h
                      WHERE ($3::bigint IS NULL OR h.id < $3::bigint)
                      ORDER BY h.id DESC LIMIT $4
                   ) x),
                '[]'::jsonb
              ) AS entries`,
      [projectId, userId, beforeId ?? null, limit]
    );
    if (!result.rows[0]?.authorized) {
      throw new ForbiddenException({ error: "Project membership required for graph history" });
    }
    return result.rows[0].entries;
  }

  /** Only invoked by the server-owned binding+Git verifier coordinator. */
  async captureVerifiedImplementationForUser(
    userId: string | null | undefined,
    projectId: string,
    verified: { binding: ProjectSourceBinding; observation: TrustedSourceObservation }
  ): Promise<PersistedGraphObservation> {
    if (!verified || verified.binding.projectId !== projectId ||
        verified.observation.projectId !== projectId ||
        verified.binding.repositoryId !== verified.observation.repositoryId ||
        verified.binding.refName !== verified.observation.refName ||
        JSON.stringify([...verified.binding.selectionPrefixes].sort()) !==
          JSON.stringify([...(verified.observation.selectionPrefixes ?? [])].sort())) {
      throw new ConflictException({ error: "Source observation does not match authorized binding" });
    }
    return this.recordForUser(userId, projectId, verified);
  }

  async captureForUser(userId: string | null | undefined, projectId: string): Promise<PersistedGraphObservation> {
    return this.recordForUser(userId, projectId);
  }

  private async recordForUser(
    userId: string | null | undefined,
    projectId: string,
    verified?: { binding: ProjectSourceBinding; observation: TrustedSourceObservation }
  ): Promise<PersistedGraphObservation> {
    if (!userId) throw new ForbiddenException({ error: "Authenticated project membership required" });
    return this.db.transaction(async (client) => {
      // Serialize all history writers for one project. The source is captured
      // after the lock on this same transaction client, not on a separate pool
      // connection where another commit could reorder our observations.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [projectId]);
      if (verified) {
        // Hold the configured binding stable until COMMIT; a retired/changed
        // binding must never authorize a historical source assertion.
        const scoped = await client.query<{ project_id: string }>(
          `SELECT b.project_id FROM project_source_bindings b
             WHERE b.project_id=$1::uuid AND b.enabled=true
               AND b.repository_id=$2 AND b.checkout_key=$3 AND b.ref_name=$4
               AND b.selection_prefixes=$5::text[]
             FOR SHARE OF b`,
          [projectId, verified.binding.repositoryId, verified.binding.checkoutKey,
            verified.binding.refName, verified.binding.selectionPrefixes]
        );
        if (scoped.rows.length !== 1) {
          throw new ConflictException({ error: "Source binding changed before graph history commit" });
        }
      }
      const native = await this.reader.captureForUserInTransaction(userId, projectId, client);
      const capture: GraphCaptureForComparison = verified
        ? projectImplementationObservations(native, verified.observation)
        : native;
      if (capture.inventoryStatus !== "complete" || !capture.snapshot ||
          capture.unresolvedDiagnostics.length !== 0) {
        throw new ConflictException({
          error: "Graph capture not comparable: cached source inventory incomplete or ambiguous",
          diagnostics: capture.unresolvedDiagnostics
        });
      }

      const previous = await client.query<{ id: string; capture_json: GraphCaptureForComparison }>(
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
