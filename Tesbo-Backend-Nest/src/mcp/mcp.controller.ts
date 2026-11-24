import { Body, Controller, Delete, Get, NotFoundException, Optional, Param, Post, Put, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../common/request.types";
import { McpService } from "./mcp.service";
import { MCP_SERVER_INSTRUCTIONS, MCP_SERVER_NAME, MCP_SESSION_HEADER, RpcCode, type JsonRpcId } from "./mcp.types";
import type { McpClientGrant } from "./mcp-access";
import { unsupportedMcpProtocol } from "./mcp-protocol-compat";
import { mcpOAuthDiscoveryPolicy, mcpOAuthProtectedResourceMetadata, mcpOAuthUnauthorizedChallenge } from "./mcp-oauth-discovery";
import { McpOAuthServer } from "../auth/mcp-oauth-server";
import { modernMcpResponse, validateModernMcpRequest } from "./mcp-oauth-modern";

/**
 * Tesbo MCP — HTTP transport.
 *
 * A single JSON-RPC 2.0 endpoint per project, plus a project-agnostic alias. Authentication is
 * the API bearer token resolved by AuthMiddleware (req.apiToken); browser-session callers are
 * rejected because MCP is a machine-client surface. The project is always the token's own
 * project (ApiTokenContext.projectId) — McpService never trusts a client-supplied value for it.
 *
 * Project-scoped form (kept for existing clients that pin a project in the URL):
 *   POST /api/projects/<projectId>/mcp
 *   Authorization: Bearer tsbo_...
 *   { "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
 * Here the URL's projectId is cross-checked against the token's own project inside McpService
 * (still required to match), so a token can never drive another project's data.
 *
 * Dynamic form (one shared URL for every user/project — nothing to edit per token):
 *   POST /api/mcp
 *   Authorization: Bearer tsbo_...
 * The project is read straight off the token, so this is exactly the project-scoped form with
 * the URL's projectId always equal to the token's own — same guarantee, no URL to keep in sync.
 *
 * Streamable HTTP, the parts that keep a client's tool list current after a deploy:
 *   - `initialize` answers with an Mcp-Session-Id bound to the current tool set.
 *   - A later request carrying an id from a different tool set gets HTTP 404, which the MCP spec
 *     requires a client to answer by re-initializing — so the first call after a deploy that
 *     changed a schema re-fetches tools/list, with no restart and no client-side change.
 *   - A request with no session id is served exactly as before, so a client that never adopted
 *     sessions keeps working (it just keeps its cached tool list until it reconnects).
 *   - Notifications get 202 with no body; GET/DELETE get 405 (no server stream, no explicit
 *     session termination — both allowed by the spec).
 * The response is written here rather than returned because Nest would otherwise overwrite the
 * 202/404 with the route's default 201, which ordinary replies keep.
 */
@Controller()
export class McpController {
  constructor(private readonly mcp: McpService, @Optional() private readonly oauth?: McpOAuthServer) {}

  /**
   * Opt-in, read-only *preview* of project-specific RFC 9728 discovery.
   * No OAuth issuer, client registration, token or MCP capability is activated.
   * Path is exact and the resource is formed from trusted server configuration.
   */
  @Get("/.well-known/oauth-protected-resource/api/projects/:projectId/mcp")
  protectedResourceMetadata(@Param("projectId") projectId: string) {
    const policy = mcpOAuthDiscoveryPolicy();
    if (!policy) throw new NotFoundException({ error: "OAuth discovery is not available" });
    try {
      return mcpOAuthProtectedResourceMetadata(policy, projectId);
    } catch {
      throw new NotFoundException({ error: "OAuth project resource is not available" });
    }
  }

  @Post("/api/projects/:projectId/mcp")
  async handle(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param("projectId") projectId: string,
    @Body() body: unknown
  ) {
    if (req.oauthAccess) {
      await this.respondOAuth(req, res, body, projectId);
      return;
    }
    const principal = this.requirePrincipal(req, res, projectId);
    await this.respond(req, res, body, principal, projectId);
  }

  @Post("/api/mcp")
  async handleForToken(@Req() req: AuthenticatedRequest, @Res() res: Response, @Body() body: unknown) {
    const principal = this.requirePrincipal(req);
    // No URL project to read, so hand the token's own project straight back to McpService's
    // scope check — it always matches, which is the point: the token is the only source of truth.
    await this.respond(req, res, body, principal, principal.projectId ?? "");
  }

  @Get("/api/projects/:projectId/mcp-access")
  getAccess(@Req() req: AuthenticatedRequest, @Param("projectId") projectId: string) {
    return this.mcp.getAccessSettings(req, projectId);
  }

  @Put("/api/projects/:projectId/mcp-access")
  updateAccess(@Req() req: AuthenticatedRequest, @Param("projectId") projectId: string, @Body() body: unknown) {
    return this.mcp.updateAccessSettings(req, projectId, body);
  }

  // Two handlers, not two decorators on one: Nest keeps a single route-method per handler.
  @Get(["/api/mcp", "/api/projects/:projectId/mcp"])
  async getNotAllowed(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    await this.methodNotAllowed(req, res);
  }

  @Delete(["/api/mcp", "/api/projects/:projectId/mcp"])
  async deleteNotAllowed(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    await this.methodNotAllowed(req, res);
  }

  private async methodNotAllowed(req: AuthenticatedRequest, res: Response) {
    const principal = this.requirePrincipal(req);
    const projectId = typeof req.params?.projectId === "string" ? req.params.projectId : principal.projectId ?? "";
    try { await this.mcp.authorizeRequest(principal, projectId); } catch (error) {
      res.status(403).json(this.mcp.toErrorResponse(null, error));
      return;
    }
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "The Tesbo MCP endpoint accepts POST only (no server-sent event stream, no session termination)." });
  }

  /**
   * OAuth access is accepted only for a verified opaque bearer bound to this
   * exact resource. The shared MCP service owns current membership, owner
   * consent, read-scope intersection and every tool handler. This transport
   * intentionally remains legacy-era until the 2026 stateless codec is tested.
   */
  private async respondOAuth(req: AuthenticatedRequest, res: Response, body: unknown, projectId: string) {
    const principal = req.oauthAccess;
    if (!principal || !this.oauth?.enabled) {
      throw new UnauthorizedException({ error: "A valid OAuth access token is required" });
    }
    let resource: string;
    try { resource = this.oauth.resource(projectId); }
    catch { throw new UnauthorizedException({ error: "OAuth resource is unavailable" }); }
    const modern = validateModernMcpRequest(req, body, new URL(resource).origin);
    if (!modern.ok) {
      res.status(modern.error.status).json(modern.error.body);
      return;
    }
    const info = { name: MCP_SERVER_NAME, version: this.mcp.serverVersion,
      instructions: MCP_SERVER_INSTRUCTIONS };
    // Never expose catalog/capabilities to a revoked client or removed member.
    if (modern.method === "server/discover") {
      try {
        await this.mcp.authorizeVerifiedOAuthReadOnly(principal, projectId, this.oauth.issuer, resource);
      } catch (error) {
        res.status(403).json(this.mcp.toErrorResponse(modern.id, error));
        return;
      }
      res.status(200).json(modernMcpResponse(
        { jsonrpc: "2.0", id: modern.id, result: {} }, modern.method, info
      ));
      return;
    }
    const result = await this.mcp.handleVerifiedOAuthReadOnlyRequest(
      body, principal, projectId, this.oauth.issuer, resource
    );
    if ("error" in result && result.error.code === RpcCode.ProjectScopeDenied) {
      res.status(403).json(result);
      return;
    }
    if ("error" in result && result.error.code === RpcCode.ScopeDenied) {
      const metadata = mcpOAuthDiscoveryPolicy();
      if (metadata) res.setHeader("WWW-Authenticate",
        `Bearer error="insufficient_scope", resource_metadata="${metadata.resourceOrigin}/.well-known/oauth-protected-resource/api/projects/${projectId}/mcp"`);
      res.status(403).json(result);
      return;
    }
    res.status(200).json(modernMcpResponse(result, modern.method, info));
  }

  private async respond(
    req: AuthenticatedRequest,
    res: Response,
    body: unknown,
    principal: NonNullable<AuthenticatedRequest["apiToken"]>,
    projectId: string
  ) {
    const rpc = (body && typeof body === "object" ? body : {}) as { id?: unknown; method?: unknown };
    const id: JsonRpcId = typeof rpc.id === "string" || typeof rpc.id === "number" ? rpc.id : null;
    const isInitialize = rpc.method === "initialize";
    const sessionId = req.header(MCP_SESSION_HEADER);

    let grant: McpClientGrant;
    try { ({ grant } = await this.mcp.authorizeRequest(principal, projectId)); } catch (error) {
      res.status(201).json(this.mcp.toErrorResponse(id, error));
      return;
    }
    // Only legacy initialize/session MCP is implemented here. A stateless 2026 client
    // must receive a recognizable UnsupportedProtocolVersion response BEFORE a stale
    // session check or tool dispatch; otherwise it could mistake legacy output
    // for a modern, capability-checked result.
    const unsupported = unsupportedMcpProtocol(body, req.header("MCP-Protocol-Version") ?? undefined);
    if (unsupported) {
      res.status(400).json(unsupported);
      return;
    }
    // initialize is exempt: it is how a client recovers from exactly this 404.
    if (sessionId && !isInitialize && !this.mcp.isCurrentSession(sessionId, principal, grant)) {
      res.status(404).json({
        jsonrpc: "2.0",
        id,
        error: { code: RpcCode.SessionExpired, message: "Session expired: the Tesbo MCP tool set changed. Re-initialize to load the current tools." }
      });
      return;
    }
    if (McpService.isNotification(body)) {
      res.status(202).end();
      return;
    }
    const result = await this.mcp.handleRequest(body, principal, projectId);
    if (isInitialize && "result" in result) {
      const version = (result.result as { serverInfo: { version: string } }).serverInfo.version;
      res.setHeader(MCP_SESSION_HEADER, this.mcp.newSessionId(version));
    }
    res.status(201).json(result);
  }

  private requirePrincipal(req: AuthenticatedRequest, res?: Response, resourceProjectId?: string) {
    const principal = req.apiToken;
    if (!principal) {
      // Machine surface: must present a valid API bearer token (not a browser session).
      // Preview-only discovery; the OAuth bearer path remains disabled.
      // This challenge is never attached to the dynamic/ambiguous /api/mcp alias.
      if (res && resourceProjectId) {
        const policy = mcpOAuthDiscoveryPolicy();
        if (policy) {
          try { res.setHeader("WWW-Authenticate", mcpOAuthUnauthorizedChallenge(policy, resourceProjectId)); }
          catch { /* invalid resource: do not advertise a misleading challenge */ }
        }
      }
      throw new UnauthorizedException({ error: "MCP requires a valid API token (Authorization: Bearer <token>)" });
    }
    return principal;
  }
}
