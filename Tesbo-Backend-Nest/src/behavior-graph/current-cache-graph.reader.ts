import { ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import {
  projectCurrentCacheGraph,
  type CurrentCacheGraphCapture,
  type CurrentCaseRow,
  type CachedRequirementRow,
  type CurrentSourceScope
} from "./current-cache-graph-projection";

/**
 * All projections are extracted in ONE PostgreSQL SELECT / MVCC statement.
 * It neither calls provider APIs nor creates/upgrades upstream revisions.
 * LegacyService authorization happens BEFORE the SELECT and may perform its
 * existing account-workspace bookkeeping (outside this no-write capture).
 *
 * Do not convert source failures into [] or accept client-authored captures.
 * This is internal-only; not registered in a module / exposed through MCP/REST.
 */
export const CURRENT_CACHE_CAPTURE_SQL = `
WITH allowed AS (
  SELECT DISTINCT p.id, p.organization_id
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $3::uuid
    JOIN organization_members om ON om.organization_id = p.organization_id AND om.user_id = $3::uuid
   WHERE p.id = $1::uuid AND p.organization_id = $2::uuid
     AND (to_jsonb(p)->>'deleted_at') IS NULL
     AND (to_jsonb(p)->>'archived_at') IS NULL
     AND COALESCE((to_jsonb(p)->>'is_archived')::boolean, false) = false
     AND (to_jsonb(pm)->>'deleted_at') IS NULL
     AND (to_jsonb(om)->>'deleted_at') IS NULL
),
jira_map AS (
  SELECT m.project_id, m.id AS mapping_id, m.jira_project_id AS remote_id,
         c.id AS connection_id,
         CASE WHEN NULLIF(c.external_id,'') IS NULL AND NULLIF(c.site_url,'') IS NULL\n              THEN NULL ELSE jsonb_build_array(c.external_id,c.site_url)::text END AS namespace
    FROM jira_project_mappings m JOIN allowed a ON a.id = m.project_id
    LEFT JOIN integration_connections c ON c.organization_id = a.organization_id AND c.provider = 'jira'
   WHERE m.enabled = true
),
linear_map AS (
  SELECT m.project_id, m.id AS mapping_id, m.linear_team_id AS remote_id,
         concat(m.entity_type,':',m.linear_team_id)::text AS entity_scope,
         c.id AS connection_id,
         CASE WHEN NULLIF(c.external_id,'') IS NULL AND NULLIF(c.site_url,'') IS NULL\n              THEN NULL ELSE jsonb_build_array(c.external_id,c.site_url)::text END AS namespace
    FROM linear_project_mappings m JOIN allowed a ON a.id = m.project_id
    LEFT JOIN integration_connections c ON c.organization_id = a.organization_id AND c.provider = 'linear'
   WHERE m.enabled = true
),
notion_map AS (
  SELECT m.project_id, m.id AS mapping_id, m.notion_database_id AS remote_id,
         c.id AS connection_id,
         CASE WHEN NULLIF(c.external_id,'') IS NULL AND NULLIF(c.site_url,'') IS NULL\n              THEN NULL ELSE jsonb_build_array(c.external_id,c.site_url)::text END AS namespace
    FROM notion_project_mappings m JOIN allowed a ON a.id = m.project_id
    LEFT JOIN integration_connections c ON c.organization_id = a.organization_id AND c.provider = 'notion'
   WHERE m.enabled = true
)
SELECT EXISTS(SELECT 1 FROM allowed) AS authorized,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'projectId', t.project_id::text, 'id', t.id::text,
       'title', t.title, 'description', t.description,
       'preconditions', t.preconditions, 'postconditions', t.postconditions,
       'stepsJsonbText', t.steps::text, 'testData', t.test_data::text,
       'jiraIssueKey', t.jira_issue_key, 'linearIssueKey', t.linear_issue_key,
       'notionPageId', t.notion_page_id
     ) ORDER BY t.id), '[]'::jsonb)
     FROM testcases t JOIN allowed a ON a.id = t.project_id
    WHERE t.deleted_at IS NULL) AS cases,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'provider','jira','mappingId',m.mapping_id::text,'connectionId',m.connection_id::text,
       'namespace',m.namespace,'remoteProjectId',m.remote_id::text
     ) ORDER BY m.mapping_id), '[]'::jsonb) FROM jira_map m) AS jira_scopes,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'provider','linear','mappingId',m.mapping_id::text,'connectionId',m.connection_id::text,
       'namespace',m.namespace,'remoteProjectId',m.entity_scope
     ) ORDER BY m.mapping_id), '[]'::jsonb) FROM linear_map m) AS linear_scopes,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'provider','notion','mappingId',m.mapping_id::text,'connectionId',m.connection_id::text,
       'namespace',m.namespace,'remoteProjectId',m.remote_id::text
     ) ORDER BY m.mapping_id), '[]'::jsonb) FROM notion_map m) AS notion_scopes,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'projectId',t.project_id::text,'provider','jira','rowId',t.id::text,
       'key',t.jira_issue_key,'remoteId',t.jira_issue_id::text,
       'summary',t.summary,'description',t.description,'propertiesJsonbText',NULL
     ) ORDER BY t.id), '[]'::jsonb)
     FROM jira_tickets t JOIN jira_map m
       ON m.project_id=t.project_id
      AND m.remote_id::text=t.mapped_remote_id::text
      AND m.connection_id=t.jira_connection_id) AS jira_requirements,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'projectId',t.project_id::text,'provider','linear','rowId',t.id::text,
       'key',t.linear_issue_key,'remoteId',t.linear_issue_id::text,
       'summary',t.summary,'description',t.description,'propertiesJsonbText',NULL
     ) ORDER BY t.id), '[]'::jsonb)
     FROM linear_tickets t JOIN linear_map m
       ON m.project_id=t.project_id
      AND m.remote_id::text=t.mapped_remote_id::text
      AND m.connection_id=t.integration_connection_id) AS linear_requirements,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object(
       'projectId',t.project_id::text,'provider','notion','rowId',t.id::text,
       'key',t.notion_page_id::text,'remoteId',t.notion_page_id::text,
       'summary',t.summary,'description',t.description,
       'propertiesJsonbText',t.properties_json::text
     ) ORDER BY t.id), '[]'::jsonb)
     FROM notion_pages t JOIN notion_map m
       ON m.project_id=t.project_id
      AND m.remote_id::text=t.mapped_remote_id::text
      AND m.connection_id=t.integration_connection_id
    WHERE t.archived IS NOT TRUE) AS notion_requirements
`;

interface CaptureSqlRow {
  authorized: boolean;
  cases: CurrentCaseRow[];
  jira_scopes: CurrentSourceScope[];
  linear_scopes: CurrentSourceScope[];
  notion_scopes: CurrentSourceScope[];
  jira_requirements: CachedRequirementRow[];
  linear_requirements: CachedRequirementRow[];
  notion_requirements: CachedRequirementRow[];
}

/**
 * Internal current-cache snapshot reader. Its "complete" status means the local
 * authorized single SELECT completed without pagination or omitted rows. It does
 * NOT mean a remote Jira/Linear/Notion inventory or history is complete/fresh.
 */
@Injectable()
export class CurrentCacheGraphReader {
  constructor(
    private readonly db: DatabaseService,
    private readonly legacy: LegacyService
  ) {}

  async captureForUser(userId: string | null | undefined, projectId: string): Promise<CurrentCacheGraphCapture> {
    if (!userId) throw new ForbiddenException({ error: "Authenticated project membership required" });
    const project = await this.legacy.requireProjectAccess(userId, projectId);
    const result = await this.db.query<CaptureSqlRow>(
      CURRENT_CACHE_CAPTURE_SQL,
      [projectId, project.organization_id, userId]
    );
    const row = result.rows[0];
    // Recheck membership and project/organization scope inside the one source-data SELECT.
    // Do not interpret missing authorization as an empty-but-valid project.
    if (!row?.authorized) throw new ForbiddenException({ error: "Project access changed during graph capture" });
    return projectCurrentCacheGraph({
      projectId,
      inventoryStatus: "complete",
      diagnostics: [],
      sourceScopes: [...row.jira_scopes, ...row.linear_scopes, ...row.notion_scopes],
      requirements: [...row.jira_requirements, ...row.linear_requirements, ...row.notion_requirements],
      cases: row.cases
    });
  }
}
