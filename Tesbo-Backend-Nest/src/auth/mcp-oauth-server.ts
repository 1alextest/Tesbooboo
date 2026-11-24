import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import type { Request, Response } from "express";
import type { DatabaseService } from "../database/database.service";
import type { OAuthMachineContext } from "../common/request.types";
import { createMcpOAuthPostgresAdapter } from "./mcp-oauth-postgres.adapter";
import { isOAuthMcpGrant, readMcpAccess, type OAuthMcpClientGrant } from "../mcp/mcp-access";
import { mcpOAuthDiscoveryPolicy, mcpOAuthResource, type McpOAuthDiscoveryPolicy } from "../mcp/mcp-oauth-discovery";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MAX_CLIENTS = 20;

type ProviderInstance = {
  callback(): (req: Request, res: Response, next?: (error?: unknown) => void) => void;
  interactionDetails(req: Request, res: Response): Promise<any>;
  interactionFinished(req: Request, res: Response, result: Record<string, unknown>, options?: Record<string, unknown>): Promise<void>;
  Grant: {
    new (input: { accountId: string; clientId: string }): {
      addResourceScope(resource: string, scope: string): void;
      save(): Promise<string>;
    };
    find(value: string): Promise<any>;
  };
  AccessToken: { find(value: string): Promise<any> };
  proxy: boolean;
};

function requiredJson(name: string): unknown {
  const value = process.env[name];
  if (!value || value.length > 100_000) throw new Error(`${name} must be explicitly configured for OAuth`);
  try { return JSON.parse(value) as unknown; }
  catch { throw new Error(`${name} must be valid JSON`); }
}

function configuredKeys(): { keys: Record<string, unknown>[] } {
  const input = requiredJson("TESBO_MCP_OAUTH_PRIVATE_JWKS");
  const keys = (input as { keys?: unknown })?.keys;
  if (!Array.isArray(keys) || keys.length < 1 ||
      keys.some(k => !k || typeof k !== "object" || Array.isArray(k) ||
        !["RSA", "EC", "OKP"].includes(String((k as Record<string, unknown>).kty)) ||
        typeof (k as Record<string, unknown>).d !== "string")) {
    throw new Error("TESBO_MCP_OAUTH_PRIVATE_JWKS requires stable asymmetric private keys");
  }
  return { keys: keys as Record<string, unknown>[] };
}

function configuredClients(): Record<string, unknown>[] {
  const input = requiredJson("TESBO_MCP_OAUTH_REGISTERED_CLIENTS");
  if (!Array.isArray(input) || !input.length || input.length > MAX_CLIENTS) {
    throw new Error("OAuth requires an operator-reviewed list of registered clients");
  }
  const seen = new Set<string>();
  return input.map(raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid OAuth client");
    const client = raw as Record<string, unknown>;
    const id = client.client_id;
    if (typeof id !== "string" || !id || id.length > 2048 || seen.has(id) ||
        !Array.isArray(client.redirect_uris) || !client.redirect_uris.length ||
        client.redirect_uris.length > 10) throw new Error("Invalid registered OAuth client identity");
    seen.add(id);
    for (const redirect of client.redirect_uris) {
      if (typeof redirect !== "string" || redirect.length > 2048) throw new Error("Invalid OAuth redirect URI");
      let url: URL;
      try { url = new URL(redirect); } catch { throw new Error("Invalid OAuth redirect URI"); }
      if (url.protocol !== "https:" || url.username || url.password || url.hash || url.href !== redirect) {
        throw new Error("OAuth redirect URIs must be canonical HTTPS URLs");
      }
    }
    // The operator cannot use this flag to add machine/write authority.
    return {
      client_id: id,
      redirect_uris: [...client.redirect_uris],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"]
    };
  });
}

/**
 * Same NestJS process, same user directory and project-grant owner.
 * Production runs with OAuth completely OFF until ALL required values are
 * configured and the explicitly gated runtime is enabled. A disabled server
 * has no issuer, no route and no token verifier.
 *
 * The verified resource principal is NEVER represented as a Tesbo API token.
 */
@Injectable()
export class McpOAuthServer {
  private provider: ProviderInstance | null = null;
  private policy: McpOAuthDiscoveryPolicy | null = null;

  constructor(private readonly db: DatabaseService) {}

  get enabled(): boolean { return this.provider !== null && this.policy !== null; }
  get issuer(): string {
    if (!this.policy) throw new ServiceUnavailableException({ error: "OAuth is disabled" });
    return this.policy.issuer;
  }

  resource(projectId: string): string {
    if (!this.policy) throw new ServiceUnavailableException({ error: "OAuth is disabled" });
    return mcpOAuthResource(this.policy, projectId);
  }

  /** Exact canonical resource; never derive from incoming Host/Forwarded headers. */
  projectIdFromResource(resource: string): string {
    if (!this.policy || typeof resource !== "string") throw new Error("Invalid OAuth resource");
    const prefix = `${this.policy.resourceOrigin}/api/projects/`;
    if (!resource.startsWith(prefix) || !resource.endsWith("/mcp")) throw new Error("Invalid OAuth resource");
    const projectId = resource.slice(prefix.length, -4);
    if (!UUID.test(projectId) || mcpOAuthResource(this.policy, projectId) !== resource) {
      throw new Error("Invalid OAuth resource");
    }
    return projectId;
  }

  async approvedClient(clientId: string, resource: string): Promise<OAuthMcpClientGrant | null> {
    const projectId = this.projectIdFromResource(resource);
    const row = (await this.db.query(
      "SELECT settings FROM projects WHERE id=$1 AND archived_at IS NULL", [projectId]
    )).rows[0];
    let access;
    try { access = row ? readMcpAccess(row.settings) : null; } catch { return null; }
    if (!access?.enabled) return null;
    const grant = access.clients.find(c => isOAuthMcpGrant(c) && c.oauthClientId === clientId);
    if (!grant || !isOAuthMcpGrant(grant) || grant.scopes.length !== 1 ||
        grant.scopes[0] !== "read" || grant.expiresAt && Date.parse(grant.expiresAt) <= Date.now()) return null;
    return grant;
  }

  requireActive(): ProviderInstance {
    if (!this.provider) throw new ServiceUnavailableException({ error: "OAuth is disabled" });
    return this.provider;
  }

  async mount(app: INestApplication): Promise<void> {
    if (process.env.TESBO_MCP_OAUTH_ENABLED !== "true") return;
    const policy = mcpOAuthDiscoveryPolicy();
    if (!policy) throw new Error("OAuth discovery policy must be configured before issuer activation");
    if (!policy.issuer.endsWith("/oauth") ||
        !policy.issuer.startsWith(policy.resourceOrigin + "/")) {
      throw new Error("Embedded OAuth issuer must use the same trusted public origin and /oauth path");
    }
    const jwks = configuredKeys();
    const clients = configuredClients();
    // Explicitly pin the dependency in the existing backend lockfile. Node 22
    // supports requiring synchronous ESM; CI must prove this exact build path.
    // No fallback to a self-written issuer or to the legacy API-token service.
    const oidc = require("oidc-provider") as { Provider?: new (issuer: string, cfg: Record<string, unknown>) => ProviderInstance };
    if (typeof oidc?.Provider !== "function") throw new Error("Pinned OAuth authorization server is unavailable");
    const Provider = oidc.Provider;
    const db = this.db;
    this.policy = policy;
    try {
      const provider = new Provider(policy.issuer, {
        adapter: createMcpOAuthPostgresAdapter(this.db),
        jwks,
        clients,
        pkce: { required: () => true },
        features: {
          resourceIndicators: {
            enabled: true,
            getResourceServerInfo: async (_ctx: unknown, resource: string, client: { clientId: string }) => {
              const approved = await this.approvedClient(client.clientId, resource);
              if (!approved) throw new Error("OAuth resource or client is not approved");
              return { scope: "mcp:read", audience: resource, accessTokenTTL: 600, accessTokenFormat: "opaque" };
            }
          }
          // CIMD requires an independently tested SSRF-safe client metadata fetch
          // and is OFF rather than implicitly trusting unregistered client URLs.
        },
        interactions: {
          url: (_ctx: unknown, interaction: { uid: string }) => `/api/oauth/interactions/${encodeURIComponent(interaction.uid)}`
        },
        async findAccount(_ctx: unknown, accountId: string) {
          const row = await db.query("SELECT id FROM users WHERE id=$1", [accountId]);
          if (!row.rows[0]) return undefined;
          return { accountId, async claims() { return { sub: accountId }; } };
        }
      });
      provider.proxy = true;
      const express = app.getHttpAdapter().getInstance();
      express.use("/oauth", provider.callback());
      // A path-based issuer requires RFC 8414 well-known path insertion, not
      // merely /oauth/.well-known. Keep both supported client discovery forms.
      const callback = provider.callback();
      for (const name of ["oauth-authorization-server", "openid-configuration"]) {
        express.use(`/.well-known/${name}/oauth`, (req: Request, res: Response, next: (error?: unknown) => void) => {
          req.url = `/.well-known/${name}` + (req.url === "/" ? "" : req.url);
          callback(req, res, next);
        });
      }
      this.provider = provider;
    } catch (error) {
      this.policy = null;
      this.provider = null;
      throw error;
    }
  }

  /**
   * Verify opaque token via the *actual* issuer's retained AccessToken model.
   * Even on success, the MCP domain owner rechecks project membership and the
   * named client grant before dispatch. Never elevate to req.userId/cookie.
   */
  async verifyAccessToken(raw: string): Promise<OAuthMachineContext | null> {
    if (!this.provider || !this.policy || typeof raw !== "string" || !raw || raw.length > 8192) return null;
    try {
      const token = await this.provider.AccessToken.find(raw);
      if (!token || !token.isValid || typeof token.accountId !== "string" ||
          typeof token.clientId !== "string" || typeof token.grantId !== "string" ||
          typeof token.scope !== "string" || token.scope !== "mcp:read") return null;
      const resource = typeof token.aud === "string" ? token.aud : null;
      if (!resource) return null;
      const projectId = this.projectIdFromResource(resource);
      const grant = await this.provider.Grant.find(token.grantId);
      if (!grant || grant.accountId !== token.accountId || grant.clientId !== token.clientId ||
          grant.getResourceScope(resource) !== "mcp:read") return null;
      if (!(await this.approvedClient(token.clientId, resource))) return null;
      return {
        kind: "oauth_access", issuer: this.policy.issuer, subject: token.accountId,
        clientId: token.clientId, grantId: token.grantId, userId: token.accountId,
        projectId, resource, scopes: ["mcp:read"]
      };
    } catch {
      return null;
    }
  }
}
