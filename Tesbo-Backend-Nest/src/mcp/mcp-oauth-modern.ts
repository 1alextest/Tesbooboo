import type { Request } from "express";
import type { JsonRpcResponse } from "./mcp.types";

const VERSION = "2026-07-28";
const HEADER_MISMATCH = -32020;
const UNSUPPORTED = -32022;
const INVALID = -32600;
const NOT_FOUND = -32601;

type ModernError = { status: number; body: JsonRpcResponse };
export type ModernValidation =
  | { ok: true; method: "server/discover" | "tools/list" | "tools/call" | "ping"; name?: string; id: string | number }
  | { ok: false; error: ModernError };

function rpcError(id: string | number | null, code: number, message: string, status: number, data?: unknown): ModernValidation {
  return { ok: false, error: {
    status, body: { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } }
  } };
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function header(req: Pick<Request, "header">, name: string): string | undefined {
  const result = req.header(name);
  return typeof result === "string" && result ? result : undefined;
}
function nameHeaderValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!value.startsWith("=?base64?") || !value.endsWith("?=")) return value;
  const encoded = value.slice(9, -2);
  if (!encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    return undefined;
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(encoded, "base64")); }
  catch { return undefined; }
}

/**
 * Read-only support for 2026-07-28, scoped ONLY to already verified OAuth
 * machine credentials. No session/initialize, no implicit fallback to legacy.
 * Every request's body is the source of truth; HTTP headers must match.
 */
export function validateModernMcpRequest(
  req: Pick<Request, "header">,
  body: unknown,
  allowedOrigin: string
): ModernValidation {
  const id = object(body) && (typeof body.id === "string" || typeof body.id === "number")
    ? body.id : null;

  const origin = header(req, "Origin");
  if (origin && origin !== allowedOrigin) return rpcError(id, HEADER_MISMATCH, "Origin not permitted", 403);
  if (!object(body) || body.jsonrpc !== "2.0" ||
      (typeof body.id !== "number" && typeof body.id !== "string") ||
      !Number.isFinite(typeof body.id === "number" ? body.id : 0) ||
      typeof body.method !== "string" || !object(body.params)) {
    return rpcError(id, INVALID, "Invalid modern MCP JSON-RPC request", 400);
  }
  const validId: string | number = body.id as string | number;
  const version = header(req, "MCP-Protocol-Version");
  const meta = body.params._meta;
  if (!object(meta) || typeof meta["io.modelcontextprotocol/protocolVersion"] !== "string") {
    return rpcError(id, HEADER_MISMATCH, "Missing modern MCP request version metadata", 400);
  }
  const bodyVersion = meta["io.modelcontextprotocol/protocolVersion"];
  if (!version || version !== bodyVersion) {
    return rpcError(id, HEADER_MISMATCH, "MCP-Protocol-Version header and body must agree", 400);
  }
  if (version !== VERSION) {
    return rpcError(id, UNSUPPORTED, "Unsupported protocol version", 400,
      { requested: version, supported: [VERSION] });
  }
  if (!object(meta["io.modelcontextprotocol/clientInfo"]) ||
      typeof (meta["io.modelcontextprotocol/clientInfo"] as Record<string, unknown>).name !== "string" ||
      typeof (meta["io.modelcontextprotocol/clientInfo"] as Record<string, unknown>).version !== "string" ||
      !object(meta["io.modelcontextprotocol/clientCapabilities"])) {
    return rpcError(id, INVALID, "Missing required MCP client identity or capability metadata", 400);
  }
  const methodHeader = header(req, "Mcp-Method");
  if (methodHeader !== body.method) {
    return rpcError(id, HEADER_MISMATCH, "Mcp-Method header and body must agree", 400);
  }
  const method = body.method;
  if (method !== "server/discover" && method !== "tools/list" && method !== "tools/call" && method !== "ping") {
    return rpcError(id, NOT_FOUND, "Unknown modern MCP method", 404);
  }
  const suppliedName = header(req, "Mcp-Name");
  if (method === "tools/call") {
    const name = body.params.name;
    if (typeof name !== "string" || !name ||
        nameHeaderValue(suppliedName) !== name || !suppliedName) {
      return rpcError(id, HEADER_MISMATCH, "Mcp-Name header and requested tool must agree", 400);
    }
    return { ok: true, method, name, id: validId };
  }
  if (suppliedName !== undefined) {
    return rpcError(id, HEADER_MISMATCH, "Unexpected Mcp-Name header", 400);
  }
  return { ok: true, method, id: validId };
}

/** Preserve existing MCP read tools and add modern result metadata. */
export function modernMcpResponse(
  response: JsonRpcResponse,
  method: "server/discover" | "tools/list" | "tools/call" | "ping",
  info: { name: string; version: string; instructions: string }
): JsonRpcResponse {
  if ("error" in response) return response;
  const value = object(response.result) ? response.result : {};
  if (method === "server/discover") {
    return { ...response, result: {
      resultType: "complete",
      supportedVersions: [VERSION],
      capabilities: { tools: { listChanged: false } },
      instructions: info.instructions,
      ttlMs: 0,
      cacheScope: "private",
      _meta: { "io.modelcontextprotocol/serverInfo": { name: info.name, version: info.version } }
    } };
  }
  const hints = method === "tools/list" ? { ttlMs: 0, cacheScope: "private" } : {};
  return { ...response, result: {
    ...value, resultType: "complete", ...hints,
    _meta: { "io.modelcontextprotocol/serverInfo": { name: info.name, version: info.version } }
  } };
}
