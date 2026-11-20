#!/usr/bin/env node
/*
 * Post-deploy MCP verification.
 *
 * The recurring failure this exists for: a deployment can be stale while /health, client discovery
 * and a tool count all look plausible. This checks the things a client actually relies on — the
 * build the server reports, the required tool names and the required field schemas — against a
 * fresh protocol session, not against source or a cached client catalog. It also recomputes the
 * catalog fingerprint from the tools actually returned and compares it with the fingerprint the
 * same server reported at initialize, so a proxy or stale catalog cannot pass on version alone.
 *
 * Usage (token comes from the environment only, never argv):
 *
 *   TESBO_MCP_URL="https://host/api/projects/<id>/mcp" \
 *   TESBO_MCP_TOKEN="<project token>" \
 *   EXPECTED_GIT_SHA="<deployed commit>" \
 *   node scripts/mcp-deploy-check.mjs
 *
 * Optional:
 *   EXPECTED_TOOL_COUNT=47   informational; a mismatch is a warning, because grants filter tools.
 *   REQUIRE_PROPOSAL_PREVIEW=1  require the isolated, default-off proposal review capability.
 *   TESBO_API_HEALTH_URL     defaults to <origin>/api/health derived from TESBO_MCP_URL.
 *
 * Exit code is 1 on any failed requirement. The token is never printed, and server error text is
 * redacted before it reaches the output.
 */
import { createHash } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const REQUIRED_TOOLS = [
  "list_projects",
  "get_testcase",
  "list_qa_graph_changes",
  "capture_qa_graph_change",
  "preview_behavior_model_draft",
  "create_behavior_model",
  "save_behavior_model_revision",
  "link_behavior_model_case",
  "get_behavior_model_coverage",
  "archive_behavior_model",
  "run_behavior_model"
];

export const PROPOSAL_TOOLS = ["stage_testcase_changes", "list_testcase_proposals", "get_testcase_proposal_task"];
const RETIRED_PUBLISHERS = ["create_testcase", "update_testcase", "archive_testcase", "restore_testcase", "duplicate_testcase",
  "bulk_create_testcases", "bulk_update_testcases", "bulk_archive_testcases", "link_requirement_to_testcase", "unlink_requirement_from_testcase", "clone_test_suite", "create_suite", "update_suite"];

/** If proposal preview is exposed, its actual candidate fields must be discoverable. Default-off
 * deployments are valid without these tools; a retired direct publisher is never a substitute. */
const REQUIRED_FIELDS = [
  { tool: "stage_testcase_changes", path: ["properties"], fields: ["requestKey", "operations"] },
  { tool: "stage_testcase_changes", path: ["properties", "operations", "items", "oneOf", "0", "properties", "draft", "properties"], fields: ["attachments", "postconditions", "estimatedDuration", "sourceRefs"] },
  { tool: "stage_testcase_changes", path: ["properties", "operations", "items", "oneOf", "1", "properties"], fields: ["testcaseId", "expectedRevision", "fields"] },
  { tool: "stage_testcase_changes", path: ["properties", "operations", "items", "oneOf", "1", "properties", "fields", "properties"], fields: ["attachments", "postconditions", "estimatedDuration", "sourceRefs"] }
];

/**
 * The same content hash McpService embeds in `serverInfo.version` as its session/tool-set
 * fingerprint. Recomputing it from the tools the server actually returned catches the case a
 * version string alone cannot: a proxy or cached/older catalog answering tools/list while the
 * initialize response still reports a different build's fingerprint.
 */
export function catalogFingerprint(tools, instructions) {
  if (!Array.isArray(tools)) return null;
  const payload = tools.map((tool) => ({
    name: tool?.name,
    description: tool?.description,
    inputSchema: tool?.inputSchema
  }));
  return createHash("sha256")
    .update(JSON.stringify({ tools: payload, instructions }))
    .digest("hex")
    .slice(0, 16);
}

function shapeAt(schema, path) {
  let current = schema;
  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = current[key];
  }
  return current && typeof current === "object" ? current : null;
}

export function catalogGaps(tools, { requireProposalPreview = false } = {}) {
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
  for (const required of [...REQUIRED_TOOLS, ...(requireProposalPreview ? PROPOSAL_TOOLS : [])]) {
    if (!seen.has(required)) errors.push(`missing tool: ${required}`);
  }
  for (const retired of RETIRED_PUBLISHERS) {
    if (seen.has(retired)) errors.push(`direct publication tool must not be advertised: ${retired}`);
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
  const stage = byName.get("stage_testcase_changes")?.inputSchema;
  if (stage) {
    if (!stage.required?.includes("requestKey") || !stage.required?.includes("operations")) errors.push("stage_testcase_changes: requestKey and operations must be required");
    const update = shapeAt(stage, ["properties", "operations", "items", "oneOf", "1"]);
    if (!update?.required?.includes("expectedRevision")) errors.push("stage_testcase_changes: update expectedRevision must be required");
  }
  return { errors };
}

export function summarize({ tools, instructions, serverVersion, health, expectedGitSha, expectedToolCount, requireProposalPreview = false }) {
  const errors = [];
  const warnings = [];
  const catalog = catalogGaps(tools, { requireProposalPreview });
  const schemas = schemaGaps(tools);
  errors.push(...catalog.errors, ...schemas.errors);

  if (typeof serverVersion !== "string" || !serverVersion) {
    errors.push("initialize did not report serverInfo.version");
  } else if (/\+local\./.test(serverVersion)) {
    warnings.push("server reports an unidentified build (+local); set GIT_SHA or deploy from a GitHub trigger");
  }

  // Cross-check the catalog against the version the same server just reported. Only when both
  // halves are available: an older server may omit instructions, and a missing tools/list is
  // already an error above. No extra warning when unavailable, to keep the existing warning set.
  const reportedFingerprint = typeof serverVersion === "string"
    ? /\.([a-f0-9]{16})$/.exec(serverVersion)?.[1] ?? null
    : null;
  const computedFingerprint = typeof instructions === "string" ? catalogFingerprint(tools, instructions) : null;
  if (reportedFingerprint && computedFingerprint && reportedFingerprint !== computedFingerprint) {
    errors.push(
      `tools/list catalog fingerprint ${computedFingerprint} does not match serverInfo.version ${reportedFingerprint}`
    );
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
    reportedSha: reportedSha || "",
    catalogFingerprint: computedFingerprint || "",
    fingerprintCheck: !computedFingerprint || !reportedFingerprint
      ? "unavailable"
      : computedFingerprint === reportedFingerprint ? "matches" : "mismatch"
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
  const requireProposalPreview = process.env.REQUIRE_PROPOSAL_PREVIEW === "1";
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
      instructions: initialized.json?.result?.instructions,
      serverVersion: initialized.json?.result?.serverInfo?.version,
      health,
      expectedGitSha,
      expectedToolCount,
      requireProposalPreview
    });

    console.log("MCP deploy check");
    console.log(`  endpoint: ${new URL(endpoint).origin}${new URL(endpoint).pathname}`);
    console.log(`  server:   ${result.serverVersion}`);
    console.log(`  tools:    ${result.toolCount}`);
    console.log(`  catalog:  ${result.catalogFingerprint || "unavailable"} (${result.fingerprintCheck})`);
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
