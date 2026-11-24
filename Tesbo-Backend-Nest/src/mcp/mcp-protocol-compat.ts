import { MCP_SUPPORTED_PROTOCOL_VERSIONS, type JsonRpcId } from "./mcp.types";

/**
 * Only the legacy initialize/session era is implemented by Tesbo today.
 * A 2026-07-28 client probes with a stateless server/discover request and expects
 * a recognizable modern protocol error before deciding how to negotiate.
 *
 * Never mislabel a legacy initialize/tools/list reply as a stateless 2026 result:
 * it lacks required per-request metadata, resultType, and header validation.
 * This pure check is applied by the authenticated transport before session
 * validation or tool dispatch. It does not issue OAuth grants or change old calls.
 */
const LEGACY_VERSIONS = new Set<string>(MCP_SUPPORTED_PROTOCOL_VERSIONS);
const MODERN_DISCOVERY = "server/discover";

export interface UnsupportedMcpProtocol {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: -32022;
    message: "Unsupported protocol version";
    data: { supported: string[]; requested: string };
  };
}

export function unsupportedMcpProtocol(
  body: unknown,
  headerVersion: string | undefined
): UnsupportedMcpProtocol | null {
  const request = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown> : {};
  const params = request.params && typeof request.params === "object" &&
    !Array.isArray(request.params) ? request.params as Record<string, unknown> : {};
  const meta = params._meta && typeof params._meta === "object" &&
    !Array.isArray(params._meta) ? params._meta as Record<string, unknown> : {};
  const declared = meta["io.modelcontextprotocol/protocolVersion"];
  const bodyVersion = typeof declared === "string" ? declared : undefined;
  const unsupportedHeader = typeof headerVersion === "string" &&
    !LEGACY_VERSIONS.has(headerVersion);
  const unsupportedBody = typeof bodyVersion === "string" &&
    !LEGACY_VERSIONS.has(bodyVersion);
  const modernDiscovery = request.method === MODERN_DISCOVERY;
  if (!unsupportedHeader && !unsupportedBody && !modernDiscovery) return null;

  const requested = unsupportedBody ? bodyVersion :
    unsupportedHeader ? headerVersion : "unadvertised";
  const id: JsonRpcId = typeof request.id === "number" || typeof request.id === "string"
    ? request.id : null;
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32022,
      message: "Unsupported protocol version",
      data: { supported: [...MCP_SUPPORTED_PROTOCOL_VERSIONS], requested }
    }
  };
}
