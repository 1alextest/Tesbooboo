import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import { PlanLimitsService } from "./plan-limits.service";

/**
 * Enforces the read-only lock on projects beyond the Launch allowance, once a former Pro
 * workspace's grace window has closed.
 *
 * Applied globally rather than at each call site: there are ~67 mutating routes under
 * /api/projects/:id, and a per-handler check would be forgotten by the next route added. A guard
 * covers all of them and any future ones by construction.
 *
 * Deliberately narrow:
 *   - Safe methods pass untouched, so locked projects stay fully READABLE. Customers can always see
 *     and export their data; this restricts changes, it never withholds anything.
 *   - DELETE on the project itself passes, because that archives it (see deleteProject) and archived
 *     projects don't count toward the limit. Without this exemption the advice to "archive another
 *     project" would be impossible to follow — the lock would be inescapable without paying.
 */
const PROJECT_PATH = /^\/api\/projects\/([0-9a-fA-F-]{36})(\/.*)?$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class ProjectWriteLockGuard implements CanActivate {
  constructor(
    private readonly projectLookup: ProjectLookupService,
    private readonly planLimits: PlanLimitsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const path = (req.path ?? req.url ?? "").split("?")[0];
    const match = PROJECT_PATH.exec(path);
    if (!match) return true;

    const [, projectId, rest] = match;
    // MCP uses POST for reads/discovery too. Its shared dispatcher enforces writability
    // per existing tool scope after authorization, on both MCP routes (not by HTTP method).
    if (rest === "/mcp" || rest === "/mcp/") return true;
    // Consent revocation remains possible when billing locks ordinary project writes. The shared
    // MCP owner checks writability before any grant/enable/expiry expansion.
    if (rest === "/mcp-access" || rest === "/mcp-access/") return true;
    // This exact POST only validates an in-memory candidate. Its controller owns project
    // membership before the opt-in flag/body; entering billing enforcement here would notify
    // and write billing history before that authorization. Other KB mutations stay guarded.
    if (req.method === "POST" && /^\/knowledge-base\/requirements\/preview\/?$/i.test(rest ?? "")) return true;
    // The authenticated handoff reads an exact approved bundle; billing enforcement can itself
    // emit notifications or history. Its adjacent apply/approval routes still enforce the lock.
    if (req.method === "POST" && /^\/requirements\/proposals\/[^/]+\/automation-handoff\/?$/i.test(rest ?? "")) return true;
    // Archiving the project is the documented way out of the lock — never block it.
    if (req.method === "DELETE" && (!rest || rest === "/")) return true;

    // Same project row ProjectLookupService's other callers (loadWriteContext, externalIdPrefix)
    // read for this request — memoized there, not re-queried here. The archived_at check that used
    // to be a WHERE clause is applied here instead, since the shared lookup reads the row
    // unconditionally: an archived project must be treated exactly like a missing one.
    const project = await this.projectLookup.getProjectBasics(projectId);
    // Unknown or archived project: let the handler produce its own 404 rather than a confusing
    // plan-limit error.
    if (!project || project.archivedAt) return true;

    await this.planLimits.assertProjectWritable(project.organizationId, projectId);
    return true;
  }
}
