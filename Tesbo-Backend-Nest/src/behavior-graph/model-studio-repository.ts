import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { TESTCASE_EDIT_REVISION_SQL } from "../legacy/testcase-edit-revision";
import { DraftPreviewError, previewDraftModel, type PreviewDefinition } from "./model-studio-preview.core";
import { generateModelPaths, type GenerationStrategy } from "./model-studio-generator";

type Body = Record<string, any>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;

/**
 * Persisted Model Studio Phase A: expected-model identity, immutable draft revisions and explicit
 * case links. This is deliberately not a second graph/approval/execution store:
 *
 *  - expected behavior lives here;
 *  - observed source declarations remain graph_capture_history / source bindings;
 *  - execution remains native cycles/executions/attachments.
 *
 * No approval, activation, generation or target execution route exists yet. A link is an accepted
 * mapping between two artifacts, never execution or coverage evidence.
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
  private async requireActiveModel(modelId: string, projectId: string) {
    const model = await this.db.query(
      "SELECT id FROM mbt_models WHERE id = $1 AND project_id = $2 AND archived_at IS NULL",
      [modelId, projectId]
    );
    if (!model.rows[0]) throw new NotFoundException({ error: "Model not found" });
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

  private modelView(model: Body, revision: Body | null, includeContent: boolean) {
    return {
      id: model.id,
      projectId: model.project_id,
      name: model.name,
      createdAt: model.created_at,
      latestRevision: revision ? this.revisionView(revision, includeContent) : null
    };
  }

  private revisionView(row: Body, includeContent: boolean) {
    return {
      id: row.id,
      modelId: row.model_id,
      revisionNumber: row.revision_number,
      parentRevisionId: row.parent_revision_id ?? null,
      status: row.status,
      contentHash: row.content_hash,
      createdAt: row.created_at,
      ...(includeContent ? { content: row.content, preview: this.previewOrNull(row) } : {}),
      authority: {
        expectedBehavior: true,
        observedSource: false,
        executionEvidence: false,
        approval: "NOT_APPROVED",
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
              r.content_hash AS latest_content_hash, r.created_at AS latest_revision_created_at
       FROM mbt_models m
       LEFT JOIN LATERAL (
         SELECT * FROM mbt_model_revisions r
         WHERE r.model_id = m.id AND r.project_id = m.project_id
         ORDER BY r.revision_number DESC LIMIT 1
       ) r ON true
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
      return this.modelView(row, revision, false);
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
    return {
      ...this.modelView(model.rows[0], revisions.rows[0] ?? null, true),
      revisions: revisions.rows.map((row) => this.revisionView(row, true))
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

  async linkCaseForUser(userId: string | null | undefined, projectId: string, modelId: string, revisionId: string, body: Body) {
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
    const testcase = await this.db.query("SELECT id FROM testcases WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL", [testcaseId, projectId]);
    if (!testcase.rows[0]) throw new NotFoundException({ error: "Test case not found" });
    const testcaseRevision = body?.testcaseRevision;
    if (testcaseRevision !== undefined && (typeof testcaseRevision !== "string" || !HASH.test(testcaseRevision))) {
      throw new BadRequestException({ error: "testcaseRevision must be the case editRevision or omitted" });
    }

    const inserted = await this.db.query(
      `INSERT INTO mbt_model_case_links (project_id, model_id, model_revision_id, testcase_id, testcase_revision, element_ids, created_by)
       VALUES ($1,$2,$3,$4,$5,$6::text[],$7)
       ON CONFLICT (model_revision_id, testcase_id, element_ids) DO NOTHING
       RETURNING *`,
      [projectId, modelId, revisionId, testcaseId, testcaseRevision ?? null, unique, userId]
    );
    const row = inserted.rows[0] ?? (await this.db.query(
      "SELECT * FROM mbt_model_case_links WHERE model_revision_id = $1 AND testcase_id = $2 AND element_ids = $3::text[]",
      [revisionId, testcaseId, unique]
    )).rows[0];
    return this.linkView(row);
  }

  async unlinkCaseForUser(userId: string | null | undefined, projectId: string, modelId: string, revisionId: string, linkId: string) {
    await this.access(userId, projectId);
    if (![modelId, revisionId, linkId].every((value) => UUID.test(value))) {
      throw new NotFoundException({ error: "Model link not found" });
    }
    await this.requireActiveModel(modelId, projectId);
    const removed = await this.db.query(
      "DELETE FROM mbt_model_case_links WHERE id = $1 AND model_id = $2 AND model_revision_id = $3 AND project_id = $4",
      [linkId, modelId, revisionId, projectId]
    );
    if (!removed.rowCount) throw new NotFoundException({ error: "Model link not found" });
    return { ok: true };
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
    // Deleted mappings are computed across every revision: deleting a case invalidates a mapping
    // regardless of which model revision it targeted.
    const deleted = await this.db.query(
      `SELECT COUNT(DISTINCT l.testcase_id)::int AS cases
       FROM mbt_model_case_links l
       JOIN testcases t ON t.id = l.testcase_id
       WHERE l.model_id = $1 AND l.project_id = $2 AND t.deleted_at IS NOT NULL`,
      [modelId, projectId]
    );
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
      coverageAssertion: "none",
      executionAssertion: "none",
      note: "A linked case is an accepted mapping, not execution or verified coverage."
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
    const seed = body?.seed === undefined ? String(revision.rows[0].id) : String(body.seed).trim();
    if (!seed || seed.length > 128) {
      throw new BadRequestException({ error: "seed must be a non-empty string of at most 128 characters" });
    }

    const generated = generateModelPaths({
      definition: revision.rows[0].content as PreviewDefinition,
      revisionId: revision.rows[0].id,
      contentHash: revision.rows[0].content_hash,
      options: { strategy, maxPaths, maxDepth, seed }
    });
    // Read-only: proposals are returned, never written to cases, tasks, runs or evidence.
    return { ...generated, modelId, revisionId: revision.rows[0].id, contentHash: revision.rows[0].content_hash };
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
