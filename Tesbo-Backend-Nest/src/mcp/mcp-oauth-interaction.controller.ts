import { Body, Controller, Get, GoneException, HttpCode, NotFoundException, Param, Post, Req, Res, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import type { Response } from "express";
import { timingSafeEqual } from "node:crypto";
import type { AuthenticatedRequest } from "../common/request.types";
import { oauthReferenceFingerprint } from "../common/crypto.util";
import { AppConfigService } from "../config/app-config.service";
import { McpService } from "./mcp.service";
import { McpOAuthServer } from "../auth/mcp-oauth-server";

type InteractionDetails = {
  uid: string;
  prompt?: { name?: string };
  params?: { client_id?: string; scope?: string; resource?: string | string[] };
};
type ConsentBody = { action?: string; csrf?: string; review?: string };

function html(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || "");
}

function safeEquals(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

/**
 * In-process OAuth login/consent uses the EXISTING Tesbo browser session and
 * the EXISTING owner-managed project MCP grants. It does not create accounts,
 * give project roles, issue API tokens, or publish QA records.
 *
 * OAuth protocol interaction state is owned by the vetted authorization
 * server and persisted with the encrypted Postgres adapter. One consent
 * approval is NOT permission to write; only mcp:read is supported.
 */
@Controller("/api/oauth")
export class McpOAuthInteractionController {
  constructor(
    private readonly oauth: McpOAuthServer,
    private readonly mcp: McpService,
    private readonly config: AppConfigService
  ) {}

  private humanUser(req: AuthenticatedRequest): string {
    if (!this.oauth.enabled) throw new NotFoundException({ error: "OAuth is disabled" });
    if (!req.userId || req.apiToken || req.oauthAccess || req.headers.authorization) {
      throw new UnauthorizedException({ error: "Sign in using a Tesbo browser session before authorizing this client" });
    }
    return req.userId;
  }

  private async currentInteraction(req: AuthenticatedRequest, res: Response, uid: string): Promise<InteractionDetails> {
    let details: InteractionDetails;
    try {
      details = await this.oauth.requireActive().interactionDetails(req, res);
    } catch (error) {
      // oidc-provider uses SessionNotFound for an absent/expired interaction cookie or session.
      if (!(error instanceof Error) || error.name !== "SessionNotFound") throw error;
      throw new GoneException("This authorization request has expired. Reconnect from your client.");
    }
    if (details.uid !== uid) {
      throw new GoneException("This authorization request is no longer current. Reconnect from your client.");
    }
    return details;
  }

  private csrf(req: AuthenticatedRequest, interactionId: string): string {
    const sessionToken = req.cookies?.[this.config.sessionCookieName];
    if (typeof sessionToken !== "string" || !sessionToken) throw new UnauthorizedException("A Tesbo browser session is required");
    return oauthReferenceFingerprint("oauth:interaction-csrf", `${interactionId}:${sessionToken}`);
  }

  private async reviewedTarget(req: AuthenticatedRequest, details: InteractionDetails) {
    const userId = this.humanUser(req);
    const params = details.params;
    const clientId = params?.client_id;
    const resource = params?.resource;
    const scope = params?.scope;
    if (typeof clientId !== "string" || typeof resource !== "string" ||
        typeof scope !== "string" || !scope.split(/\s+/).includes("mcp:read") ||
        scope.split(/\s+/).some(value => !["openid", "offline_access", "mcp:read"].includes(value))) {
      throw new ForbiddenException({ error: "Only one approved MCP read resource and scope may be requested" });
    }
    const projectId = this.oauth.projectIdFromResource(resource);
    const approved = await this.oauth.approvedClient(clientId, resource);
    if (!approved) throw new ForbiddenException({ error: "Project owner has not approved this OAuth client" });
    const project = await this.mcp.requireOAuthConsentProject(userId, projectId);
    const projectMembershipId = project.project_membership_id;
    const organizationMembershipId = project.organization_membership_id;
    if (typeof projectMembershipId !== "string" || !projectMembershipId ||
        typeof organizationMembershipId !== "string" || !organizationMembershipId) {
      throw new ForbiddenException({ error: "Current membership identities are required to authorize this client" });
    }
    const requestedScopes = scope.split(/\s+/);
    return { userId, clientId, projectId, resource, clientName: approved.clientName,
      projectName: project.name || project.key || projectId,
      projectMembershipId, organizationMembershipId,
      refreshRequested: requestedScopes.includes("offline_access"), openidRequested: requestedScopes.includes("openid"),
      allowedTools: approved.allowedTools, expiresAt: approved.expiresAt, accessRevision: approved.accessRevision };
  }

  /** Bind approval to the exact facts displayed, not just the interaction cookie.
   * Cancellation remains available even if project policy changes. */
  private reviewedProof(csrf: string, prompt: string, target: Awaited<ReturnType<McpOAuthInteractionController["reviewedTarget"]>>): string {
    return oauthReferenceFingerprint("oauth:interaction-review", JSON.stringify([csrf, prompt, target]));
  }

  @Get("/interactions/:uid")
  async consentPage(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param("uid") uid: string
  ) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    const needsBrowserLogin = !req.userId && !req.apiToken && !req.oauthAccess &&
      req.headers.authorization === undefined && req.headers.accept &&
      req.accepts(["json", "html"]) === "html";
    if (this.oauth.enabled && needsBrowserLogin) {
      await this.currentInteraction(req, res, uid);
      const login = new URL("/login", this.config.frontendUrl);
      login.searchParams.set("redirect", `/api/oauth/interactions/${encodeURIComponent(uid)}`);
      res.redirect(303, login.href);
      return;
    }
    const userId = this.humanUser(req);
    const details = await this.currentInteraction(req, res, uid);
    const prompt = details.prompt?.name;
    if (prompt !== "login" && prompt !== "consent") throw new ForbiddenException("Unsupported OAuth interaction");
    const target = await this.reviewedTarget(req, details);
    const csrf = this.csrf(req, uid);
    const review = this.reviewedProof(csrf, prompt, target);
    const login = prompt === "login";
    const label = login ? "Continue as this Tesbo user" : "Authorize read-only access";
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize read-only Tesbo QA access</title>
<style>body{font-family:system-ui,sans-serif;max-width:38rem;padding:2rem;margin:auto;line-height:1.5}button{padding:.75rem 1rem;font:inherit;cursor:pointer}button+button{margin-left:.6rem}.secondary{background:transparent;border:1px solid #888}.muted{color:#555}main{border:1px solid #8886;border-radius:12px;padding:1.5rem}dl{display:grid;grid-template-columns:max-content 1fr;gap:.4rem 1rem}dt{font-weight:700}</style></head>
<body><main><h1>Authorize Tesbo QA access</h1>
<p>This action ${login ? "confirms which Tesbo account is signing in. You will still review the permissions before granting access." : "allows a verified OAuth client to READ data only. It cannot create, edit, publish, approve or execute tests."}</p>
<dl><dt>Account</dt><dd>${html(userId)}</dd><dt>Client</dt><dd>${html(target.clientName)}</dd>
<dt>Client ID</dt><dd>${html(target.clientId)}</dd><dt>Project</dt><dd>${html(target.projectName)}</dd>
<dt>Permissions</dt><dd>Read-only QA records and tools: ${html(target.allowedTools ? target.allowedTools.join(", ") : "all permitted read-only tools")}</dd><dt>Owner approval expiry</dt><dd>${html(target.expiresAt ?? "No fixed expiry")}</dd><dt>Reconnect</dt><dd>${target.refreshRequested ? "You are also granting offline read-only access until revoked." : "No offline access was requested; you may need to sign in again."}</dd></dl>
<p class="muted">The project owner preapproved this client identity. You can cancel. You may later revoke the project grant. Login and consent do not publish test cases or approve Skills.</p>
<form method="post" action="/api/oauth/interactions/${encodeURIComponent(uid)}">
<input type="hidden" name="csrf" value="${html(csrf)}">
<input type="hidden" name="review" value="${html(review)}">
<button type="submit" name="action" value="approve">${label}</button>
<button type="submit" name="action" value="deny" class="secondary">Cancel</button>
</form></main></body></html>`);
  }

  @Post("/interactions/:uid")
  @HttpCode(200)
  async submitConsent(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param("uid") uid: string,
    @Body() body: ConsentBody
  ) {
    const userId = this.humanUser(req);
    const origin = req.get("origin");
    if (origin !== new URL(this.oauth.issuer).origin) {
      throw new ForbiddenException({ error: "OAuth consent origin did not match the authorization server" });
    }
    const expected = this.csrf(req, uid);
    if (typeof body.csrf !== "string" || !safeEquals(body.csrf, expected)) {
      throw new ForbiddenException({ error: "OAuth consent needs a valid session-bound anti-CSRF token" });
    }
    if (body.action !== "approve" && body.action !== "deny") {
      throw new ForbiddenException({ error: "A user choice is required" });
    }
    const provider = this.oauth.requireActive();
    const details = await this.currentInteraction(req, res, uid);
    if (body.action === "deny") {
      await provider.interactionFinished(req, res, { error: "access_denied" }, { mergeWithLastSubmission: false });
      return;
    }
    const prompt = details.prompt?.name;
    if (prompt !== "login" && prompt !== "consent") throw new ForbiddenException("Unsupported OAuth prompt");
    const target = await this.reviewedTarget(req, details);
    const review = this.reviewedProof(expected, prompt, target);
    if (typeof body.review !== "string" || !safeEquals(body.review, review)) {
      throw new ForbiddenException({ error: "OAuth permissions or review context changed. Reload the consent page and review again." });
    }
    if (prompt === "login") {
      await provider.interactionFinished(req, res,
        { login: { accountId: userId, remember: false } },
        { mergeWithLastSubmission: false });
      return;
    }
    const grant = new provider.Grant({ accountId: userId, clientId: target.clientId });
    grant.addResourceScope(target.resource, "mcp:read");
    if (target.openidRequested || target.refreshRequested) {
      grant.addOIDCScope([...(target.openidRequested ? ["openid"] : []),
        ...(target.refreshRequested ? ["offline_access"] : [])].join(" "));
    }
    const grantId = await grant.save();
    try {
      await this.oauth.bindIssuedGrant(grantId, {
        accountId: userId, clientId: target.clientId, resource: target.resource,
        projectId: target.projectId, approvalRevision: target.accessRevision,
        projectMembershipId: target.projectMembershipId,
        organizationMembershipId: target.organizationMembershipId
      });
    } catch {
      // A revoked or modified approval must never complete an OAuth consent.
      // An unbound provider Grant grants no authority and is best-effort destroyed.
      await this.oauth.discardUnboundGrant(grantId).catch(() => undefined);
      throw new ForbiddenException({ error: "Project owner approval or membership changed during consent. Review and authorize again." });
    }
    await provider.interactionFinished(req, res,
      { consent: { grantId } },
      { mergeWithLastSubmission: false });
  }
}
