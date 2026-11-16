#!/usr/bin/env node
/*
 * Post-deploy MCP verification.
 *
 * The recurring failure this exists for: a deployment can be stale while /health, client discovery
 * and a tool count all look plausible. This checks the things a client actually relies on — the
 * build the server reports, the required tool names and the required field schemas — against a
 * fresh protocol session, not against source or a cached client catalog.
 *
 * Usage (token comes from the environment only, never argv):
 *
 *   TESBO_MCP_URL="https://host/api/projects/<id>/mcp" \
 *   TESBO_MCP_TOKEN="<project token>" \
 *   EXPECTED_GIT_SHA="<deployed commit>" \
 *   node scripts/mcp-deploy-check.mjs
 *
 * Optional:
 *   EXPECTED_TOOL_COUNT=53   informational; a mismatch is a warning, because the catalog evolves.
 *   TESBO_API_HEALTH_URL     defaults to <origin>/api/health derived from TESBO_MCP_URL.
 *
 * Exit code is 1 on any failed requirement. The token is never printed, and server error text is
 * redacted before it reaches the output.
 */
import process from "node:process";
import { pathToFileURL } from "node:url";

export const REQUIRED_TOOLS = [
  "list_projects",
  "get_testcase",
  "create_testcase",
  "update_testcase",
  "bulk_create_testcases",
  "list_qa_graph_changes",
  "capture_qa_graph_change",
  "preview_behavior_model_draft"
];

/** Fields a deployment must advertise on the shape clients actually read/write. */
const REQUIRED_FIELDS = [
  { tool: "create_testcase", path: ["properties"], fields: ["attachments", "postconditions"] },
  { tool: "update_testcase", path: ["properties"], fields: ["attachments", "postconditions"] },
  { tool: "bulk_create_testcases", path: ["properties", "testcases", "items", "properties"], fields: ["attachments", "postconditions"] }
];

function shapeAt(schema, path) {
  let current = schema;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = current[key];
  }
  return current && typeof current === "object" ? current : null;
}

export function catalogGaps(tools) {
  if (!Array.isArray(tools)) return { errors: ["tools/list did not return an array"], count: 0 };
  const errors = [];
  const names = [];
  for (const tool of tools) {
    if (!tool || typeof tool !== "object" || typeof tool.name !== "string" || !tool.name) {
      errors.push("tools/list contained an entry without a name");
      continue;
    }
    names.push(tool.name);
  }
  const seen = new Set();
  for (const name of names) {
    if (seen.has(name)) errors.push(`duplicate tool: ${name}`);
    seen.add(name);
  }
  for (const required of REQUIRED_TOOLS) {
    if (!seen.has(required)) errors.push(`missing tool: ${required}`);
  }
  return { errors, count: names.length, names };
}

export function schemaGaps(tools) {
  const errors = [];
  if (!Array.isArray(tools)) return { errors: ["tools/list did not return an array"] };
  const byName = new Map(tools.filter((t) => t && typeof t === "object" && t.name).map((t) => [t.name, t]));
  for (const requirement of REQUIRED_FIELDS) {
    const tool = byName.get(requirement.tool);
    if (!tool) continue; // catalogGaps reports the missing tool; do not double-count.
    const schema = tool.inputSchema;
    const properties = shapeAt(schema, requirement.path);
    if (!properties) {
      errors.push(`${requirement.tool}: expected an input object at ${requirement.path.join(".")}`);
      continue;
    }
    for (const field of requirement.fields) {
      if (!(field in properties)) errors.push(`${requirement.tool}: missing field ${field}`);
    }
  }
  return { errors };
}

export function summarize({ tools, serverVersion, health, expectedGitSha, expectedToolCount }) {
  const errors = [];
  const warnings = [];
  const catalog = catalogGaps(tools);
  const schemas = schemaGaps(tools);
  errors.push(...catalog.errors, ...schemas.errors);

  if (typeof serverVersion !== "string" || !serverVersion) {
    errors.push("initialize did not report serverInfo.version");
  } else if (/\+local\./.test(serverVersion)) {
    warnings.push("server reports an unidentified build (+local); set GIT_SHA or deploy from a GitHub trigger");
  }

  const reportedSha = health && typeof health.gitSha === "string" ? health.gitSha : null;
  if (!reportedSha) {
    errors.push("health endpoint did not report gitSha");
  } else if (expectedGitSha && reportedSha !== expectedGitSha) {
    errors.push(`health gitSha ${reportedSha} does not match expected ${expectedGitSha}`);
  } else if (!expectedGitSha && reportedSha === "local") {
    warnings.push("health reports gitSha=local; the deployed commit is unidentified");
  }

  if (expectedToolCount && catalog.count !== Number(expectedToolCount)) {
    warnings.push(`tool count ${catalog.count} differs from EXPECTED_TOOL_COUNT ${expectedToolCount} (capabilities, not count, are the requirement)`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    toolCount: catalog.count,
    missingTools: catalog.errors.filter((e) => e.startsWith("missing tool:")).map((e) => e.slice("missing tool: ".length)),
    schemaErrors: schemas.errors,
    serverVersion: serverVersion || "",
    reportedSha: reportedSha || ""
  };
}

function redact(value, token) {
  const text = String(value ?? "");
  return token ? text.split(token).join("[redacted]") : text;
}

async function rpc(endpoint, token, body, session) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  if (session) headers["Mcp-Session-Id"] = session;
  const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`MCP endpoint returned HTTP ${response.status}`);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("MCP endpoint did not return JSON");
  }
  if (json?.error) {
    throw new Error(`MCP error ${json.error.code ?? "unknown"}: ${redact(json.error.message, token)}`);
  }
  return { json, session: response.headers.get("mcp-session-id") || undefined };
}

async function main() {
  const endpoint = String(process.env.TESBO_MCP_URL || "").trim();
  const token = String(process.env.TESBO_MCP_TOKEN || "").trim();
  const expectedGitSha = String(process.env.EXPECTED_GIT_SHA || "").trim();
  const expectedToolCount = String(process.env.EXPECTED_TOOL_COUNT || "").trim();
  if (!endpoint || !token) {
    console.error("TESBO_MCP_URL and TESBO_MCP_TOKEN must be set (token is read from the environment only).");
    process.exit(2);
  }

  try {
    const initialized = await rpc(
      endpoint,
      token,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tesbo-deploy-check", version: "1" } }
      },
      undefined
    );
    const listed = await rpc(endpoint, token, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, initialized.session);
    const tools = Array.isArray(listed.json?.result?.tools) ? listed.json.result.tools : null;

    const healthUrl = String(process.env.TESBO_API_HEALTH_URL || "").trim() || `${new URL(endpoint).origin}/api/health`;
    let health = null;
    try {
      const response = await fetch(healthUrl, { headers: { Accept: "application/json" } });
      if (response.ok) health = await response.json();
    } catch {
      health = null;
    }

    const result = summarize({
      tools,
      serverVersion: initialized.json?.result?.serverInfo?.version,
      health,
      expectedGitSha,
      expectedToolCount
    });

    console.log("MCP deploy check");
    console.log(`  endpoint: ${new URL(endpoint).origin}${new URL(endpoint).pathname}`);
    console.log(`  server:   ${result.serverVersion}`);
    console.log(`  tools:    ${result.toolCount}`);
    console.log(`  health:   ${result.reportedSha || "unavailable"}`);
    if (result.missingTools.length) console.log(`  missing:  ${result.missingTools.join(", ")}`);
    for (const warning of result.warnings) console.log(`  warning:  ${warning}`);
    for (const error of result.errors) console.log(`  FAIL:     ${error}`);
    console.log(result.ok ? "OK" : "FAILED");
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(`MCP deploy check failed: ${redact(error instanceof Error ? error.message : error, token)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
