#!/usr/bin/env node
/*
 * Negative-path probe for project MCP consent.
 *
 * One tools/list request with the credential from a file. Prints only the protocol outcome: the
 * HTTP status, the JSON-RPC error code/message, or the advertised tool count if a catalog is served.
 * The credential is never printed and never accepted from argv.
 *
 * Usage:
 *   TESBO_MCP_URL="https://<host>/api/projects/<id>/mcp" node scripts/mcp-consent-probe.mjs
 * Optional: TESBO_MCP_TOKEN_FILE (default ~/.config/opencode/secrets/tesbo.token)
 *
 * Interpretation:
 *   -32001 "requires an enabled project and a current approved client credential" → consent gate is
 *   live and this credential is not approved (expected before the human approval step).
 *   A served tool list → consent is already granted for this credential; the number is informational.
 */
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { readApprovedMcpCredential } from "./mcp-approved-origin.mjs";

const tokenFile = String(process.env.TESBO_MCP_TOKEN_FILE || path.join(homedir(), ".config/opencode/secrets/tesbo.token"));
let endpoint;
let token;
try {
  // Fail BEFORE opening the token: a caller-supplied URL cannot redirect a local
  // credential to an unrelated HTTPS host, even without an HTTP 3xx response.
  ({ endpoint, token } = readApprovedMcpCredential(String(process.env.TESBO_MCP_URL || "").trim(), tokenFile));
} catch (error) {
  console.error(`mcp-consent-probe: ${error instanceof Error ? error.message : "unapproved endpoint"}`);
  process.exit(2);
}
const response = await fetch(endpoint, {
  redirect: "manual",
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});

let body = null;
try {
  body = await response.json();
} catch {
  body = null;
}

if (body?.error) {
  // An untrusted error code can contain arbitrary text or an object, including
  // the bearer. Emit only an integer and fixed diagnostic text.
  const code = Number.isSafeInteger(body.error.code) ? body.error.code : null;
  const message = code === null ? "malformed protocol error (details withheld)"
    : code === -32001 ? "external MCP consent is not approved" : "protocol error (message withheld)";
  console.log(JSON.stringify({ status: response.status, code, message }));
  if (code === null) process.exitCode = 1;
} else if (Array.isArray(body?.result?.tools)) {
  console.log(JSON.stringify({ status: response.status, catalog: body.result.tools.length, message: "credential is approved; catalog served" }));
} else {
  console.log(JSON.stringify({ status: response.status, message: "no JSON-RPC error and no tool list in the response" }));
  process.exitCode = 1;
}
