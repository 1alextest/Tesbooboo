import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ProjectSourceBindingReader } from "./project-source-binding";

export interface SourceBindingSettings {
  repositoryId: string;
  checkoutKey: string;
  refName: string;
  selectionPrefixes: string[];
  enabled: boolean;
}

/**
 * Native, owner-scoped administrative configuration. Paths and credentials
 * are never part of the API schema or persisted in project rows.
 */
@Injectable()
export class ProjectSourceBindingManagement {
  constructor(
    private readonly db: DatabaseService,
    private readonly bindings: ProjectSourceBindingReader
  ) {}

  private async requireOwner(userId: string | null | undefined, projectId: string): Promise<void> {
    if (!userId) throw new ForbiddenException({ error: "Project owner required" });
    const result = await this.db.query<{ allowed: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=pm.user_id
          WHERE p.id=$1::uuid AND pm.role='owner'
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
            AND (to_jsonb(pm)->>'deleted_at') IS NULL
            AND (to_jsonb(om)->>'deleted_at') IS NULL
       ) AS allowed`,
      [projectId, userId]
    );
    if (!result.rows[0]?.allowed) throw new ForbiddenException({ error: "Project owner required" });
  }

  async getForOwner(userId: string | null | undefined, projectId: string):
    Promise<{ configured: boolean; binding: SourceBindingSettings | null }> {
    await this.requireOwner(userId, projectId);
    const result = await this.db.query<{
      repository_id: string; checkout_key: string; ref_name: string;
      selection_prefixes: string[]; enabled: boolean;
    }>(
      `SELECT b.repository_id, b.checkout_key, b.ref_name, b.selection_prefixes, b.enabled
         FROM project_source_bindings b
         JOIN projects p ON p.id=b.project_id
         JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid AND pm.role='owner'
         JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=pm.user_id
        WHERE b.project_id=$1::uuid
          AND (to_jsonb(p)->>'archived_at') IS NULL
          AND (to_jsonb(p)->>'deleted_at') IS NULL
          AND (to_jsonb(pm)->>'deleted_at') IS NULL
          AND (to_jsonb(om)->>'deleted_at') IS NULL`,
      [projectId, userId]
    );
    const row = result.rows[0];
    return row
      ? { configured: true, binding: {
          repositoryId: row.repository_id, checkoutKey: row.checkout_key,
          refName: row.ref_name, selectionPrefixes: row.selection_prefixes,
          enabled: row.enabled
        } }
      : { configured: false, binding: null };
  }

  async setForOwner(
    userId: string | null | undefined, projectId: string, value: unknown
  ): Promise<{ configured: boolean; binding: SourceBindingSettings | null }> {
    await this.requireOwner(userId, projectId);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException({ error: "A source binding object is required" });
    }
    const data = value as Record<string, unknown>;
    const allowedKeys = ["repositoryId", "checkoutKey", "refName", "selectionPrefixes", "enabled"];
    if (Object.keys(data).length !== allowedKeys.length ||
        Object.keys(data).some((key) => !allowedKeys.includes(key))) {
      throw new BadRequestException({ error: "Only approved source binding fields are accepted" });
    }
    const { repositoryId, checkoutKey, refName, selectionPrefixes, enabled } = data;
    const pathOk = (prefix: unknown): prefix is string =>
      typeof prefix === "string" && prefix.length > 0 && prefix.length <= 512 &&
      !prefix.startsWith("/") && !prefix.includes("\\") &&
      prefix.split("/").every((part) => part.length > 0 && part !== "." && part !== "..") &&
      !/[\u0000-\u001f]/.test(prefix);
    if (typeof repositoryId !== "string" || typeof checkoutKey !== "string" ||
        typeof refName !== "string" || typeof enabled !== "boolean" ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryId) ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(checkoutKey) ||
        !/^[A-Za-z0-9._/-]{1,200}$/.test(refName) ||
        refName.startsWith("/") || refName.includes("..") || refName.endsWith("/") ||
        !Array.isArray(selectionPrefixes) || selectionPrefixes.length > 32 ||
        selectionPrefixes.some((prefix) => !pathOk(prefix)) ||
        new Set(selectionPrefixes).size !== selectionPrefixes.length ||
        !this.bindings.isApprovedCheckout(checkoutKey, repositoryId)) {
      throw new BadRequestException({ error: "Source must use an administrator-approved checkout, ref and selection" });
    }
    const result = await this.db.query<{ project_id: string }>(
      `WITH authorized AS MATERIALIZED (
         SELECT p.id FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid AND pm.role='owner'
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=pm.user_id
          WHERE p.id=$1::uuid
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean,false)=false
            AND (to_jsonb(pm)->>'deleted_at') IS NULL
            AND (to_jsonb(om)->>'deleted_at') IS NULL
          FOR SHARE OF p, pm, om
       )
       INSERT INTO project_source_bindings
         (project_id, repository_id, checkout_key, ref_name, selection_prefixes, enabled)
       SELECT id, $3, $4, $5, $6::text[], $7::boolean FROM authorized
       ON CONFLICT (project_id) DO UPDATE SET
         repository_id=EXCLUDED.repository_id, checkout_key=EXCLUDED.checkout_key,
         ref_name=EXCLUDED.ref_name, selection_prefixes=EXCLUDED.selection_prefixes,
         enabled=EXCLUDED.enabled, configured_at=now()
       RETURNING project_id::text`,
      [projectId, userId, repositoryId, checkoutKey, refName, selectionPrefixes, enabled]
    );
    if (result.rows.length !== 1) throw new ForbiddenException({ error: "Project owner required" });
    return { configured: true, binding: {
      repositoryId, checkoutKey, refName,
      selectionPrefixes: [...selectionPrefixes] as string[], enabled
    } };
  }
}
