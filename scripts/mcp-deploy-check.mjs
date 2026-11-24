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
 * Usage (the bearer is read only from its approved private file, never argv):
 *
 *   TESBO_MCP_URL="https://host/api/projects/<id>/mcp" \
 *   TESBO_MCP_TOKEN_FILE="<private credential file>" \
 *   EXPECTED_GIT_SHA="<deployed commit>" \
 *   node scripts/mcp-deploy-check.mjs
 *
 * Optional:
 *   EXPECTED_TOOL_COUNT=47   informational; a mismatch is a warning, because grants filter tools.
 *   REQUIRE_PROPOSAL_PREVIEW=1  require the isolated, default-off proposal review capability.
 *   TESBO_PILOT_READ_ONLY=1    sample existing project cases/suites through authorized MCP reads ONLY.
 *   TESBO_API_HEALTH_URL     defaults to <origin>/api/health derived from TESBO_MCP_URL.
 *
 * Exit code is 1 on any failed requirement. The token is never printed, and server error text is
 * redacted before it reaches the output.
 */
import { createHash } from "node:crypto";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { readApprovedMcpCredential, requireApprovedMcpEndpoint } from "./mcp-approved-origin.mjs";

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

export const PROPOSAL_TOOLS = ["stage_testcase_changes", "list_testcase_proposals", "get_testcase_proposal_task",
  "stage_requirement_change_bundle", "get_requirement_proposal_task", "list_requirement_proposals"];

/**
 * Optional read-only external-client pilot of the EXISTING project-scoped native repository.
 * The tool names are fixed here, not taken from a model or server response. Never print cases,
 * suite names, source refs, project IDs, or token-bearing JSON. This is inventory, NOT a Run.
 */
export const NATIVE_PILOT_READ_TOOLS = ["list_testcases", "list_suites"];
export function readOnlyPilotCatalogGaps(tools) {
  if (!Array.isArray(tools)) return ["native pilot tool catalog is unavailable"];
  const names = new Set(tools.map(item => item?.name));
  return NATIVE_PILOT_READ_TOOLS.filter(name => !names.has(name))
    .map(name => "native pilot read permission unavailable: " + name);
}
export function summarizeNativePilotCases(casesResponse, suitesResponse) {
  // Native list_testcases uses {rows, total}, the same paginated owner as REST and the
  // established MCP E2E contract. Do not substitute an imagined array/testcases envelope.
  const cases = casesResponse?.rows;
  const reportedTotal = casesResponse?.total;
  const suites = suitesResponse?.suites;
  if (!Array.isArray(cases) || !Number.isSafeInteger(reportedTotal) || reportedTotal < 0 ||
      !Array.isArray(suites) || cases.length > 25 || suites.length > 2000 ||
      cases.length !== Math.min(reportedTotal, 25) ||
      cases.some(value => !value || typeof value.id !== "string" || !value.id ||
        typeof value.status !== "string") ||
      suites.some(value => !value || typeof value.id !== "string" || !value.id) ||
      new Set(cases.map(value => value.id)).size !== cases.length ||
      new Set(suites.map(value => value.id)).size !== suites.length) {
    throw new Error("Native pilot inventory is incomplete or outside its bounded read contract");
  }
  const statusCounts = { Draft: 0, "In Review": 0, Approved: 0, Deprecated: 0, Archived: 0, Other: 0 };
  for (const item of cases) {
    const key = Object.hasOwn(statusCounts, item.status) ? item.status : "Other";
    statusCounts[key]++;
  }
  return { sampledCases: cases.length, sampleLimit: 25, reportedCaseTotal: reportedTotal,
    suites: suites.length, statusCounts, fullCaseTotalVerified: reportedTotal === cases.length,
    recordMutation: false };
}

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

export function catalogGaps(tools, { requireProposalPreview = false, pilotReadOnly = false } = {}) {
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
  if (pilotReadOnly && requireProposalPreview) errors.push("read-only pilot cannot require write-scoped proposal tools");
  const requiredForMode = pilotReadOnly
    ? NATIVE_PILOT_READ_TOOLS : [...REQUIRED_TOOLS, ...(requireProposalPreview ? PROPOSAL_TOOLS : [])];
  for (const required of requiredForMode) {
    if (!seen.has(required)) errors.push(`missing tool: ${required}`);
  }
  for (const retired of RETIRED_PUBLISHERS) {
    if (seen.has(retired)) errors.push(`direct publication tool must not be advertised: ${retired}`);
  }
  return { errors, count: names.length, names };
}

export function schemaGaps(tools, { pilotReadOnly = false } = {}) {
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
  if (pilotReadOnly) {
    const testcaseSchema = byName.get("list_testcases")?.inputSchema;
    const suiteSchema = byName.get("list_suites")?.inputSchema;
    if (testcaseSchema?.type !== "object" ||
        testcaseSchema.properties?.limit?.type !== "number" ||
        testcaseSchema.properties?.offset?.type !== "number" ||
        testcaseSchema.properties?.includeArchived?.type !== "boolean") {
      errors.push("read-only pilot: list_testcases schema must advertise limit, offset and includeArchived");
    }
    if (suiteSchema?.type !== "object" || !suiteSchema.properties) {
      errors.push("read-only pilot: list_suites schema is unavailable");
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

export function summarize({ tools, instructions, serverVersion, health, expectedGitSha, expectedToolCount, requireProposalPreview = false, pilotReadOnly = false }) {
  const errors = [];
  const warnings = [];
  const catalog = catalogGaps(tools, { requireProposalPreview, pilotReadOnly });
  const schemas = schemaGaps(tools, { pilotReadOnly });
  errors.push(...catalog.errors, ...schemas.errors);

  if (typeof serverVersion !== "string" || !serverVersion) {
    errors.push("initialize did not report serverInfo.version");
  } else if (/\+local\./.test(serverVersion)) {
    warnings.push("server reports an unidentified build (+local); set GIT_SHA or deploy from a GitHub trigger");
  }

  // Both halves are required to verify the catalog. An older or incomplete
  // response is unverifiable and must not produce an OK deployment result.
  const reportedFingerprint = typeof serverVersion === "string"
    ? /\.([a-f0-9]{16})$/.exec(serverVersion)?.[1] ?? null
    : null;
  const computedFingerprint = typeof instructions === "string" ? catalogFingerprint(tools, instructions) : null;
  if (!reportedFingerprint) errors.push("initialize did not report a valid catalog fingerprint");
  if (typeof instructions !== "string") errors.push("initialize did not report instructions required to verify the catalog fingerprint");
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
  const response = await fetch(endpoint, { method: "POST", redirect: "manual", headers, body: JSON.stringify(body) });
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

async function nativeReadOnlyPilot(endpoint, token, session, tools) {
  const gaps = readOnlyPilotCatalogGaps(tools);
  if (gaps.length) throw new Error(gaps.join("; "));
  const parsed = new URL(endpoint);
  // A shared MCP endpoint cannot prove which project an authorized list belongs to.
  if (!/^\/api\/projects\/[^/]+\/mcp\/?$/.test(parsed.pathname)) {
    throw new Error("Native pilot requires the existing project-specific MCP endpoint");
  }
  const invokeRead = async (id, name, args) => {
    try {
      const answer = await rpc(endpoint, token, {
        jsonrpc: "2.0", id, method: "tools/call",
        params: { name, arguments: args }
      }, session);
      const result = answer.json?.result;
      if (result?.isError === true || !Array.isArray(result?.content) ||
          result.content.length !== 1 || result.content[0]?.type !== "text" ||
          typeof result.content[0].text !== "string") throw new Error("Invalid result");
      return JSON.parse(result.content[0].text);
    } catch {
      // Native data and service error text are private; emit a fixed failure.
      throw new Error("Native pilot read refused or unavailable (details withheld)");
    }
  };
  const cases = await invokeRead(3, "list_testcases", { limit: 25, offset: 0, includeArchived: true });
  const suites = await invokeRead(4, "list_suites", {});
  return summarizeNativePilotCases(cases, suites);
}

async function main() {
  const endpoint = String(process.env.TESBO_MCP_URL || "").trim();
  const tokenFile = String(process.env.TESBO_MCP_TOKEN_FILE || "");
  let token = "";
  const expectedGitSha = String(process.env.EXPECTED_GIT_SHA || "").trim();
  const expectedToolCount = String(process.env.EXPECTED_TOOL_COUNT || "").trim();
  const requireProposalPreview = process.env.REQUIRE_PROPOSAL_PREVIEW === "1";
  const nativePilotReadOnly = process.env.TESBO_PILOT_READ_ONLY === "1";
  if (!endpoint || !tokenFile) {
    console.error("TESBO_MCP_URL and TESBO_MCP_TOKEN_FILE must be set; use verify-production-mcp.sh.");
    process.exit(2);
  }
  if (!/^[0-9a-f]{40}$/i.test(expectedGitSha)) {
    console.error("MCP deployment check requires the exact expected 40-character Git commit SHA.");
    process.exit(2);
  }
  let parsedEndpoint;
  try {
    parsedEndpoint = requireApprovedMcpEndpoint(endpoint, tokenFile);
  } catch (error) {
    console.error(`MCP deploy check: ${error instanceof Error ? error.message : "unapproved MCP origin"}`);
    process.exit(2);
  }

  try {
    // The first network request is UNAUTHENTICATED. Never transmit the bearer
    // until a strictly same-origin health read verifies the intended build.
    const healthUrl = String(process.env.TESBO_API_HEALTH_URL || "").trim() ||
      `${parsedEndpoint.origin}/api/health`;
    const parsedHealth = new URL(healthUrl);
    if (parsedHealth.origin !== parsedEndpoint.origin ||
        parsedHealth.pathname !== "/api/health" || parsedHealth.search ||
        parsedHealth.username || parsedHealth.password || parsedHealth.hash) {
      throw new Error("Health endpoint must be the same-origin credential-free /api/health resource");
    }
    const healthResponse = await fetch(healthUrl, {
      redirect: "manual", headers: { Accept: "application/json" }
    });
    if (!healthResponse.ok) throw new Error("Verified deployment health is unavailable");
    const health = await healthResponse.json();
    if (typeof health?.gitSha !== "string" || health.gitSha !== expectedGitSha) {
      throw new Error("Health gitSha does not match the explicitly expected deployment; token not sent");
    }

    // The validated file is the sole credential source. Recheck its origin
    // after the health wait, then read it; an environment bearer cannot replace it.
    token = readApprovedMcpCredential(endpoint, tokenFile).token;

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



    const result = summarize({
      tools,
      instructions: initialized.json?.result?.instructions,
      serverVersion: initialized.json?.result?.serverInfo?.version,
      health,
      expectedGitSha,
      expectedToolCount,
      requireProposalPreview,
      pilotReadOnly: nativePilotReadOnly
    });

    // Response fields, including versions and duplicate tool names, are
    // untrusted and can echo the bearer just like a protocol error message.
    const print = (line) => console.log(redact(line, token));
    print("MCP deploy check");
    print(`  endpoint: ${new URL(endpoint).origin}${new URL(endpoint).pathname}`);
    print(`  server:   ${result.serverVersion}`);
    print(`  tools:    ${result.toolCount}`);
    print(`  catalog:  ${result.catalogFingerprint || "unavailable"} (${result.fingerprintCheck})`);
    print(`  health:   ${result.reportedSha || "unavailable"}`);
    if (result.missingTools.length) print(`  missing:  ${result.missingTools.join(", ")}`);
    for (const warning of result.warnings) print(`  warning:  ${warning}`);
    for (const error of result.errors) print(`  FAIL:     ${error}`);
    if (nativePilotReadOnly) {
      if (!result.ok) throw new Error("Native read-only pilot requires a verified build/catalog");
      const pilot = await nativeReadOnlyPilot(endpoint, token, initialized.session, tools);
      print("  pilot:    " + JSON.stringify(pilot));
      print("  pilot:    sampled authorized records; no official case write, approval or execution");
    }
    print(result.ok ? "OK" : "FAILED");
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error(`MCP deploy check failed: ${redact(error instanceof Error ? error.message : error, token)}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
