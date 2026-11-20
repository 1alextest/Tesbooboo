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
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";

const url = String(process.env.TESBO_MCP_URL || "").trim();
if (!url) {
  console.error("mcp-consent-probe: set TESBO_MCP_URL to the project MCP endpoint.");
  process.exit(2);
}
const tokenFile = String(process.env.TESBO_MCP_TOKEN_FILE || path.join(homedir(), ".config/opencode/secrets/tesbo.token"));
let token = "";
try {
  token = readFileSync(tokenFile, "utf8").trim();
} catch {
  console.error(`mcp-consent-probe: token file missing or unreadable: ${tokenFile}`);
  process.exit(2);
}
if (!token) {
  console.error(`mcp-consent-probe: token file is empty: ${tokenFile}`);
  process.exit(2);
}

const response = await fetch(url, {
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
  // Server error text is safe here: it is the protocol message, not the request. Keep it bounded.
  console.log(JSON.stringify({ status: response.status, code: body.error.code, message: String(body.error.message || "").slice(0, 300) }));
} else if (Array.isArray(body?.result?.tools)) {
  console.log(JSON.stringify({ status: response.status, catalog: body.result.tools.length, message: "credential is approved; catalog served" }));
} else {
  console.log(JSON.stringify({ status: response.status, message: "no JSON-RPC error and no tool list in the response" }));
}
