/**
 * Tesbo's eventual MCP OAuth protected-resource discovery contract (RFC 9728).
 *
 * This is ONLY a feature-gated discovery surface, not an authorization server,
 * token verifier or means to enable machine access. The existing MCP controller,
 * project authorization, human publication, and current API bearer clients are
 * unchanged by this module. Never infer public URLs from untrusted Host or
 * X-Forwarded-* headers.
 */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export type McpOAuthDiscoveryPolicy = {
  issuer: string;
  resourceOrigin: string;
  /** The only advertised initial OAuth scope; write requires a separate step-up design. */
  scopes: readonly ["mcp:read"];
};

function configuredHttpsUrl(value: string | undefined, label: string, allowPath: boolean): string {
  if (!value || value.trim() !== value || value.includes("\\")) {
    throw new Error(`${label} must be an explicitly configured HTTPS URL`);
  }
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.port && url.port !== "443" || !url.hostname || url.hostname === "localhost" ||
      (!allowPath && url.pathname !== "/") || url.pathname.includes("//")) {
    throw new Error(`${label} must be a canonical public HTTPS URL`);
  }
  // Deliberately refuse URLs whose host, encoding, case, path or trailing slash
  // would normalize differently in the browser vs the authorization server.
  const canonical = url.origin + (allowPath ? url.pathname.replace(/\/$/, "") : "");
  if (canonical !== value) throw new Error(`${label} must be canonical: ${canonical}`);
  return canonical;
}

export function mcpOAuthDiscoveryPolicy(env: NodeJS.ProcessEnv = process.env): McpOAuthDiscoveryPolicy | null {
  // Fail closed when not explicitly enabled. This gate only permits metadata,
  // never real access-token acceptance.
  if (env.TESBO_MCP_OAUTH_DISCOVERY_PREVIEW !== "true") return null;
  return {
    issuer: configuredHttpsUrl(env.TESBO_MCP_OAUTH_ISSUER, "TESBO_MCP_OAUTH_ISSUER", true),
    resourceOrigin: configuredHttpsUrl(env.TESBO_MCP_OAUTH_RESOURCE_ORIGIN, "TESBO_MCP_OAUTH_RESOURCE_ORIGIN", false),
    scopes: ["mcp:read"]
  };
}

export function mcpOAuthResource(policy: McpOAuthDiscoveryPolicy, projectId: string): string {
  if (typeof projectId !== "string" || !UUID.test(projectId) || projectId !== projectId.toLowerCase()) {
    throw new Error("Invalid canonical MCP project resource");
  }
  return `${policy.resourceOrigin}/api/projects/${projectId}/mcp`;
}

export function mcpOAuthProtectedResourceMetadata(policy: McpOAuthDiscoveryPolicy, projectId: string) {
  const resource = mcpOAuthResource(policy, projectId);
  return {
    resource,
    authorization_servers: [policy.issuer],
    scopes_supported: [...policy.scopes],
    bearer_methods_supported: ["header"],
    resource_documentation: `${policy.resourceOrigin}/api/projects/${projectId}/mcp`
  };
}

/** Exact path-aware RFC 9728 well-known URI, never a generic project discovery. */
export function mcpOAuthProtectedResourceMetadataUri(policy: McpOAuthDiscoveryPolicy, projectId: string): string {
  const u = new URL(mcpOAuthResource(policy, projectId));
  return `${u.origin}/.well-known/oauth-protected-resource${u.pathname}`;
}

export function mcpOAuthUnauthorizedChallenge(policy: McpOAuthDiscoveryPolicy, projectId: string): string {
  // Both values are server-derived; no client-controlled interpolation is used.
  return `Bearer resource_metadata="${mcpOAuthProtectedResourceMetadataUri(policy, projectId)}", scope="mcp:read"`;
}
