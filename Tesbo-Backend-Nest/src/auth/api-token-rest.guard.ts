import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { LegacyService } from "../legacy/legacy.service";

/**
 * Bearer tokens are project-bound machine credentials, not replacements for a
 * browser session. MCP tools retain their existing specialized scope checks.
 * REST routes lacking an explicit project prefix are deliberately unavailable
 * to API tokens until they have their own scoped authorization contract.
 */
const MCP_ROUTE = /^\/api\/(?:mcp|projects\/[0-9a-fA-F-]{36}\/mcp)\/?$/;
const PROJECT_ROUTE = /^\/api\/projects\/([0-9a-fA-F-]{36})(?:\/|$)/;
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Token credentials cannot administer the project, its members, or further tokens. */
const CONTROL_PLANE = /^\/(?:apikeys|members)(?:\/|$)/;

@Injectable()
export class ApiTokenRestGuard implements CanActivate {
  constructor(private readonly legacy: LegacyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = req.apiToken;
    if (!token) return true; // Preserve established browser-session auth.

    const path = (req.path ?? req.url ?? "").split("?")[0];
    if (MCP_ROUTE.test(path)) return true; // McpService owns JSON-RPC authorization.

    const match = PROJECT_ROUTE.exec(path);
    if (!match || !token.projectId || token.projectId.toLowerCase() !== match[1].toLowerCase()) {
      throw new ForbiddenException({ error: "API token is not authorized for this REST project route" });
    }

    const projectSuffix = path.slice(match[0].length - (match[0].endsWith("/") ? 1 : 0));
    // Project administration requires a human session, even for tokens with write scope.
    // Otherwise a token can mint new tokens, remove members, or archive its own project.
    if (CONTROL_PLANE.test(projectSuffix) ||
        (projectSuffix === "" || projectSuffix === "/") && !READ_METHODS.has(req.method.toUpperCase())) {
      throw new ForbiddenException({ error: "API token cannot administer project settings or credentials" });
    }

    if (!token.userId) {
      throw new ForbiddenException({ error: "API token must belong to a current project member" });
    }

    const requiredScope = READ_METHODS.has(req.method.toUpperCase()) ? "read" : "write";
    if (!token.scopes.includes(requiredScope)) {
      throw new ForbiddenException({ error: `API token requires ${requiredScope} scope for this operation` });
    }

    // Reuse the existing canonical project membership/workspace/archive check.
    await this.legacy.requireProjectAccess(token.userId, token.projectId);
    return true;
  }
}
