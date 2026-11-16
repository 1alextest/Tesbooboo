import { BadRequestException, ForbiddenException, HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { DraftPreviewError, previewDraftModel } from "./model-studio-preview.core";

/** Native, opt-in, ephemeral M1 validation. No model/case/run writes. */
@Injectable()
export class ModelStudioPreview {
  constructor(private readonly db: DatabaseService, private readonly legacy: LegacyService) {}

  async availabilityForUser(userId: string | null | undefined, projectId: string) {
    if (!userId) throw new ForbiddenException({ error: "Project membership required" });
    const project = await this.legacy.requireProjectAccess(userId, projectId);
    await this.fenceCurrentAccess(userId, projectId, project.organization_id);
    return { schemaVersion: "tesbo-fsm-preview-availability/1" as const,
      enabled: process.env.TESBO_MODEL_PREVIEW_ENABLED === "1",
      semantics: "SEQUENTIAL_FSM" as const, maxStates: 32, maxTransitions: 64 };
  }

  async previewForUser(userId: string | null | undefined, projectId: string, input: unknown): Promise<ReturnType<typeof previewDraftModel>> {
    if (!userId) throw new ForbiddenException({ error: "Project membership required" });
    const project = await this.legacy.requireProjectAccess(userId, projectId);
    if (process.env.TESBO_MODEL_PREVIEW_ENABLED !== "1") {
      throw new ServiceUnavailableException({ code: "MODEL_PREVIEW_DISABLED", error: "Model draft preview is not enabled" });
    }
    let preview: ReturnType<typeof previewDraftModel>;
    try { preview = previewDraftModel(input); }
    catch (error: unknown) {
      if (!(error instanceof DraftPreviewError)) throw error;
      const body = { code: error.code, error: error.message };
      if (error.code === "UNSUPPORTED_SEMANTICS") throw new HttpException(body, 422);
      throw new BadRequestException(body);
    }
    // Reuse the native access boundary, then fence a revoke/archive occurring
    // during validation before returning any project-scoped result. No input
    // field can supply a tenant, principal, family identity or approval grant.
    await this.fenceCurrentAccess(userId, projectId, project.organization_id);
    return preview;
  }

  private async fenceCurrentAccess(userId: string, projectId: string, organizationId: string) {
    const access = await this.db.query<{ allowed: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$3::uuid
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=pm.user_id
          WHERE p.id=$1::uuid AND p.organization_id=$2::uuid
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
            AND (to_jsonb(pm)->>'deleted_at') IS NULL
            AND (to_jsonb(om)->>'deleted_at') IS NULL
       ) AS allowed`, [projectId, organizationId, userId]
    );
    if (!access.rows[0]?.allowed) throw new ForbiddenException({ error: "Project access changed during model preview" });
  }
}
