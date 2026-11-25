import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, UnauthorizedException } from "@nestjs/common";
import { ProjectSourceGraphCoordinator } from "../behavior-graph/project-source-graph.coordinator";
import { GraphChangeReviewDelivery } from "../behavior-graph/graph-change-review.delivery";
import { BUILD_GIT_SHA } from "../build-provenance";
import { DatabaseService } from "../database/database.service";
import { LegacyService } from "../legacy/legacy.service";
import { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { MCP_ACCESS_KEY, hasApprovedMcpToolPermission, isOAuthMcpGrant, onlyReducesMcpAccess, projectSettingsObject, readMcpAccess, validateMcpAccess, type ApiMcpClientGrant, type McpClientGrant, type OAuthMcpClientGrant } from "./mcp-access";
import { currentOAuthGrantBinding } from "../auth/mcp-oauth-grant-binding";
import type { ApiTokenContext, AuthenticatedRequest, OAuthMachineContext } from "../common/request.types";
import { ModelStudioPreview } from "../behavior-graph/model-studio-preview";
import { ModelStudioRepository } from "../behavior-graph/model-studio-repository";
import { humanPublicationRequired, isDirectTestcasePublisher, proposalReviewPreviewEnabled } from "../common/testcase-publication.policy";
import { buildMcpTools } from "./mcp.tools";
import {
  MCP_AGENT_SLUG,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INSTRUCTIONS,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
  McpError,
  RpcCode,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpTool,
  type McpToolContext,
  type TokenScope
} from "./mcp.types";

/**
 * Tesbo MCP — protocol engine.
 *
 * Handles a single JSON-RPC 2.0 request against the MCP surface (initialize / tools/list /
 * tools/call / ping) for a project-scoped API token. Four guarantees enforced here, before any
 * tool handler runs, close the gaps left open by the auth foundation (88a2505):
 *   1. Project scope — the token's project must match the project on the request URL.
 *   2. Consent      — the project is enabled and the credential has a current named client grant.
 *   3. Tool scope   — both the token and its client grant must permit the tool.
 *   4. Writability  — write tools obey the existing project plan lock; reads/discovery do not.
 *
 * Writes are attributed to a dedicated "tesbo-mcp" agent actor (seeded in V65) so machine
 * activity is distinguishable from human and Zyra activity in audit history.
 */
/**
 * Only a verified credential resolver may supply this runtime identity.
 * OAuth is not connected to HTTP yet and can only enter through isolated tests.
 * Absence of tokenId is intentional; never synthesize API-token provenance.
 */
type McpRuntimePrincipal = {
  projectId: string | null;
  userId: string | null;
  scopes: string[];
  tokenId?: string;
};

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly tools: McpTool[] = buildMcpTools();
  private readonly toolsByName = new Map(this.tools.map((t) => [t.name, t]));
  /*
   * A fingerprint of everything a client caches from this server: the tools/list payload and the
   * session instructions. MCP clients fetch tools/list once per session and keep it, and a
   * blue/green deploy swaps the process behind the same URL without breaking anything, so a client
   * connected before a deploy kept calling with the old schemas indefinitely (the "severity still
   * free text on stage" report). Session ids embed this value — see isCurrentSession.
   *
   * A content hash rather than GIT_SHA: it changes exactly when the schemas do (a deploy that
   * leaves MCP untouched does not force every client to reconnect), and it works even when the
   * build is unidentified ("local") — local dev, e2e, or a deploy exposing neither GIT_SHA nor
   * RAILWAY_GIT_COMMIT_SHA.
   */
  private readonly toolsFingerprint = createHash("sha256")
    .update(JSON.stringify({ tools: this.listToolsPayload(), instructions: MCP_SERVER_INSTRUCTIONS }))
    .digest("hex")
    .slice(0, 16);
  /** SemVer build metadata: which deploy (resolved build commit) and which tool set (fingerprint) this is. */
  readonly serverVersion = `${MCP_SERVER_VERSION}+${BUILD_GIT_SHA}.${this.toolsFingerprint}`;

  // Resolved once and reused — the MCP agent's actor id never changes at runtime.
  private mcpActorIdPromise: Promise<string | null> | null = null;

  constructor(
    private readonly legacy: LegacyService,
    private readonly db: DatabaseService,
    private readonly planLimits: PlanLimitsService,
    @Optional() private readonly graphCapture?: ProjectSourceGraphCoordinator,
    @Optional() private readonly graphNotificationDelivery?: GraphChangeReviewDelivery,
    @Optional() private readonly modelPreview?: ModelStudioPreview,
    @Optional() private readonly modelStudio?: ModelStudioRepository
  ) {}

  /** Actor id for the well-known "tesbo-mcp" agent (V65), used to attribute token-authed writes. */
  async resolveMcpActorId(): Promise<string | null> {
    if (!this.mcpActorIdPromise) {
      this.mcpActorIdPromise = this.db
        .query<{ id: string }>("SELECT a.id FROM actors a JOIN agents g ON g.id = a.id WHERE g.slug = $1", [
          MCP_AGENT_SLUG
        ])
        .then((res) => res.rows[0]?.id || null)
        .catch((err) => {
          this.logger.warn(`Failed to resolve MCP agent actor: ${err instanceof Error ? err.message : err}`);
          return null;
        });
    }
    return this.mcpActorIdPromise;
  }

  listTools(): McpTool[] {
    return this.tools;
  }

  /** Bind the session to the exact catalog version returned by this initialize response. */
  newSessionId(version = this.serverVersion): string {
    const fingerprint = version.match(/\.([0-9a-f]{16})$/)?.[1];
    if (!fingerprint) throw new Error("Cannot issue an MCP session without a valid catalog fingerprint");
    return `${fingerprint}.${randomUUID()}`;
  }

  /** False for an id issued against a different tool set (or not issued by this server at all). */
  isCurrentSession(sessionId: string, principal?: ApiTokenContext, grant?: McpClientGrant): boolean {
    const fingerprint = principal && grant ? this.catalogFingerprint(this.visibleTools(principal, grant)) : this.toolsFingerprint;
    return sessionId.startsWith(`${fingerprint}.`);
  }

  /** A JSON-RPC notification: no id, so no response is expected (Streamable HTTP answers 202). */
  static isNotification(body: unknown): boolean {
    const req = body as Partial<JsonRpcRequest> | null;
    return !!req && typeof req === "object" && req.jsonrpc === "2.0" && typeof req.method === "string" && req.method.startsWith("notifications/") && req.id === undefined;
  }

  private listToolsPayload() {
    return this.tools.filter(t => !t.hiddenFromDiscovery && (!t.proposalPreviewOnly || proposalReviewPreviewEnabled())).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
  }

  private visibleTools(principal: McpRuntimePrincipal, grant: McpClientGrant) {
    return this.listToolsPayload().filter(tool => this.clientCanUseTool(principal, grant, tool.name));
  }

  private catalogFingerprint(tools: ReturnType<McpService["listToolsPayload"]>): string {
    return createHash("sha256").update(JSON.stringify({ tools, instructions: MCP_SERVER_INSTRUCTIONS })).digest("hex").slice(0, 16);
  }

  /**
   * Handle one JSON-RPC request for an authenticated, project-scoped token.
   * `urlProjectId` is the project the transport (controller) routed the call to.
   * Always resolves to a JSON-RPC response object (errors are encoded, not thrown).
   */
  async handleRequest(
    body: unknown,
    principal: ApiTokenContext,
    urlProjectId: string
  ): Promise<JsonRpcResponse> {
    const req = body as Partial<JsonRpcRequest> | null;
    const id: JsonRpcId = req && (typeof req.id === "string" || typeof req.id === "number") ? req.id : null;

    try {
      // Authorization runs for every request before its shape is considered: a credential's project
      // consent, scope and grant are checked regardless of how well formed the body is, so a
      // malformed request can never be used to reach dispatch without passing that check.
      const { organizationId, grant } = await this.authorizeRequest(principal, urlProjectId);
      const parsed = this.parseRequest(body);
      const result = await this.dispatch(parsed.method, parsed.params, principal, organizationId, grant);
      return { jsonrpc: "2.0", id: parsed.id, result };
    } catch (err) {
      return this.toErrorResponse(id, err);
    }
  }

  /** Shape validation for a JSON-RPC 2.0 request; throws InvalidRequest rather than returning one. */
  private parseRequest(body: unknown): { id: JsonRpcId; method: string; params: Record<string, unknown> } {
    const req = body as Partial<JsonRpcRequest> | null;
    if (!req || req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      throw new McpError(RpcCode.InvalidRequest, "Invalid JSON-RPC 2.0 request");
    }
    return {
      id: typeof req.id === "string" || typeof req.id === "number" ? req.id : null,
      method: req.method,
      params: (req.params ?? {}) as Record<string, unknown>
    };
  }

  /** Every transport path (including cached sessions and notifications) rechecks current consent. */
  async authorizeRequest(principal: ApiTokenContext, urlProjectId: string): Promise<{ organizationId: string; grant: McpClientGrant }> {
    if (!principal.projectId || principal.projectId !== urlProjectId || !principal.userId) {
      throw new McpError(RpcCode.ProjectScopeDenied, "API token is not scoped to an accessible project");
    }
    let project: Record<string, any>;
    try {
      project = await this.legacy.requireProjectAccess(principal.userId, principal.projectId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw new McpError(RpcCode.ProjectScopeDenied, "API token issuer no longer has access to this project");
      }
      throw error;
    }
    // Read the authoritative row each time, not a session snapshot or a cached project projection.
    // Rechecking the credential also prevents a previously authenticated context surviving revocation.
    const current = await this.db.query(
      `SELECT p.settings, t.scopes FROM projects p
       JOIN api_tokens t ON t.project_id = p.id AND t.id = $2 AND t.user_id = $3
       WHERE p.id = $1 AND p.archived_at IS NULL`,
      [principal.projectId, principal.tokenId, principal.userId]
    );
    const row = current.rows[0];
    let access;
    try { access = row ? readMcpAccess(row.settings) : null; } catch { access = null; }
    const grant = access?.clients.find(client => !isOAuthMcpGrant(client) && client.tokenId === principal.tokenId.toLowerCase());
    const currentScopes = typeof row?.scopes === "string" ? row.scopes.split(",").map((scope: string) => scope.trim()) : [];
    if (!access?.enabled || !grant || grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now() ||
        !grant.scopes.length || grant.scopes.some(scope => !currentScopes.includes(scope))) {
      throw new McpError(RpcCode.ProjectScopeDenied, "External MCP access requires an enabled project and a current approved client credential");
    }
    return { organizationId: project.organization_id, grant };
  }

  /**
   * The future resource-server verifier may call this ONLY with a validated,
   * resource-bound opaque OAuth principal. This method reuses Tesbo's project
   * access and revisioned owner-grant policy; it is not token verification or
   * browser-session consent. No HTTP path currently calls this function.
   *
   * All OAuth operations in this slice are restricted to read and cannot
   * stage, mutate, approve or publish anything.
   */
  async authorizeVerifiedOAuthReadOnly(
    principal: OAuthMachineContext,
    urlProjectId: string,
    expectedIssuer: string,
    expectedResource: string
  ): Promise<{ organizationId: string; grant: OAuthMcpClientGrant }> {
    if (principal.kind !== "oauth_access" || !principal.userId || !principal.subject ||
        !principal.grantId || !principal.clientId ||
        principal.projectId !== urlProjectId || principal.resource !== expectedResource ||
        principal.issuer !== expectedIssuer || principal.scopes.length !== 1 ||
        principal.scopes[0] !== "mcp:read") {
      throw new McpError(RpcCode.ProjectScopeDenied, "OAuth principal is not read-scoped to this exact MCP resource");
    }
    let project: Record<string, any>;
    try {
      project = await this.legacy.requireProjectAccess(principal.userId, urlProjectId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw new McpError(RpcCode.ProjectScopeDenied, "OAuth user no longer has access to this project");
      }
      throw error;
    }
    const current = await this.db.query(
      "SELECT settings FROM projects WHERE id=$1 AND archived_at IS NULL", [urlProjectId]
    );
    let access;
    try { access = current.rows[0] ? readMcpAccess(current.rows[0].settings) : null; }
    catch { access = null; }
    const grant = access?.clients.find(g => isOAuthMcpGrant(g) && g.oauthClientId === principal.clientId);
    if (!grant || !isOAuthMcpGrant(grant) || !access?.enabled || grant.scopes.length !== 1 ||
        grant.scopes[0] !== "read" || grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now()) {
      throw new McpError(RpcCode.ProjectScopeDenied,
        "OAuth read access requires current project owner approval and a valid named client grant");
    }
    // Reapproval of the same client does not restore an earlier human consent.
    if (!(await currentOAuthGrantBinding(this.db, principal.grantId, {
      projectId: urlProjectId, accountId: principal.userId,
      clientId: principal.clientId, resource: expectedResource,
      approvalRevision: access.revision
    }))) {
      throw new McpError(RpcCode.ProjectScopeDenied,
        "OAuth consent has expired or was revoked; fresh authorization is required");
    }
    return { organizationId: project.organization_id, grant };
  }

  /**
   * Reuses the existing tool catalog/dispatcher for a future VERIFIED OAuth
   * resource principal. OAuth is not accepted by McpController yet: this is
   * deliberately unreachable over HTTP until the vetted AS and consent flow
   * produce an independently validated subject, audience and active grant.
   */
  async handleVerifiedOAuthReadOnlyRequest(
    body: unknown,
    principal: OAuthMachineContext,
    projectId: string,
    expectedIssuer: string,
    expectedResource: string
  ): Promise<JsonRpcResponse> {
    const input = body as Partial<JsonRpcRequest> | null;
    const id: JsonRpcId = input && (typeof input.id === "string" || typeof input.id === "number") ? input.id : null;
    try {
      const { organizationId, grant } = await this.authorizeVerifiedOAuthReadOnly(
        principal, projectId, expectedIssuer, expectedResource
      );
      const parsed = this.parseRequest(body);
      const normalized: McpRuntimePrincipal = { userId: principal.userId, projectId, scopes: ["read"] };
      return { jsonrpc: "2.0", id: parsed.id,
        result: await this.dispatch(parsed.method, parsed.params, normalized, organizationId, grant) };
    } catch (error) {
      return this.toErrorResponse(id, error);
    }
  }

  private clientCanUseTool(principal: McpRuntimePrincipal, grant: McpClientGrant, name: string): boolean {
    const tool = this.toolsByName.get(name);
    return !!tool && hasApprovedMcpToolPermission(principal.scopes, grant, tool.requiredScope, name);
  }

  /** Consent uses the existing MCP project access boundary, not a new LegacyService consumer. */
  async requireOAuthConsentProject(userId: string, projectId: string) {
    return this.legacy.requireProjectAccess(userId, projectId);
  }


  /** A member may inspect/revoke ONLY their own OAuth consent records.
   * This is not the owner-managed client allowlist and does not grant access.
   * Read-only history remains available while OAuth issuance is disabled. */
  private async humanOAuthConsentOwner(req: AuthenticatedRequest, projectId: string) {
    if (!req.userId || req.apiToken || req.oauthAccess || req.headers?.authorization) {
      throw new ForbiddenException({ error: "OAuth consents require a human Tesbo browser session" });
    }
    return this.legacy.requireProjectAccess(req.userId, projectId);
  }

  async listMyOAuthConsents(req: AuthenticatedRequest, projectId: string) {
    await this.humanOAuthConsentOwner(req, projectId);
    // A binding is evidence of consent, NOT evidence that a client is online.
    const rows = await this.db.query(
      `SELECT b.grant_fingerprint,b.client_id,b.resource,b.approval_revision,
              b.created_at,b.revoked_at,p.settings
         FROM mcp_oauth_grant_approval_bindings b
         JOIN projects p ON p.id=b.project_id AND p.archived_at IS NULL
        WHERE b.project_id=$1 AND b.account_id=$2
        ORDER BY b.created_at DESC,b.grant_fingerprint DESC LIMIT 51`,
      [projectId, req.userId]
    );
    const consents = rows.rows.slice(0, 50).map(row => {
      let approved = false;
      let label: string = row.client_id;
      let currentAllowedTools: string[] | null = null;
      try {
        const access = readMcpAccess(row.settings);
        const client = access.clients.find(c =>
          isOAuthMcpGrant(c) && c.oauthClientId === row.client_id);
        if (client && isOAuthMcpGrant(client)) {
          label = client.clientName;
          currentAllowedTools = client.allowedTools;
          approved = access.enabled && access.revision === Number(row.approval_revision) &&
            client.scopes.length === 1 && client.scopes[0] === "read" &&
            (!client.expiresAt || Date.parse(client.expiresAt) > Date.now());
        }
      } catch { /* Corrupt or unavailable policy must not appear authorized. */ }
      const status = row.revoked_at ? "revoked" :
        approved ? "consent_current" : "reconsent_required";
      return {
        id: row.grant_fingerprint as string,
        clientId: row.client_id as string,
        clientName: label,
        resource: row.resource as string,
        status,
        // Null is unrestricted only while current consent exists; otherwise no permission.
        currentAllowedTools: approved && !row.revoked_at ? currentAllowedTools : null,
        createdAt: new Date(row.created_at).toISOString(),
        revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null
      };
    });
    return { consents, truncated: rows.rows.length > 50 };
  }

  async revokeMyOAuthConsent(req: AuthenticatedRequest, projectId: string, consentId: string) {
    await this.humanOAuthConsentOwner(req, projectId);
    if (!/^[a-f0-9]{64}$/.test(consentId)) {
      throw new NotFoundException({ error: "OAuth consent was not found" });
    }
    return this.db.transaction(async client => {
      // Match the existing owner-policy writer's global lock order:
      // project/membership first, then the individual OAuth binding. Otherwise
      // owner revoke (project -> binding) can deadlock with self revoke
      // (binding -> project). The in-transaction membership check also closes
      // a membership-removal race after the non-locking preflight.
      const locked = await client.query(
        `SELECT p.organization_id FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=$2
          WHERE p.id=$1 AND p.archived_at IS NULL
          FOR SHARE OF p,pm,om`,
        [projectId, req.userId]
      );
      if (!locked.rows[0]) {
        throw new NotFoundException({ error: "OAuth consent was not found" });
      }
      const result = await client.query(
        `SELECT client_id,revoked_at
           FROM mcp_oauth_grant_approval_bindings b
          WHERE b.project_id=$1 AND b.account_id=$2 AND b.grant_fingerprint=$3
          FOR UPDATE OF b`,
        [projectId, req.userId, consentId]
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException({ error: "OAuth consent was not found" });
      if (row.revoked_at) return { id: consentId, status: "revoked", replayed: true };
      await client.query(
        `UPDATE mcp_oauth_grant_approval_bindings
            SET revoked_at=clock_timestamp()
          WHERE grant_fingerprint=$1 AND revoked_at IS NULL`,
        [consentId]
      );
      // Audit failure rolls back the revocation and its receipt together.
      await client.query(
        `INSERT INTO audit_logs
           (project_id,actor_id,action,entity_type,entity_id,entity_name,diff,organization_id)
         VALUES ($1,$2,'mcp_oauth_user_consent_revoked','oauth_consent',$3,
                 'OAuth user consent revoked',$4::jsonb,$5)`,
        [projectId, req.userId, consentId,
          JSON.stringify({ clientId: row.client_id, revokedBy: "human_session" }),
          locked.rows[0].organization_id]
      );
      return { id: consentId, status: "revoked", replayed: false };
    });
  }

  private async humanProjectManager(req: AuthenticatedRequest, projectId: string) {
    if (!req.userId || req.apiToken || req.oauthAccess) throw new ForbiddenException({ error: "An authenticated human session is required to manage external MCP access" });
    const project = await this.legacy.requireProjectAccess(req.userId, projectId);
    const role = this.legacy.normalizeRole(project.caller_role);
    if (role !== "owner" && role !== "manager") throw new ForbiddenException({ error: "Only project owners and managers can manage external MCP access" });
    return project;
  }

  async getAccessSettings(req: AuthenticatedRequest, projectId: string) {
    await this.humanProjectManager(req, projectId);
    const result = await this.db.query("SELECT settings FROM projects WHERE id = $1 AND archived_at IS NULL", [projectId]);
    if (!result.rows[0]) throw new NotFoundException({ error: "Project not found" });
    return readMcpAccess(result.rows[0].settings);
  }

  async updateAccessSettings(req: AuthenticatedRequest, projectId: string, body: unknown) {
    const project = await this.humanProjectManager(req, projectId);
    const input = validateMcpAccess(body, new Set(this.toolsByName.keys()));
    return this.db.transaction(async client => {
      // Lock the existing project setting and current memberships, including role changes/revocation.
      const locked = await client.query(
        `SELECT p.settings, pm.role AS caller_role FROM projects p
         JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
         JOIN organization_members om ON om.organization_id = p.organization_id AND om.user_id = $2
         WHERE p.id = $1 AND p.organization_id = $3 AND p.archived_at IS NULL
         FOR UPDATE OF p FOR SHARE OF pm, om`, [projectId, req.userId, project.organization_id]
      );
      const row = locked.rows[0];
      if (!row || !["owner", "manager"].includes(this.legacy.normalizeRole(row.caller_role))) {
        throw new ForbiddenException({ error: "Project management access changed; reload before trying again" });
      }
      const before = readMcpAccess(row.settings);
      if (before.revision !== input.revision) throw new ConflictException({ error: "External MCP access changed; reload and review the current settings" });
      if (!onlyReducesMcpAccess(before, input)) await this.planLimits.assertProjectWritable(project.organization_id, projectId);
      if (input.clients.length) {
        const tokens = await client.query(
          "SELECT id, user_id, scopes FROM api_tokens WHERE project_id = $1 AND id = ANY($2::uuid[]) FOR SHARE",
          [projectId, input.clients.filter((grant): grant is ApiMcpClientGrant => !isOAuthMcpGrant(grant)).map(grant => grant.tokenId)]
        );
        for (const grant of input.clients) {
          if (isOAuthMcpGrant(grant)) continue; // Owner-managed read-only client grants are not API tokens.
          const token = tokens.rows.find(token => token.id === grant.tokenId);
          const scopes = typeof token?.scopes === "string" ? token.scopes.split(",").map((scope: string) => scope.trim()) : [];
          const unchanged = before.clients.some(previous => JSON.stringify(previous) === JSON.stringify(grant));
          // A revoked credential stays denied at request time. Retaining its historical label must
          // not prevent an owner disabling access or revoking another client's grant.
          if ((!token?.user_id || grant.scopes.some(scope => !scopes.includes(scope))) && !unchanged) {
            throw new BadRequestException({ error: "Every client must use a current credential in this project and a subset of its scopes" });
          }
        }
      }
      const after = { ...input, revision: before.revision + 1 };
      const settings = { ...projectSettingsObject(row.settings), [MCP_ACCESS_KEY]: after };
      await client.query("UPDATE projects SET settings = $2::jsonb, updated_at = now() WHERE id = $1", [projectId, JSON.stringify(settings)]);
      // Project-owner updates invalidate old OAuth families in the same
      // transaction. A later identical client approval cannot revive their tombstoned identities.
      await client.query(
        "UPDATE mcp_oauth_grant_approval_bindings SET revoked_at=now() WHERE project_id=$1 AND approval_revision<>$2 AND revoked_at IS NULL",
        [projectId, after.revision]
      );
      // The consent change and its attributable receipt commit together. Audit failure rolls back consent.
      // entity_id is varchar while project_id is uuid: reusing one parameter for both makes
      // Postgres fail with "inconsistent types deduced for parameter $1". Pass the project id twice.
      await client.query(
        `INSERT INTO audit_logs (project_id, actor_id, action, entity_type, entity_id, entity_name, diff, organization_id)
         VALUES ($1,$2,'project_mcp_access_updated','project',$5,'External AI & MCP Access',$3::jsonb,$4)`,
        [projectId, req.userId, JSON.stringify({ before, after }), project.organization_id, projectId]
      );
      return after;
    });
  }

  private async dispatch(
    method: string,
    params: Record<string, unknown>,
    principal: McpRuntimePrincipal,
    organizationId: string,
    grant: McpClientGrant
  ): Promise<unknown> {
    switch (method) {
      case "initialize": {
        // Echo the client's version when supported; otherwise answer with the long-standing default
        // (the spec lets the client decide whether it can proceed with that).
        const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
        const protocolVersion = (MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : MCP_PROTOCOL_VERSION;
        return {
          protocolVersion,
          // Still false: this transport has no server-to-client stream to send
          // notifications/tools/list_changed on. Tool-set changes reach clients through session
          // expiry instead (see isCurrentSession / McpController).
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: MCP_SERVER_NAME, version: `${MCP_SERVER_VERSION}+${BUILD_GIT_SHA}.${this.catalogFingerprint(this.visibleTools(principal, grant))}` },
          instructions: MCP_SERVER_INSTRUCTIONS
        };
      }

      case "ping":
        return {};

      case "tools/list":
        return { tools: this.visibleTools(principal, grant) };

      case "tools/call":
        return this.callTool(params, principal, organizationId, grant);

      default:
        throw new McpError(RpcCode.MethodNotFound, `Unknown method: ${method}`);
    }
  }

  private async callTool(params: Record<string, unknown>, principal: McpRuntimePrincipal, organizationId: string, grant: McpClientGrant): Promise<unknown> {
    const name = typeof params.name === "string" ? params.name : "";
    const tool = this.toolsByName.get(name);
    if (!tool) {
      throw new McpError(RpcCode.MethodNotFound, `Unknown tool: ${name || "(missing name)"}`);
    }

    const scopes = (principal.scopes || []) as TokenScope[];
    if (!scopes.includes(tool.requiredScope)) {
      throw new McpError(
        RpcCode.ScopeDenied,
        `Tool "${name}" requires "${tool.requiredScope}" scope; token has [${scopes.join(", ") || "none"}]`
      );
    }

    if (!this.clientCanUseTool(principal, grant, name)) {
      throw new McpError(RpcCode.ScopeDenied, "This credential's approved MCP client grant does not allow this tool");
    }

    const rawArgs = params.arguments;
    const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
      ? rawArgs as Record<string, unknown> : {};
    if (isDirectTestcasePublisher(name)) {
      const refusal = humanPublicationRequired(principal.projectId as string);
      throw new McpError(RpcCode.ToolExecutionError, refusal.error, refusal);
    }
    if (tool.proposalPreviewOnly && !proposalReviewPreviewEnabled()) {
      throw new McpError(RpcCode.ToolExecutionError, "The unpublished proposal review preview is unavailable on this deployment", {
        code: "PROPOSAL_REVIEW_PREVIEW_DISABLED", stagingAvailable: false
      });
    }

    // Both transports reach this same boundary after project membership and token scope.
    // Check once before actor resolution or any handler (including partial batches/clones).
    if (tool.requiredScope === "write") {
      try {
        await this.planLimits.assertProjectWritable(organizationId, principal.projectId as string);
      } catch (err) {
        if (err instanceof ForbiddenException) {
          throw new McpError(RpcCode.ToolExecutionError, this.extractMessage(err));
        }
        // An entitlement lookup failure is not a plan denial or a successful tool call.
        throw err;
      }
    }

    // Only resolve/attach the agent actor for writes — reads never touch actor columns.
    const actorId = tool.requiredScope === "write" ? await this.resolveMcpActorId() : null;

    const ctx: McpToolContext = {
      projectId: principal.projectId as string,
      tokenId: principal.tokenId,
      actorId,
      userId: principal.userId ?? null,
      scopes,
      legacy: this.legacy,
      db: this.db,
      graphCapture: this.graphCapture,
      graphNotificationDelivery: this.graphNotificationDelivery,
      modelPreview: this.modelPreview,
      modelStudio: this.modelStudio
    };

    try {
      const data = await tool.handler(args, ctx);
      // MCP tools/call result shape: content parts + isError flag.
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        isError: false
      };
    } catch (err) {
      if (err instanceof McpError) throw err;
      // Surface underlying service errors (BadRequest/NotFound/etc.) as a tool execution error.
      const message = this.extractMessage(err);
      throw new McpError(RpcCode.ToolExecutionError, message);
    }
  }

  private extractMessage(err: unknown): string {
    const anyErr = err as { getResponse?: () => unknown; message?: string };
    if (anyErr && typeof anyErr.getResponse === "function") {
      const resp = anyErr.getResponse();
      if (resp && typeof resp === "object") {
        const obj = resp as Record<string, unknown>;
        return String(obj.error || obj.message || anyErr.message || "Tool execution failed");
      }
      if (typeof resp === "string") return resp;
    }
    return err instanceof Error ? err.message : String(err);
  }

  toErrorResponse(id: JsonRpcId, err: unknown): JsonRpcResponse {
    if (err instanceof McpError) {
      return { jsonrpc: "2.0", id, error: { code: err.code, message: err.message, data: err.data } };
    }
    this.logger.error(`Unexpected MCP error: ${err instanceof Error ? err.stack : err}`);
    return {
      jsonrpc: "2.0",
      id,
      error: { code: RpcCode.InternalError, message: "Internal error" }
    };
  }
}
