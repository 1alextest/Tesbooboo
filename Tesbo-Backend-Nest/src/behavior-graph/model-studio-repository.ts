import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { TESTCASE_EDIT_REVISION_SQL } from "../legacy/testcase-edit-revision";
import { requireHumanReviewPrincipal, type ReviewPrincipal } from "../common/human-review-principal";
import { DraftPreviewError, previewDraftModel, type PreviewDefinition } from "./model-studio-preview.core";
import { generateModelPaths, type GeneratedPath, type GenerationStrategy } from "./model-studio-generator";

type Body = Record<string, any>;
type NativeOccurrence = { cycleItemId: string; executionId: string; snapshotApprovalRevision: string };
type ManifestCase = { entry: Body; occurrence: NativeOccurrence | null };
type GovernedRunEvidence = { row: Body; cases: Array<ManifestCase & { status: string | null }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;

/**
 * Persisted Model Studio: expected-model identity, immutable revisions, explicit case links,
 * human approval receipts bound to a revision's content hash, proposal generation, and governed
 * dispatch of an approved revision into a native Test Run. It is deliberately not a second
 * graph/approval/execution store:
 *
 *  - expected behavior lives here;
 *  - observed source declarations remain graph_capture_history / source bindings;
 *  - runs, executions, results and evidence remain native cycles/executions/attachments.
 *
 * A link is an accepted mapping between two artifacts, never execution or verified coverage. A
 * governed run records which cases were dispatched and which elements they came from; its results
 * are case outcomes, not proof that the modeled behavior is correct.
 */
@Injectable()
export class ModelStudioRepository {
  constructor(private readonly db: DatabaseService, private readonly legacy: LegacyService) {}

  private async access(userId: string | null | undefined, projectId: string) {
    if (!userId) throw new ForbiddenException({ error: "Project membership required" });
    return this.legacy.requireProjectAccess(userId, projectId);
  }

  /**
   * An archived model is retired for every surface, not only the list. Reads and writes keyed by a
   * revision id would otherwise keep answering for a model the project can no longer see.
   */
  private async requireActiveModel(modelId: string, projectId: string, runner?: PoolClient) {
    const sql = `SELECT id, name FROM mbt_models WHERE id = $1 AND project_id = $2 AND archived_at IS NULL${runner ? " FOR SHARE" : ""}`;
    const params = [modelId, projectId];
    const model = runner ? await runner.query(sql, params) : await this.db.query(sql, params);
    if (!model.rows[0]) throw new NotFoundException({ error: "Model not found" });
    return model.rows[0];
  }

  private validate(content: unknown) {
    try {
      return previewDraftModel(content);
    } catch (error) {
      if (!(error instanceof DraftPreviewError)) throw error;
      const body = { code: error.code, error: error.message };
      if (error.code === "UNSUPPORTED_SEMANTICS") throw new HttpException(body, 422);
      throw new BadRequestException(body);
    }
  }

  private modelView(model: Body, revision: Body | null, includeContent: boolean, approval: Body | null = null) {
    return {
      id: model.id,
      projectId: model.project_id,
      name: model.name,
      createdAt: model.created_at,
      latestRevision: revision ? this.revisionView(revision, includeContent, approval) : null
    };
  }

  private revisionView(row: Body, includeContent: boolean, approval: Body | null = null) {
    const receipt = approval && approval.model_revision_id === row.id ? approval : null;
    return {
      id: row.id,
      modelId: row.model_id,
      revisionNumber: row.revision_number,
      parentRevisionId: row.parent_revision_id ?? null,
      status: row.status,
      contentHash: row.content_hash,
      createdAt: row.created_at,
      // A revision is immutable; approval is a separate human receipt bound to its content hash.
      approval: receipt
        ? {
            status: "APPROVED",
            contentHash: receipt.content_hash,
            approvedBy: receipt.approved_by ?? null,
            approvedAt: receipt.created_at
          }
        : { status: "NOT_APPROVED", contentHash: null, approvedBy: null, approvedAt: null },
      ...(includeContent ? { content: row.content, preview: this.previewOrNull(row) } : {}),
      authority: {
        expectedBehavior: true,
        observedSource: false,
        executionEvidence: false,
        approval: receipt ? "APPROVED" : "NOT_APPROVED",
        runtimeEvidence: "NONE"
      }
    };
  }

  /**
   * The same projection the preview endpoint returns, recomputed from the persisted revision for
   * display. The stored content was validated when it was saved, so this cannot fail for a normal
   * row; a corrupt row yields null instead of breaking the detail read.
   */
  private previewOrNull(row: Body) {
    try {
      return { ...previewDraftModel(row.content), modelId: row.model_id, modelRevisionId: row.id };
    } catch {
      return null;
    }
  }

  async createModelForUser(userId: string | null | undefined, projectId: string, body: Body) {
    await this.access(userId, projectId);
    const name = String(body?.name ?? "").trim();
    if (!name) throw new BadRequestException({ error: "name is required" });
    if (name.length > 120) throw new BadRequestException({ error: "name must be 120 characters or fewer" });
    const preview = this.validate(body?.model);
    const result = await this.db.transaction(async (client) => {
      const model = await client.query("INSERT INTO mbt_models (project_id, name, created_by) VALUES ($1,$2,$3) RETURNING *", [
        projectId,
        name,
        userId
      ]);
      const revision = await client.query(
        `INSERT INTO mbt_model_revisions (model_id, project_id, revision_number, content, content_hash, status, created_by)
         VALUES ($1,$2,1,$3::jsonb,$4,'draft',$5) RETURNING *`,
        [model.rows[0].id, projectId, JSON.stringify(preview.definition), preview.candidateDigest, userId]
      );
      return { model: model.rows[0], revision: revision.rows[0] };
    });
    return this.modelView(result.model, result.revision, true);
  }

  /**
   * Retire a model. This is a soft archive: revisions and mappings stay stored as history, but the
   * model disappears from the list, detail, coverage, link and generate surfaces. Archiving twice is
   * a 404 rather than a silent success, so a caller cannot mistake an already-retired model for one
   * it just retired.
   */
  async archiveModelForUser(userId: string | null | undefined, projectId: string, modelId: string) {
    await this.access(userId, projectId);
    if (!UUID.test(modelId)) throw new NotFoundException({ error: "Model not found" });
    const archived = await this.db.query(
      `UPDATE mbt_models SET archived_at = now()
       WHERE id = $1 AND project_id = $2 AND archived_at IS NULL
       RETURNING id, archived_at`,
      [modelId, projectId]
    );
    if (!archived.rows[0]) throw new NotFoundException({ error: "Model not found" });
    return { ok: true, id: archived.rows[0].id, archivedAt: archived.rows[0].archived_at };
  }

  async listModelsForUser(userId: string | null | undefined, projectId: string) {
    await this.access(userId, projectId);
    const res = await this.db.query(
      `SELECT m.*, r.id AS latest_revision_id, r.revision_number AS latest_revision_number,
              r.parent_revision_id AS latest_parent_revision_id, r.status AS latest_status,
              r.content_hash AS latest_content_hash, r.created_at AS latest_revision_created_at,
              a.id AS approval_id, a.content_hash AS approval_hash, a.approved_by AS approval_by,
              a.created_at AS approval_at, a.model_revision_id AS approval_revision_id
       FROM mbt_models m
       LEFT JOIN LATERAL (
         SELECT * FROM mbt_model_revisions r
         WHERE r.model_id = m.id AND r.project_id = m.project_id
         ORDER BY r.revision_number DESC LIMIT 1
       ) r ON true
       LEFT JOIN mbt_model_approvals a ON a.model_revision_id = r.id AND a.project_id = m.project_id
       WHERE m.project_id = $1 AND m.archived_at IS NULL
       ORDER BY m.created_at DESC`,
      [projectId]
    );
    return res.rows.map((row) => {
      const revision = row.latest_revision_id
        ? {
            id: row.latest_revision_id,
            model_id: row.id,
            revision_number: row.latest_revision_number,
            parent_revision_id: row.latest_parent_revision_id,
            status: row.latest_status,
            content_hash: row.latest_content_hash,
            created_at: row.latest_revision_created_at
          }
        : null;
      const approval = row.approval_id
        ? {
            model_revision_id: row.approval_revision_id,
            content_hash: row.approval_hash,
            approved_by: row.approval_by,
            created_at: row.approval_at
          }
        : null;
      return this.modelView(row, revision, false, approval);
    });
  }

  async getModelForUser(userId: string | null | undefined, projectId: string, modelId: string) {
    await this.access(userId, projectId);
    if (!UUID.test(modelId)) throw new NotFoundException({ error: "Model not found" });
    const model = await this.db.query("SELECT * FROM mbt_models WHERE id = $1 AND project_id = $2 AND archived_at IS NULL", [modelId, projectId]);
    if (!model.rows[0]) throw new NotFoundException({ error: "Model not found" });
    const revisions = await this.db.query(
      "SELECT * FROM mbt_model_revisions WHERE model_id = $1 AND project_id = $2 ORDER BY revision_number DESC",
      [modelId, projectId]
    );
    const approvals = await this.db.query(
      "SELECT * FROM mbt_model_approvals WHERE model_id = $1 AND project_id = $2",
      [modelId, projectId]
    );
    const approvalByRevision = new Map<string, Body>(
      approvals.rows.map((row) => [String(row.model_revision_id), row])
    );
    const head = revisions.rows[0] ?? null;
    return {
      ...this.modelView(model.rows[0], head, true, head ? approvalByRevision.get(String(head.id)) ?? null : null),
      revisions: revisions.rows.map((row) => this.revisionView(row, true, approvalByRevision.get(String(row.id)) ?? null))
    };
  }

  async saveRevisionForUser(userId: string | null | undefined, projectId: string, modelId: string, body: Body) {
    await this.access(userId, projectId);
    if (!UUID.test(modelId)) throw new NotFoundException({ error: "Model not found" });
    const preview = this.validate(body?.model);
    const baseRevisionId = body?.baseRevisionId;
    if (baseRevisionId !== undefined && (typeof baseRevisionId !== "string" || !UUID.test(baseRevisionId))) {
      throw new BadRequestException({ error: "baseRevisionId must be a revision id" });
    }
    const revision = await this.db.transaction(async (client) => {
      const model = await client.query(
        "SELECT * FROM mbt_models WHERE id = $1 AND project_id = $2 AND archived_at IS NULL FOR UPDATE",
        [modelId, projectId]
      );
      if (!model.rows[0]) throw new NotFoundException({ error: "Model not found" });
      const latest = await client.query(
        "SELECT * FROM mbt_model_revisions WHERE model_id = $1 AND project_id = $2 ORDER BY revision_number DESC LIMIT 1",
        [modelId, projectId]
      );
      const head = latest.rows[0];
      if (baseRevisionId && head && head.id !== baseRevisionId) {
        throw new ConflictException({ code: "STALE_BASE", error: "The model changed since this revision was loaded; reload before saving" });
      }
      const number = Number(head?.revision_number ?? 0) + 1;
      const inserted = await client.query(
        `INSERT INTO mbt_model_revisions (model_id, project_id, revision_number, parent_revision_id, content, content_hash, status, created_by)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,'draft',$7) RETURNING *`,
        [modelId, projectId, number, head?.id ?? null, JSON.stringify(preview.definition), preview.candidateDigest, userId]
      );
      return inserted.rows[0];
    });
    return this.revisionView(revision, true);
  }

  /**
   * Approve a revision as a human decision bound to the content hash the reviewer saw.
   *
   * Revisions stay immutable; approval is a receipt. Only the current head can be approved — approving
   * a superseded revision would attest behavior the model no longer offers. Approval is not coverage,
   * not execution and not runtime evidence.
   */
  async approveRevisionForUser(
    userId: string | null | undefined,
    projectId: string,
    modelId: string,
    revisionId: string,
    body: Body,
    principal?: ReviewPrincipal
  ) {
    requireHumanReviewPrincipal(principal);
    await this.access(userId, projectId);
    for (const value of [modelId, revisionId]) {
      if (!UUID.test(value)) throw new NotFoundException({ error: "Model revision not found" });
    }
    const expectedHash = body?.expectedHash;
    if (typeof expectedHash !== "string" || !HASH.test(expectedHash)) {
      throw new BadRequestException({ error: "expectedHash must be the revision contentHash that was reviewed" });
    }
    const result = await this.db.transaction(async (client) => {
      // Parent before revision locks: saving a new head and archiving the model cannot race
      // the decision's current/active check, or invert dispatch's model → revision order.
      await this.requireActiveModel(modelId, projectId, client);
      const revision = await client.query(
        `SELECT r.* FROM mbt_model_revisions r
         JOIN mbt_models m ON m.id = r.model_id AND m.project_id = r.project_id AND m.archived_at IS NULL
         WHERE r.id = $1 AND r.model_id = $2 AND r.project_id = $3
         FOR UPDATE OF r`,
        [revisionId, modelId, projectId]
      );
      if (!revision.rows[0]) throw new NotFoundException({ error: "Model revision not found" });
      const head = await client.query(
        "SELECT id FROM mbt_model_revisions WHERE model_id = $1 AND project_id = $2 ORDER BY revision_number DESC LIMIT 1",
        [modelId, projectId]
      );
      if (head.rows[0]?.id !== revisionId) {
        throw new ConflictException({
          code: "SUPERSEDED_REVISION",
          error: "Only the current revision can be approved; save a new revision and approve that"
        });
      }
      if (String(revision.rows[0].content_hash) !== expectedHash) {
        throw new ConflictException({
          code: "MODEL_APPROVAL_CONFLICT",
          error: "The revision changed since it was reviewed; reload before approving"
        });
      }
      await this.legacy.requireCurrentProjectAuthority(client, projectId, userId);
      const inserted = await client.query(
        `INSERT INTO mbt_model_approvals (project_id, model_id, model_revision_id, content_hash, approved_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (model_revision_id) DO NOTHING
         RETURNING *`,
        [projectId, modelId, revisionId, expectedHash, userId]
      );
      if (inserted.rows[0]) {
        await client.query("UPDATE mbt_model_revisions SET status = 'approved' WHERE id = $1 AND project_id = $2", [
          revisionId,
          projectId
        ]);
      }
      const receipt =
        inserted.rows[0] ??
        (await client.query("SELECT * FROM mbt_model_approvals WHERE model_revision_id = $1", [revisionId])).rows[0];
      const current = await client.query("SELECT * FROM mbt_model_revisions WHERE id = $1", [revisionId]);
      return { revision: current.rows[0], approval: receipt, alreadyApproved: !inserted.rows[0] };
    });
    return { ...this.revisionView(result.revision, true, result.approval), alreadyApproved: result.alreadyApproved };
  }

  /**
   * Turn selected path proposals into unapproved Draft cases. The revision must be approved first;
   * the server regenerates the proposals with the supplied generation inputs and accepts only their
   * digests, so a caller cannot invent a path. Each created case is linked to its digest, making a
   * repeated request idempotent.
   */
  async createCasesFromPathsForUser(
    userId: string | null | undefined,
    projectId: string,
    modelId: string,
    revisionId: string,
    body: Body,
    principal?: ReviewPrincipal
  ) {
    requireHumanReviewPrincipal(principal);
    await this.access(userId, projectId);
    for (const value of [modelId, revisionId]) {
      if (!UUID.test(value)) throw new NotFoundException({ error: "Model revision not found" });
    }
    const afterCommit: Array<() => Promise<void>> = [];
    const cases = await this.db.transaction(async (client) => {
      await this.requireActiveModel(modelId, projectId, client);
      const revision = await client.query(
        `SELECT r.*, m.name AS model_name FROM mbt_model_revisions r
         JOIN mbt_models m ON m.id = r.model_id AND m.project_id = r.project_id AND m.archived_at IS NULL
         WHERE r.id = $1 AND r.model_id = $2 AND r.project_id = $3`,
        [revisionId, modelId, projectId]
      );
      const row = revision.rows[0];
      if (!row) throw new NotFoundException({ error: "Model revision not found" });
      const approved = await client.query(
        "SELECT content_hash FROM mbt_model_approvals WHERE model_revision_id = $1 AND project_id = $2 FOR SHARE",
        [revisionId, projectId]
      );
      if (!approved.rows[0] || String(approved.rows[0].content_hash) !== String(row.content_hash)) {
        throw new ConflictException({
          code: "MODEL_NOT_APPROVED",
          error: "Approve this revision before creating cases from its proposals"
        });
      }
      const digests = Array.isArray(body?.digests) ? [...new Set(body.digests.map((digest: unknown) => String(digest)))] : [];
      if (!digests.length || digests.length > 64) {
        throw new BadRequestException({ error: "digests must name between 1 and 64 proposed paths" });
      }
      const options = this.generationOptions(body, row);
      const generated = generateModelPaths({
        definition: row.content as PreviewDefinition,
        revisionId: row.id,
        contentHash: row.content_hash,
        options
      });
      const byDigest = new Map(generated.paths.map((path) => [path.digest, path]));
      const unknown = digests.filter((digest) => !byDigest.has(digest));
      if (unknown.length) {
        throw new BadRequestException({ error: `Unknown or stale path digest(s): ${unknown.join(", ")}` });
      }
      const labels = new Map((row.content as PreviewDefinition).states.map((state) => [state.id, state.label]));
      // Same revision + digest must not be generated twice concurrently; the advisory lock is
      // transaction-scoped and only serializes callers of this method.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [
        `model-candidates:${projectId}:${revisionId}`
      ]);
      // Native case insertion also takes this mutex. Acquire it before authority rows, matching
      // reviewed proposal publication, so revocation/archive can win any earlier wait safely.
      await this.legacy.lockTestcaseSuiteWrites(client, projectId);
      await this.legacy.requireCurrentProjectAuthority(client, projectId, userId);
      const createdCases: Array<{ digest: string; testcaseId: string; created: boolean; title?: string }> = [];
      for (const digest of digests) {
        const path = byDigest.get(digest) as GeneratedPath;
        const existing = await client.query(
          "SELECT testcase_id FROM mbt_generated_cases WHERE model_revision_id = $1 AND path_digest = $2",
          [revisionId, digest]
        );
        // The path's states and transitions are recorded with the case: a governed run reports
        // observed results per model element, and the generation options that produced the path
        // are not persisted, so the digest alone cannot be mapped back later.
        const elementIds = [...path.stateIds, ...path.transitionIds];
        if (existing.rows[0]) {
          // Opportunistic backfill for a case generated before element_ids existed. The path was
          // just regenerated with the caller's options and matched by digest, so these are its
          // elements; an empty array is left alone once filled.
          await client.query(
            `UPDATE mbt_generated_cases SET element_ids = $3
             WHERE model_revision_id = $1 AND path_digest = $2 AND element_ids = '{}'`,
            [revisionId, digest, elementIds]
          );
          createdCases.push({ digest, testcaseId: existing.rows[0].testcase_id, created: false });
          continue;
        }
        const created = await this.legacy.createTestCase(
          projectId, userId, this.generatedCaseBody(row, path, labels), { client, afterCommit }
        );
        await client.query(
          `INSERT INTO mbt_generated_cases (project_id, model_id, model_revision_id, path_digest, testcase_id, created_by, element_ids)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [projectId, modelId, revisionId, digest, created.id, userId, elementIds]
        );
        createdCases.push({ digest, testcaseId: String(created.id), created: true, title: String(created.title) });
      }
      return createdCases;
    });
    for (const effect of afterCommit) await effect();
    return {
      modelId,
      revisionId,
      created: cases.filter((item) => item.created).length,
      skipped: cases.filter((item) => !item.created).length,
      cases,
      coverageAssertion: "none",
      executionAssertion: "none",
      note: "Generated cases are unapproved drafts derived from model proposals. A proposal is not coverage and these cases are not execution evidence."
    };
  }

  /** The case a proposal becomes: a Draft with the path's transitions as steps and honest provenance. */
  private generatedCaseBody(revisionRow: Body, path: GeneratedPath, labels: Map<string, string>) {
    const transitions = (revisionRow.content as PreviewDefinition).transitions;
    const byId = new Map(transitions.map((transition) => [transition.id, transition]));
    const steps = path.transitionIds.map((id, index) => {
      const transition = byId.get(id);
      return {
        stepNumber: index + 1,
        action: transition?.action ?? id,
        expectedResult: transition?.expectedObservation ?? ""
      };
    });
    const route = path.stateIds.map((id) => labels.get(id) ?? id).join(" → ");
    const title = `Model: ${route}`.slice(0, 255);
    const description = [
      `Generated from expected-behavior model "${revisionRow.model_name}" revision ${revisionRow.revision_number}, path ${path.digest}.`,
      "",
      ...steps.map((step) => `${step.stepNumber}. ${step.action} — expected: ${step.expectedResult}`),
      "",
      "This is an unapproved draft derived from a model proposal; review it before approving. A mapping or proposal is not verified coverage, execution or runtime evidence."
    ].join("\n");
    return { title, description, steps, status: "Draft", type: "Functional", priority: "P2" };
  }

  async linkCaseForUser(userId: string | null | undefined, projectId: string, modelId: string, revisionId: string, body: Body) {
    await this.access(userId, projectId);
    for (const value of [modelId, revisionId]) {
      if (!UUID.test(value)) throw new NotFoundException({ error: "Model revision not found" });
    }
    return this.db.transaction(client => this.linkCase(client, userId, projectId, modelId, revisionId, body));
  }

  private async linkCase(
    client: PoolClient, userId: string | null | undefined, projectId: string,
    modelId: string, revisionId: string, body: Body
  ) {
    await this.requireActiveModel(modelId, projectId, client);
    const revision = await client.query(
      "SELECT * FROM mbt_model_revisions WHERE id = $1 AND model_id = $2 AND project_id = $3",
      [revisionId, modelId, projectId]
    );
    if (!revision.rows[0]) throw new NotFoundException({ error: "Model revision not found" });
    const content = revision.rows[0].content as { states: Array<{ id: string }>; transitions: Array<{ id: string }> };
    const elementIds = body?.elementIds;
    if (!Array.isArray(elementIds) || !elementIds.length) {
      throw new BadRequestException({ error: "elementIds must name at least one model element" });
    }
    const unique = [...new Set(elementIds.map((value: unknown) => String(value ?? "").trim()).filter(Boolean))];
    const known = new Set([...content.states.map((s) => s.id), ...content.transitions.map((t) => t.id)]);
    const unknown = unique.filter((id) => !known.has(id));
    if (unknown.length) throw new BadRequestException({ error: `Unknown model element(s): ${unknown.join(", ")}` });

    const testcaseId = String(body?.testcaseId ?? "");
    if (!UUID.test(testcaseId)) throw new BadRequestException({ error: "testcaseId must be a test case id" });
    const testcase = await client.query(
      `SELECT id, ${TESTCASE_EDIT_REVISION_SQL} AS edit_revision
       FROM testcases WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL FOR SHARE`,
      [testcaseId, projectId]
    );
    if (!testcase.rows[0]) throw new NotFoundException({ error: "Test case not found" });
    const testcaseRevision = body?.testcaseRevision;
    if (testcaseRevision !== undefined && (typeof testcaseRevision !== "string" || !HASH.test(testcaseRevision))) {
      throw new BadRequestException({ error: "testcaseRevision must be the case editRevision or omitted" });
    }
    if (testcaseRevision !== undefined && testcaseRevision !== String(testcase.rows[0].edit_revision)) {
      throw new ConflictException({
        code: "MAPPING_CHANGED",
        error: "This test case changed. Review its current content before linking it."
      });
    }

    const inserted = await client.query(
      `INSERT INTO mbt_model_case_links (project_id, model_id, model_revision_id, testcase_id, testcase_revision, element_ids, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::text[],$7)
       ON CONFLICT (model_revision_id, testcase_id, element_ids) DO NOTHING
       RETURNING *`,
      [projectId, modelId, revisionId, testcaseId, testcaseRevision ?? null, unique, userId]
    );
    const row = inserted.rows[0] ?? (await client.query(
      "SELECT * FROM mbt_model_case_links WHERE model_revision_id = $1 AND testcase_id = $2 AND element_ids = $3::text[]",
      [revisionId, testcaseId, unique]
    )).rows[0];
    if (String(row.testcase_revision ?? "") !== String(testcaseRevision ?? "")) {
      throw new ConflictException({
        code: "MAPPING_CHANGED",
        error: "This mapping records a different case revision. Review and remove the old mapping before linking the current case."
      });
    }
    return this.linkView(row);
  }

  async unlinkCaseForUser(userId: string | null | undefined, projectId: string, modelId: string, revisionId: string, linkId: string) {
    await this.access(userId, projectId);
    if (![modelId, revisionId, linkId].every((value) => UUID.test(value))) {
      throw new NotFoundException({ error: "Model link not found" });
    }
    return this.db.transaction(async client => {
      await this.requireActiveModel(modelId, projectId, client);
      const removed = await client.query(
        "DELETE FROM mbt_model_case_links WHERE id = $1 AND model_id = $2 AND model_revision_id = $3 AND project_id = $4",
        [linkId, modelId, revisionId, projectId]
      );
      if (!removed.rowCount) throw new NotFoundException({ error: "Model link not found" });
      return { ok: true };
    });
  }

  /**
   * Dispatches the model's current, approved revision into a native Test Run.
   *
   * The rules, in order:
   *  - only the model's **latest** revision is a dispatchable basis. Saving a new revision moves the
   *    basis and blocks dispatch until that revision is approved (no second "active" pointer);
   *  - that revision must carry an approval receipt whose content hash matches it;
   *  - only cases that **belong to this revision** may enter the run: generated from its proposals
   *    (`mbt_generated_cases`) or explicitly linked to it (`mbt_model_case_links`). A case from
   *    another model, or one merely selected in the UI, is refused by id;
   *  - only Approved, non-deleted cases can be attached — the native Approved-only writer remains
   *    authoritative, and this method refuses up front with the same rule.
   *
   * The same native writer creates the run, memberships and executions inside this transaction.
   * Its manifest commits with them. The active model and relied-on mappings stay locked until
   * commit, so a concurrent revision/archive/unlink cannot leave a run based on stale authority.
   */
  async dispatchRunForUser(
    userId: string | null | undefined,
    projectId: string,
    modelId: string,
    revisionId: string,
    body: Body
  ) {
    await this.access(userId, projectId);
    for (const value of [modelId, revisionId]) {
      if (!UUID.test(value)) throw new NotFoundException({ error: "Model revision not found" });
    }
    return this.db.transaction(client => this.dispatchRun(client, userId, projectId, modelId, revisionId, body));
  }

  private async dispatchRun(
    client: PoolClient, userId: string | null | undefined, projectId: string,
    modelId: string, revisionId: string, body: Body
  ) {
    const model = await this.requireActiveModel(modelId, projectId, client);
    const revision = await client.query(
      "SELECT * FROM mbt_model_revisions WHERE id = $1 AND model_id = $2 AND project_id = $3",
      [revisionId, modelId, projectId]
    );
    const revisionRow = revision.rows[0];
    if (!revisionRow) throw new NotFoundException({ error: "Model revision not found" });

    const head = await client.query(
      "SELECT id FROM mbt_model_revisions WHERE model_id = $1 AND project_id = $2 ORDER BY revision_number DESC LIMIT 1",
      [modelId, projectId]
    );
    if (String(head.rows[0]?.id) !== String(revisionRow.id)) {
      throw new ConflictException({
        code: "SUPERSEDED_REVISION",
        error: "Only the model's current revision can start a run. Save a revision, approve it, then run it."
      });
    }
    const approval = await client.query(
      "SELECT * FROM mbt_model_approvals WHERE model_revision_id = $1 AND project_id = $2 FOR SHARE",
      [revisionId, projectId]
    );
    if (!approval.rows[0] || String(approval.rows[0].content_hash) !== String(revisionRow.content_hash)) {
      throw new ConflictException({
        code: "MODEL_NOT_APPROVED",
        error: "Approve this revision before running it"
      });
    }

    const generated = await client.query(
      `SELECT g.testcase_id, g.path_digest, g.element_ids, t.title, t.status, t.deleted_at IS NOT NULL AS deleted
       FROM mbt_generated_cases g
       JOIN testcases t ON t.id = g.testcase_id
       WHERE g.model_revision_id = $1 AND g.project_id = $2
       ORDER BY g.testcase_id, g.id FOR SHARE OF g`,
      [revisionId, projectId]
    );
    const linked = await client.query(
      `SELECT l.id, l.testcase_id, l.testcase_revision, l.element_ids, t.title, t.status, t.deleted_at IS NOT NULL AS deleted
       FROM mbt_model_case_links l
       JOIN testcases t ON t.id = l.testcase_id
       WHERE l.model_revision_id = $1 AND l.project_id = $2
       ORDER BY l.testcase_id, l.id FOR SHARE OF l`,
      [revisionId, projectId]
    );
    type EligibleCase = {
      title: string;
      status: string;
      deleted: boolean;
      elementIds: Set<string>;
      pathDigest: string | null;
      sources: string[];
      mappings: Array<{ id: string; testcaseRevision: string | null; basis: "CURRENT" | "UNRECORDED" }>;
    };
    const eligible = new Map<string, EligibleCase>();
    const entryFor = (id: string, row: Body): EligibleCase => {
      const existing = eligible.get(id) ?? {
        title: String(row.title ?? "Untitled test case"),
        status: String(row.status ?? ""),
        deleted: row.deleted === true,
        elementIds: new Set<string>(),
        pathDigest: null,
        sources: [],
        mappings: []
      };
      for (const elementId of Array.isArray(row.element_ids) ? row.element_ids : []) existing.elementIds.add(String(elementId));
      eligible.set(id, existing);
      return existing;
    };
    for (const row of generated.rows) {
      const entry = entryFor(String(row.testcase_id), row);
      entry.pathDigest = entry.pathDigest ?? String(row.path_digest);
      if (!entry.sources.includes("generated")) entry.sources.push("generated");
    }
    for (const row of linked.rows) {
      const entry = entryFor(String(row.testcase_id), row);
      if (!entry.sources.includes("linked")) entry.sources.push("linked");
      entry.mappings.push({ id: String(row.id), testcaseRevision: row.testcase_revision == null ? null : String(row.testcase_revision),
        basis: row.testcase_revision == null ? "UNRECORDED" : "CURRENT" });
    }

    const rawRequested = body?.caseIds;
    let requested: string[];
    if (rawRequested === undefined) {
      requested = [...eligible.keys()];
    } else {
      if (!Array.isArray(rawRequested) || rawRequested.length === 0 || rawRequested.length > 200) {
        throw new BadRequestException({ error: "caseIds must be a non-empty list of at most 200 case ids" });
      }
      requested = [...new Set(rawRequested.map((id: unknown) => String(id ?? "").trim()))];
      const malformed = requested.filter((id) => !UUID.test(id));
      if (malformed.length) throw new BadRequestException({ error: `Invalid case id(s): ${malformed.join(", ")}` });
    }
    const unknown = requested.filter((id) => !eligible.has(id));
    if (unknown.length) {
      throw new BadRequestException({
        code: "CASE_NOT_IN_MODEL",
        error: `These cases do not belong to this model revision: ${unknown.join(", ")}`
      });
    }
    // Mapping locks preserve the actual basis; case locks are acquired once, in stable order,
    // before refreshing authored data. A case edit that was already in flight must finish before
    // eligibility/title are read, and cannot change them again before the native snapshot commits.
    await client.query(
      "SELECT id FROM testcases WHERE project_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR SHARE",
      [projectId, requested]
    );
    const currentCases = await client.query(
      `SELECT id, title, status, deleted_at IS NOT NULL AS deleted, ${TESTCASE_EDIT_REVISION_SQL} AS edit_revision
       FROM testcases WHERE project_id = $1 AND id = ANY($2::uuid[])`,
      [projectId, requested]
    );
    const currentById = new Map(currentCases.rows.map(row => [String(row.id), row]));
    for (const id of requested) {
      const entry = eligible.get(id) as EligibleCase, current = currentById.get(id);
      entry.deleted = !current || current.deleted === true;
      entry.status = String(current?.status ?? "");
      entry.title = String(current?.title ?? "Untitled test case");
    }
    const ineligible = requested.filter((id) => {
      const entry = eligible.get(id) as EligibleCase;
      return entry.deleted || entry.status !== "Approved";
    });
    if (ineligible.length) {
      throw new ConflictException({
        code: "CASE_NOT_APPROVED",
        error: "Only Approved, non-deleted model cases can enter a run",
        caseIds: ineligible
      });
    }
    const changedMappings = requested.filter(id => (eligible.get(id) as EligibleCase).mappings.some(mapping =>
      mapping.testcaseRevision !== null && mapping.testcaseRevision !== String(currentById.get(id)?.edit_revision)
    ));
    if (changedMappings.length) {
      throw new ConflictException({
        code: "MAPPING_CHANGED",
        error: "A selected case changed since it was linked. Review and replace its mapping before starting a new run.",
        caseIds: changedMappings
      });
    }
    if (!requested.length) {
      throw new ConflictException({
        code: "NO_ELIGIBLE_CASES",
        error: "This revision has no Approved cases to run. Generate cases from its proposals and approve them first."
      });
    }

    const defaultName = `Model run: ${String(model.name)} r${Number(revisionRow.revision_number)}`.slice(0, 255);
    const created = await this.legacy.createCycleWithTestcasesForUser(userId, projectId, {
      name: body?.name === undefined || body?.name === "" ? defaultName : String(body.name),
      environment: body?.environment,
      buildVersion: body?.buildVersion,
      testcaseIds: requested
    }, client);
    if (created.added !== requested.length) {
      // Refuse inside the outer transaction: even an unexpected partial attach rolls back the
      // run, memberships and executions. There is no fallible compensating deletion afterward.
      throw new ConflictException({
        code: "CASE_NOT_APPROVED",
        error: "A selected case is no longer Approved. Nothing was created; review the cases and try again."
      });
    }

    // The native owner has created and locked this run in the same transaction. Capture its
    // actual occurrences before commit: testcaseId alone can later name a different membership
    // and reviewed snapshot after a user removes and re-adds a case to the editable native run.
    const native = await client.query(
      `SELECT ci.testcase_id, ci.id AS cycle_item_id, e.id AS execution_id, ci.snapshot_approval_revision
       FROM cycle_items ci
       JOIN cycles c ON c.id = ci.cycle_id AND c.project_id = $2
       JOIN executions e ON e.cycle_item_id = ci.id AND e.deleted_at IS NULL
       WHERE ci.cycle_id = $1 AND ci.deleted_at IS NULL`,
      [created.cycle.id, projectId]
    );
    const cases = requested.map((id) => {
      const matches = native.rows.filter(row => String(row.testcase_id) === id);
      const nativeOccurrence = this.nativeOccurrenceFor({ testcaseId: id, nativeOccurrence: matches.length === 1 ? {
        cycleItemId: matches[0].cycle_item_id, executionId: matches[0].execution_id,
        snapshotApprovalRevision: matches[0].snapshot_approval_revision
      } : null });
      if (native.rows.length !== requested.length || !nativeOccurrence) {
        throw new ConflictException({ code: "NATIVE_OCCURRENCE_UNAVAILABLE",
          error: "The native run did not expose one reviewed occurrence for every selected case. Nothing was created." });
      }
      const entry = eligible.get(id) as EligibleCase;
      return { testcaseId: id, title: entry.title, pathDigest: entry.pathDigest,
        elementIds: [...entry.elementIds], sources: entry.sources, mappings: entry.mappings, nativeOccurrence };
    });
    const manifest = {
      revisionNumber: Number(revisionRow.revision_number),
      contentHash: String(revisionRow.content_hash),
      approvalId: String(approval.rows[0].id),
      cases
    };
    const inserted = await client.query(
      `INSERT INTO mbt_model_runs
         (project_id, model_id, model_revision_id, approval_id, content_hash, cycle_id, created_by, manifest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        projectId,
        modelId,
        revisionId,
        approval.rows[0].id,
        revisionRow.content_hash,
        created.cycle.id,
        userId,
        JSON.stringify(manifest)
      ]
    );
    const runRow: Body = inserted.rows[0];
    return {
      ...this.modelRunView(runRow, created.cycle, manifest),
      requested: created.requested,
      added: created.added,
      skipped: created.skipped,
      note: "The run is native. Its results are case outcomes, not proof that the modeled behavior is correct."
    };
  }

  private modelRunView(row: Body, cycle: Body, manifest: Body) {
    return {
      id: row.id,
      projectId: row.project_id,
      modelId: row.model_id,
      modelRevisionId: row.model_revision_id,
      approvalId: row.approval_id,
      contentHash: row.content_hash,
      cycleId: row.cycle_id,
      createdAt: row.created_at,
      run: { id: cycle.id, name: cycle.name, status: cycle.status, environment: cycle.environment ?? null },
      manifest,
      coverageAssertion: "none",
      executionAssertion: "governed-run"
    };
  }

  private nativeOccurrenceFor(entry: Body): NativeOccurrence | null {
    const occurrence = entry.nativeOccurrence;
    return typeof entry.testcaseId === "string" && UUID.test(entry.testcaseId)
      && occurrence && typeof occurrence.cycleItemId === "string" && UUID.test(occurrence.cycleItemId)
      && typeof occurrence.executionId === "string" && UUID.test(occurrence.executionId)
      && typeof occurrence.snapshotApprovalRevision === "string" && HASH.test(occurrence.snapshotApprovalRevision)
      ? occurrence : null;
  }

  /** Legacy or ambiguous manifests have no trustworthy occurrence basis; never reconstruct it. */
  private manifestCases(manifest: Body): ManifestCase[] {
    const cases: ManifestCase[] = (Array.isArray(manifest?.cases) ? manifest.cases : []).map((value: unknown) => {
      const entry = value && typeof value === "object" ? value as Body : {};
      return { entry, occurrence: this.nativeOccurrenceFor(entry) };
    });
    const keys = (item: ManifestCase) => item.occurrence ? [
      `case:${item.entry.testcaseId}`, `item:${item.occurrence.cycleItemId}`, `execution:${item.occurrence.executionId}`
    ] : [];
    const counts = new Map<string, number>();
    for (const item of cases) for (const key of keys(item)) counts.set(key, (counts.get(key) ?? 0) + 1);
    // Reject every member of a duplicate group, rather than allowing the last mapping to win.
    return cases.map(item => keys(item).some(key => counts.get(key)! > 1) ? { ...item, occurrence: null } : item);
  }

  /** One native evidence projection feeds both run rollups and per-element attribution. */
  private async governedRunEvidenceFor(revisionId: string, projectId: string): Promise<GovernedRunEvidence[]> {
    const runs = await this.db.query(
      `SELECT mr.id, mr.cycle_id, mr.created_at, mr.manifest, c.name AS cycle_name, c.deleted_at AS cycle_deleted
       FROM mbt_model_runs mr
       JOIN cycles c ON c.id = mr.cycle_id AND c.project_id = mr.project_id
       WHERE mr.model_revision_id = $1 AND mr.project_id = $2
       ORDER BY mr.created_at DESC`,
      [revisionId, projectId]
    );
    if (!runs.rows.length) return [];
    const executions = await this.db.query(
      `SELECT mr.id AS model_run_id, ci.testcase_id, ci.id AS cycle_item_id, e.id AS execution_id,
              ci.snapshot_approval_revision, e.status
       FROM mbt_model_runs mr
       JOIN cycles c ON c.id = mr.cycle_id AND c.project_id = mr.project_id
       JOIN cycle_items ci ON ci.cycle_id = mr.cycle_id AND ci.deleted_at IS NULL
       JOIN executions e ON e.cycle_item_id = ci.id AND e.deleted_at IS NULL
       WHERE mr.model_revision_id = $1 AND mr.project_id = $2`,
      [revisionId, projectId]
    );
    const byOccurrence = new Map<string, Body | null>();
    for (const row of executions.rows) {
      const key = `${row.model_run_id}:${row.cycle_item_id}:${row.execution_id}`;
      byOccurrence.set(key, byOccurrence.has(key) ? null : row);
    }
    return runs.rows.map(row => ({
      row,
      cases: this.manifestCases(row.manifest).map(item => {
        const pin = item.occurrence;
        const result = pin ? byOccurrence.get(`${row.id}:${pin.cycleItemId}:${pin.executionId}`) : null;
        const matches = result && result.testcase_id === item.entry.testcaseId
          && result.snapshot_approval_revision === pin?.snapshotApprovalRevision && typeof result.status === "string";
        return { ...item, status: matches ? result.status as string : null };
      })
    }));
  }

  /** Counts describe the immutable dispatch; statuses use only its original active occurrences. */
  private async governedRunsFor(revisionId: string, projectId: string, evidence?: GovernedRunEvidence[]) {
    const runs = evidence ?? await this.governedRunEvidenceFor(revisionId, projectId);
    return runs.map(({ row, cases }) => {
      const statusCounts: Record<string, number> = {};
      for (const item of cases) if (item.status !== null) statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
      const unknownCaseCount = cases.filter(item => !item.occurrence).length;
      return {
        id: row.id, cycleId: row.cycle_id, name: row.cycle_name, createdAt: row.created_at,
        caseCount: cases.length, runDeleted: row.cycle_deleted !== null, statusCounts,
        occurrenceBasis: cases.length && !unknownCaseCount ? "PINNED" as const : "UNKNOWN" as const,
        attributedCaseCount: cases.filter(item => item.status !== null).length,
        unavailableCaseCount: cases.filter(item => item.occurrence && item.status === null).length,
        unknownCaseCount
      };
    });
  }

  /**
   * Observed case outcomes per model element, across this revision's governed runs.
   *
   * The element list comes from each run's immutable manifest, not from today's links: a link
   * removed after dispatch does not rewrite what that run exercised. Results are native execution
   * statuses — this is not model verification or behavioral coverage.
   */
  private async observedByElementFor(revisionId: string, projectId: string, evidence?: GovernedRunEvidence[]) {
    const runs = evidence ?? await this.governedRunEvidenceFor(revisionId, projectId);
    const perElement = new Map<string, { runs: Set<string>; results: number; statusCounts: Record<string, number> }>();
    for (const run of runs) {
      for (const item of run.cases) {
        if (item.status === null) continue;
        const elements = new Set<string>(Array.isArray(item.entry.elementIds) ? item.entry.elementIds.map(String) : []);
        for (const elementId of elements) {
          const entry = perElement.get(elementId) ?? { runs: new Set<string>(), results: 0, statusCounts: {} };
          entry.runs.add(String(run.row.id));
          entry.results += 1;
          entry.statusCounts[item.status] = (entry.statusCounts[item.status] ?? 0) + 1;
          perElement.set(elementId, entry);
        }
      }
    }
    return [...perElement.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([elementId, entry]) => ({
        elementId,
        runs: entry.runs.size,
        results: entry.results,
        statusCounts: entry.statusCounts
      }));
  }

  /**
   * Provenance for a native Test Run that a model dispatched, or null for an ordinary run.
   *
   * The run detail page reads this so the model basis is visible where the results are, not only
   * from the studio. A cycle the project never dispatched from a model — or a cycle id from another
   * project — answers null; the caller renders nothing rather than an error.
   */
  async runProvenanceForUser(userId: string | null | undefined, projectId: string, cycleId: string) {
    await this.access(userId, projectId);
    if (!UUID.test(cycleId)) return null;
    const res = await this.db.query(
      `SELECT mr.id, mr.model_id, mr.model_revision_id, mr.content_hash, mr.approval_id, mr.created_at,
              m.name AS model_name, r.revision_number, a.created_at AS approved_at, a.approved_by, mr.manifest
       FROM mbt_model_runs mr
       JOIN mbt_models m ON m.id = mr.model_id AND m.project_id = mr.project_id
       JOIN mbt_model_revisions r ON r.id = mr.model_revision_id AND r.project_id = mr.project_id
       LEFT JOIN mbt_model_approvals a ON a.id = mr.approval_id
       WHERE mr.cycle_id = $1 AND mr.project_id = $2`,
      [cycleId, projectId]
    );
    const row = res.rows[0];
    if (!row) return null;
    const cases = this.manifestCases(row.manifest), unknownCaseCount = cases.filter(item => !item.occurrence).length;
    return {
      id: row.id,
      modelId: row.model_id,
      modelName: row.model_name,
      modelRevisionId: row.model_revision_id,
      revisionNumber: Number(row.revision_number),
      contentHash: row.content_hash,
      approvalId: row.approval_id,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by ?? null,
      dispatchedAt: row.created_at,
      caseCount: cases.length,
      occurrenceBasis: cases.length && !unknownCaseCount ? "PINNED" as const : "UNKNOWN" as const,
      pinnedCaseCount: cases.length - unknownCaseCount,
      unknownCaseCount
    };
  }

  async coverageForUser(userId: string | null | undefined, projectId: string, modelId: string) {
    await this.access(userId, projectId);
    if (!UUID.test(modelId)) throw new NotFoundException({ error: "Model not found" });
    await this.requireActiveModel(modelId, projectId);
    const revision = await this.db.query(
      "SELECT * FROM mbt_model_revisions WHERE model_id = $1 AND project_id = $2 ORDER BY revision_number DESC LIMIT 1",
      [modelId, projectId]
    );
    if (!revision.rows[0]) throw new NotFoundException({ error: "Model not found" });
    const content = revision.rows[0].content as { states: Array<{ id: string }>; transitions: Array<{ id: string }> };
    const ids = [...content.states.map((s) => s.id), ...content.transitions.map((t) => t.id)];
    // A soft-deleted case no longer exists for the repository, so it must not keep contributing
    // to current coverage. The link row is retained and reported as a deleted mapping below.
    const counts = await this.db.query(
      `SELECT element_id, COUNT(DISTINCT l.testcase_id)::int AS cases
       FROM mbt_model_case_links l
       JOIN testcases t ON t.id = l.testcase_id
       CROSS JOIN unnest(l.element_ids) AS element_id
       WHERE l.model_revision_id = $1 AND l.project_id = $2 AND t.deleted_at IS NULL
       GROUP BY element_id`,
      [revision.rows[0].id, projectId]
    );
    const byId = new Map<string, number>(counts.rows.map((row) => [String(row.element_id), Number(row.cases)]));
    const elements = ids.map((id) => ({ id, linkedCases: byId.get(id) ?? 0 }));

    // A model revision is immutable, so a later revision does not rewrite earlier mappings. They
    // simply stop contributing to the current revision's per-element counts. Report them instead
    // of presenting the gap as "no mapping": superseded links are a changed basis for review, not
    // coverage and not a reason to rewrite case history.
    const superseded = await this.db.query(
      `SELECT l.model_revision_id, r.revision_number, r.content_hash,
              COUNT(DISTINCT l.testcase_id)::int AS cases
       FROM mbt_model_case_links l
       JOIN mbt_model_revisions r ON r.id = l.model_revision_id AND r.project_id = l.project_id
       WHERE l.model_id = $1 AND l.project_id = $2 AND l.model_revision_id <> $3
       GROUP BY l.model_revision_id, r.revision_number, r.content_hash
       ORDER BY r.revision_number DESC`,
      [modelId, projectId, revision.rows[0].id]
    );
    const latestLinks = await this.db.query(
      `SELECT l.testcase_revision,
              ${TESTCASE_EDIT_REVISION_SQL} AS current_revision
       FROM mbt_model_case_links l
       JOIN testcases ON testcases.id = l.testcase_id
       WHERE l.model_revision_id = $1 AND l.project_id = $2 AND testcases.deleted_at IS NULL`,
      [revision.rows[0].id, projectId]
    );
    // The mappings themselves, so the studio can list and unlink them. Deleted cases stay in the
    // list (flagged) because the link row still exists and must remain removable; they no longer
    // contribute to the per-element counts above.
    const linkRows = await this.db.query(
      `SELECT l.id, l.testcase_id, l.element_ids, l.testcase_revision, l.created_at,
              testcases.title AS testcase_title, testcases.status AS testcase_status,
              testcases.deleted_at IS NOT NULL AS testcase_deleted,
              (l.testcase_revision IS NOT NULL
               AND l.testcase_revision <> ${TESTCASE_EDIT_REVISION_SQL}) AS changed_since_link
       FROM mbt_model_case_links l
       LEFT JOIN testcases ON testcases.id = l.testcase_id
       WHERE l.model_revision_id = $1 AND l.project_id = $2
       ORDER BY l.created_at ASC`,
      [revision.rows[0].id, projectId]
    );
    // Deleted mappings are computed across every revision: deleting a case invalidates a mapping
    // regardless of which model revision it targeted.
    const deleted = await this.db.query(
      `SELECT COUNT(DISTINCT l.testcase_id)::int AS cases
       FROM mbt_model_case_links l
       JOIN testcases t ON t.id = l.testcase_id
       WHERE l.model_id = $1 AND l.project_id = $2 AND t.deleted_at IS NOT NULL`,
      [modelId, projectId]
    );
    const approval = await this.db.query(
      "SELECT * FROM mbt_model_approvals WHERE model_revision_id = $1 AND project_id = $2",
      [revision.rows[0].id, projectId]
    );
    // Observed results for the linked cases, reported separately from the model itself. This is the
    // "what have these cases actually done" half of the honest coverage split; it is not model
    // verification and does not prove the modeled behavior is correct.
    const evidenceRows = await this.db.query(
      `SELECT l.testcase_id, e.status, COUNT(*)::int AS count, MAX(e.updated_at) AS last_at
       FROM mbt_model_case_links l
       JOIN testcases t ON t.id = l.testcase_id AND t.deleted_at IS NULL
       JOIN cycle_items ci ON ci.testcase_id = l.testcase_id
       JOIN executions e ON e.cycle_item_id = ci.id
       JOIN cycles c ON c.id = ci.cycle_id AND c.deleted_at IS NULL AND c.project_id = l.project_id
       WHERE l.model_revision_id = $1 AND l.project_id = $2
       GROUP BY l.testcase_id, e.status`,
      [revision.rows[0].id, projectId]
    );
    // The cases this revision's proposals actually produced, so the studio can show them back
    // instead of leaving the reviewer with a one-line notice.
    const generated = await this.db.query(
      `SELECT g.path_digest, g.testcase_id, g.created_at,
              testcases.title AS testcase_title, testcases.status AS testcase_status,
              testcases.deleted_at IS NOT NULL AS testcase_deleted
       FROM mbt_generated_cases g
       LEFT JOIN testcases ON testcases.id = g.testcase_id
       WHERE g.model_revision_id = $1 AND g.project_id = $2
       ORDER BY g.created_at ASC`,
      [revision.rows[0].id, projectId]
    );
    const evidenceByCase = new Map<string, Body>();
    for (const evidence of evidenceRows.rows) {
      const key = String(evidence.testcase_id);
      const entry = evidenceByCase.get(key) ?? { statusCounts: {}, latestStatus: null, latestAt: null };
      entry.statusCounts[String(evidence.status)] = Number(evidence.count);
      if (!entry.latestAt || new Date(evidence.last_at).getTime() > new Date(entry.latestAt as string).getTime()) {
        entry.latestAt = evidence.last_at;
        entry.latestStatus = evidence.status;
      }
      evidenceByCase.set(key, entry);
    }
    const caseEvidence = linkRows.rows
      .filter((row) => row.testcase_deleted !== true)
      .map((row) => ({
        testcaseId: row.testcase_id,
        testcaseTitle: row.testcase_title ?? "Deleted test case",
        ...(evidenceByCase.get(String(row.testcase_id)) ?? { statusCounts: {}, latestStatus: null, latestAt: null })
      }));

    const runEvidence = await this.governedRunEvidenceFor(String(revision.rows[0].id), projectId);
    const governedRuns = await this.governedRunsFor(String(revision.rows[0].id), projectId, runEvidence);
    const observedByElement = await this.observedByElementFor(String(revision.rows[0].id), projectId, runEvidence);

    const latestHash = String(revision.rows[0].content_hash);
    let testcasesChangedSinceLink = 0;
    let testcasesWithoutRecordedRevision = 0;
    for (const row of latestLinks.rows) {
      if (row.testcase_revision == null) testcasesWithoutRecordedRevision += 1;
      else if (String(row.testcase_revision) !== String(row.current_revision)) testcasesChangedSinceLink += 1;
    }

    return {
      modelId,
      revisionId: revision.rows[0].id,
      elements,
      links: linkRows.rows.map((row) => ({
        id: row.id,
        testcaseId: row.testcase_id,
        testcaseTitle: row.testcase_title ?? "Deleted test case",
        testcaseStatus: row.testcase_status ?? null,
        elementIds: row.element_ids,
        testcaseRevision: row.testcase_revision,
        caseChangedSinceLink: row.testcase_revision !== null && row.changed_since_link === true,
        caseDeleted: row.testcase_deleted === true
      })),
      unlinkedElements: elements.filter((element) => element.linkedCases === 0).map((element) => element.id),
      mappingStaleness: {
        supersededRevisions: superseded.rows.map((row) => ({
          modelRevisionId: row.model_revision_id,
          revisionNumber: Number(row.revision_number),
          linkedCases: Number(row.cases),
          sameContentAsLatest: String(row.content_hash) === latestHash
        })),
        testcasesChangedSinceLink,
        testcasesWithoutRecordedRevision,
        deletedTestcases: Number(deleted.rows[0]?.cases ?? 0),
        note: "Staleness reports a changed basis for review. It never rewrites a case, link or history."
      },
      approval: approval.rows[0]
        ? {
            status: "APPROVED",
            contentHash: approval.rows[0].content_hash,
            approvedBy: approval.rows[0].approved_by ?? null,
            approvedAt: approval.rows[0].created_at
          }
        : { status: "NOT_APPROVED", contentHash: null, approvedBy: null, approvedAt: null },
      generatedCases: generated.rows.map((generatedCase) => ({
        pathDigest: generatedCase.path_digest,
        testcaseId: generatedCase.testcase_id,
        testcaseTitle: generatedCase.testcase_title ?? "Deleted test case",
        testcaseStatus: generatedCase.testcase_status ?? null,
        caseDeleted: generatedCase.testcase_deleted === true,
        createdAt: generatedCase.created_at
      })),
      caseEvidence,
      evidenceNote:
        "Case evidence is the observed result history of linked cases across native runs, separate from the original occurrences of a model dispatch. It is not model verification, coverage of the modeled behavior, or proof the expected behavior is correct.",
      governedRuns,
      observedByElement,
      coverageAssertion: "none",
      executionAssertion: governedRuns.length ? "governed-runs" : "none",
      note:
        "A linked case is an accepted mapping, not execution or verified coverage. Observed results use only the original active occurrences recorded by governed runs of this revision; later additions and unknown occurrence bases are not attributed. They do not prove the modeled behavior is correct."
    };
  }

  async generateForUser(
    userId: string | null | undefined,
    projectId: string,
    modelId: string,
    revisionId: string,
    body: Body
  ) {
    await this.access(userId, projectId);
    for (const value of [modelId, revisionId]) {
      if (!UUID.test(value)) throw new NotFoundException({ error: "Model revision not found" });
    }
    await this.requireActiveModel(modelId, projectId);
    const revision = await this.db.query(
      "SELECT * FROM mbt_model_revisions WHERE id = $1 AND model_id = $2 AND project_id = $3",
      [revisionId, modelId, projectId]
    );
    if (!revision.rows[0]) throw new NotFoundException({ error: "Model revision not found" });

    const generated = generateModelPaths({
      definition: revision.rows[0].content as PreviewDefinition,
      revisionId: revision.rows[0].id,
      contentHash: revision.rows[0].content_hash,
      options: this.generationOptions(body, revision.rows[0])
    });
    // Read-only: proposals are returned, never written to cases, tasks, runs or evidence.
    return { ...generated, modelId, revisionId: revision.rows[0].id, contentHash: revision.rows[0].content_hash };
  }

  /** Shared, validated generation inputs for preview-only generation and case creation. */
  private generationOptions(body: Body, revision: Body) {
    const strategy = (body?.strategy === undefined ? "edge_coverage" : String(body.strategy)) as GenerationStrategy;
    if (strategy !== "edge_coverage" && strategy !== "shortest_paths") {
      throw new BadRequestException({ error: "strategy must be edge_coverage or shortest_paths" });
    }
    const maxPaths = body?.maxPaths === undefined ? 20 : Number(body.maxPaths);
    if (!Number.isInteger(maxPaths) || maxPaths < 1 || maxPaths > 64) {
      throw new BadRequestException({ error: "maxPaths must be an integer between 1 and 64" });
    }
    const maxDepth = body?.maxDepth === undefined ? 12 : Number(body.maxDepth);
    if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 32) {
      throw new BadRequestException({ error: "maxDepth must be an integer between 1 and 32" });
    }
    const seed = body?.seed === undefined ? String(revision.id) : String(body.seed).trim();
    if (!seed || seed.length > 128) {
      throw new BadRequestException({ error: "seed must be a non-empty string of at most 128 characters" });
    }
    return { strategy, maxPaths, maxDepth, seed };
  }

  private linkView(row: Body) {
    if (!row) throw new NotFoundException({ error: "Model link not found" });
    return {
      id: row.id,
      projectId: row.project_id,
      modelId: row.model_id,
      modelRevisionId: row.model_revision_id,
      testcaseId: row.testcase_id,
      testcaseRevision: row.testcase_revision,
      elementIds: row.element_ids,
      createdAt: row.created_at,
      coverageAssertion: "none",
      executionAssertion: "none"
    };
  }
}
