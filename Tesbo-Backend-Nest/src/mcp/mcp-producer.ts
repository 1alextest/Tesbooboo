import { McpError, RpcCode } from "./mcp.types";
import type { McpToolContext } from "./mcp.types";

/**
 * Existing native staging provenance boundary. A request's arguments must never
 * select its producer kind, credential identity or actor.
 *
 * This adapter is deliberately API-token-only. OAuth cannot be enabled for
 * staging by inventing a tokenId: extend the authoritative native proposal
 * producer/receipt and replay contract before admitting another credential kind.
 */
export function apiTokenStagingProducer(
  context: Pick<McpToolContext, "tokenId" | "actorId">,
  options: { requireAgentActor: boolean }
): { kind: "api_token"; transport: "mcp"; tokenId: string; actorId?: string } {
  if (!context.tokenId) {
    throw new McpError(RpcCode.ProjectScopeDenied, "An authenticated API-token credential is required to stage this proposal");
  }
  if (options.requireAgentActor && !context.actorId) {
    throw new McpError(
      RpcCode.ToolExecutionError,
      "The MCP agent identity is unavailable; no proposal was staged",
      { code: "AGENT_IDENTITY_UNAVAILABLE" }
    );
  }
  return {
    kind: "api_token",
    transport: "mcp",
    tokenId: context.tokenId,
    ...(context.actorId ? { actorId: context.actorId } : {})
  };
}
