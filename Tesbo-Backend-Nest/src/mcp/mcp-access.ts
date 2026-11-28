import { BadRequestException } from "@nestjs/common";

/** Project settings own consent; existing API-token ids own credential identity. */
export const MCP_ACCESS_KEY = "externalMcpAccess";
/** Existing token grant format is preserved exactly for all established callers. */
export type ApiMcpClientGrant = {
  tokenId: string;
  clientName: string;
  scopes: Array<"read" | "write">;
  allowedTools: string[] | null;
  expiresAt: string | null;
};

/** Owner pre-approval of a client identity, NOT OAuth end-user consent or a live connection.
 * OAuth grants remain read-only and require a verified token and separate human consent. */
export type OAuthMcpClientGrant = {
  kind: "oauth_client";
  oauthClientId: string;
  clientName: string;
  scopes: Array<"read" | "write">;
  allowedTools: string[] | null;
  expiresAt: string | null;
};
export type McpClientGrant = ApiMcpClientGrant | OAuthMcpClientGrant;
export type ProjectMcpAccess = { enabled: boolean; revision: number; clients: McpClientGrant[] };

export function isOAuthMcpGrant(grant: McpClientGrant): grant is OAuthMcpClientGrant {
  return "kind" in grant && grant.kind === "oauth_client";
}
export function mcpGrantKey(grant: McpClientGrant): string {
  return isOAuthMcpGrant(grant) ? `oauth:${grant.oauthClientId}` : `api:${grant.tokenId.toLowerCase()}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function projectSettingsObject(value: unknown): Record<string, unknown> {
  let parsed = value;
  // Older project settings can be a JSON string inside a jsonb value.
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return {}; }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown> : {};
}

export function validateMcpAccess(value: unknown, knownTools?: ReadonlySet<string>): ProjectMcpAccess {
  const fail = (message: string): never => { throw new BadRequestException({ error: message }); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("MCP access must be an object");
  const input = value as Record<string, unknown>;
  if (typeof input.enabled !== "boolean") return fail("enabled must be a boolean");
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0) return fail("revision must be a non-negative integer");
  if (!Array.isArray(input.clients) || input.clients.length > 100) return fail("clients must be an array of at most 100 named credentials");
  const seen = new Set<string>();
  const clients = input.clients.map((raw): McpClientGrant => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Each client grant must be an object");
    const client = raw as Record<string, unknown>;
    const oauth = client.kind === "oauth_client";
    if (client.kind !== undefined && !oauth) return fail("Unknown MCP grant credential kind");
    let credentialIdentity: string;
    let tokenId: string | undefined;
    let oauthClientId: string | undefined;
    if (oauth) {
      if (Object.hasOwn(client, "tokenId")) return fail("OAuth grants cannot impersonate API tokens");
      if (typeof client.oauthClientId !== "string" || client.oauthClientId.length > 2048) {
        return fail("OAuth client_id must be an approved HTTPS URL");
      }
      let parsed: URL;
      try { parsed = new URL(client.oauthClientId); } catch { return fail("OAuth client_id must be an approved HTTPS URL"); }
      if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password ||
          parsed.hash || parsed.search || parsed.hostname === "localhost" ||
          parsed.href !== client.oauthClientId) {
        return fail("OAuth client_id must be a canonical HTTPS URL without credentials or fragments");
      }
      oauthClientId = client.oauthClientId;
      credentialIdentity = `oauth:${oauthClientId}`;
    } else {
      if (Object.hasOwn(client, "oauthClientId")) return fail("API token grants cannot contain OAuth client identity");
      if (typeof client.tokenId !== "string" || !UUID.test(client.tokenId)) return fail("Each client requires a valid tokenId");
      tokenId = client.tokenId.toLowerCase();
      credentialIdentity = `api:${tokenId}`;
    }
    if (seen.has(credentialIdentity)) return fail("A credential can have only one named MCP client grant");
    seen.add(credentialIdentity);
    if (typeof client.clientName !== "string" || !client.clientName.trim() || client.clientName.trim().length > 100)
      return fail("Each client requires a name of 1 to 100 characters");
    if (!Array.isArray(client.scopes) || !client.scopes.length || client.scopes.some(scope => scope !== "read" && scope !== "write"))
      return fail("Client scopes must explicitly contain read and/or write");
    if (oauth && (client.scopes.length !== 1 || client.scopes[0] !== "read")) {
      return fail("OAuth client pre-approval is read-only; write is not implemented");
    }
    if (client.allowedTools !== null && (!Array.isArray(client.allowedTools) || client.allowedTools.length === 0 ||
        client.allowedTools.some(name => typeof name !== "string" || !name || knownTools && !knownTools.has(name))))
      return fail("allowedTools must be null or a non-empty list of supported tool names");
    if (client.expiresAt !== null && (typeof client.expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(client.expiresAt) || !Number.isFinite(Date.parse(client.expiresAt))))
      return fail("expiresAt must be null or an ISO timestamp");
    const common = {
      clientName: client.clientName.trim(),
      scopes: [...new Set(client.scopes)] as Array<"read" | "write">,
      allowedTools: client.allowedTools === null ? null : [...new Set(client.allowedTools as string[])],
      expiresAt: client.expiresAt === null ? null : new Date(client.expiresAt as string).toISOString()
    };
    return oauth
      ? { ...common, kind: "oauth_client", oauthClientId: oauthClientId! }
      : { ...common, tokenId: tokenId! };
  });
  return { enabled: input.enabled, revision: Number(input.revision), clients };
}

export function readMcpAccess(settings: unknown): ProjectMcpAccess {
  const value = projectSettingsObject(settings)[MCP_ACCESS_KEY];
  // No legacy token or project is silently opted in.
  if (value === undefined) return { enabled: false, revision: 0, clients: [] };
  return validateMcpAccess(value);
}

/** Billing-locked projects must still be able to disable or narrow external access. */
export function onlyReducesMcpAccess(before: ProjectMcpAccess, after: ProjectMcpAccess): boolean {
  if (after.enabled && !before.enabled) return false;
  return after.clients.every(next => {
    const old = before.clients.find(item => mcpGrantKey(item) === mcpGrantKey(next));
    if (!old || next.scopes.some(scope => !old.scopes.includes(scope))) return false;
    if (old.allowedTools !== null && (next.allowedTools === null || next.allowedTools.some(name => !old.allowedTools!.includes(name)))) return false;
    if (old.expiresAt && (!next.expiresAt || Date.parse(next.expiresAt) > Date.parse(old.expiresAt))) return false;
    return true;
  });
}

/**
 * The credential's effective scopes, its owner-approved MCP grant, and the explicit
 * tool allowlist must ALL permit an operation. This is deliberately credential-type
 * neutral: OAuth must eventually resolve a valid principal and grant before reaching
 * this boundary, never invent an API-token ID or skip current DB/role/consent checks.
 *
 * This pure predicate does not establish authentication, membership or grant freshness.
 * Those are revalidated by the existing McpService authority on every request.
 */
export function hasApprovedMcpToolPermission(
  credentialScopes: readonly string[],
  grant: { readonly scopes: readonly ("read" | "write")[]; readonly allowedTools: readonly string[] | null },
  requiredScope: "read" | "write",
  toolName: string
): boolean {
  return credentialScopes.includes(requiredScope) &&
    grant.scopes.includes(requiredScope) &&
    (grant.allowedTools === null || grant.allowedTools.includes(toolName));
}
